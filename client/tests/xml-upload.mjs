import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { acceptsFiscalFile, importFiscalFiles } from '../src/services/xmlUpload.js';

assert(acceptsFiscalFile('nota.XML'));
assert(acceptsFiscalFile('notas.ZIP'));
const zip = new JSZip();
for (let i = 0; i < 105; i++) zip.file(`saida/${i}.XML`, '<test/>');
zip.file('leia.txt', 'ignored');
let calls = 0;
const result = await importFiscalFiles([new File([await zip.generateAsync({type:'uint8array'})], 'lote.ZIP')], async file => {
  assert.equal(await file.text(), '<test/>');
  calls++;
  if (calls === 2) throw new Error('falha de rede');
  if (calls === 3) return {processed:0, errors:['XML rejeitado']};
  return {processed:1};
});
assert.equal(calls, 105);
assert.equal(result.processed, 103);
assert.equal(result.errors.length, 2);
const failures = await importFiscalFiles([new File(['broken'], 'x.zip'), new File(['x'], 'x.pdf')], () => {throw new Error('should not upload');});
assert.equal(failures.processed, 0);
assert.equal(failures.errors.length, 2);
const empty = new JSZip(); empty.file('x.txt','x');
const noXml = await importFiscalFiles([new File([await empty.generateAsync({type:'uint8array'})], 'empty.zip')], () => {});
assert.match(noXml.errors[0], /não contém/);
console.log('xml-upload: uppercase, ZIP folders, 105 files, partial failure and invalid archives OK');
