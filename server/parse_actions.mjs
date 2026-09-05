import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';

async function parseWsdlActions() {
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

  const res = await new Promise(resolve => {
    const req = https.request('https://nfse.salvador.ba.gov.br/rps/ENVIOLOTERPS/EnvioLoteRps.svc?wsdl', {
      method: 'GET',
      agent
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    });
    req.end();
  });

  console.log('=== PARSED WSDL ACTIONS ===');
  const matches = res.match(/soapAction="([^"]+)"/g);
  console.log('Found soapActions:', matches);

  const ops = res.match(/<wsdl:operation name="([^"]+)"/g);
  console.log('Found operations:', ops);

  const ports = res.match(/<wsdl:portType name="([^"]+)"/g);
  console.log('Found portTypes:', ports);
}

parseWsdlActions();
