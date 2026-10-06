// Repair a legacy consolidated row using only its original municipal XML.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {DatabaseSync,backup}=require('node:sqlite');
const {splitMunicipalXml,municipalDocument,originalNfsePdf}=require('../dist/services/nfse/originalDocuments.js');
const {parseFiscalXml}=require('../dist/services/xmlParser.js');
function plan(source,cnpj){
 const seen=new Set();const entries=splitMunicipalXml(source).map(xml=>{
  municipalDocument(xml);const p=parseFiscalXml(xml);
  if(p.emitente.cnpjCpf!==cnpj.replace(/\D/g,'')||!/^\d+$/.test(p.numero)||p.numero==='0')throw Error('Prestador ou número incompatível');
  if(seen.has(p.chaveAcesso))throw Error('Nota duplicada no consolidado');seen.add(p.chaveAcesso);
  return {xml,p};
 });
 if(entries.length<2)throw Error('Não é um consolidado pendente');return entries;
}
async function main(){
 const [id,flag]=process.argv.slice(2);if(!id||!['--check','--apply'].includes(flag))throw Error('Use invoice-id --check|--apply');
 const storage=path.resolve(__dirname,'../storage');
 const ro=new DatabaseSync(path.join(storage,'data/fiscal_hub.db'),{readOnly:true});
 const row=ro.prepare('SELECT * FROM invoices WHERE id=?').get(id);if(!row||row.numero!=='0'||row.modelo!=='NFS-e')throw Error('Registro não é o consolidado legado de número zero');
 const c=ro.prepare('SELECT cnpj,razao_social FROM companies WHERE id=?').get(row.company_id);
 const entries=plan(row.xml_raw,c.cnpj);
 for(const e of entries){if(ro.prepare("SELECT id FROM invoices WHERE chave_acesso=? OR (company_id=? AND modelo='NFS-e' AND numero=?)").get(e.p.chaveAcesso,row.company_id,e.p.numero))throw Error('Nota já cadastrada: '+e.p.numero);}
 // Do not repurpose a record linked to payments, reconciliations or events.
 for(const t of ro.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()){
  const quote=s=>'"'+s.replace(/"/g,'""')+'"';
  const cols=ro.prepare('PRAGMA table_info('+quote(t.name)+')').all();
  for(const col of cols.filter(x=>x.name==='invoice_id'))if(ro.prepare('SELECT 1 FROM '+quote(t.name)+' WHERE '+quote(col.name)+'=? LIMIT 1').get(id))throw Error('Registro tem vínculo em '+t.name);
 }
 const hash=crypto.createHash('sha256').update(row.xml_raw).digest('hex');
 if(flag==='--check'){console.log(JSON.stringify({documents:entries.length,sourceSha256:hash,direction:'saida',duplicates:0}));ro.close();return;}
 const root=process.env.VIANFE_RECOVERY_DIR;
 if(!root||!path.isAbsolute(root)||path.resolve(root).startsWith(path.resolve(__dirname,'..')+path.sep))throw Error('Backup externo obrigatório');
 const recovery=path.join(root,'municipal-batch-'+id+'-'+Date.now());fs.mkdirSync(recovery,{recursive:true,mode:0o700});
 await backup(ro,path.join(recovery,'database.sqlite'));fs.writeFileSync(path.join(recovery,'original.xml'),row.xml_raw);fs.writeFileSync(path.join(recovery,'record.json'),JSON.stringify(row));ro.close();
 const {getInvoiceStoragePaths}=require('../dist/utils/driveFolderMatcher.js');
 for(const e of entries){
  const paths=getInvoiceStoragePaths(c.razao_social,e.p.dataEmissao,e.p.chaveAcesso,storage,c.cnpj,'saida');
  if(fs.existsSync(paths.xmlFilePath)||fs.existsSync(paths.pdfFilePath))throw Error('Arquivo de destino já existe; conferir antes de sobrescrever');
  e.pdf=await originalNfsePdf(e.xml);
 }
 const {db}=require('../dist/database/db.js');const {sefazService}=require('../dist/services/sefazService.js');const saved=[];
 db.exec('BEGIN IMMEDIATE');
 try{
  if(db.prepare('SELECT xml_raw FROM invoices WHERE id=?').get(id)?.xml_raw!==row.xml_raw)throw Error('Registro mudou durante preparação');
  for(const e of entries)if(db.prepare('SELECT id FROM invoices WHERE chave_acesso=?').get(e.p.chaveAcesso))throw Error('Nota criada durante preparação');
  db.prepare('UPDATE invoices SET chave_acesso=? WHERE id=?').run(entries[0].p.chaveAcesso,id);
  for(const e of entries){const result=await sefazService.ingestXml(row.company_id,e.xml,'upload');const r=db.prepare('SELECT * FROM invoices WHERE id=?').get(result.invoiceId);
   if(r.company_id!==row.company_id||r.tipo!=='saida'||r.xml_raw!==e.xml)throw Error('Persistência incompatível');
   fs.writeFileSync(r.pdf_file_path,e.pdf);db.prepare('UPDATE invoices SET gdrive_synced=0,gdrive_file_id=NULL,gdrive_synced_at=NULL WHERE id=?').run(r.id);
   if(fs.readFileSync(r.xml_file_path,'utf8')!==e.xml||fs.readFileSync(r.pdf_file_path).subarray(0,5).toString()!=='%PDF-')throw Error('Arquivos não conferem');
   saved.push({id:r.id,numero:r.numero,xml:r.xml_file_path,pdf:r.pdf_file_path});
  }
  fs.writeFileSync(path.join(recovery,'manifest.json'),JSON.stringify({sourceSha256:hash,saved},null,2));db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
 console.log(JSON.stringify({documents:saved.length,recovery,transmissions:0,sourceSha256:hash}));
}
module.exports={plan};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
