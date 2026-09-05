import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';

async function scanEnvioEndpoints() {
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

  const endpoints = [
    'https://nfse.sefaz.salvador.ba.gov.br/EnvioLoteRPS/EnvioLoteRPS.svc',
    'https://nfse.sefaz.salvador.ba.gov.br/EnvioLoteRps/EnvioLoteRps.svc',
    'https://nfse.sefaz.salvador.ba.gov.br/envioloterps/envioloterps.svc',
    'https://nfse.sefaz.salvador.ba.gov.br/EnvioLoteRps/EnvioLoteRps.svc?wsdl',
    'https://nfse.sefaz.salvador.ba.gov.br/EnvioLoteRPS/EnvioLoteRPS.svc?wsdl',
    'https://nfse.sefaz.salvador.ba.gov.br/RecebeLoteRps/RecebeLoteRps.svc?wsdl',
    'https://nfse.sefaz.salvador.ba.gov.br/RecepcionarLoteRps/RecepcionarLoteRps.svc?wsdl',
    'https://nfse.sefaz.salvador.ba.gov.br/LoteRps/LoteRps.svc?wsdl',
    'https://nfse.sefaz.salvador.ba.gov.br/Nfse/Nfse.svc?wsdl',
    'https://nfse.sefaz.salvador.ba.gov.br/WSNFSE/WSNFSE.svc?wsdl',
    'https://nfse.sefaz.salvador.ba.gov.br/RecebeLoteRPS/RecebeLoteRPS.asmx?wsdl',
    'https://nfse.sefaz.salvador.ba.gov.br/EnvioLoteRPS/EnvioLoteRPS.asmx?wsdl'
  ];

  console.log('Scanning Salvador SEFAZ endpoints...');
  for (const url of endpoints) {
    try {
      const res = await new Promise(resolve => {
        const req = https.request(url, { method: 'GET', agent, timeout: 5000 }, (r) => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve({ status: r.statusCode, data: d }));
        });
        req.on('error', e => resolve({ error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
        req.end();
      });
      console.log(`URL: ${url} -> Status: ${res.status || res.error}`);
      if (res.status === 200) {
        console.log('🎯 FOUND ACTIVE ENDPOINT:', url);
        console.log('Data snippet:', res.data.substring(0, 300));
      }
    } catch (e) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

scanEnvioEndpoints();
