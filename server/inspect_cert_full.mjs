import fs from 'fs';
import forge from 'node-forge';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';

function inspectCertSubject() {
  const comp = db.prepare("SELECT * FROM companies WHERE cnpj = '11156091000175'").get();
  const certPath = `${CERTS_DIR}/${comp.cert_filename}`;
  const password = decryptText(comp.cert_password_enc);
  const pfxBuffer = fs.readFileSync(certPath);
  const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxBuffer.toString('binary')), password);

  const cert = pfx.safeContents[0].safeBags[0].cert;
  console.log('=== CERTIFICATE SUBJECT ATTRIBUTES ===');
  for (const attr of cert.subject.attributes) {
    console.log(`${attr.name} (${attr.type}): ${attr.value}`);
  }

  console.log('=== CERTIFICATE EXTENSIONS ===');
  for (const ext of cert.extensions) {
    console.log(`${ext.name}:`, ext);
  }
}

inspectCertSubject();
