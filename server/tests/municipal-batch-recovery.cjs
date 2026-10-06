const assert=require('node:assert/strict');const {plan}=require('../scripts/recover_municipal_batch.cjs');
const note=n=>`<CompNfse><Nfse><InfNfse><Numero>${n}</Numero><CodigoVerificacao>V${n}</CodigoVerificacao><DataEmissao>2026-08-01T10:00:00</DataEmissao><PrestadorServico><IdentificacaoPrestador><Cnpj>11111111000111</Cnpj></IdentificacaoPrestador></PrestadorServico><Servico><Valores><ValorServicos>90</ValorServicos><ValorLiquidoNfse>0</ValorLiquidoNfse></Valores><Discriminacao>Fixture isolada</Discriminacao></Servico></InfNfse></Nfse></CompNfse>`;
const wrap=s=>`<ConsultarNfseResposta xmlns="http://www.abrasf.org.br/nfse.xsd"><ListaNfse>${s}</ListaNfse></ConsultarNfseResposta>`;
const p=plan(wrap(note(10)+note(11)),'11111111000111');assert.equal(p.length,2);assert.equal(p[0].p.totais.valorTotal,0);assert.match(p[0].xml,/xmlns=/);
assert.throws(()=>plan(wrap(note(10)+note(10)),'11111111000111'),/duplicada/);
assert.throws(()=>plan(wrap(note(10)+note(11)),'22222222000122'),/Prestador/);
assert.throws(()=>plan(wrap(note(10)),'11111111000111'),/consolidado/);
console.log('PASS: original batch plan, namespaces, duplicate/issuer/single-note rejection, preserved real zero. No database or network.');
