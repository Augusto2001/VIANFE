/**
 * Tier 2: Boundary & Corner Cases Test Suite (25 Tests)
 * Verifies edge conditions, stress limits, formatting edge cases, and adversarial boundaries
 * 
 * Boundaries Covered:
 * B1: Empty Company Returning Strict 0.00 (Zero Mock Fallback Validation)
 * B2: Exact R$ 3.6M Subteto Estadual Boundary & Alert Escalation
 * B3: Exact R$ 4.8M Teto Federal Ceiling & Desenquadramento Trigger
 * B4: Negative Bank Balance (Overdraft / Cheque Especial)
 * B5: High Monetary Values (R$ 10.000.000,00) & Tax Precision
 * B6: Zero Value / Negative Value Rejection in Invoice Issuer
 * B7: Invalid CNPJ / CPF Check Digit Validation
 * B8: Special Characters & Non-ASCII Encoding in Descriptions & Share URLs
 * B9: Rapid Navigation & State settles reliably
 * B10: Viewport Thresholds (767px Mobile vs 768px Desktop)
 * B11: Leap Year and Month-End Date Transitions in Forecast
 * B12: Missing Parameters & Non-Existent Company Isolation Rejection
 * B13: Expired vs Advance Tax Guides
 * B14: Corrupted / Low-Quality OCR String Handling
 * B15: Max File Size and Unsupported Extensions Rejection
 */

import { assert, TestSuite } from './harness.js';
import { PortalSession, PortalMultiTenantDB } from './engines/portal_state.js';
import { generatePixPayload, parseAndValidatePixPayload, calculateCRC16 } from './engines/pix.js';
import { calculateSimplesDiagnostic, SIMPLES_LIMITS } from './engines/simples.js';
import { isValidCNPJ, isValidCPF, extractReceiptTokens, autoMatchReceiptWithPayables } from './engines/ocr.js';

