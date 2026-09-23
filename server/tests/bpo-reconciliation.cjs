// All fixtures are in-memory; this test never imports the production DB module.
const assert = require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE companies(id TEXT,tenant_id TEXT); CREATE TABLE user_companies(user_id TEXT,company_id TEXT);
CREATE TABLE financial_categories(id TEXT PRIMARY KEY,tenant_id TEXT,codigo TEXT,nome TEXT,tipo TEXT,conta_debito_dominio TEXT,conta_credito_dominio TEXT,created_at TEXT);
CREATE TABLE invoices(id TEXT,company_id TEXT,numero TEXT,emitente_nome TEXT,destinatario_nome TEXT,chave_acesso TEXT,valor_total REAL);
CREATE TABLE bank_transactions(id TEXT,company_id TEXT,conciliado INTEGER,tipo TEXT,valor REAL,data TEXT,created_at TEXT,categoria_id TEXT,invoice_id TEXT,descricao_original TEXT);
CREATE TABLE dominio_chart_of_accounts(id TEXT,company_id TEXT,codigo_conta TEXT,classificacao TEXT,nome_conta TEXT,tipo_conta TEXT,natureza TEXT,created_at TEXT);
INSERT INTO companies VALUES ('a','one'),('b','two');`);
const insert=db.prepare("INSERT INTO bank_transactions VALUES (?, 'a', ?, 'CREDITO', 1, '2026-09-23', '', NULL, NULL, 'fixture')");
for(let n=0;n<978;n++)insert.run(String(n),n<29?1:0);
const dependencies={'../database/db.js':{db},'uuid':{v4:require('node:crypto').randomUUID},'../services/ofxParser.js':{},'pdf-parse':{},'../services/predictiveAlertsService.js':{},'../services/openFinanceService.js':{},'../services/bpoValidation.js':require('../dist/services/bpoValidation.js')};
const exported={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/controllers/bpoController.js'),'utf8'),{exports:exported,require:key=>{assert.ok(key in dependencies,key);return dependencies[key]},console});
const ctl=exported.bpoController;
const user={id:'admin-one',tenant_id:'one',role:'admin'};
async function call(method,{query={},body={},params={},identity=user}={}){let result,code=200;const res={status:n=>{code=n;return res},json:x=>{result=x},setHeader:()=>{},send:x=>{result=x}};await ctl[method]({query,body,params,user:identity},res);return {code,result};}
(async()=>{
  for(const [status,count] of [['pending',949],['reconciled',29],['all',978]]) {
    const {result}=await call('getTransactions',{query:{company_id:'a',status}});
    assert.equal(result.data.length,count);assert.equal(result.summary.totalCount,978);
    assert.equal(result.summary.reconciledCount,29);assert.equal(result.summary.pendingCount,949);assert.equal(result.summary.reconciledPercent,3);
  }
  assert.equal((await call('getTransactions',{query:{company_id:'b'}})).code,403);
  const empty=await call('getTransactions',{query:{company_id:'b'},identity:{...user,tenant_id:'two'}});assert.equal(empty.result.summary.reconciledPercent,0);
  const body={company_id:'a',nome:'Empréstimo recebido',tipo:'emprestimo'};
  const created=await call('createCategory',{body});assert.equal(created.code,201);assert.equal(created.result.data.tenant_id,'one');assert.equal(created.result.data.conta_debito_dominio,null);
  assert.equal((await call('createCategory',{body})).result.data.id,created.result.data.id);
  assert.equal((await call('createCategory',{body:{...body,company_id:'b'}})).code,403);
  assert.equal((await call('createCategory',{body:{...body,nome:'%PDF-1.4'}})).code,400);
  assert.equal((await call('getCategories',{identity:{...user,tenant_id:'two'}})).result.data.length,0);
  assert.equal((await call('reconcileTransaction',{params:{id:'30'},body:{categoria_id:'chart-id'}})).code,400);
  assert.equal((await call('exportDominioBatches',{query:{company_id:'a'}})).code,400);
  db.prepare("INSERT INTO dominio_chart_of_accounts VALUES ('old','a','10','1.1','Caixa','analitica','D','')").run();
  for(const raw_content of ['%PDF-1.4\nstream\nabc','texto sem contas','1;1.1;Nome\ufffd']){
    assert.equal((await call('importChartOfAccounts',{body:{company_id:'a',replace_existing:true,raw_content}})).code,400);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM dominio_chart_of_accounts').get().n,1);
  }
  const valid=await call('importChartOfAccounts',{body:{company_id:'a',replace_existing:true,raw_content:'20;1.1.02;Bancos;D'}});
  assert.equal(valid.result.count,1);assert.equal(db.prepare('SELECT codigo_conta FROM dominio_chart_of_accounts').get().codigo_conta,'20');
  db.exec("CREATE TRIGGER test_failure BEFORE INSERT ON dominio_chart_of_accounts WHEN NEW.codigo_conta = '99' BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
  assert.equal((await call('importChartOfAccounts',{body:{company_id:'a',replace_existing:true,raw_content:'99;1.1.03;Falha isolada;D'}})).code,500);
  assert.equal(db.prepare('SELECT codigo_conta FROM dominio_chart_of_accounts').get().codigo_conta,'20');
  db.exec('DROP TRIGGER test_failure');
  if (process.argv[2]) {
    const csv=fs.readFileSync(process.argv[2],'utf8');
    const expected=csv.trim().split(/\r?\n/).slice(1).map(line=>line.split(';'));
    const imported=await call('importChartOfAccounts',{body:{company_id:'a',replace_existing:true,raw_content:csv}});
    assert.equal(imported.result.count,expected.length);
    for(const [code,classification,name,type,nature] of expected){
      const actual=db.prepare('SELECT * FROM dominio_chart_of_accounts WHERE codigo_conta=?').get(code);
      assert.equal(actual.classificacao,classification);assert.equal(actual.nome_conta,name);
      assert.equal(actual.tipo_conta,type==='S'?'sintetica':'analitica');assert.equal(actual.natureza,nature || '');
    }
    console.log(`PASS: ${expected.length} source accounts round-trip with exact code, classification, name, type and no inferred nature.`);
  }
  console.log('PASS: stable 978/29/949 counters, tenant access, custom category persistence/deduplication, invalid category refusal, unmapped export refusal, PDF/invalid import preservation and rollback.');
  db.close();
})().catch(error=>{console.error(error);process.exitCode=1});
