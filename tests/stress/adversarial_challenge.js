/**
 * Adversarial Stress & Edge Probes Harness for Challenger 1
 * Project: Viacont Super App / Client Portal
 *
 * Empirical Challenge Probes:
 * 1. Multi-Tenant Boundary Isolation Probes (Zero leakage between Tenant A, B, and C)
 * 2. Missing Parameter / Non-Existent Company Rejection Probes (Zero default fallbacks)
 * 3. Empty Company Strict R$ 0.00 Determinism Probes (Zero mock fallbacks: 158k, 12.5k, 28.4k, 1.85M)
 * 4. Subteto (R$ 3.6M) and Teto (R$ 4.8M) Boundary & Alert Escalation Probes
 * 5. BACEN EMV BR Code PIX CRC16-CCITT Mathematical Correctness Probes
 */

import { assert } from '../e2e/harness.js';
import { PortalMultiTenantDB, PortalSession } from '../e2e/engines/portal_state.js';
import { calculateSimplesDiagnostic, SIMPLES_LIMITS } from '../e2e/engines/simples.js';
import { generatePixPayload, parseAndValidatePixPayload, calculateCRC16 } from '../e2e/engines/pix.js';

export function runAdversarialProbes() {
  const results = [];
  const startTotal = Date.now();

  function test(name, fn) {
    const start = Date.now();
    try {
      fn();
      const dur = Date.now() - start;
      results.push({ name, pass: true, duration: dur });
      console.log(`  [ADV-PASS] ${name} (${dur}ms)`);
    } catch (err) {
      const dur = Date.now() - start;
      results.push({ name, pass: false, duration: dur, error: err.message });
      console.error(`  [ADV-FAIL] ${name} (${dur}ms): ${err.message}`);
    }
  }

  console.log('\n--- STARTING ADVERSARIAL CHALLENGE PROBES ---\n');

  // =========================================================================
  // CHALLENGE 1: MULTI-TENANT BOUNDARY ISOLATION
  // =========================================================================
  test('ADV.1.1: Querying Tenant Alpha NEVER leaks Tenant Beta bank balances, receivables, or payables', () => {
    const db = new PortalMultiTenantDB();
    const sumA = db.getDashboardSummary('comp_tenant_alpha');
    const sumB = db.getDashboardSummary('comp_tenant_beta');

    assert.strictEqual(sumA.data.bank_balance, 75000.00);
    assert.strictEqual(sumB.data.bank_balance, 210000.00);
    assert.strictEqual(sumA.data.receivables_today, 50000.00);
    assert.strictEqual(sumB.data.receivables_today, 120000.00);
    assert.strictEqual(sumA.data.payables_today, 11179.50);
    assert.strictEqual(sumB.data.payables_today, 15000.00);
  });

  test('ADV.1.2: Tenant Alpha tax guides strictly contain 0 records belonging to Tenant Beta', () => {
    const db = new PortalMultiTenantDB();
    const guidesA = db.getTaxGuides('comp_tenant_alpha');
    const guidesB = db.getTaxGuides('comp_tenant_beta');

    assert.ok(guidesA.data.every(g => g.company_id === 'comp_tenant_alpha'));
    assert.ok(guidesB.data.every(g => g.company_id === 'comp_tenant_beta'));
    assert.strictEqual(guidesA.data.filter(g => g.company_id === 'comp_tenant_beta').length, 0);
    assert.strictEqual(guidesB.data.filter(g => g.company_id === 'comp_tenant_alpha').length, 0);
  });

  test('ADV.1.3: Emitting invoice for Tenant Alpha does NOT alter Tenant Beta RBT12 or Receivables', () => {
    const sessionA = new PortalSession('comp_tenant_alpha');
    const sessionB = new PortalSession('comp_tenant_beta');

    const betaRbt12Before = sessionB.getDashboardSummary().data.simples_nacional.rbt12;
    const betaRecBefore = sessionB.getDashboardSummary().data.receivables_today;

    sessionA.setIssuerStep1({ cnpj_cpf: '00.000.000/0001-91', razao_social: 'Cliente A' });
    sessionA.setIssuerStep2({ descricao: 'Consultoria Isolada', valor: 95000.00 });
    sessionA.emitInvoiceStep3();

    const betaRbt12After = sessionB.getDashboardSummary().data.simples_nacional.rbt12;
    const betaRecAfter = sessionB.getDashboardSummary().data.receivables_today;

    assert.strictEqual(betaRbt12Before, betaRbt12After, 'Beta RBT12 must remain unchanged');
    assert.strictEqual(betaRecBefore, betaRecAfter, 'Beta receivables must remain unchanged');
  });

  // =========================================================================
  // CHALLENGE 2: MISSING PARAMETERS & NON-EXISTENT TENANT REJECTION
  // =========================================================================
  test('ADV.2.1: Missing company_id parameter is rejected without defaulting or leaking any company', () => {
    const db = new PortalMultiTenantDB();
    
    assert.throws(() => db.getDashboardSummary(null), /company_id é obrigatório/i);
    assert.throws(() => db.getDashboardSummary(''), /company_id é obrigatório/i);
    assert.throws(() => db.getDashboardSummary(undefined), /company_id é obrigatório/i);
    assert.throws(() => db.getTaxGuides(null), /company_id é obrigatório/i);
    assert.throws(() => db.getFavorites(''), /company_id é obrigatório/i);
    assert.throws(() => db.getReceipts(undefined), /company_id é obrigatório/i);
  });

  test('ADV.2.2: Non-existent company_id throws not found error without leaking other tenants', () => {
    const db = new PortalMultiTenantDB();

    assert.throws(() => db.getDashboardSummary('comp_non_existent_9999'), /não encontrada/i);
    assert.throws(() => db.getTaxGuides('comp_ghost_tenant'), /não encontrada/i);
  });

  // =========================================================================
  // CHALLENGE 3: EMPTY COMPANY STRICT 0.00 DETERMINISM (ZERO MOCK FALLBACKS)
  // =========================================================================
  test('ADV.3.1: Empty company returns exact 0.00 (not 158.450,20 / 28.400 / 12.500 / 1.850.000)', () => {
    const db = new PortalMultiTenantDB();
    const sumEmpty = db.getDashboardSummary('comp_tenant_empty');

    assert.strictEqual(sumEmpty.data.bank_balance, 0.00, 'Bank balance must be 0.00');
    assert.notStrictEqual(sumEmpty.data.bank_balance, 158450.20);
    assert.notStrictEqual(sumEmpty.data.bank_balance, 158000.00);

    assert.strictEqual(sumEmpty.data.receivables_today, 0.00, 'Receivables today must be 0.00');
    assert.notStrictEqual(sumEmpty.data.receivables_today, 28400.00);

    assert.strictEqual(sumEmpty.data.payables_today, 0.00, 'Payables today must be 0.00');
    assert.notStrictEqual(sumEmpty.data.payables_today, 12500.00);

    assert.strictEqual(sumEmpty.data.simples_nacional.rbt12, 0.00, 'RBT12 must be 0.00');
    assert.notStrictEqual(sumEmpty.data.simples_nacional.rbt12, 1850000.00);

    assert.strictEqual(sumEmpty.data.simples_nacional.percentual_atingido_estadual, 0.00);
    assert.strictEqual(sumEmpty.data.simples_nacional.percentual_atingido_federal, 0.00);
    assert.strictEqual(sumEmpty.data.simples_nacional.aliquota_efetiva, 0.00);
    assert.strictEqual(sumEmpty.data.simples_nacional.faixa_numero, 1);
    assert.strictEqual(sumEmpty.data.simples_nacional.alerta, 'normal');
  });

  test('ADV.3.2: Empty company returns empty lists with 0 items for guides, favorites, and receipts', () => {
    const db = new PortalMultiTenantDB();
    const guides = db.getTaxGuides('comp_tenant_empty');
    const favorites = db.getFavorites('comp_tenant_empty');
    const receipts = db.getReceipts('comp_tenant_empty');

    assert.strictEqual(guides.data.length, 0);
    assert.strictEqual(favorites.data.length, 0);
    assert.strictEqual(receipts.data.length, 0);
  });

  // =========================================================================
  // CHALLENGE 4: SUBTETO (R$ 3.6M) & TETO (R$ 4.8M) BOUNDARY PROBES
  // =========================================================================
  test('ADV.4.1: RBT12 at exact Subteto R$ 3.600.000,00 triggers sublimite_atingido and 100.00%', () => {
    const diag = calculateSimplesDiagnostic(3600000.00);
    assert.strictEqual(diag.rbt12, 3600000.00);
    assert.strictEqual(diag.percentual_atingido_estadual, 100.00);
    assert.strictEqual(diag.percentual_atingido_federal, 75.00);
    assert.strictEqual(diag.alerta, 'sublimite_atingido');
    assert.strictEqual(diag.faixa_numero, 6);
  });

  test('ADV.4.2: RBT12 at R$ 3.600.000,01 triggers sublimite_atingido and > 100.00%', () => {
    const diag = calculateSimplesDiagnostic(3600000.01);
    assert.strictEqual(diag.alerta, 'sublimite_atingido');
    assert.ok(diag.percentual_atingido_estadual > 100.00);
  });

  test('ADV.4.3: RBT12 at 85% of Subteto (R$ 3.060.000,00) triggers atencao_sublimite warning', () => {
    const diag = calculateSimplesDiagnostic(3060000.00);
    assert.strictEqual(diag.alerta, 'atencao_sublimite');
    assert.strictEqual(diag.percentual_atingido_estadual, 85.00);
  });

  test('ADV.4.4: RBT12 at exact Teto Federal R$ 4.800.000,00 reaches 100.00% cap', () => {
    const diag = calculateSimplesDiagnostic(4800000.00);
    assert.strictEqual(diag.percentual_atingido_federal, 100.00);
    assert.strictEqual(diag.faixa_numero, 6);
  });

  test('ADV.4.5: RBT12 exceeding Teto Federal (R$ 4.800.000,01) triggers desenquadramento_obrigatorio', () => {
    const diag = calculateSimplesDiagnostic(4800000.01);
    assert.strictEqual(diag.alerta, 'desenquadramento_obrigatorio');
    assert.ok(diag.percentual_atingido_federal > 100.00);
  });

  // =========================================================================
  // CHALLENGE 5: BACEN EMV BR CODE PIX & CRC16-CCITT VERIFICATION
  // =========================================================================
  test('ADV.5.1: Dynamic PIX payload contains valid BACEN GUI, CNPJ key, amount, and CRC16 checksum', () => {
    const payload = generatePixPayload({
      pixKey: '12345678000199',
      merchantName: 'EMPRESA CONTRIBUINTE LTDA',
      merchantCity: 'SALVADOR',
      amount: 4820.50,
      txid: 'DAS202608',
      description: 'DAS SIMPLES'
    });

    assert.ok(payload.startsWith('000201'));
    assert.ok(payload.includes('br.gov.bcb.pix'));
    assert.ok(payload.includes('12345678000199'));
    assert.ok(payload.includes('4820.50'));
    
    const check = parseAndValidatePixPayload(payload);
    assert.strictEqual(check.valid, true);
    assert.strictEqual(check.amount, 4820.50);
  });

  test('ADV.5.2: Mathematical CRC16-CCITT validation correctly identifies tampered string', () => {
    const valid = generatePixPayload({
      pixKey: '12345678000199',
      merchantName: 'TESTE',
      merchantCity: 'SALVADOR',
      amount: 50.00
    });

    const tampered = valid.replace('50.00', '99.99');
    const check = parseAndValidatePixPayload(tampered);
    assert.strictEqual(check.valid, false);
    assert.match(check.error, /CRC16 mismatch/i);
  });

  const totalDuration = Date.now() - startTotal;
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  console.log(`\n--- ADVERSARIAL PROBES COMPLETED: ${passed} PASSED, ${failed} FAILED (${totalDuration}ms) ---\n`);

  return { total: results.length, passed, failed, results };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('adversarial_challenge.js')) {
  const summary = runAdversarialProbes();
  if (summary.failed > 0) {
    process.exit(1);
  }
}
