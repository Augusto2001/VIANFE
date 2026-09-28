const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {DatabaseSync}=require('node:sqlite'),{spawnSync}=require('child_process');
const {xml,key}=require('./nfse-nacional.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vianfe-manifest-test-')),file=path.join(dir,'test.sqlite');
try {
 const db=new DatabaseSync(file);
 db.exec('CREATE TABLE companies(id TEXT,cnpj TEXT); CREATE TABLE invoices(chave_acesso TEXT,company_id TEXT,tipo TEXT,xml_raw TEXT,xml_file_path TEXT,pdf_file_path TEXT)');
 db.prepare('INSERT INTO companies VALUES (?,?)').run('fixture','11111111000111');
 const input=[{source:'valid.xml',companyCnpj:'11111111000111',xml},
 {source:'wrong-company.xml',companyCnpj:'22222222000122',xml},
 {source:'broken.xml',companyCnpj:'11111111000111',xml:'not xml'}];
 const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/import_saida_manifest.mjs'),'--companies=11111111000111'],{input:input.map(r=>JSON.stringify(r)).join('\n'),encoding:'utf8',env:{...process.env,VIANFE_DB:file}});
 assert.equal(result.status,0,result.stderr);
 const rows=result.stdout.trim().split('\n').map(s=>JSON.parse(s));
 assert.equal(rows[0].status,'validated');assert.equal(rows[0].key,key);
 assert.equal(rows[1].status,'error');assert.equal(rows[2].status,'error');
 assert.equal(db.prepare('SELECT count(*) n FROM invoices').get().n,0);
 db.close();
 console.log('PASS: manifest is read-only by default; exact allowlist and real XML validation enforced.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
