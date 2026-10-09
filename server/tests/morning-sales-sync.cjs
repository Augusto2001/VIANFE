const assert = require('node:assert/strict');

(async () => {
  const { MorningSalesSyncService, morningSalesSyncService } = await import('../dist/services/morningSalesSyncService.js');

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
