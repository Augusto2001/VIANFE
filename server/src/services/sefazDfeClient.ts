import fs from 'fs';
import path from 'path';
import https from 'https';
import zlib from 'zlib';
import { XMLParser } from 'fast-xml-parser';
import { db, CERTS_DIR } from '../database/db.js';
import { decryptText, cleanNumeric } from '../utils/crypto.js';
import { loadPfxWithForge, validatePfxCertificate } from '../utils/pfxLoader.js';

export interface SefazDfeResult {
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  documents: Array<{
    nsu: string;
    schema: string;
    xmlContent: string;
    isSummary: boolean;
    chaveAcesso?: string;
  }>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

export class SefazDfeClient {
  private sefazUrlProducao = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
  private sefazUrlHomologacao = 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
  private relaySubdomain = process.env.SEFAZ_RELAY_URL || 'https://sefaz-relay.contadordev.com.br';
  private relayToken = process.env.SEFAZ_RELAY_TOKEN || 'vianfe_sefaz_relay_token_2026';

  private ufToCode: Record<string, string> = {
    'RO': '11', 'AC': '12', 'AM': '13', 'RR': '14', 'PA': '15', 'AP': '16', 'TO': '17',
    'MA': '21', 'PI': '22', 'CE': '23', 'RN': '24', 'PB': '25', 'PE': '26', 'AL': '27',
    'SE': '28', 'BA': '29', 'MG': '31', 'ES': '32', 'RJ': '33', 'SP': '35', 'PR': '41',
    'SC': '42', 'RS': '43', 'MS': '50', 'MT': '51', 'GO': '52', 'DF': '53'
  };

  private loadCompanyCert(company: any): { certPem: string; keyPem: string; caPems: string[]; subject: string; validTo: string } {
    const certPath = path.join(CERTS_DIR, company.cert_filename);
    if (!fs.existsSync(certPath)) {
      throw new Error(`Arquivo de certificado "${company.cert_filename}" não localizado no servidor.`);
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const passphrase = company.cert_password_enc ? decryptText(company.cert_password_enc) : '';

    // Use node-forge to parse the PFX - supports legacy RC2/3DES from Brazilian ACs
    return loadPfxWithForge(pfxBuffer, passphrase);
  }

  /**
   * Validate that the stored certificate can be opened with its stored password.
   */
  public validateCertificate(companyId: string): {
    valid: boolean; subject?: string; issuer?: string; validFrom?: string; validTo?: string; error?: string;
  } {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) return { valid: false, error: 'Empresa não encontrada.' };
    if (!company.cert_filename) return { valid: false, error: 'Nenhum Certificado Digital A1 cadastrado para esta empresa.' };

    const certPath = path.join(CERTS_DIR, company.cert_filename);
    if (!fs.existsSync(certPath)) {
      return { valid: false, error: `Arquivo de certificado não encontrado no servidor: ${company.cert_filename}` };
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const passphrase = company.cert_password_enc ? decryptText(company.cert_password_enc) : '';

    return validatePfxCertificate(pfxBuffer, passphrase);
  }

  /**
   * Query SEFAZ DFe using the company's real A1 Digital Certificate (.pfx)
   * Supports legacy Brazilian AC certificates using node-forge
   */
  public async queryDistributionDfe(companyId: string): Promise<SefazDfeResult> {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error(`Empresa com ID ${companyId} não encontrada.`);
    }
    if (!company.cert_filename) {
      throw new Error(`A empresa "${company.razao_social}" não possui Certificado Digital A1 (.pfx) cadastrado. Faça o upload na aba "Empresas Clientes".`);
    }

    // Load and validate certificate via node-forge (handles legacy RC2/3DES)
    const certData = this.loadCompanyCert(company);

    const cnpjClean = cleanNumeric(company.cnpj);
    const cUf = this.ufToCode[company.uf.toUpperCase()] || '35';
    const tpAmb = company.sefaz_ambiente === 'homologacao' ? '2' : '1';
    const lastNsuFormatted = String(company.last_nsu || '0').padStart(15, '0');

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUf}</cUFAutor>
          <CNPJ>${cnpjClean}</CNPJ>
          <distNSU>
            <ultNSU>${lastNsuFormatted}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

    const targetUrl = company.sefaz_ambiente === 'homologacao' ? this.sefazUrlHomologacao : this.sefazUrlProducao;
    const urlObj = new URL(targetUrl);

    // Build https.Agent using PEM key+cert extracted by node-forge
    const agent = new https.Agent({
      cert: certData.certPem,
      key: certData.keyPem,
      ca: certData.caPems.length > 0 ? certData.caPems : undefined,
      rejectUnauthorized: false,
    });

