import https from 'https';
import fs from 'fs';
import path from 'path';
import { officialNfse } from '../emissionSafety.js';
import forge from 'node-forge';
// @ts-ignore
import { SignedXml } from 'xml-crypto';
import { INfseAdapter, NfseEmissionPayload, NfseEmissionResponse, NfseConsultationPayload } from '../INfseAdapter.js';
import { CERTS_DIR } from '../../../database/db.js';
import { decryptText, cleanNumeric } from '../../../utils/crypto.js';

export interface CertificateInfo {
  certPem: string;
  keyPem: string;
  fullChainPem: string;
  leafCertBase64: string;
  subject: string;
  validUntil: Date;
}

export class SalvadorNfseAdapter implements INfseAdapter {
  readonly nomePrefeitura = 'Salvador';
  readonly codigoIbge = '2927408';
  readonly versaoSchema = '2.03';

  // URLs oficiais da SEFAZ Salvador
  private getWsUrl(ambiente: 'producao' | 'homologacao' = 'producao'): string {
    return ambiente === 'homologacao' 
      ? 'https://notahml.salvador.ba.gov.br'
      : 'https://nfse.salvador.ba.gov.br';
  }

  /**
   * Cria o agente HTTPS com TLSv1.2 e Certificado A1 do Prestador
   */
  private createHttpsAgent(certInfo: CertificateInfo): https.Agent {
    return new https.Agent({
      cert: certInfo.fullChainPem || certInfo.certPem,
      key: certInfo.keyPem,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      rejectUnauthorized: true
    });
  }

