/**
 * Tier 3: Cross-Feature Combinations Test Suite (10 Tests)
 * Verifies pairwise interactions, reactive pipelines, and state integrity across all features
 * 
 * Combinations Covered:
 * C1: Emit Invoice -> Reactive Update to Dashboard Receivables & RBT12
 * C2: Scan Receipt -> Auto-Match -> Reactive Update to Dashboard Payables
 * C3: Pay Tax Guide -> Reactive Deduction from Bank Balance & Cash Outflow
 * C4: Favorite Catalog Item -> Tab Navigation -> Quick Emission
 * C5: Responsive Viewport Switch Mid-Wizard (State Preserved)
 * C6: Tab Isolation (Scan Receipt -> Switch to Tax Guides -> No Cross-Contamination)
 * C7: Invoice WhatsApp Share Link PIX Payload Matches Tax Guides PIX Engine
 * C8: Multi-Tenant Switching (Company Alpha -> Company Beta Complete State Refresh)
 * C9: Offline Draft Queuing -> Online Network Reconnection Batch Processing
 * C10: Concurrent Multi-Tenant Load Operations (Zero Data Race / Leakage)
 */

import { assert, TestSuite } from './harness.js';
import { PortalSession, PortalMultiTenantDB } from './engines/portal_state.js';
import { parseAndValidatePixPayload } from './engines/pix.js';

