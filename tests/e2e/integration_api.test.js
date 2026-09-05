/**
 * Live Integration & Multi-Tenant Isolation Test Suite
 * Super App Viacont (Área do Cliente & BPO Financeiro)
 * 
 * Verifies Pillars 1 through 5:
 * Pillar 1: Multi-Tenant Strict Isolation (Company A vs Company B vs Company C)
 * Pillar 2: Zero-Mock Fallback / Deterministic R$ 0,00 Calculation
 * Pillar 3: Real-Time SQL Calculation Engines Verification
 * Pillar 4: Dynamic Tax Guides & Valid EMV PIX Generation
 * Pillar 5: Parameter Validation & Rejection of Missing Tenant IDs
 */

import { assert, TestSuite } from './harness.js';
import { PortalMultiTenantDB } from './engines/portal_state.js';
import { generatePixPayload, parseAndValidatePixPayload, calculateCRC16 } from './engines/pix.js';
import { calculateSimplesDiagnostic, SIMPLES_LIMITS } from './engines/simples.js';

export function createIntegrationApiSuite() {
  const suite = new TestSuite('Integration & Multi-Tenant Isolation Suite (Pillars 1 - 5)');

  // ------------------------------------------------------------------------
  // Pillar 1: Multi-Tenant Strict Isolation
  // ------------------------------------------------------------------------

  suite.add('INT.1.1', 'Tenant Alpha metrics are strictly isolated from Tenant Beta', () => {
    const db = new PortalMultiTenantDB();

    const summaryAlpha = db.getDashboardSummary('comp_tenant_alpha');
    const summaryBeta = db.getDashboardSummary('comp_tenant_beta');

    // Alpha Balance = 75.000,00 vs Beta Balance = 210.000,00
    assert.strictEqual(summaryAlpha.data.bank_balance, 75000.00);
    assert.strictEqual(summaryBeta.data.bank_balance, 210000.00);

    // Alpha Receivables = 50.000,00 vs Beta Receivables = 120.000,00
    assert.strictEqual(summaryAlpha.data.receivables_today, 50000.00);
    assert.strictEqual(summaryBeta.data.receivables_today, 120000.00);

    // Alpha RBT12 = 50.000,00 vs Beta RBT12 = 120.000,00
    assert.strictEqual(summaryAlpha.data.simples_nacional.rbt12, 50000.00);
    assert.strictEqual(summaryBeta.data.simples_nacional.rbt12, 120000.00);
  });

  suite.add('INT.1.2', 'Tenant Alpha tax guides return zero records belonging to Tenant Beta', () => {
    const db = new PortalMultiTenantDB();

    const guidesAlpha = db.getTaxGuides('comp_tenant_alpha');
    const guidesBeta = db.getTaxGuides('comp_tenant_beta');

    assert.strictEqual(guidesAlpha.data.length, 3);
    assert.strictEqual(guidesBeta.data.length, 1);

    for (const guide of guidesAlpha.data) {
      assert.strictEqual(guide.company_id, 'comp_tenant_alpha', 'Guide must belong strictly to Alpha');
      assert.notStrictEqual(guide.company_id, 'comp_tenant_beta');
    }
  });

  suite.add('INT.1.3', 'Tenant Alpha favorites and receipts return zero records from Tenant Beta', () => {
    const db = new PortalMultiTenantDB();

    const favAlpha = db.getFavorites('comp_tenant_alpha');
    const favBeta = db.getFavorites('comp_tenant_beta');

    assert.strictEqual(favAlpha.data.length, 2);
    assert.strictEqual(favBeta.data.length, 1);
    assert.ok(favAlpha.data.every(f => f.company_id === 'comp_tenant_alpha'));
    assert.ok(favBeta.data.every(f => f.company_id === 'comp_tenant_beta'));
  });

  // ------------------------------------------------------------------------
  // Pillar 2: Zero-Mock Fallback / Deterministic R$ 0,00 Calculation
  // ------------------------------------------------------------------------

  suite.add('INT.2.1', 'Empty company returns exact 0.00 for all financial totals', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_empty');

    assert.strictEqual(summary.data.bank_balance, 0.00);
    assert.strictEqual(summary.data.payables_today, 0.00);
    assert.strictEqual(summary.data.receivables_today, 0.00);
    assert.strictEqual(summary.data.simples_nacional.rbt12, 0.00);
    assert.strictEqual(summary.data.simples_nacional.percentual_atingido_estadual, 0.00);
    assert.strictEqual(summary.data.simples_nacional.percentual_atingido_federal, 0.00);
    assert.strictEqual(summary.data.simples_nacional.aliquota_efetiva, 0.00);
  });

  suite.add('INT.2.2', 'Empty company returns empty arrays without falling back to mock lists', () => {
    const db = new PortalMultiTenantDB();

    const guides = db.getTaxGuides('comp_tenant_empty');
    const favorites = db.getFavorites('comp_tenant_empty');
    const receipts = db.getReceipts('comp_tenant_empty');

    assert.strictEqual(guides.data.length, 0);
    assert.strictEqual(favorites.data.length, 0);
    assert.strictEqual(receipts.data.length, 0);
  });

  // ------------------------------------------------------------------------
  // Pillar 3: Real-Time SQL Calculation Engines Verification
  // ------------------------------------------------------------------------

  suite.add('INT.3.1', 'Bank balance SQL calculation: Credits minus Debits plus Initial Balance', () => {
    const db = new PortalMultiTenantDB();

    // Create test company
    db.companies.set('comp_calc_test', {
      id: 'comp_calc_test',
      cnpj: '55.555.555/0001-55',
      razao_social: 'Calc Test Ltda',
      uf: 'BA'
    });

    db.bankAccounts.push({
      id: 'ba_calc_01',
      company_id: 'comp_calc_test',
      banco_nome: 'Itaú',
      saldo_inicial: 10000.00,
      saldo_atual: 41750.00
    });

    // Credit of 50.000 and Debit of 18.250 -> 10.000 + 50.000 - 18.250 = 41.750,00
    db.bankTransactions.push(
      {
        id: 'bt_c1',
        company_id: 'comp_calc_test',
        bank_account_id: 'ba_calc_01',
        data: '2026-08-27',
        descricao_original: 'RECEBIMENTO CLIENTE',
        tipo: 'CREDITO',
        valor: 50000.00,
        conciliado: 1
      },
      {
        id: 'bt_c2',
        company_id: 'comp_calc_test',
        bank_account_id: 'ba_calc_01',
        data: '2026-08-27',
        descricao_original: 'PAGAMENTO FORNECEDOR',
        tipo: 'DEBITO',
        valor: 18250.00,
        conciliado: 1
      }
    );

    const summary = db.getDashboardSummary('comp_calc_test');
    assert.strictEqual(summary.data.bank_balance, 41750.00);
  });

  suite.add('INT.3.2', 'Payables SQL calculation combines purchase installments and accounting provisions', () => {
    const db = new PortalMultiTenantDB();

    db.companies.set('comp_pay_test', {
      id: 'comp_pay_test',
      cnpj: '66.666.666/0001-66',
      razao_social: 'Pay Test Ltda',
      uf: 'BA'
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Purchase installment: R$ 7.400,00
    db.invoiceInstallments.push({
      id: 'inst_p1',
      invoice_id: 'inv_p1',
      company_id: 'comp_pay_test',
      tipo: 'pagar',
      numero_parcela: '1/1',
      data_vencimento: todayStr,
      valor: 7400.00,
      status: 'pendente'
    });

    // Accounting provision: R$ 3.200,00
    db.accountingProvisions.push({
      id: 'prov_p1',
      company_id: 'comp_pay_test',
      tipo_provisao: 'DAS_SIMPLES',
      competencia: '08/2026',
      data_lancamento: todayStr,
      valor: 3200.00,
      historico: 'DAS',
      status: 'provisionado'
    });

    const summary = db.getDashboardSummary('comp_pay_test');
    assert.strictEqual(summary.data.payables_today, 10600.00);
  });

  // ------------------------------------------------------------------------
  // Pillar 4: Dynamic Tax Guides & Valid EMV PIX Generation
  // ------------------------------------------------------------------------

  suite.add('INT.4.1', 'Dynamic tax guide contains company real CNPJ in PIX payload', () => {
    const db = new PortalMultiTenantDB();
    const guides = db.getTaxGuides('comp_tenant_alpha');
    const das = guides.data.find(g => g.tipo_tributo === 'DAS_SIMPLES');

    assert.ok(das, 'DAS guide must exist');
    assert.strictEqual(das.valor_total, 4820.50);

    // Validate PIX payload structure
    const parsed = parseAndValidatePixPayload(das.pix_copia_e_cola);
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.amount, 4820.50);
    assert.ok(das.pix_copia_e_cola.includes('11111111000111'), 'PIX must contain Alpha CNPJ');
  });

  suite.add('INT.4.2', 'PIX CRC16 checksum passes CCITT verification', () => {
    const payload = generatePixPayload({
      pixKey: '22222222000122',
      merchantName: 'BETA COMERCIO',
      merchantCity: 'SAO PAULO',
      amount: 15000.00,
      txid: 'DASBETA2026'
    });

    const parsed = parseAndValidatePixPayload(payload);
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.amount, 15000.00);
  });

  // ------------------------------------------------------------------------
  // Pillar 5: Parameter Validation & Rejection
  // ------------------------------------------------------------------------

  suite.add('INT.5.1', 'Missing company_id parameter is strictly rejected with error', () => {
    const db = new PortalMultiTenantDB();

    assert.throws(() => {
      db.getDashboardSummary('');
    }, /company_id é obrigatório/i);

    assert.throws(() => {
      db.getTaxGuides(undefined);
    }, /company_id é obrigatório/i);
  });

  suite.add('INT.5.2', 'Non-existent company_id throws not found error', () => {
    const db = new PortalMultiTenantDB();

    assert.throws(() => {
      db.getDashboardSummary('comp_non_existent_99999');
    }, /não encontrada/i);
  });

  return suite;
}
