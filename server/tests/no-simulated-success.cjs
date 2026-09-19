const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function load(file,stub){const exports={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),{exports,require:n=>{if(n in stub)return stub[n];throw Error('Unexpected dependency '+n)},console});return exports;}
(async()=>{
 let writes=0;const db={prepare:()=>{writes++;throw Error('No database write allowed')}};
 const c=load('controllers/manifestacaoController.js',{'../database/db.js':{db}}).manifestacaoController;
 let code,body;const res={status:n=>(code=n,res),json:x=>(body=x,res)};await c.submitManifestation({body:{invoice_id:'test',event_type:'confirmacao'}},res);assert.equal(code,503);assert.equal(body.success,false);assert.equal(writes,0);
 const quietDb={prepare:()=>({get:()=>undefined})};const g=load('services/googleDriveService.js',{'fs':{existsSync:()=>true,createReadStream:()=>({})},'path':{},'googleapis':{google:{}},'../database/db.js':{db:quietDb}}).googleDriveService;
 assert.equal(g.getStatus().mode,'not_configured');await assert.rejects(()=>g.listFolders());await assert.rejects(()=>g.ensureCompanyFolderStructure('real','Empresa','2026','09','XMLs'));await assert.rejects(()=>g.uploadFile('x','x.xml','real','application/xml'));
 g.isConfigured=true;g.driveClient={files:{create:async()=>({data:{}})}};await assert.rejects(()=>g.uploadFile('x','x.xml','real','application/xml'),/ID/);
 g.driveClient={files:{create:async()=>({data:{id:'real-id'}})}};assert.equal((await g.uploadFile('x','x.xml','real','application/xml')).fileId,'real-id');await assert.rejects(()=>g.uploadFile('x','x.xml','virtual_bad','application/xml'));
 console.log('PASS: manifestação sem gravação simulada; Drive sem credencial, ID ausente, pasta virtual e upload confirmado.');
})().catch(e=>{console.error(e);process.exitCode=1});
