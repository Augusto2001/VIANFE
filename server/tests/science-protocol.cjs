const assert = require('node:assert/strict');
const forge = require('node-forge');
const {SignedXml} = require('xml-crypto');
const {DOMParser,XMLSerializer} = require('@xmldom/xmldom');
(async()=>{
  const {sendCiencia,parseScienceResponse,parseDistributionResponse}=await import('../scripts/auto_ciencia.mjs');
  const zipped=require('node:zlib').gzipSync('<nfeProc><NFe/></nfeProc>').toString('base64');
  assert.equal(parseDistributionResponse(`<s:Envelope><s:retDistDFeInt><s:cStat>138</s:cStat><s:loteDistDFeInt><s:docZip NSU="1">${zipped}</s:docZip></s:loteDistDFeInt></s:retDistDFeInt></s:Envelope>`).full,'<nfeProc><NFe/></nfeProc>');
  assert.equal(parseDistributionResponse('<retDistDFeInt><cStat>137</cStat></retDistDFeInt>').empty,true);
  assert.equal(parseDistributionResponse('<retDistDFeInt><cStat>656</cStat></retDistDFeInt>').rate,true);
  assert.throws(()=>parseDistributionResponse('<retDistDFeInt><cStat>999</cStat></retDistDFeInt>'),/999/);
  const key='1'.repeat(44);
  const response=(code='135',protocol='123456789012345',chave=key,event='210210',amb='1',seq='1')=>
    `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><n:retEnvEvento xmlns:n="http://www.portalfiscal.inf.br/nfe"><n:cStat>128</n:cStat><n:retEvento><n:infEvento><n:cStat>${code}</n:cStat><n:nProt>${protocol}</n:nProt><n:chNFe>${chave}</n:chNFe><n:tpEvento>${event}</n:tpEvento><n:tpAmb>${amb}</n:tpAmb><n:nSeqEvento>${seq}</n:nSeqEvento></n:infEvento></n:retEvento></n:retEnvEvento></s:Body></s:Envelope>`;
  assert.equal(parseScienceResponse(response(),key,'1').cStat,'135');
  for(const xml of [response('135',''),response('135','135'),response('135',undefined,'2'.repeat(44)),response('135',undefined,key,'210200'),response('135',undefined,key,'210210','2'),response('135',undefined,key,'210210','1','2')]) assert.throws(()=>parseScienceResponse(xml,key,'1'));
  assert.equal(parseScienceResponse(response('573',''),key,'1').cStat,'573');
  assert.equal(parseScienceResponse('<retEnvEvento><cStat>656</cStat></retEnvEvento>',key,'1').cStat,'656');
  assert.throws(()=>parseScienceResponse('<other/>',key,'1'));
  const keys=forge.pki.rsa.generateKeyPair(2048),cert=forge.pki.createCertificate();
  cert.publicKey=keys.publicKey;cert.serialNumber='01';cert.validity.notBefore=new Date();cert.validity.notAfter=new Date(Date.now()+86400000);
  cert.setSubject([{name:'commonName',value:'OFFLINE TEST ONLY'}]);cert.setIssuer(cert.subject.attributes);cert.sign(keys.privateKey);
  const pem=forge.pki.certificateToPem(cert),privatePem=forge.pki.privateKeyToPem(keys.privateKey);
  let calls=0;
  const result=await sendCiencia({cnpj:'12345678000199',uf:'SP'},key,privatePem,pem,async(host,pathname,action,body)=>{
    calls++; assert.equal(host,'www.nfe.fazenda.gov.br');assert.match(action,/nfeRecepcaoEventoNF$/);
    assert.match(body,/<tpEvento>210210<\/tpEvento>/);
    const doc=new DOMParser().parseFromString(body,'text/xml');
    const eventXml=new XMLSerializer().serializeToString(doc.getElementsByTagName('evento')[0]);
    const eventDoc=new DOMParser().parseFromString(eventXml,'text/xml');
    const verifier=new SignedXml({publicCert:pem});verifier.loadSignature(eventDoc.getElementsByTagName('Signature')[0]);
    assert.equal(verifier.checkSignature(eventXml),true,'The extracted fiscal event must verify independently of SOAP namespaces');
    return response();
  });
  assert.equal(calls,1);assert.equal(result.nProt,'123456789012345');
  await assert.rejects(()=>sendCiencia({},'invalid',privatePem,pem,()=>{throw Error('Must not send')}),/Chave inválida/);
  console.log('PASS: science-only, SOAP signature, namespaced reply, key/event/environment/sequence correlation, missing protocol, rejection and malformed reply. No network calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
