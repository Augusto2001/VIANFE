// Read-only audit of explicitly inventoried local XML paths. No database import.
const fs = require('node:fs/promises');
const { parseFiscalXmlCollection } = require('../dist/services/xmlParser.js');
(async () => {
  const paths = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  let next = 0;
  await Promise.all(Array.from({length: 12}, async () => {
    while (next < paths.length) {
      const source = paths[next++];
      let result;
      try {
        if ((await fs.stat(source)).size > 10 * 1024 * 1024) throw new Error('XML excede 10 MB.');
        const invoices = parseFiscalXmlCollection(await fs.readFile(source, 'utf8'));
        for (const p of invoices) {
        result = {source, status:p.nfseNacional ? 'validated_national' : p.nfseMunicipal ? 'validated_municipal' : 'other_layout',
          key:p.chaveAcesso, number:p.numero, issuer:p.emitente.cnpjCpf, recipient:p.destinatario.cnpjCpf,
          date:p.dataEmissao, total:p.totais.valorTotal, paymentForms:p.pagamentos.length, installments:p.duplicatas.length};
          console.log(JSON.stringify(result));
        }
        continue;
      } catch (error) { result = {source, status:'error', error:error.message}; }
      console.log(JSON.stringify(result));
    }
  }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
