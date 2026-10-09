const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const { parseSvrsResponse, svrsNfceClient } = await import('../dist/services/svrsNfceClient.js');

  const chaveValida = '29260951090446000195650010000435151995998530';
  const xmlSample = '<nfeProc versao="4.00"><NFe><infNFe Id="NFe29260951090446000195650010000435151995998530"/></NFe><protNFe><infProt><cStat>100</cStat><nProt>229261132052638</nProt></infProt></protNFe></nfeProc>';

  // 1. Sucesso na interpretação do HTML com var stringJson
  const htmlSucesso = `<html><body><script>var stringJson = {"xml": ${JSON.stringify(xmlSample)}};\r\n</script></body></html>`;
  const res1 = parseSvrsResponse(htmlSucesso, chaveValida);
  assert.equal(res1.success, true);
  assert.equal(res1.chaveAcesso, chaveValida);
  assert.equal(res1.protocolo, '229261132052638');
  assert.equal(res1.cStat, '100');
  assert.equal(res1.xmlContent, xmlSample);

  // 2. Erro retornado pela SEFAZ com tag textoErro
  const htmlErro = '<html><body><h4 class="textoErro">Documento não localizado no ambiente de produção da SVRS.</h4></body></html>';
  const res2 = parseSvrsResponse(htmlErro, chaveValida);
  assert.equal(res2.success, false);
  assert.equal(res2.chaveAcesso, chaveValida);
  assert.match(res2.error, /Documento não localizado/);

  // 3. Resposta sem JSON e sem tag de erro
  const htmlInvalido = '<html><body>500 Internal Server Error</body></html>';
  const res3 = parseSvrsResponse(htmlInvalido, chaveValida);
  assert.equal(res3.success, false);
  assert.ok(res3.error);

  // 4. Validação de chave inválida (< 44 dígitos)
  const resChaveCurta = await svrsNfceClient.downloadNfceXml('fake-id', '12345');
  assert.equal(resChaveCurta.success, false);
  assert.match(resChaveCurta.error, /inválida/);

  console.log('PASS: parseSvrsResponse sucesso, erro SEFAZ textoErro, formato inválido e guarda de chave 44 dígitos.');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
