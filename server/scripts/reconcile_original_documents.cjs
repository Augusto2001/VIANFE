// Administrative recovery from original NDJSON. No SEFAZ calls or fiscal events sent.
// Usage: node scripts/reconcile_original_documents.cjs CNPJ YYYY input.ndjson --check|--apply
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync,backup}=require('node:sqlite');
const {XMLParser,XMLValidator}=require('fast-xml-parser');
const {parseFiscalXml}=require('../dist/services/xmlParser.js');
const {splitMunicipalXml,municipalDocument,originalNfsePdf}=require('../dist/services/nfse/originalDocuments.js');
const [cnpj,year,input,mode]=process.argv.slice(2);
if(!/^\d{14}$/.test(cnpj||'')||!/^20\d{2}$/.test(year||'')||!input||!['--check','--apply'].includes(mode))throw Error('Use CNPJ YYYY input.ndjson --check|--apply');
const storage=path.resolve(__dirname,'../storage');
const db=new DatabaseSync(path.join(storage,'data/fiscal_hub.db'),{readOnly:mode==='--check'});
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false});
const emit=x=>console.log(JSON.stringify(x));
(async()=>{
 const companies=db.prepare('SELECT * FROM companies').all().filter(c=>c.cnpj.replace(/\D/g,'')===cnpj);
 if(companies.length!==1)throw Error('Empresa ausente ou ambígua');
 const company=companies[0],entries=[],rejected=[],seen=new Set();
 for(const line of fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean)){
  let record;
  try {
   record=JSON.parse(line);
   if(typeof record.xml!=='string'||Buffer.byteLength(record.xml)>10e6||/<!DOCTYPE|<!ENTITY/i.test(record.xml)||XMLValidator.validate(record.xml)!==true)throw Error('XML inválido');
   const tree=parser.parse(record.xml);
   if(tree.procEventoNFe){
    const e=tree.procEventoNFe.evento?.infEvento,r=tree.procEventoNFe.retEvento?.infEvento;
    if(!e||!r||e.tpEvento!=='110111'||r.tpEvento!=='110111'||!['135','155'].includes(r.cStat)||e.chNFe!==r.chNFe||e.nSeqEvento!==r.nSeqEvento||e.tpAmb!=='1'||r.tpAmb!=='1'||!/^\d{15}$/.test(r.nProt||'')||e.CNPJ!==cnpj)throw Error('Cancelamento sem retorno aceito e correlacionado');
    const old=db.prepare('SELECT * FROM invoices WHERE company_id=? AND chave_acesso=?').get(company.id,e.chNFe);
    if(!old||!old.data_emissao.startsWith(year+'-'))throw Error('Cancelamento fora do escopo');
    if(!seen.has('event:'+e.chNFe)){entries.push({kind:'cancel',old,key:e.chNFe,number:old.numero,xml:record.xml,source:record.source,protocol:r.nProt});seen.add('event:'+e.chNFe);}
    continue;
   }
   const parts=splitMunicipalXml(record.xml);
   for(const xml of parts.length?parts:[record.xml]){
    try {
     const p=parseFiscalXml(xml);
     if(!p.dataEmissao.startsWith(year+'-')||![p.emitente.cnpjCpf,p.destinatario.cnpjCpf].includes(cnpj)||p.naturezaOperacao.startsWith('Resumo '))throw Error('Documento incompleto ou fora da empresa/ano');
     if(p.nfseMunicipal)municipalDocument(xml);
     else if(!p.nfseNacional){
      const t=parser.parse(xml),prot=t.nfeProc?.protNFe?.infProt;
      if(p.modelo!=='55'||!p.itens.length||!prot||prot.chNFe!==p.chaveAcesso||!['100','150'].includes(prot.cStat)||prot.tpAmb!=='1'||!/^\d{15}$/.test(prot.nProt||''))throw Error('NF-e sem protocolo de autorização válido');
     }
     const identity=p.modelo==='NFS-e'?`${p.modelo}:${p.emitente.cnpjCpf}:${p.numero}:${year}`:p.chaveAcesso;
     if(seen.has(identity))continue;
     const keyRow=db.prepare('SELECT * FROM invoices WHERE chave_acesso=?').get(p.chaveAcesso);
     if(keyRow&&keyRow.company_id!==company.id)throw Error('Chave já pertence a outra empresa; importação bloqueada para não mover dados');
     const matches=p.modelo==='NFS-e'?db.prepare("SELECT * FROM invoices WHERE company_id=? AND modelo='NFS-e' AND emitente_cnpj=? AND CAST(numero AS INTEGER)=? AND data_emissao LIKE ?").all(company.id,p.emitente.cnpjCpf,Number(p.numero),year+'-%'):keyRow?[keyRow]:[];
     if(matches.length>1)throw Error('Identidade duplicada no sistema');
     const old=matches[0],direction=p.emitente.cnpjCpf===cnpj&&p.tipoOperacao!=='0'?'saida':'entrada';
     if(old&&(old.tipo!==direction||old.data_emissao.slice(0,10)!==p.dataEmissao.slice(0,10)))throw Error('Data ou direção diverge do cadastro');
     if(old&&p.modelo!=='NFS-e'&&old.xml_raw!==xml)throw Error('NF-e existente diferente; exige conferência individual');
     entries.push({kind:'invoice',old,key:p.chaveAcesso,number:p.numero,p,xml,source:record.source,direction});seen.add(identity);
    }catch(error){rejected.push({source:record.source,error:error.message});}
   }
  }catch(error){rejected.push({source:record?.source,error:error.message});}
 }
 for(const r of rejected)emit({status:'rejected',...r});
 emit({mode,validated:entries.length,new:entries.filter(e=>e.kind==='invoice'&&!e.old).length,existing:entries.filter(e=>e.kind==='invoice'&&e.old).length,cancellations:entries.filter(e=>e.kind==='cancel').length,rejected:rejected.length});
 if(mode==='--check')return;
 const root=process.env.VIANFE_RECOVERY_DIR;
 if(!root||!path.isAbsolute(root)||path.resolve(root).startsWith(path.resolve(__dirname,'../..')+path.sep))throw Error('Defina backup externo à aplicação');
 const recovery=path.join(root,`originals-${cnpj}-${Date.now()}`);fs.mkdirSync(recovery,{recursive:true,mode:0o700});
 await backup(db,path.join(recovery,'database.sqlite'));
 fs.copyFileSync(input,path.join(recovery,'input.ndjson'));
 for(const e of entries){
  if(e.old)for(const field of ['xml_file_path','pdf_file_path'])if(e.old[field]&&fs.existsSync(e.old[field]))fs.copyFileSync(e.old[field],path.join(recovery,e.old.id+'-'+field));
  if(e.kind==='invoice'&&e.p.modelo==='NFS-e')e.pdf=await originalNfsePdf(e.xml);
 }
 fs.writeFileSync(path.join(recovery,'manifest.json'),JSON.stringify({inputSha256:digest(fs.readFileSync(input)),entries:entries.map(({pdf,p,xml,...e})=>({...e,xmlSha256:digest(xml)}))},null,2));
 const {sefazService}=require('../dist/services/sefazService.js');
 for(const e of entries){
  if(e.kind==='cancel'){
   const folder=path.join(storage,'events',cnpj,year);fs.mkdirSync(folder,{recursive:true});
   const file=path.join(folder,`${e.key}-110111-${e.protocol}.xml`);
   if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==e.xml)throw Error('Evento original existente diferente');
   fs.writeFileSync(file,e.xml);
   db.prepare('UPDATE invoices SET status=?,gdrive_synced=0 WHERE id=? AND company_id=?').run('cancelada',e.old.id,company.id);
   emit({status:'cancelled_from_original_event',number:e.number,key:e.key,protocol:e.protocol});continue;
  }
  let id=e.old?.id;
  if(e.old&&e.p.modelo==='NFS-e'){
   const dir=path.join(storage,'recovered-originals',cnpj,year,e.p.dataEmissao.slice(5,7),e.direction);fs.mkdirSync(dir,{recursive:true});
   const xp=path.join(dir,e.old.id+'.xml'),pp=path.join(dir,e.old.id+'.pdf');
   for(const file of [xp,pp])if(fs.existsSync(file))fs.copyFileSync(file,path.join(recovery,path.basename(file)));
   fs.writeFileSync(xp,e.xml);fs.writeFileSync(pp,e.pdf);
   db.prepare('UPDATE invoices SET xml_raw=?,xml_file_path=?,pdf_file_path=?,valor_total=?,valor_produtos=?,valor_pis=?,valor_cofins=?,gdrive_synced=0 WHERE id=? AND company_id=?').run(e.xml,xp,pp,e.p.totais.valorTotal,e.p.totais.valorProdutos,e.p.totais.valorPis,e.p.totais.valorCofins,id,company.id);
  }else if(!e.old){id=(await sefazService.ingestXml(company.id,e.xml,'upload')).invoiceId;}
  const saved=db.prepare('SELECT * FROM invoices WHERE id=? AND company_id=?').get(id,company.id);
  if(!saved||saved.xml_raw!==e.xml||fs.readFileSync(saved.xml_file_path,'utf8')!==e.xml||!saved.pdf_file_path||!fs.existsSync(saved.pdf_file_path)||fs.readFileSync(saved.pdf_file_path).subarray(0,5).toString()!=='%PDF-')throw Error('Verificação falhou para '+e.number);
  emit({status:e.old?'repaired':'imported',number:e.number,model:e.p.modelo,direction:e.direction,key:saved.chave_acesso,id});
 }
 emit({status:'complete',recovery,documents:entries.length,rejected:rejected.length,transmissions:0});
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
