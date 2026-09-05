import { db } from './dist/database/db.js';

const rows = db.prepare('SELECT id, numero_nfse, numero_rps, serie_rps, tomador_nome, valor_servicos, issued_at FROM nfse_issued ORDER BY issued_at DESC').all();
console.log('=== NFS-e Registradas no Banco ===');
console.log(rows);