    console.log(`[SEFAZ] Consultando NFeDistribuicaoDFe | CNPJ: ${cnpjClean} | Empresa: ${company.razao_social} | Amb: ${tpAmb === '1' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'} | UF: ${company.uf} (cUF: ${cUf}) | ultNSU: ${lastNsuFormatted}`);

    const responseXml = await new Promise<string>((resolve, reject) => {
      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(soapEnvelope),
          'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
        },
        timeout: 60000,
      }, (res) => {
        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          console.log(`[SEFAZ] Resposta HTTP ${res.statusCode} | ${rawData.length} bytes`);
          resolve(rawData);
        });
      });

      req.on('error', (err: any) => {
        const msg = err.message || '';
        if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
          reject(new Error(`Não foi possível conectar ao WebService da SEFAZ. Verifique sua conexão.`));
        } else if (msg.includes('certificate') || msg.includes('SSL') || msg.includes('handshake')) {
          reject(new Error(`Falha na autenticação com a SEFAZ: ${msg}. O certificado pode estar vencido ou revogado.`));
        } else {
          reject(new Error(`Erro na comunicação com a SEFAZ: ${msg}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Tempo limite excedido na SEFAZ (60s). Tente novamente em horário de menor tráfego (Madrugada recomendada).'));
      });

      req.write(soapEnvelope);
      req.end();
    });

    return this.parseSefazResponse(responseXml, companyId);
  }

  private parseSefazResponse(responseXml: string, companyId: string): SefazDfeResult {
    try {
      const parsedSoap = parser.parse(responseXml);

      // Navigate SOAP envelope - handle different namespace prefixes
      let body: any = null;
      for (const key of Object.keys(parsedSoap)) {
        if (key.toLowerCase().includes('envelope')) {
          const envelope = parsedSoap[key];
          for (const bkey of Object.keys(envelope)) {
            if (bkey.toLowerCase().includes('body')) {
              body = envelope[bkey];
              break;
            }
          }
          break;
        }
      }
      if (!body) body = parsedSoap;

      const findRetDist = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.retDistDFeInt) return obj.retDistDFeInt;
        for (const key of Object.keys(obj)) {
          const found = findRetDist(obj[key]);
          if (found) return found;
        }
        return null;
      };
      const retDist = findRetDist(body) || body;

      const cStat = String(retDist.cStat || '0');
      const xMotivo = String(retDist.xMotivo || 'Resposta processada');
      const ultNSU = String(retDist.ultNSU || '0');
      const maxNSU = String(retDist.maxNSU || '0');

      console.log(`[SEFAZ] cStat=${cStat} | xMotivo="${xMotivo}" | ultNSU=${ultNSU} | maxNSU=${maxNSU}`);

      const rawLote = retDist.loteDistDFeInt?.docZip;
      const docZipArray = Array.isArray(rawLote) ? rawLote : (rawLote ? [rawLote] : []);
      const documents: SefazDfeResult['documents'] = [];

      for (const item of docZipArray) {
        try {
          const nsu = String(item['@_NSU'] || '');
          const schema = String(item['@_schema'] || '');
          const base64Data = typeof item === 'string' ? item : (item['#text'] || '');
          if (!base64Data) continue;

          const buffer = Buffer.from(base64Data, 'base64');
          const decompressed = zlib.gunzipSync(buffer).toString('utf-8');
          const isSummary = schema.toLowerCase().includes('resnfe') || schema.toLowerCase().includes('rescte');

          let chaveAcesso = '';
          const matchChave = decompressed.match(/chNFe[=>"']\s*(\d{44})/i) || decompressed.match(/Id[=>"']\s*NFe(\d{44})/i);
          if (matchChave) chaveAcesso = matchChave[1];

          documents.push({ nsu, schema, xmlContent: decompressed, isSummary, chaveAcesso });
          console.log(`[SEFAZ] Doc NSU=${nsu} | schema=${schema} | summary=${isSummary} | chave=${chaveAcesso || 'N/A'}`);
        } catch (decompErr: any) {
          console.warn('[SEFAZ] Erro ao descompactar docZip:', decompErr.message);
        }
      }

      if (ultNSU && ultNSU !== '0') {
        db.prepare('UPDATE companies SET last_nsu = ?, updated_at = ? WHERE id = ?')
          .run(ultNSU, new Date().toISOString(), companyId);
      }

      return { cStat, xMotivo, ultNSU, maxNSU, documents };
    } catch (err: any) {
      console.error('[SEFAZ] Erro ao parsear resposta:', err.message);
      console.error('[SEFAZ] XML (primeiros 500 chars):', responseXml.substring(0, 500));
      throw new Error(`Erro ao interpretar retorno da SEFAZ: ${err.message}`);
    }
  }
}

export const sefazDfeClient = new SefazDfeClient();
