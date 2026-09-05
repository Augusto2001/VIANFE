/**
 * Tier 1: Feature Coverage Test Suite (25 Tests)
 * Verifies core functionality for Requirements R1 through R4
 * 
 * Features Covered:
 * F1: Real-Time Bank Balance Calculation (Credits - Debits + Initial Balance)
 * F2: Real-Time Receivables (A Receber Este Mês)
 * F3: Real-Time Payables (A Pagar Este Mês from NF-e purchases + accounting provisions)
 * F4: Simples Nacional RBT12 Thermometer (LC 123/2006 Anexo I-V Effective Rate & Subteto/Teto)
 * F5: Route Aliasing Support (/portal/dashboard-summary & /portal/dashboard/summary)
 * F6: Dynamic Tax Guides Aggregation (accounting_provisions + tax_guides)
 * F7: Dynamic Real PIX Generation (EMV BR Code & CRC16-CCITT Checksum with real CNPJ and amount)
 * F8: Strict Multi-Tenant Isolation (Tenant Alpha vs Tenant Beta)
 * F9: Fast 3-Step Guided Invoice Issuer & WhatsApp Share Link
 * F10: Receipt OCR Scanner & Accounts Payable Auto-Match
 * F11: Responsive Hybrid Layout (Mobile PWA vs Desktop Expanded)
 */

import { assert, TestSuite } from './harness.js';
import { PortalSession, PortalMultiTenantDB } from './engines/portal_state.js';
import { generatePixPayload, parseAndValidatePixPayload, calculateCRC16 } from './engines/pix.js';
import { calculateSimplesDiagnostic, SIMPLES_LIMITS } from './engines/simples.js';
import { isValidCNPJ, isValidCPF, extractReceiptTokens, autoMatchReceiptWithPayables } from './engines/ocr.js';

