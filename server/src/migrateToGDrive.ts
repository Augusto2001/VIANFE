import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { getInvoiceStoragePaths, G_DRIVE_BASE_PATH } from './utils/driveFolderMatcher.js';

const DB_PATH = 'C:/app_xml_antigravity/server/storage/data/fiscal_hub.db';
const STORAGE_DIR = 'C:/app_xml_antigravity/server/storage';

const db = new DatabaseSync(DB_PATH);

const invoices = db.prepare(`
  SELECT i.id, i.chave_acesso, i.data_emissao, i.xml_file_path, i.pdf_file_path,
         c.razao_social, c.cnpj
  FROM invoices i
  JOIN companies c ON i.company_id = c.id
`).all() as any[];

console.log(`🚀 Migrating ${invoices.length} invoices to G: Drive path: ${G_DRIVE_BASE_PATH}...`);

let count = 0;
for (const inv of invoices) {
  const { xmlFilePath, pdfFilePath } = getInvoiceStoragePaths(
    inv.razao_social,
    inv.data_emissao,
    inv.chave_acesso,
    STORAGE_DIR,
    inv.cnpj
  );

  // Read current XML
  let xmlContent: string | null = null;
  if (inv.xml_file_path && fs.existsSync(inv.xml_file_path)) {
    xmlContent = fs.readFileSync(inv.xml_file_path, 'utf-8');
  }

  if (xmlContent) {
    fs.mkdirSync(path.dirname(xmlFilePath), { recursive: true });
    fs.writeFileSync(xmlFilePath, xmlContent, 'utf-8');
  }

  // Copy PDF if exists
  if (inv.pdf_file_path && fs.existsSync(inv.pdf_file_path)) {
    fs.mkdirSync(path.dirname(pdfFilePath), { recursive: true });
    fs.copyFileSync(inv.pdf_file_path, pdfFilePath);
  }

  // Update DB record
  db.prepare('UPDATE invoices SET xml_file_path = ?, pdf_file_path = ?, gdrive_synced = 1 WHERE id = ?')
    .run(xmlFilePath, pdfFilePath, inv.id);

  console.log(`✅ [${inv.razao_social.substring(0, 25)}] -> ${xmlFilePath}`);
  count++;
}

console.log(`\n🎉 Migrated ${count} invoices directly into G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS!`);
