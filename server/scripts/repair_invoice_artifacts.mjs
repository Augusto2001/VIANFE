// Rebuild only explicitly selected invoices from their stored, complete XML.
// Default is read-only. No SEFAZ calls, emails, or final manifestations.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url);
const {parseFiscalXml}=require('../dist/services/xmlParser.js');
const {syncXmlInstallments}=require('../dist/services/invoiceInstallments.js');
const args=process.argv.slice(2),apply=args.includes('--apply');
const ids=args.filter(a=>!a.startsWith('--'));
if(!ids.length || ids.some(id=>!/^[a-zA-Z0-9_-]+$/.test(id))) throw new Error('Informe IDs explícitos de notas; --apply confirma a gravação.');
const db=new DatabaseSync(process.env.VIANFE_DB || '/app/server/storage/data/fiscal_hub.db',{readOnly:!apply});
db.exec('PRAGMA busy_timeout=8000');
try {
for(const id of ids){
 const invoice=db.prepare('SELECT * FROM invoices WHERE id=?').get(id);
 if(!invoice) throw new Error(`Nota inexistente: ${id}`);
 const parsed=parseFiscalXml(invoice.xml_raw || '');
 if(parsed.chaveAcesso!==invoice.chave_acesso || !parsed.itens.length || !/^\d{15}$/.test(parsed.protocoloAutorizacao||'') || parsed.naturezaOperacao.startsWith('Resumo ')) throw new Error(`XML completo indisponível: ${id}`);
 if(apply){
  const {XMLS_DIR}=require('../dist/database/db.js');
  const {generateDanfePdf}=require('../dist/services/danfeGenerator.js');
  const xmlPath=path.join(XMLS_DIR,`${parsed.chaveAcesso}.xml`);
  fs.writeFileSync(xmlPath,invoice.xml_raw,'utf8');
  const pdfPath=await generateDanfePdf(parsed);
  syncXmlInstallments(db,id,invoice.company_id,invoice.tipo,parsed);
  db.prepare('UPDATE invoices SET xml_file_path=?,pdf_file_path=? WHERE id=?').run(xmlPath,pdfPath,id);
 }
 console.log(JSON.stringify({invoiceId:id,numero:parsed.numero,items:parsed.itens.length,duplicates:parsed.duplicatas.length,applied:apply}));
}
} finally {db.close();}
