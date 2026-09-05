import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { parseFiscalXml } from './dist/services/xmlParser.js';
import { generateDanfePdf } from './dist/services/danfeGenerator.js';

const dbPath = path.resolve('server/storage/data/fiscal_hub.db');
const db = new DatabaseSync(dbPath);

const GDRIVE_ROOT = 'G:\\Meu Drive\\AUTOMATICA\\NFE_APP_PROPRIO_V2';

function sanitizeFolderName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

async function run() {
  console.log(`=== REORGANIZANDO DRIVE LOCAL: ${GDRIVE_ROOT} ===`);

  const companies = db.prepare('SELECT id, cnpj, razao_social, nome_fantasia FROM companies').all();

  for (const company of companies) {
    const companyFolder = sanitizeFolderName(company.nome_fantasia || company.razao_social || company.cnpj);
    const companyPath = path.join(GDRIVE_ROOT, companyFolder);

    if (fs.existsSync(companyPath)) {
      fs.rmSync(companyPath, { recursive: true, force: true });
    }
    fs.mkdirSync(companyPath, { recursive: true });

    const invoices = db.prepare('SELECT id, chave_acesso, numero, serie, data_emissao, xml_raw FROM invoices WHERE company_id = ? AND xml_raw IS NOT NULL').all(company.id);

    console.log(`Empresa: ${companyFolder} (${company.cnpj}) -> ${invoices.length} notas`);

    if (invoices.length === 0) {
      continue;
    }

    for (const inv of invoices) {
      let year = '2026';
      let month = '08';
      try {
        const d = new Date(inv.data_emissao);
        year = String(d.getFullYear());
        month = String(d.getMonth() + 1).padStart(2, '0');
      } catch {}

      const xmlDir = path.join(companyPath, year, month, 'XMLs');
      const pdfDir = path.join(companyPath, year, month, 'PDFs');

      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(pdfDir, { recursive: true });

      const xmlFilePath = path.join(xmlDir, `${inv.chave_acesso}.xml`);
      const pdfFilePath = path.join(pdfDir, `DANFE_${inv.chave_acesso}.pdf`);

      fs.writeFileSync(xmlFilePath, inv.xml_raw, 'utf-8');

      try {
        const parsed = parseFiscalXml(inv.xml_raw);
        await generateDanfePdf(parsed, pdfFilePath);
      } catch (err) {
        console.warn(`Aviso DANFE ${inv.chave_acesso}:`, err.message);
      }
    }
  }

  console.log(`\n✓ TODAS AS PASTAS DO GOOGLE DRIVE FORAM LIMPAS E REORGANIZADAS COM SUCESSO!`);
}

run();
