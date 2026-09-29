// Original XMLs only. Read-only validation unless --apply is explicit.
import {createRequire} from 'node:module';
import {createInterface} from 'node:readline';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {parseFiscalXml}=require('../dist/services/xmlParser.js');
const {XMLParser}=require('fast-xml-parser');
const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false});
const db=new DatabaseSync(process.env.VIANFE_DB||'/app/server/storage/data/fiscal_hub.db',{readOnly:true});
const apply=process.argv.includes('--apply');
let counts={};
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
 let r={};
 try{
  r=JSON.parse(line);
  if(typeof r.xml!=='string'||Buffer.byteLength(r.xml)>10*1024*1024)throw Error('XML ausente ou excede 10 MB');
  const p=parseFiscalXml(r.xml),raw=parser.parse(r.xml),prot=raw.nfeProc?.protNFe?.infProt;
  const row=db.prepare('SELECT * FROM invoices WHERE id=? AND company_id=? AND chave_acesso=?').get(r.id,r.company_id,r.chave_acesso);
  const c=db.prepare('SELECT cnpj FROM companies WHERE id=?').get(r.company_id);
  if(!row||row.tipo!=='entrada'||p.modelo!=='55'||p.chaveAcesso!==row.chave_acesso||!p.itens.length||!/^\d{15}$/.test(p.protocoloAutorizacao||'')||prot?.chNFe!==p.chaveAcesso||prot?.cStat!=='100'||p.destinatario.cnpjCpf!==c?.cnpj.replace(/\D/g,''))throw Error('XML original não corresponde à entrada autorizada');
  if(row.xml_raw&&!/<(?:\w+:)?resNFe[\s/>]/.test(row.xml_raw)){console.log(JSON.stringify({id:r.id,status:'already_complete'}));continue;}
  if(apply){
   const {sefazService}=require('../dist/services/sefazService.js');
   await sefazService.ingestXml(row.company_id,r.xml,'upload');
   const saved=db.prepare('SELECT * FROM invoices WHERE id=?').get(row.id);
   if(saved.xml_raw!==r.xml||!saved.xml_file_path||fs.readFileSync(saved.xml_file_path,'utf8')!==r.xml||!saved.pdf_file_path||fs.readFileSync(saved.pdf_file_path).subarray(0,5).toString()!=='%PDF-')throw Error('Persistência XML/PDF não validada');
  }
  const status=apply?'recovered':'validated';counts[status]=(counts[status]||0)+1;console.log(JSON.stringify({id:r.id,number:p.numero,status}));
 }catch(e){counts.error=(counts.error||0)+1;console.log(JSON.stringify({id:r.id,status:'error',error:e.message}));}
}
db.close();console.log(JSON.stringify({summary:counts,apply}));
