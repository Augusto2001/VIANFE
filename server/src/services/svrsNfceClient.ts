import fs from 'fs';
import path from 'path';
import https from 'https';
import querystring from 'querystring';
import { db, CERTS_DIR } from '../database/db.js';
import { decryptText } from '../utils/crypto.js';
import { loadPfxWithForge } from '../utils/pfxLoader.js';

export interface SvrsDownloadResult {
  success: boolean;
  chaveAcesso: string;
  xmlContent?: string;
  error?: string;
  protocolo?: string;
  cStat?: string;
}

/**
 * Função pura para interpretar o retorno HTML / JSON retornado pelo portal SVRS
 */
export function parseSvrsResponse(rawHtml: string, chaveAcesso: string): SvrsDownloadResult {
  const idxStart = rawHtml.indexOf('var stringJson =');
  if (idxStart !== -1) {
    try {
      const sub = rawHtml.substring(idxStart);
      const endLine = sub.indexOf(';\r\n') !== -1 ? sub.indexOf(';\r\n') : sub.indexOf(';\n');
      const line = (endLine !== -1 ? sub.substring(0, endLine) : sub)
        .replace('var stringJson =', '')
        .trim();

      let jsonParsed: any;
      try {
        jsonParsed = JSON.parse(line);
      } catch {
        // Fallback para avaliação de objeto literal JS caso não seja JSON estrito
        const fn = new Function(`return (${line});`);
        jsonParsed = fn();
      }

      const xmlContent = jsonParsed?.xml;
      if (!xmlContent || typeof xmlContent !== 'string') {
        return {
          success: false,
          chaveAcesso,
          error: 'Portal SVRS não retornou o corpo do XML no payload stringJson.'
        };
      }

      const protMatch = xmlContent.match(/<nProt>([^<]+)<\/nProt>/);
      const cStatMatch = xmlContent.match(/<cStat>([^<]+)<\/cStat>/);

      return {
        success: true,
        chaveAcesso,
        xmlContent,
        protocolo: protMatch ? protMatch[1] : undefined,
        cStat: cStatMatch ? cStatMatch[1] : '100'
      };
    } catch (err: any) {
      return {
        success: false,
        chaveAcesso,
        error: `Falha ao interpretar XML retornado pela SVRS: ${err.message}`
      };
    }
  }

  // Verificar mensagem de erro apresentada pelo portal do governo
  const erroMatch = rawHtml.match(/<h4 class="textoErro">([^<]+)<\/h4>/i);
  const msgErro = erroMatch
    ? erroMatch[1].trim()
    : 'Documento não localizado ou certificado não autorizado para este CNPJ.';

  return {
    success: false,
    chaveAcesso,
    error: msgErro
  };
}

export class SvrsNfceClient {
  private portalUrl = 'https://dfe-portal.svrs.rs.gov.br/NfceSSL/DownloadXmlDfe';

  /**
   * Carrega e valida o Certificado Digital A1 da empresa usando node-forge (compatível com ACs brasileiras)
   */
  private loadCompanyCert(company: any): { certPem: string; keyPem: string; caPems: string[]; subject: string } {
    const certPath = path.join(CERTS_DIR, company.cert_filename);
    if (!fs.existsSync(certPath)) {
      throw new Error(`Arquivo de certificado "${company.cert_filename}" não localizado no servidor.`);
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const passphrase = company.cert_password_enc ? decryptText(company.cert_password_enc) : '';
    return loadPfxWithForge(pfxBuffer, passphrase);
  }

  /**
   * Baixa o XML oficial de uma NFC-e (modelo 65) diretamente da SEFAZ Virtual do RS (SVRS)
   */
  public async downloadNfceXml(companyId: string, chaveAcesso: string): Promise<SvrsDownloadResult> {
    const chaveClean = chaveAcesso.replace(/\D/g, '');
    if (chaveClean.length !== 44) {
      return {
        success: false,
        chaveAcesso,
        error: `Chave de acesso inválida (${chaveClean.length} dígitos; esperado 44).`
      };
    }

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error(`Empresa com ID ${companyId} não encontrada no ViaNFe.`);
    }
    if (!company.cert_filename) {
      throw new Error(`A empresa "${company.razao_social}" não possui Certificado Digital A1 cadastrado.`);
    }

    const certData = this.loadCompanyCert(company);
    const agent = new https.Agent({
      cert: certData.certPem,
      key: certData.keyPem,
      ca: certData.caPems.length > 0 ? certData.caPems : undefined,
      rejectUnauthorized: false
    });

    const postPayload = querystring.stringify({
      sistema: 'Nfce',
      OrigemSite: '0',
      Ambiente: company.sefaz_ambiente === 'homologacao' ? '2' : '1',
      ChaveAcessoDfe: chaveClean
    });

    const urlObj = new URL(this.portalUrl);

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postPayload),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ViaNFe/2026.1'
        },
        timeout: 30000
      }, (res) => {
        let rawHtml = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { rawHtml += chunk; });
        res.on('end', () => {
          resolve(parseSvrsResponse(rawHtml, chaveClean));
        });
      });

      req.on('error', (err: any) => {
        reject(new Error(`Erro de conexão com SVRS RS: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Tempo limite excedido na SVRS RS (30s).'));
      });

      req.write(postPayload);
      req.end();
    });
  }
}

export const svrsNfceClient = new SvrsNfceClient();
