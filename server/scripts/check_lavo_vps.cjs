const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/server/storage/data/fiscal_hub.db');
const rows = db.prepare("SELECT numero, valor_total, data_emissao FROM invoices WHERE emitente_cnpj = '60248404000120' ORDER BY data_emissao").all();
console.log('NOTAS LAVO NA VPS:', rows.length);
rows.forEach(r => console.log('Nota:', r.numero, '| Valor: R$', r.valor_total, '| Data:', r.data_emissao));