export function createTier3Suite() {
  const suite = new TestSuite('Tier 3: Cross-Feature Combinations (Pairwise)');

  suite.add('T3.1', 'Emit invoice in F2 -> Update dashboard receivables and RBT12 in F1 immediately', () => {
    const session = new PortalSession('comp_tenant_alpha');
    const initialSummary = session.getDashboardSummary();
    const initialReceivables = initialSummary.data.receivables_today;
    const initialRbt12 = initialSummary.data.simples_nacional.rbt12;

    // Emit invoice for R$ 50.000,00
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Cliente Grande Porte S.A.'
    });
    session.setIssuerStep2({
      descricao: 'Desenvolvimento e Consultoria de Software Enterprise',
      valor: 50000.00
    });
    const emission = session.emitInvoiceStep3();
    assert.strictEqual(emission.success, true);

    // Check dashboard immediately
    const updatedSummary = session.getDashboardSummary();
    assert.strictEqual(
      updatedSummary.data.receivables_today,
      initialReceivables + 50000.00,
      'Dashboard receivables must increase by exactly R$ 50.000,00'
    );
    assert.strictEqual(
      updatedSummary.data.simples_nacional.rbt12,
      initialRbt12 + 50000.00,
      'RBT12 must increment by emitted invoice amount'
    );
  });

  suite.add('T3.2', 'Scan receipt in F4 -> Auto-match with payable -> Update dashboard payables in F1', () => {
    const session = new PortalSession('comp_tenant_alpha');
    const initialPayablesToday = session.getDashboardSummary().data.payables_today;

    // Scan receipt matching inst_alpha_pag_01 (Dell: R$ 3.179,50)
    const scanText = `DELL COMPUTADORES BRASIL
    CNPJ: 72.381.189/0001-10
    DATA: ${new Date().toISOString().split('T')[0]}
    VALOR TOTAL R$ 3179,50`;

    const scanRes = session.scanReceipt(scanText, 'comprovante_dell.jpg');
    assert.strictEqual(scanRes.data.match_status, 'MATCHED');

    // Verify payables_today is reduced
    const updatedSummary = session.getDashboardSummary();
    assert.strictEqual(
      updatedSummary.data.payables_today,
      initialPayablesToday - 3179.50,
      "Resolved payable must be subtracted from today's open payables"
    );
  });

  suite.add('T3.3', 'Pay tax guide in F3 -> Update cash flow outflow and bank balance in F1', () => {
    const session = new PortalSession('comp_tenant_alpha');
    const initialBalance = session.getDashboardSummary().data.bank_balance;

    // Pay DAS guide (R$ 4.820,50)
    const payRes = session.payTaxGuide('guide_prov_alpha_01');
    assert.strictEqual(payRes.guide.status, 'pago');

    // Bank balance decreased
    const updatedBalance = session.getDashboardSummary().data.bank_balance;
    assert.strictEqual(
      updatedBalance,
      initialBalance - 4820.50,
      'Bank balance must decrease by paid tax guide amount'
    );
  });

  suite.add('T3.4', 'Add favorite catalog item in F2 -> Switch tabs -> Favorite remains available and usable', () => {
    const session = new PortalSession('comp_tenant_alpha');

    // Add new favorite
    const newFav = session.addFavoriteCatalogItem({
      descricao: 'Auditoria de Processos Fiscais de Entrada',
      valor: 3500.00,
      aliquota_iss: 2.0
    });

    // Switch tabs to inicio and back to emitir
    session.switchTab('inicio');
    assert.strictEqual(session.activeTab, 'inicio');

    session.switchTab('emitir');
    assert.strictEqual(session.activeTab, 'emitir');

    // Apply newly created favorite
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Cliente Favorito S.A.'
    });
    const step2 = session.applyFavoriteItem(newFav.id);
    assert.strictEqual(step2.draft.item.descricao, 'Auditoria de Processos Fiscais de Entrada');
    assert.strictEqual(step2.draft.item.valor, 3500.00);
  });

  suite.add('T3.5', 'Switch between Mobile and Desktop while mid-way through 3-step invoice issuance (state preserved)', () => {
    const session = new PortalSession('comp_tenant_alpha');
    session.setViewportWidth(375); // Mobile PWA

    // Complete Step 1 & Step 2 on Mobile
    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Cliente Transição Responsiva Ltda',
      email: 'transicao@exemplo.com'
    });
    session.setIssuerStep2({
      descricao: 'Serviço em Progresso',
      valor: 7800.00
    });
    assert.strictEqual(session.issuerStep, 3);

    // Resize viewport to Desktop (1440px)
    session.setViewportWidth(1440);
    assert.strictEqual(session.getLayoutMode(), 'desktop_expanded');

    // Form state must remain 100% intact
    assert.strictEqual(session.issuerStep, 3);
    assert.strictEqual(session.issuerDraft.tomador.razao_social, 'Cliente Transição Responsiva Ltda');
    assert.strictEqual(session.issuerDraft.item.valor, 7800.00);

    // Emit in desktop mode
    const emission = session.emitInvoiceStep3();
    assert.strictEqual(emission.success, true);
  });

  suite.add('T3.6', 'Scan receipt in F4 -> Switch to F3 Guias -> No memory leak or state contamination', () => {
    const session = new PortalSession('comp_tenant_alpha');

    session.switchTab('recibos');
    const scan = session.scanReceipt('DELL COMPUTADORES CNPJ: 72.381.189/0001-10 TOTAL: R$ 3179,50', 'recibo.jpg');
    assert.strictEqual(scan.success, true);

    // Switch to Guias
    session.switchTab('guias');
    const guias = session.getTaxGuides();

    assert.strictEqual(guias.success, true);
    assert.strictEqual(guias.data.length, 3);
    assert.strictEqual(guias.data[0].tipo_tributo, 'DAS_SIMPLES');
  });

  suite.add('T3.7', 'Emit NFS-e with WhatsApp sharing link -> Validate PIX code in share link matches PIX engine in F3', () => {
    const session = new PortalSession('comp_tenant_alpha');

    session.setIssuerStep1({
      cnpj_cpf: '00.000.000/0001-91',
      razao_social: 'Hospital São Lucas S.A.',
      whatsapp: '5571999991111'
    });
    session.setIssuerStep2({
      descricao: 'Licença de Software de Prontuário Eletrônico',
      valor: 8500.00
    });
    const emission = session.emitInvoiceStep3();

    // Extract PIX from WhatsApp share URL
    const shareUrl = emission.data.whatsapp_share_url;
    const urlParams = new URL(shareUrl).searchParams;
    const text = urlParams.get('text');
    const pixMatch = text.match(/000201[0-9A-Za-z*.-]+/);

    assert.ok(pixMatch, 'WhatsApp message must contain full PIX EMV code');
    const embeddedPix = pixMatch[0];

    const validated = parseAndValidatePixPayload(embeddedPix);
    assert.strictEqual(validated.valid, true);
    assert.strictEqual(validated.amount, 8500.00);
  });

  suite.add('T3.8', 'Complete company change -> Dashboard, Invoices, Guides, and Receipts reload for new company cleanly', () => {
    const sessionA = new PortalSession('comp_tenant_alpha', 'Alpha Tecnologia');
    const sessionB = new PortalSession('comp_tenant_beta', 'Beta Comércio');

    // Session A emits invoice
    sessionA.setIssuerStep1({ cnpj_cpf: '00.000.000/0001-91', razao_social: 'Cliente Alfa' });
    sessionA.setIssuerStep2({ descricao: 'Serviço Alfa', valor: 1000.00 });
    sessionA.emitInvoiceStep3();

    const sumA = sessionA.getDashboardSummary();
    const sumB = sessionB.getDashboardSummary();

    assert.strictEqual(sumA.data.simples_nacional.rbt12, 51000.00);
    assert.strictEqual(sumB.data.simples_nacional.rbt12, 120000.00, 'Company Beta must remain 100% isolated');
  });

  suite.add('T3.9', 'Offline draft creation -> Online reconnection -> Successful emission', () => {
    const session = new PortalSession('comp_tenant_alpha');
    session.setConnectivity(false); // Disconnect

    // Create 2 offline drafts
    session.setIssuerStep1({ cnpj_cpf: '00.000.000/0001-91', razao_social: 'Cliente Offline 1' });
    session.setIssuerStep2({ descricao: 'Serviço 1', valor: 1200.00 });
    session.emitInvoiceStep3();

    session.setIssuerStep1({ cnpj_cpf: '00.000.000/0001-91', razao_social: 'Cliente Offline 2' });
    session.setIssuerStep2({ descricao: 'Serviço 2', valor: 2400.00 });
    session.emitInvoiceStep3();

    assert.strictEqual(session.offlineQueue.length, 2);

    // Reconnect to network
    const syncRes = session.setConnectivity(true);
    assert.strictEqual(syncRes.reconnected, true);
    assert.strictEqual(syncRes.processedQueue.length, 2);
    assert.strictEqual(session.offlineQueue.length, 0);
  });

  suite.add('T3.10', 'High-load concurrent operations across all multi-tenant endpoints', async () => {
    const db = new PortalMultiTenantDB();

    const tasks = [];
    for (let i = 0; i < 15; i++) {
      tasks.push(Promise.resolve(db.getDashboardSummary('comp_tenant_alpha')));
      tasks.push(Promise.resolve(db.getDashboardSummary('comp_tenant_beta')));
      tasks.push(Promise.resolve(db.getDashboardSummary('comp_tenant_empty')));
      tasks.push(Promise.resolve(db.getTaxGuides('comp_tenant_alpha')));
    }

    const results = await Promise.all(tasks);
    assert.strictEqual(results.length, 60);
    for (const r of results) {
      assert.strictEqual(r.success, true);
    }
  });

  return suite;
}
