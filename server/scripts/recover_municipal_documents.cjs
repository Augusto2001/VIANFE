// Reads existing originals only. Never calls SEFAZ or emits a note.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {DatabaseSync,backup}=require('node:sqlite');
const {splitMunicipalXml,municipalDocument,originalNfsePdf}=require('../dist/services/nfse/originalDocuments.js');
const [cnpj,period,flag]=process.argv.slice(2);
if(!/^\d{14}$/.test(cnpj||'')||! /^(0[1-9]|1[0-2])\.\d{4}$/.test(period||'')||!['--check','--apply'].includes(flag)){throw new Error('Use CNPJ MM.AAAA --check ou --apply');}
const storage=path.resolve(__dirname,'../storage');
const dir=path.join(storage,'exports/nfse',cnpj,period.slice(3),period);
const input=path.join(dir,`NFSe_CONSOLIDADO_${period}.xml`);
const source=fs.readFileSync(input,'utf8');
const db=new DatabaseSync(path.join(storage,'data/fiscal_hub.db'),{readOnly:flag==='--check'});
(async()=>{
 const companies=db.prepare('SELECT id FROM companies WHERE cnpj=?').all(cnpj);if(companies.length!==1)throw new Error('Empresa ambígua/ausente');
 const companyId=companies[0].id;const entries=[];const seen=new Set();
 for(const xml of splitMunicipalXml(source)){
  const {note}=municipalDocument(xml);const prest=note.PrestadorServico?.IdentificacaoPrestador?.Cnpj;
  if(String(prest)!==cnpj||!/^\d+$/.test(note.Numero))throw new Error('Prestador/número inválido');
  if(seen.has(note.Numero))throw new Error('Número duplicado no consolidado');seen.add(note.Numero);
  const rows=db.prepare("SELECT id,xml_raw,xml_file_path,pdf_file_path FROM invoices WHERE company_id=? AND modelo='NFS-e' AND CAST(numero AS INTEGER)=?").all(companyId,Number(note.Numero));
  if(rows.length!==1)throw new Error('Registro ausente/duplicado: '+note.Numero);
  entries.push({number:note.Numero,xml,row:rows[0],base:`NFSe_${String(note.Numero).padStart(8,'0')}_${period}`});
 }
 if(!entries.length)throw new Error('Nenhum documento completo');
 const hash=crypto.createHash('sha256').update(source).digest('hex');
 if(flag==='--check'){console.log(JSON.stringify({mode:'check',documents:entries.length,sourceSha256:hash}));return;}
 const recoveryRoot=process.env.VIANFE_RECOVERY_DIR;if(!recoveryRoot||!path.isAbsolute(recoveryRoot))throw new Error('Defina VIANFE_RECOVERY_DIR fora da aplicação');
 const recovery=path.resolve(recoveryRoot,`municipal-${cnpj}-${Date.now()}`);if(recovery.startsWith(path.resolve(__dirname,'..')+path.sep))throw new Error('Backup deve ficar fora da aplicação');
 fs.mkdirSync(recovery,{recursive:true,mode:0o700});await backup(db,path.join(recovery,'database.sqlite'));
 fs.copyFileSync(input,path.join(recovery,path.basename(input)));
 for(const e of entries){e.pdf=await originalNfsePdf(e.xml);for(const ext of ['xml','pdf']){const file=path.join(dir,e.base+'.'+ext);if(fs.existsSync(file))fs.copyFileSync(file,path.join(recovery,e.base+'.'+ext));}}
 fs.writeFileSync(path.join(recovery,'manifest.json'),JSON.stringify({sourceSha256:hash,entries:entries.map(({pdf,xml,...e})=>e)},null,2));
 db.exec('BEGIN IMMEDIATE');
 try{for(const e of entries){const xp=path.join(dir,e.base+'.xml'),pp=path.join(dir,e.base+'.pdf');fs.writeFileSync(xp+'.tmp',e.xml);fs.renameSync(xp+'.tmp',xp);fs.writeFileSync(pp+'.tmp',e.pdf);fs.renameSync(pp+'.tmp',pp);db.prepare('UPDATE invoices SET xml_raw=?,xml_file_path=?,pdf_file_path=? WHERE id=? AND company_id=?').run(e.xml,xp,pp,e.row.id,companyId);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 for(const e of entries){const row=db.prepare('SELECT xml_raw,xml_file_path,pdf_file_path FROM invoices WHERE id=?').get(e.row.id);if(row.xml_raw!==e.xml||fs.readFileSync(row.xml_file_path,'utf8')!==e.xml)throw new Error('Verificação falhou');}
 console.log(JSON.stringify({mode:'applied',documents:entries.length,sourceSha256:hash,recovery,transmissions:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.close());
