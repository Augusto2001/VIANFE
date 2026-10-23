// Fixtures are isolated in memory: layout of Domínio > Utilitários > Exportação > Contas. No account is stored.
const assert=require('node:assert/strict');
const {parseDominioFixedChart}=require('../dist/services/bpoValidation.js');
const linha=(codigo,classe,nome,tipo)=>String(codigo).padStart(7,'0')+classe.padEnd(20)+nome.padEnd(40).slice(0,40)+tipo+' '.repeat(10);
const arquivo=[
  linha(1,'1','ATIVO','S'),linha(2,'11','ATIVO CIRCULANTE','S'),linha(4,'11101','CAIXA','S'),
  linha(5,'11101001','CAIXA GERAL','A'),
  linha(10,'11103','APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATAS','S'),   // nome com 40+ caracteres encosta no tipo
  linha(30,'111','DISPONÍVEL','S'),'9'.repeat(78)];
const contas=parseDominioFixedChart(arquivo.map(l=>l.trimEnd()));
assert.ok(contas);assert.equal(contas.length,6);
assert.deepEqual(contas[3],['5','1.1.1.01.001','CAIXA GERAL','analitica','']);
assert.deepEqual(contas[0],['1','1','ATIVO','sintetica','']);
assert.equal(contas[4][1],'1.1.1.03');assert.equal(contas[4][2],'APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA');assert.equal(contas[4][3],'sintetica');
assert.equal(contas[5][1],'1.1.1');
// Arquivos com separador seguem no parser antigo.
assert.equal(parseDominioFixedChart(['5;1.1.1.01.001;CAIXA GERAL;A']),null);
assert.equal(parseDominioFixedChart(['Plano de contas','00000011                   ATIVO']),null);
assert.equal(parseDominioFixedChart([]),null);
console.log('PASS: layout fixo do Domínio (código, classificação com máscara inferida, nome de 40, tipo, trailer 9).');