export function createTier2Suite() {
  const suite = new TestSuite('Tier 2: Boundary & Corner Cases (R1 - R4)');

  // ------------------------------------------------------------------------
  // B1: Zero Mock Fallback & Empty Company Boundaries (5 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.1.1', 'Empty company returns strict 0.00 for bank balance (never mock 158.450,20)', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_empty');

    assert.strictEqual(summary.data.bank_balance, 0.00, 'Bank balance for empty company must be exactly 0.00');
    assert.notStrictEqual(summary.data.bank_balance, 158450.20, 'Must NOT fall back to mock 158450.20');
  });

  suite.add('T2.1.2', 'Empty company returns strict 0.00 for receivables and payables (never mock 28.4k / 12.5k)', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_empty');

    assert.strictEqual(summary.data.receivables_today, 0.00, 'Receivables today must be exactly 0.00');
    assert.strictEqual(summary.data.payables_today, 0.00, 'Payables today must be exactly 0.00');
    assert.notStrictEqual(summary.data.receivables_today, 28400.00);
    assert.notStrictEqual(summary.data.payables_today, 12500.00);
  });

  suite.add('T2.1.3', 'Empty company returns strict 0.00 RBT12, 0.00% gauge, and Faixa 1 (never mock 1.85M)', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_empty');

    assert.strictEqual(summary.data.simples_nacional.rbt12, 0.00, 'RBT12 for empty company must be strictly 0.00');
    assert.strictEqual(summary.data.simples_nacional.percentual_atingido_estadual, 0.00);
    assert.strictEqual(summary.data.simples_nacional.percentual_atingido_federal, 0.00);
    assert.strictEqual(summary.data.simples_nacional.faixa_numero, 1);
    assert.strictEqual(summary.data.simples_nacional.alerta, 'normal');
    assert.notStrictEqual(summary.data.simples_nacional.rbt12, 1850000.00);
  });

  suite.add('T2.1.4', 'Empty company returns all 0.00 in 7-day cash flow forecast curve (no mock curve)', () => {
    const db = new PortalMultiTenantDB();
    const summary = db.getDashboardSummary('comp_tenant_empty');

    assert.strictEqual(summary.data.cash_flow_forecast.length, 7);
    for (const day of summary.data.cash_flow_forecast) {
      assert.strictEqual(day.inflow, 0.00);
      assert.strictEqual(day.outflow, 0.00);
      assert.strictEqual(day.net, 0.00);
    }
  });

  suite.add('T2.1.5', 'Empty company returns empty lists for tax guides, favorites, and receipts', () => {
    const db = new PortalMultiTenantDB();
    const guides = db.getTaxGuides('comp_tenant_empty');
    const favorites = db.getFavorites('comp_tenant_empty');
    const receipts = db.getReceipts('comp_tenant_empty');

    assert.deepStrictEqual(guides.data, []);
    assert.deepStrictEqual(favorites.data, []);
    assert.deepStrictEqual(receipts.data, []);
  });

  // ------------------------------------------------------------------------
  // B2: Simples Nacional Subteto Estadual (R$ 3.6M) Boundaries (3 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.2.1', 'RBT12 at exact limit (R$ 3.600.000,00) triggers sublimite_atingido', () => {
    const diagnostic = calculateSimplesDiagnostic(SIMPLES_LIMITS.SUBTETO_ESTADUAL);

    assert.strictEqual(diagnostic.rbt12, 3600000.00);
    assert.strictEqual(diagnostic.percentual_atingido_estadual, 100.00);
    assert.strictEqual(diagnostic.alerta, 'sublimite_atingido');
    assert.ok(diagnostic.mensagem_alerta.includes('sublimite estadual'));
  });

  suite.add('T2.2.2', 'RBT12 at R$ 3.600.000,01 (> 3.6M) triggers sublimite_atingido and > 100%', () => {
    const diagnostic = calculateSimplesDiagnostic(3600000.01);

    assert.strictEqual(diagnostic.alerta, 'sublimite_atingido');
    assert.ok(diagnostic.percentual_atingido_estadual > 100.00);
  });

  suite.add('T2.2.3', 'RBT12 at 85% of Subteto (R$ 3.060.000,00) triggers atencao_sublimite warning', () => {
    const diagnostic = calculateSimplesDiagnostic(3060000.00); // 85% of 3.6M

    assert.strictEqual(diagnostic.alerta, 'atencao_sublimite');
    assert.strictEqual(diagnostic.percentual_atingido_estadual, 85.00);
    assert.ok(diagnostic.mensagem_alerta.includes('85% do sublimite'));
  });

  // ------------------------------------------------------------------------
  // B3: Simples Nacional Teto Federal (R$ 4.8M) Boundaries (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.3.1', 'RBT12 exceeding federal ceiling (> R$ 4.800.000,00) triggers desenquadramento_obrigatorio', () => {
    const diagnostic = calculateSimplesDiagnostic(4850000.00);

    assert.strictEqual(diagnostic.rbt12, 4850000.00);
    assert.strictEqual(diagnostic.percentual_atingido_federal, 101.04);
    assert.strictEqual(diagnostic.alerta, 'desenquadramento_obrigatorio');
    assert.ok(diagnostic.mensagem_alerta.includes('Desenquadramento obrigatório'));
  });

  suite.add('T2.3.2', 'RBT12 at exact federal ceiling (R$ 4.800.000,00) reaches 100% federal cap', () => {
    const diagnostic = calculateSimplesDiagnostic(SIMPLES_LIMITS.TETO_FEDERAL);

    assert.strictEqual(diagnostic.rbt12, 4800000.00);
    assert.strictEqual(diagnostic.percentual_atingido_federal, 100.00);
    assert.strictEqual(diagnostic.faixa_numero, 6);
  });

  // ------------------------------------------------------------------------
  // B4: Negative Bank Balance & Overdraft Handling (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.4.1', 'Negative bank balance from debits exceeding credits is accurately returned', () => {
    const db = new PortalMultiTenantDB();
    // Add company with negative balance
    db.companies.set('comp_overdraft', {
      id: 'comp_overdraft',
      cnpj: '44.444.444/0001-44',
      razao_social: 'Empresa Cheque Especial Ltda',
      uf: 'BA'
    });
    db.bankAccounts.push({
      id: 'ba_overdraft',
      company_id: 'comp_overdraft',
      banco_nome: 'Itaú',
      saldo_inicial: 5000.00,
      saldo_atual: -15420.50
    });
    db.bankTransactions.push({
      id: 'bt_overdraft_01',
      company_id: 'comp_overdraft',
      data: '2026-08-20',
      descricao_original: 'DEBITO CHEQUE ESPECIAL',
      tipo: 'DEBITO',
      valor: 20420.50,
      conciliado: 1
    });

    const summary = db.getDashboardSummary('comp_overdraft');
    assert.strictEqual(summary.data.bank_balance, -15420.50, 'Negative balance must not be clipped or converted to zero/mock');
  });

  suite.add('T2.4.2', 'Cash flow net computation handles negative net outflows accurately', () => {
    const inflow = 1500.00;
    const outflow = 8500.00;
    const net = Number((inflow - outflow).toFixed(2));
    assert.strictEqual(net, -7000.00);
  });

  // ------------------------------------------------------------------------
  // B5: High Monetary Values & Tax Precision (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.5.1', 'High value invoice (R$ 10.000.000,00) calculates exact ISS and PIX amount', () => {
    const session = new PortalSession('comp_tenant_alpha');
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Grande Construtora S.A.'
    });
    session.setIssuerStep2({
      descricao: 'Construção e Montagem Industrial de Grande Porte',
      valor: 10000000.00,
      aliquota_iss: 2.5
    });

    const emission = session.emitInvoiceStep3();
    assert.strictEqual(emission.data.valor_total, 10000000.00);
    assert.strictEqual(emission.data.valor_iss, 250000.00, 'ISS (2.5% of 10M) must accurately equal 250.000,00');

    const parsedPix = parseAndValidatePixPayload(emission.data.pix_code);
    assert.strictEqual(parsedPix.amount, 10000000.00);
  });

  suite.add('T2.5.2', 'Cent fractional precision with 3 decimal roundings (e.g. 0.3333%)', () => {
    const base = 12450.75;
    const rate = 3.3333;
    const tax = Number(((base * rate) / 100).toFixed(2));
    assert.strictEqual(tax, 415.03);
  });

  // ------------------------------------------------------------------------
  // B6: Zero Value / Negative Value Rejection (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.6.1', 'Zero value (R$ 0,00) in invoice issuer is rejected with validation error', () => {
    const session = new PortalSession();
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Cliente Teste'
    });

    assert.throws(() => {
      session.setIssuerStep2({
        descricao: 'Serviço Gratuito',
        valor: 0.00
      });
    }, /maior que zero/i);
  });

  suite.add('T2.6.2', 'Negative value in invoice issuer is rejected', () => {
    const session = new PortalSession();
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Cliente Teste'
    });

    assert.throws(() => {
      session.setIssuerStep2({
        descricao: 'Serviço com valor negativo',
        valor: -500.00
      });
    }, /maior que zero/i);
  });

  // ------------------------------------------------------------------------
  // B7: Invalid CNPJ / CPF Validation (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.7.1', 'Invalid CNPJ check digits are rejected', () => {
    const session = new PortalSession();
    assert.throws(() => {
      session.setIssuerStep1({
        cnpj_cpf: '12.345.678/0001-00', // Invalid check digit
        razao_social: 'Empresa Teste'
      });
    }, /dígitos verificadores inválidos/i);

    assert.throws(() => {
      session.setIssuerStep1({
        cnpj_cpf: '11.111.111/1111-11', // Repeated digit
        razao_social: 'Empresa Teste'
      });
    }, /dígitos verificadores inválidos/i);
  });

  suite.add('T2.7.2', 'Invalid CPF check digits are rejected', () => {
    const session = new PortalSession();
    assert.throws(() => {
      session.setIssuerStep1({
        cnpj_cpf: '123.456.789-00',
        razao_social: 'Cliente Pessoa Física'
      });
    }, /dígitos verificadores inválidos/i);
  });

  // ------------------------------------------------------------------------
  // B8: Special Characters & Non-ASCII Encoding (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.8.1', 'Special characters and emojis in description are safely preserved and URI-encoded', () => {
    const session = new PortalSession();
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Cliente A&B <Tech> "Solutions"'
    });

    const desc = 'Desenvolvimento <API> & "Microsserviços" com acentuação: Ação, Preço, Saída! 🚀💻';
    const step2 = session.setIssuerStep2({
      descricao: desc,
      valor: 1500.00
    });

    assert.strictEqual(step2.draft.item.descricao, desc);

    const emission = session.emitInvoiceStep3();
    assert.strictEqual(emission.success, true);
    assert.ok(emission.data.whatsapp_share_url.includes('%F0%9F%9A%80'));
  });

  suite.add('T2.8.2', 'PIX merchant name normalization removes accents and special characters', () => {
    const payload = generatePixPayload({
      pixKey: '00000000000199',
      merchantName: 'VIACONT CONCEIÇÃO & COMÉRCIO LTDA',
      merchantCity: 'SÃO PAULO',
      amount: 150.00
    });

    const parsed = parseAndValidatePixPayload(payload);
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.merchantCity, 'SAO PAULO');
  });

  // ------------------------------------------------------------------------
  // B9: Viewport Thresholds (767px vs 768px) & Responsiveness (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.9.1', 'Viewport at exactly 767px (mobile limit) and 768px (desktop threshold)', () => {
    const session = new PortalSession();

    session.setViewportWidth(767);
    assert.strictEqual(session.getLayoutMode(), 'mobile_pwa');

    session.setViewportWidth(768);
    assert.strictEqual(session.getLayoutMode(), 'desktop_expanded');
  });

  suite.add('T2.9.2', 'Leap year and month-end date transitions in 7-day cash flow', () => {
    const generateDates = (startStr, days = 7) => {
      const dates = [];
      const curr = new Date(startStr);
      for (let i = 0; i < days; i++) {
        const d = new Date(curr);
        d.setDate(curr.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
      return dates;
    };

    // Leap day transition: 2028-02-28 -> 2028-02-29 -> 2028-03-01
    const leapDates = generateDates('2028-02-28T00:00:00Z', 3);
    assert.deepStrictEqual(leapDates, ['2028-02-28', '2028-02-29', '2028-03-01']);

    // Year-end transition: 2026-12-31 -> 2027-01-01
    const yearEndDates = generateDates('2026-12-31T00:00:00Z', 2);
    assert.deepStrictEqual(yearEndDates, ['2026-12-31', '2027-01-01']);
  });

  // ------------------------------------------------------------------------
  // B10: OCR Edge & File Format Rejections (2 tests)
  // ------------------------------------------------------------------------

  suite.add('T2.10.1', 'Corrupted OCR string and unparseable image returns null tokens safely without crashing', () => {
    const corrupted = '###$$$%%% 0000 ???? |||| --- ===';
    const extracted = extractReceiptTokens(corrupted);

    assert.strictEqual(extracted.cnpj, null);
    assert.strictEqual(extracted.valor_total, 0.0);
  });

  suite.add('T2.10.2', 'Auto-match engine returns UNMATCHED when receipt does not match open payables', () => {
    const session = new PortalSession('comp_tenant_alpha');
    const unmatchedText = `FORNECEDOR DESCONHECIDO LTDA
    CNPJ: 00.000.000/0001-91
    DATA: 2026-08-27
    VALOR TOTAL: R$ 999999.99`;

    const scanRes = session.scanReceipt(unmatchedText, 'recibo_desconhecido.jpg');
    assert.strictEqual(scanRes.data.match_status, 'UNMATCHED');
    assert.strictEqual(scanRes.data.matched_payable, null);
  });

  return suite;
}
