const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let old={id:'offline',status:'manifestado_confirmado',xml_raw:'<resNFe/>'},writes=0,saved;
const parsed={chaveAcesso:'1'.repeat(44),numero:'1',modelo:'55',naturezaOperacao:'Compra',status:'autorizada',emitente:{cnpjCpf:'11111111000111'},destinatario:{cnpjCpf:'22222222000122'},totais:{},itens:[],dataEmissao:'2026-09-01'};
const db={prepare:sql=>({get:()=>sql.includes('FROM companies')?{id:'company',cnpj:'22222222000122'}:old,run:(...args)=>{saved=args;writes++;}})};
const mods={fs:{writeFileSync:()=>{}},path:require('node:path'),uuid:{v4:()=>{throw Error('must update')}},'../database/db.js':{db},'./xmlParser.js':{parseFiscalXml:()=>parsed},'./danfeGenerator.js':{generateDanfePdf:async()=>{}},'./invoiceInstallments.js':{syncXmlInstallments:()=>{}},'../utils/crypto.js':{cleanNumeric:s=>s},'../utils/driveFolderMatcher.js':{getInvoiceStoragePaths:()=>({xmlFilePath:'offline.xml',pdfFilePath:'offline.pdf'})},'../utils/fiscalClassifier.js':{isSameCompany:(a,b)=>a===b,classifyFiscalDirection:()=>({tipo:'entrada',destinatarioCnpj:'22222222000122'})}};
const ctx={exports:{},console,require:n=>mods[n]||{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/services/sefazService.js'),'utf8'),ctx);
(async()=>{
 const s=ctx.exports.sefazService;
 for(const status of ['manifestado_confirmado','manifestado_ciencia','cancelada']){old.status=status;await s.ingestXml('company','<nfeProc/>');assert.equal(saved[5],status);}
 old.xml_raw='<nfeProc/>';parsed.naturezaOperacao='Resumo de NF-e';const before=writes;
 await s.ingestXml('company','<resNFe/>');assert.equal(writes,before);
 console.log('PASS: complete XML is not downgraded and fiscal manifestation/cancellation state survives recovery.');
})().catch(e=>{console.error(e);process.exitCode=1});
