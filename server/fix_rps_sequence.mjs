import { db } from './dist/database/db.js';

// 1. Apaga registros de teste com RPS > 358
db.prepare("DELETE FROM nfse_issued WHERE company_id = (SELECT id FROM companies WHERE cnpj = '11156091000175') AND CAST(numero_rps AS INTEGER) > 358").run();

// 2. Trava o último RPS emitido oficialmente na prefeitura em 358
db.prepare("UPDATE companies SET ultimo_rps_numero = 358 WHERE cnpj = '11156091000175'").run();

const comp = db.prepare("SELECT id, razao_social, cnpj, ultimo_rps_numero FROM companies WHERE cnpj = '11156091000175'").get();
console.log('✅ Viacont ajustada com sucesso:');
console.log(comp);
console.log(`➡️ O PRÓXIMO RPS A SER GERADO É ESTRITAMENTE: ${comp.ultimo_rps_numero + 1} (Nº 359)`);