  /**
   * Obtém as credenciais do certificado A1 da empresa e extrai a folha pública e chave privada
   */
  private getCertInfo(company: any): CertificateInfo {
    if (!company.cert_filename) {
      throw new Error('Certificado Digital A1 não configurado para a empresa.');
    }
    const certPath = path.join(CERTS_DIR, company.cert_filename);
    if (!fs.existsSync(certPath)) {
      throw new Error(`Arquivo de certificado não encontrado: ${company.cert_filename}`);
    }
    if (!company.cert_password_enc) {
      throw new Error('Senha do certificado não informada.');
    }
    const password = decryptText(company.cert_password_enc);
    const pfxBuffer = fs.readFileSync(certPath);

    const pfxDer = pfxBuffer.toString('binary');
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

    let leafCert: any = null;
    let keyPem = '';
    let fullChainPem = '';
    let certPem = '';
    let subject = '';
    let validUntil = new Date();

    const companyCnpjClean = cleanNumeric(company.cnpj || '');

    for (const sc of pfx.safeContents) {
      for (const sb of sc.safeBags) {
        if (sb.cert) {
          const pem = forge.pki.certificateToPem(sb.cert);
          fullChainPem += pem;
          const subjStr = sb.cert.subject.attributes.map((a: any) => `${a.shortName || a.name}=${a.value}`).join(' ');
          if (subjStr.replace(/\D/g, '').includes(companyCnpjClean)) {
            leafCert = sb.cert;
            certPem = pem;
            subject = subjStr;
            validUntil = sb.cert.validity.notAfter;
          }
        }
        if (sb.key) {
          keyPem = forge.pki.privateKeyToPem(sb.key);
        }
      }
    }

    if (!keyPem || !leafCert) {
      throw new Error('Chave privada ou certificado público não encontrados no arquivo .pfx');
    }

    if (validUntil.getTime() < Date.now() || leafCert.validity.notBefore.getTime() > Date.now()) throw new Error('Certificado fora da validade.');
    const leafCertBase64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(leafCert)).getBytes());

    return { certPem, keyPem, fullChainPem, leafCertBase64, subject, validUntil };
  }

  /**
   * Constrói e assina o XML do Lote RPS no padrão oficial da Prefeitura de Salvador (XSD Nota Salvador)
   * Utiliza canonicalização C14N e assinatura digital dupla (InfRps e LoteRps) via xml-crypto
   */
  public buildSignedXml(payload: NfseEmissionPayload, certInfo: CertificateInfo): { signedXml: string; rpsId: string; loteId: string } {
    const prestadorCnpj = cleanNumeric(payload.company.cnpj || '');
    let prestadorIm = cleanNumeric(payload.company.inscricao_municipal || '');


    const cleanTomadorDoc = cleanNumeric(payload.tomadorCnpjCpf || '');
    const isCpf = cleanTomadorDoc.length === 11;
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const dataEmissao = payload.dataEmissaoRps || nowIso;

    const valorServicos = Number(payload.valorServicos || 0);
    const aliquotaNum = Number(payload.aliquotaIss ?? 0);
    const valorIss = Number(payload.valorIss || (valorServicos * aliquotaNum) / 100).toFixed(2);

    const rpsId = `RPS_${payload.numeroRps}`;
    const loteId = `LOTE_${payload.numeroRps}`;
    const serieRps = payload.serieRps || '1';

    // Item de serviço formatado para Salvador (apenas dígitos, ex: 1719, 1701)
    const rawItem = (payload.itemServico || payload.company.item_servico_padrao || '').trim();
    const itemListaDigitos = rawItem.replace(/\D/g, '') || '';
    const cnae = cleanNumeric(payload.cnae || payload.company.cnae_padrao || '');
    const codTribMunicipio = (payload.codigoTributacaoMunicipio || payload.company.codigo_tributacao_municipio || '').replace(/\D/g, '');

    const discriminacao = (payload.discriminacao || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const tomadorNome = (payload.tomadorNome || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const xmlBase = `<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd"><LoteRps id="${loteId}"><NumeroLote>${payload.numeroRps}</NumeroLote><Cnpj>${prestadorCnpj}</Cnpj><InscricaoMunicipal>${prestadorIm}</InscricaoMunicipal><QuantidadeRps>1</QuantidadeRps><ListaRps><Rps><InfRps id="${rpsId}"><IdentificacaoRps><Numero>${payload.numeroRps}</Numero><Serie>${serieRps}</Serie><Tipo>${payload.tipoRps || '1'}</Tipo></IdentificacaoRps><DataEmissao>${dataEmissao}</DataEmissao><NaturezaOperacao>${payload.naturezaOperacao || '1'}</NaturezaOperacao><OptanteSimplesNacional>${payload.optanteSimplesNacional || '1'}</OptanteSimplesNacional><IncentivadorCultural>${payload.incentivadorCultural || '2'}</IncentivadorCultural><Status>1</Status><Servico><Valores><ValorServicos>${valorServicos.toFixed(2)}</ValorServicos><ValorDeducoes>0.00</ValorDeducoes><ValorPis>0.00</ValorPis><ValorCofins>0.00</ValorCofins><ValorInss>0.00</ValorInss><ValorIr>0.00</ValorIr><ValorCsll>0.00</ValorCsll><IssRetido>${payload.issRetido ? '1' : '2'}</IssRetido><ValorIss>${valorIss}</ValorIss><OutrasRetencoes>0.00</OutrasRetencoes><BaseCalculo>${valorServicos.toFixed(2)}</BaseCalculo><Aliquota>${(aliquotaNum / 100).toFixed(4)}</Aliquota><ValorLiquidoNfse>${valorServicos.toFixed(2)}</ValorLiquidoNfse><DescontoIncondicionado>0.00</DescontoIncondicionado><DescontoCondicionado>0.00</DescontoCondicionado></Valores><ItemListaServico>${itemListaDigitos}</ItemListaServico><CodigoCnae>${cnae}</CodigoCnae><CodigoTributacaoMunicipio>${codTribMunicipio}</CodigoTributacaoMunicipio><Discriminacao>${discriminacao}</Discriminacao><CodigoMunicipio>2927408</CodigoMunicipio><cClassTrib></cClassTrib><INDOP></INDOP></Servico><Prestador><Cnpj>${prestadorCnpj}</Cnpj><InscricaoMunicipal>${prestadorIm}</InscricaoMunicipal></Prestador><Tomador><IdentificacaoTomador><CpfCnpj>${isCpf ? `<Cpf>${cleanTomadorDoc}</Cpf>` : `<Cnpj>${cleanTomadorDoc}</Cnpj>`}</CpfCnpj></IdentificacaoTomador><RazaoSocial>${tomadorNome}</RazaoSocial></Tomador></InfRps></Rps></ListaRps></LoteRps></EnviarLoteRpsEnvio>`;

    // 1. Assinatura do InfRps
    const sigRps = new SignedXml();
    sigRps.privateKey = certInfo.keyPem;
    sigRps.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
    sigRps.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
    sigRps.getKeyInfoContent = () => `<X509Data><X509Certificate>${certInfo.leafCertBase64}</X509Certificate></X509Data>`;
    sigRps.addReference({
      xpath: `//*[local-name(.)='InfRps' and @id='${rpsId}']`,
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
    });
    sigRps.computeSignature(xmlBase, {
      location: { reference: `//*[local-name(.)='InfRps' and @id='${rpsId}']`, action: 'after' }
    });

    const xmlComRpsAssinado = sigRps.getSignedXml();

    // 2. Assinatura do LoteRps
    const sigLote = new SignedXml();
    sigLote.privateKey = certInfo.keyPem;
    sigLote.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
    sigLote.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
    sigLote.getKeyInfoContent = () => `<X509Data><X509Certificate>${certInfo.leafCertBase64}</X509Certificate></X509Data>`;
    sigLote.addReference({
      xpath: `//*[local-name(.)='LoteRps' and @id='${loteId}']`,
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
    });
    sigLote.computeSignature(xmlComRpsAssinado, {
      location: { reference: `//*[local-name(.)='LoteRps' and @id='${loteId}']`, action: 'after' }
    });

    const xmlFinalAssinado = sigLote.getSignedXml();
    return { signedXml: xmlFinalAssinado, rpsId, loteId };
  }

  /**
   * Executa a emissão oficial para a Prefeitura de Salvador via WebService SOAP com Certificado Digital A1
   */
  async emitir(payload: NfseEmissionPayload): Promise<NfseEmissionResponse> {
    const ambiente = payload.ambiente || payload.company.sefaz_ambiente || 'producao';
    const certInfo = this.getCertInfo(payload.company);
    const { signedXml } = this.buildSignedXml(payload, certInfo);

    const wsUrl = this.getWsUrl(ambiente);
    const agent = this.createHttpsAgent(certInfo);

    const soapEnvelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><EnviarLoteRPS xmlns="http://tempuri.org/"><loteXML><![CDATA[${signedXml}]]></loteXML></EnviarLoteRPS></s:Body></s:Envelope>`;

    console.log(`📡 [Prefeitura Salvador - ${ambiente.toUpperCase()}] Transmitindo Lote RPS Nº ${payload.numeroRps} via WebService Direto A1...`);

    const responseText = await new Promise<string>((resolve, reject) => {
      const req = https.request(`${wsUrl}/rps/ENVIOLOTERPS/EnvioLoteRps.svc`, {
        method: 'POST',
        agent,
        timeout: 30000,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://tempuri.org/IEnvioLoteRPS/EnviarLoteRPS',
          'Content-Length': Buffer.byteLength(soapEnvelope)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de comunicação na emissão com SEFAZ Salvador (>30s)'));
      });
      req.write(soapEnvelope);
      req.end();
    });

    console.log('📡 [Prefeitura Salvador] Resposta recebida:', responseText.substring(0, 300));

    // Verificação de erro/rejeição
    const msgMatch = responseText.match(/<Mensagem>([\s\S]*?)<\/Mensagem>/i);
    const faultMatch = responseText.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
    const protocoloMatch = responseText.match(/<Protocolo>(\d+)<\/Protocolo>/i) ||
                           responseText.match(/<NumeroProtocolo>(\d+)<\/NumeroProtocolo>/i);
    const protocolo = protocoloMatch ? protocoloMatch[1] : undefined;

    if (!protocolo && (msgMatch || faultMatch)) {
      const correcaoMatch = responseText.match(/<Correcao>([\s\S]*?)<\/Correcao>/i);
      const erroMsg = msgMatch ? msgMatch[1] : faultMatch![1];
      const correcao = correcaoMatch ? ` Correção: ${correcaoMatch[1]}` : '';
      throw new Error(`SEFAZ Salvador: ${erroMsg.trim()}${correcao}`);
    }

    let document: {numeroNfse?:string;codigoVerificacao?:string;xml?:string}|null=null;
    try { document=await this.consultarNfsePorRps(payload.company,payload.numeroRps,payload.serieRps,certInfo); } catch (_) { /* Ambiguous transmission stays pending; never retry emission. */ }
    return {
      success:true,status:document?.numeroNfse ? 'autorizada':'processando',
      numeroNfse:document?.numeroNfse,codigoVerificacao:document?.codigoVerificacao,
      numeroRps:payload.numeroRps,serieRps:payload.serieRps || '1',protocolo,
      dataEmissao:new Date().toISOString(),
      mensagem:document?.numeroNfse ? 'NFS-e autorizada com XML oficial.' : 'RPS enviado; autorização ainda não confirmada. Não retransmitir.',
      xmlEnviado:signedXml,xmlRetorno:document?.xml || responseText
    };
  }

  /**
   * Consulta a NFS-e autorizada a partir dos dados do RPS emitido
   */
  async consultarNfsePorRps(company: any, numeroRps: string, serieRps: string = '1', certInfo?: CertificateInfo): Promise<{ numeroNfse?: string; codigoVerificacao?: string; xml?: string } | null> {
    const cert = certInfo || this.getCertInfo(company);
    const agent = this.createHttpsAgent(cert);
    const wsUrl = this.getWsUrl(company.sefaz_ambiente);

    const prestadorCnpj = cleanNumeric(company.cnpj || '');
    let prestadorIm = cleanNumeric(company.inscricao_municipal || '');


    const xml = `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd"><IdentificacaoRps><Numero>${numeroRps}</Numero><Serie>${serieRps}</Serie><Tipo>1</Tipo></IdentificacaoRps><Prestador><Cnpj>${prestadorCnpj}</Cnpj><InscricaoMunicipal>${prestadorIm}</InscricaoMunicipal></Prestador></ConsultarNfseRpsEnvio>`;
    const soap = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ConsultarNfsePorRps xmlns="http://tempuri.org/"><consultaxml><![CDATA[${xml}]]></consultaxml></ConsultarNfsePorRps></s:Body></s:Envelope>`;

    const resXml = await new Promise<string>((resolve, reject) => {
      const req = https.request(`${wsUrl}/rps/CONSULTANFSEPORRPS/ConsultaNfsePorRps.svc`, {
        method: 'POST',
        agent,
        timeout: 15000,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://tempuri.org/IConsultaNfsePorRps/ConsultarNfsePorRps',
          'Content-Length': Buffer.byteLength(soap)
        }
      }, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve(d));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout consultar RPS')); });
      req.write(soap);
      req.end();
    });

    try {
      const note=officialNfse(resXml,{cnpj:prestadorCnpj});
      return {numeroNfse:note.numero,codigoVerificacao:note.codigo,xml:resXml};
    } catch (_) { return null; }
  }

  async consultarLoteRps(payload: NfseConsultationPayload): Promise<NfseEmissionResponse> {
    const cert = this.getCertInfo(payload.company);
    const agent = this.createHttpsAgent(cert);
    const wsUrl = this.getWsUrl(payload.company.sefaz_ambiente);
    const prestadorCnpj = cleanNumeric(payload.company.cnpj || '');
    let prestadorIm = cleanNumeric(payload.company.inscricao_municipal || '');


    const consultaLoteXml = `
      <ConsultarLoteRpsEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
        <Prestador>
          <Cnpj>${prestadorCnpj}</Cnpj>
          <InscricaoMunicipal>${prestadorIm}</InscricaoMunicipal>
        </Prestador>
        <Protocolo>${payload.protocolo || '1'}</Protocolo>
      </ConsultarLoteRpsEnvio>
    `.trim();

    const soapEnvelope = `
      <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
        <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
          <ConsultarLoteRPS xmlns="http://tempuri.org/">
            <consultaxml><![CDATA[${consultaLoteXml}]]></consultaxml>
          </ConsultarLoteRPS>
        </s:Body>
      </s:Envelope>
    `.trim();

    const delays = [3000, 6000, 12000];
    let lastResponse: any = null;

    for (let i = 0; i < delays.length; i++) {
      console.log(`🤖 [SEFAZ Salvador] Polling tentativa ${i + 1}/${delays.length} em ConsultarLoteRPS...`);

      lastResponse = await new Promise((resolve, reject) => {
        const req = https.request(`${wsUrl}/rps/CONSULTALOTERPS/ConsultaLoteRps.svc`, {
          method: 'POST',
          agent,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://tempuri.org/IConsultaLoteRPS/ConsultarLoteRps',
            'Content-Length': Buffer.byteLength(soapEnvelope)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ statusCode: res.statusCode, rawXml: data }));
        });
        req.on('error', reject);
        req.write(soapEnvelope);
        req.end();
      });

      if (lastResponse.rawXml && !lastResponse.rawXml.includes('A10')) {
        break;
      }

      if (i < delays.length - 1) {
        await new Promise(r => setTimeout(r, delays[i]));
      }
    }

    return {
      success: true,
      status: 'processando',
      numeroRps: payload.numeroRps || '1',
      serieRps: payload.serieRps || '1',
      dataEmissao: new Date().toISOString(),
      mensagem: 'Consulta de Lote RPS realizada com sucesso junto à SEFAZ Salvador.',
      xmlRetorno: lastResponse?.rawXml
    };
  }
}
