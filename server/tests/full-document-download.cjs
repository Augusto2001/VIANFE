const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let invoice={id:'offline',numero:'1',xml_raw:'<resNFe xmlns="http://www.portalfiscal.inf.br/nfe"/>',pdf_file_path:'old.pdf'};
const context={exports:{},console,require:n=>{
 if(n==='fs')return {existsSync:()=>true};
 if(n==='path')return require(n);
 if(n==='archiver')return ()=>{throw Error('Archive must not be started for incomplete invoices')};
 if(n==='../database/db.js')return {db:{prepare:()=>({get:()=>invoice,all:()=>[invoice]})}};
 return {};
}};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/controllers/invoiceController.js'),'utf8'),context);
const c=context.exports.invoiceController;
const response=()=>({code:200,status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(){throw Error('Download must not start')}});
(async()=>{
 for(const xml of ['<resNFe/>','<n:resNFe xmlns:n="test"/>','<resCTe/>']){
  invoice.xml_raw=xml;
  for(const method of ['downloadXml','downloadPdf','downloadZip']){
   const r=response();await c[method]({params:{id:'offline'},body:{company_id:'offline'}},r);
   assert.equal(r.code,409,method);assert.equal(r.body.success,false);
  }
 }
 console.log('PASS: summary XML, old PDF and ZIP cannot be delivered as complete fiscal documents. Offline only.');
})().catch(e=>{console.error(e);process.exitCode=1});
