const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const tests = [
  'server/tests/science-protocol.cjs',
  'server/tests/nfse-original-documents.cjs',
  'server/tests/reconcile-originals.cjs',
  'server/tests/nfse-decimal.cjs',
  'server/tests/nfse-list.cjs',
  'server/tests/municipal-batch-recovery.cjs',
  'server/tests/nfse-emission-safety.cjs',
  'server/tests/nfse-access.cjs',
  'server/tests/nfse-nacional.cjs',
  'server/tests/nfse-municipal.cjs'
];

console.log('--- EXECUTANDO TESTES DE REGRESSÃO ---');
for (const t of tests) {
  try {
    execSync(`node "${path.join(rootDir, t)}"`, { stdio: 'inherit', cwd: rootDir });
    console.log('✅ PASS:', t);
  } catch (e) {
    console.error('❌ FAIL:', t);
    process.exit(1);
  }
}
console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
