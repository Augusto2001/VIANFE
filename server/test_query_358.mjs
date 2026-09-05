import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';

async function testQueryNfse358() {
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

  const agent = new https.Agent({ cert: certPem, key: keyPem, minVersion: 'TLSv1.2', rejectUnauthorized: false });

  const prestadorCnpj = comp.cnpj.replace(/\D/g, '');
  const prestadorIm = (comp.inscricao_municipal || '').replace(/\D/g, '');

  const consultaXml = `
    <ConsultarNfseEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
      <Prestador>
        <Cnpj>${prestadorCnpj}</Cnpj>
        <InscricaoMunicipal>${prestadorIm}</InscricaoMunicipal>
      </Prestador>
      <NumeroNfse>358</NumeroNfse>
    </ConsultarNfseEnvio>
  `.trim();

  const soapEnvelope = `
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <ConsultarNfse xmlns="http://tempuri.org/">
          <consultaxml><![CDATA[${consultaXml}]]></consultaxml>
        </ConsultarNfse>
      </s:Body>
    </s:Envelope>
  `.trim();

  console.log('📡 Consultando NFS-e 358 na SEFAZ Salvador...');
  const res = await new Promise(resolve => {
    const req = https.request('https://nfse.sefaz.salvador.ba.gov.br/ConsultaNfse/ConsultaNfse.svc', {
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IConsultaNfse/ConsultarNfse'
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(soapEnvelope);
    req.end();
  });

  console.log(`HTTP Status: ${res.status}`);
  console.log(`SOAP Response:\n`, res.data);
}

testQueryNfse358();
