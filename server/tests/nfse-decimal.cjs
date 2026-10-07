const assert=require('node:assert/strict');
const {fiscalDecimal}=require('../dist/utils/fiscalDecimal.js');
const {parseFiscalXml}=require('../dist/services/xmlParser.js');
const {municipalDocument,originalNfsePdf}=require('../dist/services/nfse/originalDocuments.js');
for(const [input,expected] of [['5598,36',5598.36],['5598.36',5598.36],['0',0],['1,25',1.25]])assert.equal(fiscalDecimal(input),expected);
for(const invalid of ['',null,undefined,'1,2,3','12oops','NaN','1.234,56'])assert.throws(()=>fiscalDecimal(invalid));
const xml='<CompNfse><Nfse><InfNfse><Numero>1</Numero><CodigoVerificacao>TEST</CodigoVerificacao><DataEmissao>2026-01-15T10:00:00</DataEmissao><PrestadorServico><IdentificacaoPrestador><Cnpj>12345678000199</Cnpj></IdentificacaoPrestador></PrestadorServico><Servico><Discriminacao>Teste isolado</Discriminacao><Valores><ValorServicos>5598,36</ValorServicos><ValorLiquidoNfse>5500,11</ValorLiquidoNfse><ValorPis>1,23</ValorPis><ValorCofins>2,34</ValorCofins></Valores></Servico></InfNfse></Nfse></CompNfse>';
(async()=>{const p=parseFiscalXml(xml);assert.equal(p.totais.valorProdutos,5598.36);assert.equal(p.totais.valorTotal,5500.11);assert.equal(p.totais.valorPis,1.23);assert.equal(p.totais.valorCofins,2.34);assert.equal(municipalDocument(xml).note.Servico.Valores.ValorServicos,'5598,36');assert.equal((await originalNfsePdf(xml)).subarray(0,5).toString(),'%PDF-');console.log('PASS: decimais municipais, bruto/líquido distintos e PDF de XML com vírgula.');})().catch(e=>{console.error(e);process.exitCode=1;});
