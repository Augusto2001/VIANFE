import https from 'https';

async function getFullWsdl() {
  const agent = new https.Agent({ rejectUnauthorized: false, minVersion: 'TLSv1.2' });
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

  console.log('=== FULL WSDL EnvioLoteRps.svc ===');
  console.log(res);
}

getFullWsdl();
