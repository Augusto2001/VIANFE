import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';

async function scanMoreWithCert() {
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

  const svcs = [
    'CancelaNfse', 'CancelarNfse', 'CancelamentoNfse',
    'RecepcionarLoteRpsSincrono', 'RecepcionarLoteRps', 'RecebimentoLote',
    'EnvioLote', 'EnvioRps', 'GerarNfse', 'EmissaoNfse', 'LoteRps'
  ];

  for (const s of svcs) {
    for (const prefix of ['', 'ws/', 'webservices/', 'servicos/']) {
      const url = `https://nfse.sefaz.salvador.ba.gov.br/${prefix}${s}/${s}.svc?wsdl`;
      try {
        const res = await new Promise(resolve => {
          const req = https.request(url, { method: 'GET', agent, timeout: 3000 }, (r) => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => resolve({ status: r.statusCode, data: d }));
          });
          req.on('error', e => resolve({ error: e.message }));
          req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
          req.end();
        });
        if (res.status === 200) {
          console.log(`🎯 STATUS 200: ${url}`);
        } else if (res.status !== 404) {
          console.log(`ℹ️ STATUS ${res.status}: ${url}`);
        }
      } catch (_) {}
    }
  }
}

scanMoreWithCert();
