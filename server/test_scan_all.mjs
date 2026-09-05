import https from 'https';

async function scanMore() {
  const agent = new https.Agent({ rejectUnauthorized: false, minVersion: 'TLSv1.2' });
  const names = [
    'EnvioLoteRps', 'EnvioLoteRPS', 'EnvioRps', 'EnvioLote', 'RecebeLote', 'RecebimentoLoteRps', 'RecebimentoLoteRPS',
    'RecepcionarLoteRps', 'RecepcionarLoteRPS', 'GerarNfse', 'GeracaoNfse', 'EmissaoNfse', 'Emissao',
    'NotaSalvador', 'Service', 'NfseService', 'WSNfse', 'NFSeService', 'RpsService', 'LoteRpsService'
  ];

  for (const name of names) {
    const urls = [
      `https://nfse.sefaz.salvador.ba.gov.br/${name}/${name}.svc?wsdl`,
      `https://nfse.sefaz.salvador.ba.gov.br/${name}.svc?wsdl`,
      `https://nfse.sefaz.salvador.ba.gov.br/${name}.asmx?wsdl`,
      `https://nfse.sefaz.salvador.ba.gov.br/webservices/${name}.asmx?wsdl`,
      `https://nfse.sefaz.salvador.ba.gov.br/OnLine/Modulo/${name}.aspx`
    ];

    for (const u of urls) {
      try {
        const res = await new Promise(resolve => {
          const req = https.request(u, { method: 'GET', agent, timeout: 3000 }, (r) => {
            resolve({ status: r.statusCode });
          });
          req.on('error', e => resolve({ error: e.message }));
          req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
          req.end();
        });
        if (res.status === 200) {
          console.log(`🎯 STATUS 200: ${u}`);
        } else if (res.status !== 404 && res.status !== 500) {
          console.log(`ℹ️ STATUS ${res.status}: ${u}`);
        }
      } catch (_) {}
    }
  }
  console.log('Scan completed.');
}

scanMore();
