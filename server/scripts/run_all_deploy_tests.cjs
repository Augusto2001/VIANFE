const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const tests = [
  'server/tests/science-protocol.cjs',
  'server/tests/scheduler-ciencia.cjs',
  'server/tests/no-simulated-success.cjs',
  'server/tests/bank-import.cjs',
  'server/tests/bpo-reconciliation.cjs',
  'server/tests/xml-installments.cjs',
  'server/tests/nfse-original-documents.cjs',
  'server/tests/reconcile-originals.cjs',
  'server/tests/nfse-decimal.cjs',
  'server/tests/nfse-list.cjs',
  'server/tests/municipal-batch-recovery.cjs',
  'server/tests/nfse-emission-safety.cjs',
  'server/tests/nfse-access.cjs',
  'server/tests/nfse-workflow.cjs',
  'server/tests/nfse-nacional.cjs',
  'server/tests/nfse-municipal.cjs',
  'server/tests/full-document-download.cjs',
  'server/tests/ingest-preservation.cjs',
  'server/tests/saida-manifest.cjs',
  'server/tests/svrs-nfce.cjs',
  'server/tests/morning-sales-sync.cjs'
];

console.log('--- EXECUTANDO SUITE COMPLETA DO GATE DE DEPLOY ---');
let passed = 0;
for (const t of tests) {
  try {
    execSync(`node "${path.join(rootDir, t)}"`, { stdio: 'pipe', cwd: rootDir });
    console.log(`✅ [${++passed}/${tests.length}] PASS: ${t}`);
  } catch (e) {
    console.error(`❌ FAIL: ${t}`);
    console.error(e.stderr ? e.stderr.toString() : e.message);
    process.exit(1);
  }
}
console.log(`\n🎉 SUITE COMPLETA (${passed}/${tests.length}) PASSOU COM 100% DE SUCESSO!`);
