import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { CERTS_DIR, db } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';

const comps = db.prepare('SELECT id, cnpj, razao_social, cert_filename, cert_password_enc FROM companies WHERE cert_filename IS NOT NULL').all();

console.log('=== Inspecting Certificates ===');
for (const c of comps) {
  const p = path.join(CERTS_DIR, c.cert_filename);
  if (!fs.existsSync(p)) {
    console.log(`❌ File missing for ${c.razao_social}`);
    continue;
  }
  try {
    const password = decryptText(c.cert_password_enc);
    const pfxBuffer = fs.readFileSync(p);
    const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxBuffer.toString('binary')), password);
    let certSubject = '';
    for (const sc of pfx.safeContents) {
      for (const sb of sc.safeBags) {
        if (sb.cert) {
          certSubject = sb.cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
        }
      }
    }
    console.log(`✅ ${c.razao_social} (${c.cnpj}) -> Subject: ${certSubject}`);
  } catch (err) {
    console.log(`⚠️ Error reading ${c.razao_social}:`, err.message);
  }
}
