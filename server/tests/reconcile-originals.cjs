const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {xml}=require('./nfse-nacional.cjs');
const file=path.resolve(__dirname,'../scripts/reconcile_original_documents.cjs');
async function check(input,otherCompany=false){
 const logs=[];let writes=0;
 class DatabaseSync{prepare(sql){return{all:()=>sql.includes('FROM companies')?[{id:'fixture',cnpj:'11111111000111'}]:[],get:()=>otherCompany?{id:'other',company_id:'other'}:undefined,run:()=>{writes++;throw Error('dry-run wrote');}};}close(){}}
 const proc={argv:['node',file,'11111111000111','2026','fixture.ndjson','--check'],env:{}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{__dirname:path.dirname(file),Buffer,process:proc,console:{log:x=>logs.push(JSON.parse(x)),error:e=>{throw e;}},require:n=>{
  if(n==='node:fs')return{readFileSync:()=>JSON.stringify({source:'isolated fixture',xml:input}),writeFileSync:()=>{writes++;throw Error('write forbidden');}};
  if(n==='node:sqlite')return{DatabaseSync};
  if(n.startsWith('../dist/'))return require(path.resolve(path.dirname(file),n));
  return require(n);
 }});
 await new Promise(r=>setImmediate(r));assert.equal(writes,0);assert.equal(proc.exitCode,undefined);return logs.at(-1);
}
(async()=>{
 assert.equal((await check(xml)).new,1);
 assert.equal((await check(xml,true)).rejected,1);
 assert.equal((await check(xml.replace('<tpAmb>1</tpAmb>','<tpAmb>2</tpAmb>'))).rejected,1);
 assert.equal((await check(xml.replaceAll('11111111000111','22222222000122'))).rejected,1);
 assert.equal((await check('<resNFe/>')).validated,0);
 assert.equal((await check('<!DOCTYPE a><a/>')).validated,0);
 console.log('PASS: recovery dry-run never writes; wrong company, cross-company key, test environment, summary and DTD rejected.');
})().catch(e=>{console.error(e);process.exitCode=1;});
