const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE users(id,tenant_id,role,is_active);INSERT INTO users VALUES('u','t','client',1),('admin','t','admin',1);
CREATE TABLE companies(id,tenant_id,cnpj);INSERT INTO companies VALUES('a','t','111'),('b','other','222');
CREATE TABLE user_companies(user_id,company_id);INSERT INTO user_companies VALUES('u','a');
CREATE TABLE nfse_issued(id,company_id);INSERT INTO nfse_issued VALUES('foreign','b');CREATE TABLE nfse_recurring_clients(id,company_id);`);
const ctx={exports:{},process:{env:{JWT_SECRET:'isolated-test-secret'}},require:()=>({db})};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/middleware/nfseAccess.js'),'utf8'),ctx);
function check(req){let status=0,ok=false;ctx.exports.nfseAccess({user:{id:'u',tenant_id:'t'},body:{},query:{},params:{},path:'/portal/nfse/emit',...req},{status:n=>({json:()=>{status=n;}})},()=>ok=true);return ok?200:status;}
assert.equal(check({body:{company_id:'a'}}),200);
assert.equal(check({body:{company_id:'b',company_cnpj:'111'}}),403);
assert.equal(check({params:{id:'foreign'},body:{company_cnpj:'111'},query:{company_id:'a'}}),403);
assert.equal(check({path:'/portal/nfse/webhook-whatsapp',body:{company_id:'a',company_cnpj:'222'}}),403);
assert.equal(check({path:'/portal/nfse/webhook-whatsapp',body:{company_id:'a'}}),403);
assert.equal(check({user:{id:'admin',tenant_id:'t'},body:{company_id:'b'}}),403);
console.log('PASS: company selectors cannot bypass tenant/user scope, including webhook and document IDs.');
