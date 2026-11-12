const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const stubs = {
  'fs': fs,
  'path': path,
  'crypto': crypto,
  '../database/db.js': { db: { prepare: () => ({ all: () => [], get: () => undefined, run: () => ({}) }) } },
  './xmlParser.js': { parseFiscalXml: () => ({}) },
  '../utils/fiscalClassifier.js': { classifyFiscalDirection: () => ({}) },
  './jlComercioIngestionService.js': { extractZipXmlFiles: () => [] },
  '../utils/driveFolderMatcher.js': { getClientFolderInGDrive: () => null }
};

const exportsObject = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/services/morningSalesSyncService.js'), 'utf8'), {
  exports: exportsObject,
  require: n => { assert.ok(n in stubs, n); return stubs[n]; },
  console
});

(async () => {
  const { MorningSalesSyncService, morningSalesSyncService } = exportsObject;

  assert.ok(MorningSalesSyncService, 'MorningSalesSyncService classe deve existir');
  assert.ok(morningSalesSyncService, 'morningSalesSyncService singleton deve existir');
  assert.equal(typeof morningSalesSyncService.runMorningBatchSync, 'function', 'runMorningBatchSync deve ser uma função');

  // Testar execução
  const report = await morningSalesSyncService.runMorningBatchSync('TESTE_UNITARIO');
  assert.equal(report.success, true, 'O relatório deve indicar sucesso');
  assert.equal(report.triggerOrigin, 'TESTE_UNITARIO');
  assert.ok(typeof report.durationMs === 'number');
  assert.ok(Array.isArray(report.companies));

  console.log('PASS: morningSalesSyncService inicialização, execução controlada e estrutura do relatório matinal validadas.');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
