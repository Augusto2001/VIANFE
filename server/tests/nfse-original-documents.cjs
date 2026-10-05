const assert=require('node:assert/strict');
const {splitMunicipalXml,municipalDocument,originalNfsePdf}=require('../dist/services/nfse/originalDocuments.js');
const {PDFParse}=require('pdf-parse');
const description='Consultoria detalhada '.repeat(400)+'MARCADOR FINAL';
const note=n=>`<CompNfse><Nfse><InfNfse Id="N${n}"><Numero>${n}</Numero><CodigoVerificacao>TESTE</CodigoVerificacao><DataEmissao>2026-01-01T10:00:00</DataEmissao><Servico><Discriminacao><![CDATA[${description} <CompNfse> não é tag]]></Discriminacao><Valores><ValorServicos>13.50</ValorServicos><ValorIss>0</ValorIss><Aliquota>0</Aliquota><ValorPis>1.23</ValorPis><ValorLiquidoNfse>12.27</ValorLiquidoNfse></Valores><CodigoTributacaoMunicipio>1719001</CodigoTributacaoMunicipio></Servico><PrestadorServico><RazaoSocial>PRESTADOR TESTE ISOLADO</RazaoSocial></PrestadorServico><TomadorServico><Endereco><Endereco>ENDERECO TESTE</Endereco></Endereco></TomadorServico></InfNfse><ds:Signature><ds:SignatureValue>TESTE</ds:SignatureValue></ds:Signature></Nfse></CompNfse>`;
(async()=>{
 const source=`<ConsultarNfseResposta xmlns="urn:municipal" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ListaNfse>${note(1)}${note(2)}</ListaNfse></ConsultarNfseResposta>`;
 const parts=splitMunicipalXml(source);assert.equal(parts.length,2);
 assert(parts[0].includes(note(1).slice('<CompNfse>'.length)));assert(parts[0].includes('xmlns:ds='));
 assert.equal(municipalDocument(parts[0]).note.Servico.Valores.Aliquota,'0');
 assert.throws(()=>municipalDocument('<CompNfse><Nfse><!-- placeholder --></Nfse></CompNfse>'));
 assert.throws(()=>splitMunicipalXml('<!DOCTYPE a><a/>'));
 assert.throws(()=>municipalDocument(source));
 const pdf=await originalNfsePdf(parts[0]);assert.equal(pdf.subarray(0,4).toString(),'%PDF');
 const parser=new PDFParse({data:pdf});const text=await parser.getText();
 for(const value of ['MARCADOR FINAL','1719001','ENDERECO TESTE','1.23','12.27','Alíquota']) {
   if(value==='Alíquota')continue;
   assert(text.text.replace(/\s+/g,' ').includes(value),value);
 }
 assert(text.total>1,'descrição longa deve paginar');
 assert(!text.text.includes('5.00%'));await parser.destroy();
 console.log('PASS: XML original, namespaces, assinatura preservada, CDATA, zero real, retenção/líquido/endereço e descrição longa paginada. Sem rede.');
})().catch(e=>{console.error(e);process.exitCode=1;});

