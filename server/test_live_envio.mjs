import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';
import { SalvadorNfseAdapter } from './dist/services/nfse/adapters/SalvadorNfseAdapter.js';

async function testLiveEnvioToSalvador() {
  console.log('🚀 [ViaNFe] Disparando Lote RPS para https://nfse.salvador.ba.gov.br/rps/ENVIOLOTERPS/EnvioLoteRps.svc...');

  const comp = db.prepare("SELECT * FROM companies WHERE cnpj = '11156091000175'").get();
  const certPath = `${CERTS_DIR}/${comp.cert_filename}`;
  const password = decryptText(comp.cert_password_enc);
  const pfxBuffer = fs.readFileSync(certPath);
  const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxBuffer.toString('binary')), password);

  let certPem = '', keyPem = '';
  for (const sc of pfx.safeContents) {
    for (const sb of sc.safeBags) {
      if (sb.cert) certPem += forge.pki.certificateToPem(sb.cert);
      if (sb.key) keyPem = forge.pki.privateKeyToPem(sb.key);
    }
  }

  const agent = new https.Agent({
    cert: certPem,
    key: keyPem,
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  });

  const adapter = new SalvadorNfseAdapter();
  const certInfo = {
    certPem,
    keyPem,
    certBase64: forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(pfx.safeContents[0].safeBags[0].cert)).getBytes()),
    subject: '',
    validUntil: new Date()
  };

  const payload = {
    company: comp,
    numeroRps: '359',
    serieRps: '1',
    tipoRps: '1',
    optanteSimplesNacional: '2',
    incentivadorCultural: '2',
    naturezaOperacao: '1',
    tomadorCnpjCpf: '34.581.300/0001-23',
    tomadorNome: 'SALVADOR ESCRITORIO VIRTUAL LTDA',
    valorServicos: 10.00,
    aliquotaIss: 5.00,
    valorIss: 0.50,
    issRetido: false,
    itemServico: '17.01',
    cnae: '6920601',
    codigoTributacaoMunicipio: '17.01',
    codigoMunicipio: '2927408',
    discriminacao: 'Prestação de serviços contábeis e administrativos - Emissão de teste e validação de sistema ViaNFe.'
  };

  const { signedXml } = adapter.buildSignedXml(payload, certInfo);

  // Testa as 2 SOAPActions padrão de Salvador:
  const actions = [
    'http://tempuri.org/IEnvioLoteRPS/EnviarLoteRps',
    'http://tempuri.org/IEnvioLoteRPS/RecepcionarLoteRps',
    'http://tempuri.org/IEnvioLoteRPS/EnviarLoteRpsSincrono'
  ];

  for (const action of actions) {
    const opName = action.split('/').pop();
    const soapEnvelope = `
      <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
        <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
          <${opName} xmlns="http://tempuri.org/">
            <loteXML><![CDATA[${signedXml}]]></loteXML>
          </${opName}>
        </s:Body>
      </s:Envelope>
    `.trim();

    console.log(`\n📡 Testando SOAPAction: ${action}...`);
    try {
      const res = await new Promise(resolve => {
        const req = https.request('https://nfse.salvador.ba.gov.br/rps/ENVIOLOTERPS/EnvioLoteRps.svc', {
          method: 'POST',
          agent,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': action
          }
        }, (r) => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve({ status: r.statusCode, data: d }));
        });
        req.on('error', e => resolve({ error: e.message }));
        req.write(soapEnvelope);
        req.end();
      });

      console.log(`HTTP Status: ${res.status}`);
      console.log(`SOAP Response:\n`, res.data);
    } catch (err) {
      console.error('Erro na requisição:', err.message);
    }
  }
}

testLiveEnvioToSalvador().catch(console.error);