export function createTier1Suite() {
  const suite = new TestSuite('Tier 1: Feature Coverage (R1 - R4)');

  // ------------------------------------------------------------------------
  // F1: Real-Time Bank Balance Calculation (3 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.1.1', 'Real-time bank balance computes credits minus debits plus initial balance', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_alpha');

    // Alpha: Initial (25.000) + Credits (60.000) - Debits (10.000) = 75.000,00
    assert.strictEqual(summary.data.bank_balance, 75000.00, 'Bank balance must equal exact sum of initial balance and net transactions');
  });

  suite.add('T1.1.2', 'Bank balance updates immediately when new transaction is booked', () => {
    const db = new PortalMultiTenantDB();
    const initialBalance = db.getDashboardSummary('comp_tenant_alpha').data.bank_balance;

    // Add new debit transaction of R$ 5.000,00
    db.bankTransactions.push({
      id: 'bt_new_test_01',
      company_id: 'comp_tenant_alpha',
      data: new Date().toISOString().split('T')[0],
      descricao_original: 'PAGAMENTO FORNECEDOR TESTE',
      tipo: 'DEBITO',
      valor: 5000.00,
      conciliado: 1
    });

    const updatedSummary = db.getDashboardSummary('comp_tenant_alpha');
    assert.strictEqual(
      updatedSummary.data.bank_balance,
      initialBalance - 5000.00,
      'Bank balance must decrease by newly added debit transaction'
    );
  });

  suite.add('T1.1.3', 'Multiple bank accounts consolidated balance for company', () => {
    const db = new PortalMultiTenantDB();
    // Add second account for Alpha with 15.000,00
    db.bankAccounts.push({
      id: 'ba_alpha_02',
      company_id: 'comp_tenant_alpha',
      banco_nome: 'Banco Inter',
      saldo_inicial: 15000.00,
      saldo_atual: 15000.00
    });

    const summary = db.getDashboardSummary('comp_tenant_alpha');
    assert.strictEqual(summary.data.bank_balance, 90000.00, 'Consolidated bank balance must sum all active bank accounts');
  });

  // ------------------------------------------------------------------------
  // F2: Real-Time Receivables (A Receber Este Mês) (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.2.1', 'A Receber Este Mês calculates open sales installments due today/this month', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_alpha');

    // Alpha has 5 open receivables of 10.000,00 each = 50.000,00
    assert.strictEqual(summary.data.receivables_today, 50000.00, 'Receivables must aggregate open sales installments');
  });

  suite.add('T1.2.2', 'Settled (paid) receivables are excluded from pending receivables total', () => {
    const db = new PortalMultiTenantDB();
    // Mark one installment as paid
    const inst = db.invoiceInstallments.find(i => i.company_id === 'comp_tenant_alpha' && i.tipo === 'receber');
    inst.status = 'pago';

    const summary = db.getDashboardSummary('comp_tenant_alpha');
    assert.strictEqual(summary.data.receivables_today, 40000.00, 'Paid installments must not be included in open receivables');
  });

  // ------------------------------------------------------------------------
  // F3: Real-Time Payables (A Pagar Este Mês) (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.3.1', 'A Pagar Este Mês consolidates purchase installments and accounting provisions', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_alpha');

    // Alpha: Purchase (3.179,50) + Provisions (DAS 4.820,50 + ICMS 1.240,00 + Folha 1.939,50 = 8.000,00) = 11.179,50
    assert.strictEqual(summary.data.payables_today, 11179.50, 'Payables must include both purchase installments and accounting provisions');
  });

  suite.add('T1.3.2', 'Provisions settled/conciliated are excluded from pending payables', () => {
    const db = new PortalMultiTenantDB();
    const prov = db.accountingProvisions.find(p => p.company_id === 'comp_tenant_alpha' && p.tipo_provisao === 'DAS_SIMPLES');
    prov.status = 'conciliado_pago';

    const summary = db.getDashboardSummary('comp_tenant_alpha');
    assert.strictEqual(summary.data.payables_today, 11179.50 - 4820.50, 'Settled provision must be subtracted from pending payables');
  });

  // ------------------------------------------------------------------------
  // F4: Simples Nacional RBT12 Thermometer (3 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.4.1', 'RBT12 calculates sum of 12-month issued invoices and bracket determination', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_alpha');

    assert.strictEqual(summary.data.simples_nacional.rbt12, 50000.00, 'RBT12 must equal sum of 12-month issued invoices');
    assert.strictEqual(summary.data.simples_nacional.faixa_numero, 1, 'R$ 50k falls into Faixa 1 (up to R$ 180k)');
    assert.strictEqual(summary.data.simples_nacional.aliquota_efetiva, 6.00, 'Faixa 1 effective rate equals 6.00%');
    assert.strictEqual(summary.data.simples_nacional.alerta, 'normal');
  });

  suite.add('T1.4.2', 'Simples Nacional effective rate calculation formula ((RBT12 * Aliq) - Ded) / RBT12', () => {
    // RBT12 = R$ 2.400.000,00 (Faixa 5: Alíquota Nominal 21%, Dedução R$ 125.640,00)
    // Alíquota Efetiva = ((2.400.000 * 0.21) - 125.640) / 2.400.000 = (504.000 - 125.640) / 2.400.000 = 378.360 / 2.400.000 = 15.765% -> 15.77%
    const diagnostic = calculateSimplesDiagnostic(2400000.00);
    assert.strictEqual(diagnostic.faixa_numero, 5);
    assert.approximatelyEqual(diagnostic.aliquota_efetiva, 15.77, 0.02, 'Effective tax rate must match LC 123/2006 formula');
  });

  suite.add('T1.4.3', 'Percentage reached for Subteto Estadual (R$ 3.6M) and Teto Federal (R$ 4.8M)', () => {
    const diagnostic = calculateSimplesDiagnostic(1800000.00);
    // 1.8M / 3.6M = 50.00%
    assert.strictEqual(diagnostic.percentual_atingido_estadual, 50.00);
    // 1.8M / 4.8M = 37.50%
    assert.strictEqual(diagnostic.percentual_atingido_federal, 37.50);
  });

  // ------------------------------------------------------------------------
  // F5: Route Aliasing Support (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.5.1', 'Route alias /api/portal/dashboard-summary resolves with valid company_id', () => {
    const routeResolver = (urlPath, query) => {
      const normalizedPath = urlPath.replace(/\/$/, '');
      if (normalizedPath === '/api/portal/dashboard-summary' || normalizedPath === '/api/portal/dashboard/summary') {
        const db = new PortalMultiTenantDB();
        return db.getDashboardSummary(query.company_id);
      }
      throw new Error(`Route not found: ${urlPath}`);
    };

    const res = routeResolver('/api/portal/dashboard-summary', { company_id: 'comp_tenant_alpha' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.bank_balance, 75000.00);
  });

  suite.add('T1.5.2', 'Route alias /api/portal/dashboard/summary resolves identically', () => {
    const routeResolver = (urlPath, query) => {
      const normalizedPath = urlPath.replace(/\/$/, '');
      if (normalizedPath === '/api/portal/dashboard-summary' || normalizedPath === '/api/portal/dashboard/summary') {
        const db = new PortalMultiTenantDB();
        return db.getDashboardSummary(query.company_id);
      }
      throw new Error(`Route not found: ${urlPath}`);
    };

    const res = routeResolver('/api/portal/dashboard/summary', { company_id: 'comp_tenant_alpha' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.bank_balance, 75000.00);
  });

  // ------------------------------------------------------------------------
  // F6: Dynamic Tax Guides Aggregation (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.6.1', 'Dynamic tax guides dynamically synthesized from accounting_provisions', () => {
    const db = new PortalMultiTenantDB();
    const guidesRes = db.getTaxGuides('comp_tenant_alpha');

    assert.strictEqual(guidesRes.success, true);
    assert.strictEqual(guidesRes.data.length, 3, 'Must return 3 synthesized guides for Alpha (DAS, ICMS, Folha)');

    const das = guidesRes.data.find(g => g.tipo_tributo === 'DAS_SIMPLES');
    assert.ok(das, 'DAS guide must be synthesized');
    assert.strictEqual(das.valor_total, 4820.50);
    assert.strictEqual(das.status, 'pendente');
    assert.strictEqual(das.origem_apuracao, 'provisao_contabil');
  });

  suite.add('T1.6.2', 'Tax guides filter by status and competencia', () => {
    const db = new PortalMultiTenantDB();
    const pendingRes = db.getTaxGuides('comp_tenant_alpha', 'pendente', '08/2026');
    assert.strictEqual(pendingRes.data.length, 3);

    const paidRes = db.getTaxGuides('comp_tenant_alpha', 'pago');
    assert.strictEqual(paidRes.data.length, 0);
  });

  // ------------------------------------------------------------------------
  // F7: Dynamic Real PIX Generation (3 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.7.1', 'EMV BR Code payload generation contains valid tags, CNPJ key, and amount', () => {
    const payload = generatePixPayload({
      pixKey: '11111111000111',
      merchantName: 'ALPHA TECNOLOGIA',
      merchantCity: 'SALVADOR',
      amount: 4820.50,
      txid: 'DAS202608',
      description: 'DAS SIMPLES'
    });

    assert.ok(payload.startsWith('000201'), 'PIX must start with Format Indicator 000201');
    assert.ok(payload.includes('br.gov.bcb.pix'), 'PIX must contain BCB GUI');
    assert.ok(payload.includes('11111111000111'), 'PIX must contain company CNPJ');
    assert.ok(payload.includes('4820.50'), 'PIX must contain exact amount');
    assert.ok(payload.includes('6304'), 'PIX must contain CRC16 tag 6304');
  });

  suite.add('T1.7.2', 'PIX CRC16-CCITT checksum mathematical validity', () => {
    const payload = generatePixPayload({
      pixKey: '11111111000111',
      merchantName: 'ALPHA TECNOLOGIA',
      merchantCity: 'SALVADOR',
      amount: 1240.00,
      txid: 'ICMS202608'
    });

    const parsed = parseAndValidatePixPayload(payload);
    assert.strictEqual(parsed.valid, true, 'CRC16 checksum must pass validation');
    assert.strictEqual(parsed.amount, 1240.00);
  });

  suite.add('T1.7.3', 'Tampered PIX payload is rejected by CRC16 validator', () => {
    const payload = generatePixPayload({
      pixKey: '11111111000111',
      merchantName: 'ALPHA TECNOLOGIA',
      merchantCity: 'SALVADOR',
      amount: 100.00
    });

    // Tamper with payload amount without updating checksum
    const tampered = payload.replace('100.00', '999.00');
    const parsed = parseAndValidatePixPayload(tampered);
    assert.strictEqual(parsed.valid, false, 'Tampered PIX string must fail CRC validation');
    assert.match(parsed.error, /CRC16 mismatch/i);
  });

  // ------------------------------------------------------------------------
  // F8: Strict Multi-Tenant Isolation (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.8.1', 'Tenant Alpha data is completely isolated from Tenant Beta', () => {
    const db = new PortalMultiTenantDB();
    const summaryAlpha = db.getDashboardSummary('comp_tenant_alpha');
    const summaryBeta = db.getDashboardSummary('comp_tenant_beta');

    assert.strictEqual(summaryAlpha.data.bank_balance, 75000.00);
    assert.strictEqual(summaryBeta.data.bank_balance, 210000.00);

    assert.strictEqual(summaryAlpha.data.simples_nacional.rbt12, 50000.00);
    assert.strictEqual(summaryBeta.data.simples_nacional.rbt12, 120000.00);

    const guidesAlpha = db.getTaxGuides('comp_tenant_alpha');
    const guidesBeta = db.getTaxGuides('comp_tenant_beta');

    assert.strictEqual(guidesAlpha.data.length, 3);
    assert.strictEqual(guidesBeta.data.length, 1);
    assert.ok(guidesAlpha.data.every(g => g.company_id === 'comp_tenant_alpha'));
    assert.ok(guidesBeta.data.every(g => g.company_id === 'comp_tenant_beta'));
  });

  suite.add('T1.8.2', 'Omitting company_id throws parameter required error without leaking default', () => {
    const db = new PortalMultiTenantDB();
    assert.throws(() => {
      db.getDashboardSummary(null);
    }, /company_id é obrigatório/i);

    assert.throws(() => {
      db.getTaxGuides('');
    }, /company_id é obrigatório/i);
  });

  // ------------------------------------------------------------------------
  // F9: 3-Step Guided Invoice Issuer (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.9.1', 'Invoice issuance workflow completes through 3 steps and produces authorized note', () => {
    const session = new PortalSession('comp_tenant_alpha', 'Alpha Tecnologia');

    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Cliente Corporativo S.A.',
      whatsapp: '5571999998888'
    });
    session.setIssuerStep2({
      descricao: 'Desenvolvimento e Consultoria de Software',
      valor: 8500.00,
      aliquota_iss: 2.0
    });

    const emission = session.emitInvoiceStep3();
    assert.strictEqual(emission.success, true);
    assert.strictEqual(emission.data.status, 'autorizada');
    assert.strictEqual(emission.data.valor_total, 8500.00);
    assert.strictEqual(emission.data.valor_iss, 170.00);
    assert.ok(emission.data.pix_code.startsWith('000201'));
  });

  suite.add('T1.9.2', 'WhatsApp share link contains encoded customer name and PIX payload', () => {
    const session = new PortalSession('comp_tenant_alpha', 'Alpha Tecnologia');

    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Farmácia Central Ltda',
      whatsapp: '5571991234567'
    });
    session.setIssuerStep2({
      descricao: 'Serviço de Auditoria Fiscal',
      valor: 3200.00
    });

    const emission = session.emitInvoiceStep3();
    const shareUrl = emission.data.whatsapp_share_url;

    assert.ok(shareUrl.startsWith('https://api.whatsapp.com/send?phone=5571991234567'));
    assert.ok(shareUrl.includes(encodeURIComponent('Farmácia Central Ltda')));
    assert.ok(shareUrl.includes(encodeURIComponent(emission.data.pix_code)));
  });

  // ------------------------------------------------------------------------
  // F10: Receipt OCR Scanner & Auto-Match (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.10.1', 'OCR extracts CNPJ, Date, and Amount from receipt text', () => {
    const rawText = `POSTO IPIRANGA COMBUSTIVEIS
    CNPJ: 12.345.678/0001-90
    DATA: 2026-08-27 14:30:00
    VALOR TOTAL: R$ 350,00`;

    const extracted = extractReceiptTokens(rawText);
    assert.strictEqual(extracted.cnpj, '12.345.678/0001-90');
    assert.strictEqual(extracted.data_emissao, '2026-08-27');
    assert.strictEqual(extracted.valor_total, 350.00);
    assert.strictEqual(extracted.categoria_sugerida, 'Combustíveis & Frotas');
  });

  suite.add('T1.10.2', 'Auto-match engine links receipt with open payable', () => {
    const session = new PortalSession('comp_tenant_alpha');
    const rawText = `DELL COMPUTADORES BRASIL
    CNPJ: 72.381.189/0001-10
    DATA: ${new Date().toISOString().split('T')[0]}
    VALOR TOTAL: R$ 3179,50`;

    const scanRes = session.scanReceipt(rawText, 'recibo_dell.jpg');
    assert.strictEqual(scanRes.data.match_status, 'MATCHED');
    assert.strictEqual(scanRes.data.matched_payable.id, 'inst_alpha_pag_01');
  });

  // ------------------------------------------------------------------------
  // F11: Responsive Hybrid Layout (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T1.11.1', 'Mobile viewport (<768px) sets mobile_pwa mode', () => {
    const session = new PortalSession();
    session.setViewportWidth(375);
    assert.strictEqual(session.getLayoutMode(), 'mobile_pwa');
  });

  suite.add('T1.11.2', 'Desktop viewport (>=768px) sets desktop_expanded mode', () => {
    const session = new PortalSession();
    session.setViewportWidth(1280);
    assert.strictEqual(session.getLayoutMode(), 'desktop_expanded');
  });

  return suite;
}
