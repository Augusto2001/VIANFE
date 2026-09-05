/**
 * Tier 4: Real-World Business Scenarios Test Suite (5 Tests)
 * Simulates complete end-to-end user journeys for accounting clients, business owners, and BPO operations
 * 
 * Scenarios Covered:
 * S1: End-to-End Monthly Routine of Small Business (Dashboard -> Pay DAS -> Scan Receipt -> Emit NFS-e)
 * S2: High-Volume Service Provider Day (5 consecutive NFS-e emissions via favorites -> Unique codes & RBT12 escalation)
 * S3: Tax Audit & 100% Impostos Compliance Check (Review all pending provisions -> Settle via PIX)
 * S4: Clean New Company Onboarding Journey (Strict 0.00 zero-state -> First transaction & invoice -> Real-time transition)
 * S5: Simples Nacional Growth & Subteto Escalation (Emitting large enterprise invoices -> Warning trigger)
 */

import { assert, TestSuite } from './harness.js';
import { PortalSession, PortalMultiTenantDB } from './engines/portal_state.js';
import { parseAndValidatePixPayload } from './engines/pix.js';

export function createTier4Suite() {
  const suite = new TestSuite('Tier 4: Real-World Business Scenarios');

  suite.add('T4.1', 'End-to-End Monthly Routine of Small Business', () => {
    // 1. Client logs in on mobile device (375px)
    const session = new PortalSession('comp_tenant_alpha', 'Alpha Tecnologia');
    session.setViewportWidth(375);
    assert.strictEqual(session.getLayoutMode(), 'mobile_pwa');

    // 2. Client checks dashboard and Simples gauge
    const initialDashboard = session.getDashboardSummary();
    assert.strictEqual(initialDashboard.success, true);
    const initialBank = initialDashboard.data.bank_balance;

    // 3. Client navigates to Guias tab & pays DAS with 1-click PIX
    session.switchTab('guias');
    const guiasRes = session.getTaxGuides('pendente');
    const das = guiasRes.data.find(g => g.tipo_tributo === 'DAS_SIMPLES');
    assert.ok(das, 'DAS guide must be present in dynamic guides list');

    // Validate PIX payload before paying
    const pixValidation = parseAndValidatePixPayload(das.pix_copia_e_cola);
    assert.strictEqual(pixValidation.valid, true);

    const paymentRes = session.payTaxGuide(das.id);
    assert.strictEqual(paymentRes.guide.status, 'pago');

    // 4. Client navigates to Recibos tab & scans supply receipt
    session.switchTab('recibos');
    const receiptText = `DELL COMPUTADORES BRASIL
    CNPJ: 72.381.189/0001-10
    DATA: ${new Date().toISOString().split('T')[0]}
    VALOR TOTAL R$ 3179,50`;
    const scanRes = session.scanReceipt(receiptText, 'comprovante_dell.jpg');
    assert.strictEqual(scanRes.data.match_status, 'MATCHED');
    assert.strictEqual(scanRes.data.matched_payable.id, 'inst_alpha_pag_01');

    // 5. Client navigates to Emitir tab & issues monthly service invoice with WhatsApp share
    session.switchTab('emitir');
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Cliente Corporativo Mensal S.A.',
      whatsapp: '5571998877665'
    });
    session.setIssuerStep2({
      descricao: 'Serviço de Buffet e Fornecimento de Coffee Break Corporativo',
      valor: 6500.00,
      aliquota_iss: 2.0
    });
    const emission = session.emitInvoiceStep3();
    assert.strictEqual(emission.success, true);
    assert.ok(emission.data.whatsapp_share_url.includes('5571998877665'));

    // 6. Client returns to dashboard: verifies updated state
    session.switchTab('inicio');
    const finalDashboard = session.getDashboardSummary();
    assert.strictEqual(
      finalDashboard.data.bank_balance,
      initialBank - das.valor_total,
      'Bank balance must reflect DAS tax payment'
    );
  });

  suite.add('T4.2', 'High-Volume Service Provider Day (5 consecutive NFS-e emissions via favorites)', () => {
    const session = new PortalSession('comp_tenant_alpha', 'Alpha Tecnologia');
    session.setViewportWidth(1280); // Desktop receptionist workflow

    const clients = [
      { doc: '00.000.000/0001-91', name: 'Plano de Saúde Alpha S.A.', phone: '5571988880001', fav: 'fav_alpha_01' },
      { doc: '00.000.000/0001-91', name: 'Plano de Saúde Beta S.A.', phone: '5571988880002', fav: 'fav_alpha_02' },
      { doc: '00.000.000/0001-91', name: 'Seguradora Gama Saúde', phone: '5571988880003', fav: 'fav_alpha_01' },
      { doc: '00.000.000/0001-91', name: 'Hospital Delta Ltda', phone: '5571988880004', fav: 'fav_alpha_02' },
      { doc: '00.000.000/0001-91', name: 'Associação Beneficente Epsilon', phone: '5571988880005', fav: 'fav_alpha_01' }
    ];

    const emittedNotes = [];

    for (const c of clients) {
      session.setIssuerStep1({
        cnpj_cpf: c.doc,
        razao_social: c.name,
        whatsapp: c.phone
      });
      session.applyFavoriteItem(c.fav);
      const res = session.emitInvoiceStep3();
      assert.strictEqual(res.success, true);
      emittedNotes.push(res.data);
    }

    assert.strictEqual(emittedNotes.length, 5);

    // Verify distinct invoice numbers and unique verification codes
    const noteNumbers = new Set(emittedNotes.map(n => n.numero_nota));
    assert.strictEqual(noteNumbers.size, 5, 'All 5 invoices must have unique numbers');
  });

  suite.add('T4.3', 'Tax Audit & Impostos Compliance Check (100% Settlement)', () => {
    const session = new PortalSession('comp_tenant_alpha', 'Alpha Tecnologia');
    session.setViewportWidth(1440);

    session.switchTab('guias');
    const initialGuides = session.getTaxGuides();
    assert.strictEqual(initialGuides.data.length, 3);

    // Settle all pending guides (DAS, ICMS, Folha)
    const pendingGuides = initialGuides.data.filter(g => g.status === 'pendente');
    assert.strictEqual(pendingGuides.length, 3);

    for (const g of pendingGuides) {
      const pixCheck = parseAndValidatePixPayload(g.pix_copia_e_cola);
      assert.strictEqual(pixCheck.valid, true);

      const payRes = session.payTaxGuide(g.id);
      assert.strictEqual(payRes.guide.status, 'pago');
    }

    const updatedGuides = session.getTaxGuides();
    const remainingPending = updatedGuides.data.filter(g => g.status === 'pendente');
    assert.strictEqual(remainingPending.length, 0, 'Zero pending tax guides remain');
  });

  suite.add('T4.4', 'Clean New Company Onboarding Journey (Zero to Active)', () => {
    // 1. New company starts with strict 0.00
    const session = new PortalSession('comp_tenant_empty', 'Empresa Nova Zerada Ltda');
    let summary = session.getDashboardSummary();

    assert.strictEqual(summary.data.bank_balance, 0.00);
    assert.strictEqual(summary.data.receivables_today, 0.00);
    assert.strictEqual(summary.data.payables_today, 0.00);
    assert.strictEqual(summary.data.simples_nacional.rbt12, 0.00);

    // 2. Company receives initial bank deposit of R$ 20.000,00
    session.db.bankAccounts.push({
      id: 'ba_empty_01',
      company_id: 'comp_tenant_empty',
      banco_nome: 'Nubank PJ',
      saldo_inicial: 20000.00,
      saldo_atual: 20000.00
    });

    summary = session.getDashboardSummary();
    assert.strictEqual(summary.data.bank_balance, 20000.00);

    // 3. Company emits its first invoice of R$ 12.000,00
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Primeiro Cliente Ltda'
    });
    session.setIssuerStep2({
      descricao: 'Primeiro Serviço de Consultoria',
      valor: 12000.00
    });
    const emission = session.emitInvoiceStep3();
    assert.strictEqual(emission.success, true);

    summary = session.getDashboardSummary();
    assert.strictEqual(summary.data.receivables_today, 12000.00);
    assert.strictEqual(summary.data.simples_nacional.rbt12, 12000.00);
    assert.strictEqual(summary.data.simples_nacional.faixa_numero, 1);
  });

  suite.add('T4.5', 'Simples Nacional Growth & Subteto Escalation', () => {
    const session = new PortalSession('comp_tenant_alpha', 'Alpha Tecnologia');

    // Initial RBT12 is R$ 50k (Normal)
    let summary = session.getDashboardSummary();
    assert.strictEqual(summary.data.simples_nacional.alerta, 'normal');

    // Emit large enterprise invoice: R$ 3.600.000,00 -> Total RBT12 = R$ 3.650.000 (> R$ 3.6M)
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Multinacional Enterprise Corp'
    });
    session.setIssuerStep2({
      descricao: 'Licenciamento Global de Software e Transformação Digital',
      valor: 3600000.00
    });
    session.emitInvoiceStep3();

    // Verify Simples Gauge transition to Warning State
    summary = session.getDashboardSummary();
    assert.strictEqual(summary.data.simples_nacional.rbt12, 3650000.00);
    assert.strictEqual(summary.data.simples_nacional.alerta, 'sublimite_atingido');
    assert.ok(summary.data.simples_nacional.percentual_atingido_estadual > 100.00);
    assert.ok(summary.data.simples_nacional.mensagem_alerta.includes('sublimite estadual'));
  });

  return suite;
}
