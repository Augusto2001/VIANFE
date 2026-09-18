import { db } from './dist/database/db.js';
import { sefazService } from './dist/services/sefazService.js';

const amsfer = db.prepare('SELECT * FROM companies WHERE cnpj = ?').get('54879195000110');
console.log('Amsfer Record:', amsfer);

const existingInvs = db.prepare('SELECT * FROM invoices WHERE company_id = ?').all(amsfer.id);
console.log('Existing Invoices in DB for Amsfer:', existingInvs);

console.log('\n--- EXECUTING SEFAZ SYNC FOR AMSFER ---');
try {
  const result = await sefazService.syncCompany(amsfer.id, 'manual');
  console.log('Sync Result:', result);
} catch (err) {
  console.error('Sync Error:', err);
}

const updatedInvs = db.prepare('SELECT id, numero, serie, tipo, data_emissao, emitente_nome, destinatario_nome, valor_total, xml_file_path, pdf_file_path, gdrive_synced FROM invoices WHERE company_id = ?').all(amsfer.id);
console.log(`\nUpdated Invoices in DB for Amsfer (Total: ${updatedInvs.length}):`);
console.log(updatedInvs);
