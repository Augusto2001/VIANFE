/**
 * Portal State Machine & Deterministic Data Engine
 * Simulates Multi-Tenant Backend & Client Portal State
 * Super App Viacont (Área do Cliente & BPO Financeiro)
 */

import { generatePixPayload, parseAndValidatePixPayload } from './pix.js';
import { calculateSimplesDiagnostic } from './simples.js';
import { isValidCNPJ, isValidCPF, extractReceiptTokens, autoMatchReceiptWithPayables } from './ocr.js';

export class PortalMultiTenantDB {
  constructor() {
    this.companies = new Map();
    this.bankAccounts = [];
    this.bankTransactions = [];
    this.invoices = [];
    this.invoiceInstallments = [];
    this.accountingProvisions = [];
    this.taxGuides = [];
    this.receiptsOcr = [];
    this.favoriteItems = [];
    this.recurringClients = [];
    this.seedDefaultTenants();
  }

  seedDefaultTenants() {
    // 1. Tenant Alpha (Active Tech Company with Transactions)
    this.companies.set('comp_tenant_alpha', {
      id: 'comp_tenant_alpha',
      cnpj: '11.111.111/0001-11',
      razao_social: 'Alpha Tecnologia e Sistemas Ltda',
      nome_fantasia: 'Alpha Tech',
      uf: 'BA'
    });

    // Tenant Alpha: Bank Account with initial balance 25.000,00
    this.bankAccounts.push({
      id: 'ba_alpha_01',
      company_id: 'comp_tenant_alpha',
      banco_nome: 'Itaú Unibanco',
      saldo_inicial: 25000.00,
      saldo_atual: 75000.00
    });

    // Tenant Alpha: Bank Transactions (Credit: 60.000, Debit: 10.000 -> net +50.000 + 25.000 = 75.000)
    this.bankTransactions.push(
      {
        id: 'bt_alpha_01',
        company_id: 'comp_tenant_alpha',
        bank_account_id: 'ba_alpha_01',
        data: '2026-08-15',
        descricao_original: 'RECEBIMENTO PIX CLIENTE ALPHA',
        tipo: 'CREDITO',
        valor: 60000.00,
        conciliado: 1
      },
      {
        id: 'bt_alpha_02',
        company_id: 'comp_tenant_alpha',
        bank_account_id: 'ba_alpha_01',
        data: '2026-08-20',
        descricao_original: 'PAGAMENTO SERVIDORES AWS',
        tipo: 'DEBITO',
        valor: 10000.00,
        conciliado: 1
      }
    );

    const todayStr = new Date().toISOString().split('T')[0];

    // Tenant Alpha: Invoices (5 invoices totaling R$ 50.000,00 in last 12m)
    for (let i = 1; i <= 5; i++) {
      this.invoices.push({
        id: `inv_alpha_${i}`,
        company_id: 'comp_tenant_alpha',
        chave_acesso: `CHAVE_ALPHA_2026_000${i}`,
        numero: `100${i}`,
        serie: '1',
        tipo: 'saida',
        status: 'autorizada',
        data_emissao: todayStr,
        emitente_cnpj: '11.111.111/0001-11',
        emitente_nome: 'Alpha Tecnologia e Sistemas Ltda',
        destinatario_cnpj: '99.999.999/0001-99',
        destinatario_nome: `Cliente Alpha ${i}`,
        valor_total: 10000.00
      });

      this.invoiceInstallments.push({
        id: `inst_alpha_rec_${i}`,
        invoice_id: `inv_alpha_${i}`,
        company_id: 'comp_tenant_alpha',
        tipo: 'receber',
        numero_parcela: '1/1',
        data_vencimento: todayStr,
        valor: 10000.00,
        status: 'pendente'
      });
    }

    // Tenant Alpha: 1 Purchase Installment (A Pagar)
    this.invoiceInstallments.push({
      id: 'inst_alpha_pag_01',
      invoice_id: 'inv_alpha_pur_01',
      company_id: 'comp_tenant_alpha',
      tipo: 'pagar',
      numero_parcela: '1/1',
      data_vencimento: todayStr,
      valor: 3179.50,
      status: 'pendente',
      fornecedor_cliente_nome: 'Dell Computadores Brasil',
      fornecedor_cliente_cnpj: '72.381.189/0001-10'
    });

    // Tenant Alpha: Accounting Provisions (DAS, ICMS, Folha)
    this.accountingProvisions.push(
      {
        id: 'prov_alpha_01',
        company_id: 'comp_tenant_alpha',
        tipo_provisao: 'DAS_SIMPLES',
        competencia: '08/2026',
        data_lancamento: todayStr,
        valor: 4820.50,
        historico: 'Provisão DAS Simples Nacional 08/2026',
        status: 'provisionado'
      },
      {
        id: 'prov_alpha_02',
        company_id: 'comp_tenant_alpha',
        tipo_provisao: 'ICMS',
        competencia: '08/2026',
        data_lancamento: todayStr,
        valor: 1240.00,
        historico: 'Provisão ICMS Substituição Tributária 08/2026',
        status: 'provisionado'
      },
      {
        id: 'prov_alpha_03',
        company_id: 'comp_tenant_alpha',
        tipo_provisao: 'FOLHA_SALARIOS',
        competencia: '08/2026',
        data_lancamento: todayStr,
        valor: 1939.50,
        historico: 'Provisão Folha de Pagamento 08/2026',
        status: 'provisionado'
      }
    );

    // Tenant Alpha: Favorites & Recurring Clients
    this.favoriteItems.push(
      {
        id: 'fav_alpha_01',
        company_id: 'comp_tenant_alpha',
        nome_atalho: 'Consultoria TI',
        descricao_padrao: 'Consultoria e Planejamento Tributário',
        valor_padrao: 2500.00,
        aliquota_iss_padrao: 2.0
      },
      {
        id: 'fav_alpha_02',
        company_id: 'comp_tenant_alpha',
        nome_atalho: 'Desenvolvimento Web',
        descricao_padrao: 'Desenvolvimento e Manutenção de Software',
        valor_padrao: 4500.00,
        aliquota_iss_padrao: 2.5
      }
    );

    // 2. Tenant Beta (Active Commerce Company with Different Metrics)
    this.companies.set('comp_tenant_beta', {
      id: 'comp_tenant_beta',
      cnpj: '22.222.222/0001-22',
      razao_social: 'Beta Comércio de Produtos Ltda',
      nome_fantasia: 'Beta Varejo',
      uf: 'SP'
    });

    this.bankAccounts.push({
      id: 'ba_beta_01',
      company_id: 'comp_tenant_beta',
      banco_nome: 'Bradesco',
      saldo_inicial: 100000.00,
      saldo_atual: 210000.00
    });

    this.bankTransactions.push({
      id: 'bt_beta_01',
      company_id: 'comp_tenant_beta',
      bank_account_id: 'ba_beta_01',
      data: '2026-08-10',
      descricao_original: 'RECEBIMENTO CLIENTE BETA',
      tipo: 'CREDITO',
      valor: 110000.00,
      conciliado: 1
    });

    // 3 Invoices totaling R$ 120.000,00
    for (let i = 1; i <= 3; i++) {
      this.invoices.push({
        id: `inv_beta_${i}`,
        company_id: 'comp_tenant_beta',
        chave_acesso: `CHAVE_BETA_2026_000${i}`,
        numero: `200${i}`,
        serie: '1',
        tipo: 'saida',
        status: 'autorizada',
        data_emissao: todayStr,
        emitente_cnpj: '22.222.222/0001-22',
        emitente_nome: 'Beta Comércio de Produtos Ltda',
        destinatario_cnpj: '88.888.888/0001-88',
        destinatario_nome: `Cliente Beta ${i}`,
        valor_total: 40000.00
      });

      this.invoiceInstallments.push({
        id: `inst_beta_rec_${i}`,
        invoice_id: `inv_beta_${i}`,
        company_id: 'comp_tenant_beta',
        tipo: 'receber',
        numero_parcela: '1/1',
        data_vencimento: todayStr,
        valor: 40000.00,
        status: 'pendente'
      });
    }

    this.accountingProvisions.push({
      id: 'prov_beta_01',
      company_id: 'comp_tenant_beta',
      tipo_provisao: 'DAS_SIMPLES',
      competencia: '08/2026',
      data_lancamento: todayStr,
      valor: 15000.00,
      historico: 'Provisão DAS Simples Nacional Beta',
      status: 'provisionado'
    });

    this.favoriteItems.push({
      id: 'fav_beta_01',
      company_id: 'comp_tenant_beta',
      nome_atalho: 'Venda de Equipamento',
      descricao_padrao: 'Equipamento Eletrônico Comercial',
      valor_padrao: 8000.00,
      aliquota_iss_padrao: 0.0
    });

    // 3. Tenant Empty (Brand New Company: Strict 0.00 and Empty Lists)
    this.companies.set('comp_tenant_empty', {
      id: 'comp_tenant_empty',
      cnpj: '33.333.333/0001-33',
      razao_social: 'Empresa Nova Zerada Ltda',
      nome_fantasia: 'Zero Tech',
      uf: 'SC'
    });
    // Has 0 bank accounts, 0 transactions, 0 invoices, 0 installments, 0 provisions, 0 guides, 0 favorites
  }

  // Multi-tenant Query Engines (Matching Real SQL Logic)
  getDashboardSummary(companyId) {
    if (!companyId) {
      throw new Error('Parâmetro company_id é obrigatório.');
    }
    const comp = this.companies.get(companyId);
    if (!comp) {
      throw new Error(`Empresa com ID "${companyId}" não encontrada.`);
    }

    // A. Real Bank Balance (Credits - Debits + Initial Balance)
    const accounts = this.bankAccounts.filter(a => a.company_id === companyId);
    let bankBalance = 0.0;
    if (accounts.length > 0) {
      const txs = this.bankTransactions.filter(t => t.company_id === companyId);
      const credits = txs.filter(t => t.tipo === 'CREDITO').reduce((sum, t) => sum + t.valor, 0);
      const debits = txs.filter(t => t.tipo === 'DEBITO').reduce((sum, t) => sum + t.valor, 0);
      const initial = accounts.reduce((sum, a) => sum + (a.saldo_inicial || 0), 0);
      bankBalance = Number((initial + credits - debits).toFixed(2));
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // B. Real Receivables (A Receber Este Mês / Hoje)
    const receivablesToday = this.invoiceInstallments
      .filter(i => i.company_id === companyId && i.tipo === 'receber' && i.data_vencimento === todayStr && i.status === 'pendente')
      .reduce((sum, i) => sum + i.valor, 0);

    // C. Real Payables (A Pagar Este Mês / Hoje: purchase installments + provisions)
    const purchasePayables = this.invoiceInstallments
      .filter(i => i.company_id === companyId && i.tipo === 'pagar' && i.data_vencimento === todayStr && i.status === 'pendente')
      .reduce((sum, i) => sum + i.valor, 0);

    const provisionsToday = this.accountingProvisions
      .filter(p => p.company_id === companyId && p.data_lancamento === todayStr && p.status === 'provisionado')
      .reduce((sum, p) => sum + p.valor, 0);

    const payablesToday = Number((purchasePayables + provisionsToday).toFixed(2));

    // D. Real RBT12 (Sum of last 12 months issued invoices)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const dateLimit = twelveMonthsAgo.toISOString().split('T')[0];

    const rbt12 = this.invoices
      .filter(inv => inv.company_id === companyId && inv.tipo === 'saida' && inv.status === 'autorizada' && inv.data_emissao >= dateLimit)
      .reduce((sum, inv) => sum + inv.valor_total, 0);

    const simples = calculateSimplesDiagnostic(rbt12);

    // E. Deterministic 7-day Cash Flow Forecast
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      const inVal = this.invoiceInstallments
        .filter(inst => inst.company_id === companyId && inst.tipo === 'receber' && inst.data_vencimento === dateStr)
        .reduce((sum, inst) => sum + inst.valor, 0);

      const outPur = this.invoiceInstallments
        .filter(inst => inst.company_id === companyId && inst.tipo === 'pagar' && inst.data_vencimento === dateStr)
        .reduce((sum, inst) => sum + inst.valor, 0);

      const outProv = this.accountingProvisions
        .filter(p => p.company_id === companyId && p.data_lancamento === dateStr && p.status === 'provisionado')
        .reduce((sum, p) => sum + p.valor, 0);

      const outVal = outPur + outProv;

      forecast.push({
        date: dateStr,
        inflow: Number(inVal.toFixed(2)),
        outflow: Number(outVal.toFixed(2)),
        net: Number((inVal - outVal).toFixed(2))
      });
    }

    return {
      success: true,
      data: {
        company_id: companyId,
        company_name: comp.razao_social,
        bank_balance: Number(bankBalance.toFixed(2)),
        payables_today: Number(payablesToday.toFixed(2)),
        receivables_today: Number(receivablesToday.toFixed(2)),
        cash_flow_forecast: forecast,
        simples_nacional: simples
      }
    };
  }

  // Dynamic Tax Guides (Synthesized from accounting_provisions & tax_guides with real PIX)
  getTaxGuides(companyId, statusFilter, competenciaFilter) {
    if (!companyId) {
      throw new Error('Parâmetro company_id é obrigatório.');
    }
    const comp = this.companies.get(companyId);
    if (!comp) {
      throw new Error(`Empresa com ID "${companyId}" não encontrada.`);
    }

    const cleanCnpj = comp.cnpj.replace(/\D/g, '');

    // 1. Guides from tax_guides table
    let guides = this.taxGuides.filter(g => g.company_id === companyId);

    // 2. Synthesized dynamic guides from accounting_provisions
    const provisions = this.accountingProvisions.filter(p => p.company_id === companyId);
    for (const prov of provisions) {
      const guideStatus = prov.status === 'conciliado_pago' ? 'pago' : 'pendente';
      const pix = generatePixPayload({
        pixKey: cleanCnpj,
        merchantName: comp.razao_social,
        merchantCity: comp.uf === 'BA' ? 'SALVADOR' : 'SAO PAULO',
        amount: prov.valor,
        txid: prov.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20),
        description: prov.tipo_provisao
      });

      guides.push({
        id: `guide_${prov.id}`,
        company_id: companyId,
        tipo_tributo: prov.tipo_provisao,
        titulo: `${prov.tipo_provisao} - Competência ${prov.competencia}`,
        competencia: prov.competencia,
        data_vencimento: prov.data_lancamento,
        valor_total: prov.valor,
        status: guideStatus,
        pix_copia_e_cola: pix,
        origem_apuracao: 'provisao_contabil'
      });
    }

    if (statusFilter && statusFilter !== 'all') {
      guides = guides.filter(g => g.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (competenciaFilter) {
      guides = guides.filter(g => g.competencia === competenciaFilter);
    }

    return {
      success: true,
      data: guides
    };
  }

  getFavorites(companyId) {
    if (!companyId) {
      throw new Error('Parâmetro company_id é obrigatório.');
    }
    const items = this.favoriteItems.filter(f => f.company_id === companyId);
    return { success: true, data: items };
  }

  getReceipts(companyId) {
    if (!companyId) {
      throw new Error('Parâmetro company_id é obrigatório.');
    }
    const receipts = this.receiptsOcr.filter(r => r.company_id === companyId);
    return { success: true, data: receipts };
  }
}

export class PortalSession {
  constructor(companyId = 'comp_tenant_alpha', companyName = 'Alpha Tecnologia e Sistemas Ltda') {
    this.db = new PortalMultiTenantDB();
    this.companyId = companyId;
    this.companyName = companyName;
    this.viewportWidth = 375; // default mobile PWA
    this.activeTab = 'inicio'; // 'inicio' | 'emitir' | 'guias' | 'recibos'
    this.isOnline = true;
    this.offlineQueue = [];

    // Issuer Wizard State
    this.issuerStep = 1;
    this.issuerDraft = {
      tipo: 'NFS-e',
      tomador: { cnpj_cpf: '', razao_social: '', email: '', whatsapp: '', logradouro: '', municipio: '', uf: '' },
      item: { descricao: '', valor: 0.0, aliquota_iss: 2.0, iss_retido: false, ncm: '' },
      condicao_pagamento: 'PIX'
    };
  }

  setViewportWidth(width) {
    this.viewportWidth = width;
  }

  getLayoutMode() {
    return this.viewportWidth < 768 ? 'mobile_pwa' : 'desktop_expanded';
  }

  switchTab(tabName) {
    const validTabs = ['inicio', 'emitir', 'guias', 'recibos'];
    if (!validTabs.includes(tabName)) {
      throw new Error(`Invalid tab name: ${tabName}`);
    }
    this.activeTab = tabName;
    return { activeTab: this.activeTab, layoutMode: this.getLayoutMode() };
  }

  getDashboardSummary() {
    return this.db.getDashboardSummary(this.companyId);
  }

  getTaxGuides(statusFilter) {
    return this.db.getTaxGuides(this.companyId, statusFilter);
  }

  payTaxGuide(guideId) {
    const guidesRes = this.db.getTaxGuides(this.companyId);
    const guide = guidesRes.data.find(g => g.id === guideId);
    if (!guide) throw new Error(`Tax guide not found: ${guideId}`);

    guide.status = 'pago';
    guide.paid_at = new Date().toISOString();

    // Deduct from bank transactions
    this.db.bankTransactions.push({
      id: `bt_tax_pay_${Date.now()}`,
      company_id: this.companyId,
      data: new Date().toISOString().split('T')[0],
      descricao_original: `PAGAMENTO GUIA ${guide.titulo}`,
      tipo: 'DEBITO',
      valor: guide.valor_total,
      conciliado: 1
    });

    return {
      success: true,
      message: `Guia ${guide.titulo} paga com sucesso via PIX!`,
      guide
    };
  }

  setIssuerStep1(tomadorData) {
    if (!tomadorData.cnpj_cpf) {
      throw new Error('CNPJ ou CPF do tomador é obrigatório.');
    }
    const cleanDoc = tomadorData.cnpj_cpf.replace(/\D/g, '');
    if (cleanDoc.length === 14) {
      if (!isValidCNPJ(cleanDoc)) throw new Error('CNPJ informado possui dígitos verificadores inválidos.');
    } else if (cleanDoc.length === 11) {
      if (!isValidCPF(cleanDoc)) throw new Error('CPF informado possui dígitos verificadores inválidos.');
    } else {
      throw new Error('Documento do tomador deve conter 11 dígitos (CPF) ou 14 dígitos (CNPJ).');
    }

    if (!tomadorData.razao_social || tomadorData.razao_social.trim().length < 3) {
      throw new Error('Razão Social / Nome do tomador é obrigatório (mínimo 3 caracteres).');
    }

    this.issuerDraft.tomador = { ...this.issuerDraft.tomador, ...tomadorData };
    this.issuerStep = 2;
    return { step: 2, draft: this.issuerDraft };
  }

  setIssuerStep2(itemData) {
    if (!itemData.descricao || itemData.descricao.trim().length === 0) {
      throw new Error('Descrição do serviço ou produto é obrigatória.');
    }
    const valor = Number(itemData.valor);
    if (isNaN(valor) || valor <= 0) {
      throw new Error('Valor do serviço deve ser maior que zero (R$ 0,00).');
    }

    this.issuerDraft.item = { ...this.issuerDraft.item, ...itemData, valor };
    this.issuerStep = 3;
    return { step: 3, draft: this.issuerDraft };
  }

  applyFavoriteItem(favoriteId) {
    const fav = this.db.favoriteItems.find(f => f.id === favoriteId && f.company_id === this.companyId);
    if (!fav) throw new Error(`Favorite item not found: ${favoriteId}`);
    return this.setIssuerStep2({
      descricao: fav.descricao_padrao,
      valor: fav.valor_padrao,
      aliquota_iss: fav.aliquota_iss_padrao
    });
  }

  emitInvoiceStep3() {
    if (this.issuerStep < 3) {
      throw new Error('Não é possível emitir sem concluir os passos 1 e 2.');
    }

    if (!this.isOnline) {
      const draftId = `draft_${Date.now()}`;
      this.offlineQueue.push({ id: draftId, draft: { ...this.issuerDraft } });
      return {
        success: false,
        status: 'OFFLINE_QUEUED',
        message: 'Sem conexão no momento. Nota salva no rascunho offline.',
        draftId
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const comp = this.db.companies.get(this.companyId) || { cnpj: '00.000.000/0001-00', razao_social: this.companyName, uf: 'BA' };
    const cleanCnpj = comp.cnpj.replace(/\D/g, '');

    const nextNum = (this.db.invoices.filter(i => i.company_id === this.companyId).length + 1).toString().padStart(4, '0');
    const notaNumero = `2026${nextNum}`;
    const valorTotal = this.issuerDraft.item.valor;
    const aliquotaIss = this.issuerDraft.item.aliquota_iss || 2.0;
    const valorIss = Number(((valorTotal * aliquotaIss) / 100).toFixed(2));

    const pixPayload = generatePixPayload({
      pixKey: cleanCnpj,
      merchantName: comp.razao_social,
      merchantCity: comp.uf === 'BA' ? 'SALVADOR' : 'SAO PAULO',
      amount: valorTotal,
      txid: `INV${notaNumero}`,
      description: `NFS-e ${notaNumero}`
    });

    const cleanPhone = (this.issuerDraft.tomador.whatsapp || '5571999999999').replace(/\D/g, '');
    const whatsappMsg = `Olá, *${this.issuerDraft.tomador.razao_social}*! Segue sua NFS-e nº *${notaNumero}* no valor de *R$ ${valorTotal.toFixed(2)}*. Pague via PIX Copia-e-Cola: ${pixPayload}`;
    const whatsappShareUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsappMsg)}`;

    const issuedRecord = {
      id: `inv_${this.companyId}_${notaNumero}`,
      company_id: this.companyId,
      chave_acesso: `CHAVE_${notaNumero}_${Date.now()}`,
      numero: notaNumero,
      numero_nota: notaNumero,
      codigo_verificacao: `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      data_emissao: todayStr,
      tipo: 'saida',
      tomador: { ...this.issuerDraft.tomador },
      destinatario_nome: this.issuerDraft.tomador.razao_social,
      item: { ...this.issuerDraft.item },
      valor_total: valorTotal,
      valor_iss: valorIss,
      status: 'autorizada',
      pix_code: pixPayload,
      whatsapp_share_url: whatsappShareUrl
    };

    this.db.invoices.push(issuedRecord);
    this.db.invoiceInstallments.push({
      id: `inst_${issuedRecord.id}`,
      invoice_id: issuedRecord.id,
      company_id: this.companyId,
      tipo: 'receber',
      numero_parcela: '1/1',
      data_vencimento: todayStr,
      valor: valorTotal,
      status: 'pendente'
    });

    // Reset wizard
    this.issuerStep = 1;
    this.issuerDraft = {
      tipo: 'NFS-e',
      tomador: { cnpj_cpf: '', razao_social: '', email: '', whatsapp: '', logradouro: '', municipio: '', uf: '' },
      item: { descricao: '', valor: 0.0, aliquota_iss: 2.0, iss_retido: false, ncm: '' },
      condicao_pagamento: 'PIX'
    };

    return {
      success: true,
      data: issuedRecord
    };
  }

  scanReceipt(imageTextOrBuffer, filename = 'comprovante.jpg') {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      throw new Error(`Tipo de arquivo não suportado (${ext}). Envie imagens JPG, PNG ou documentos PDF.`);
    }

    const extracted = typeof imageTextOrBuffer === 'string'
      ? extractReceiptTokens(imageTextOrBuffer)
      : extractReceiptTokens('POSTO SHELL CNPJ: 12.345.678/0001-90 DATA: 2026-08-27 TOTAL: R$ 245,80');

    const openPayables = this.db.invoiceInstallments.filter(
      i => i.company_id === this.companyId && i.tipo === 'pagar' && i.status === 'pendente'
    );

    const matchResult = autoMatchReceiptWithPayables(extracted, openPayables);

    if (matchResult.match_status === 'MATCHED' && matchResult.matched_payable) {
      const payable = this.db.invoiceInstallments.find(p => p.id === matchResult.matched_payable.id);
      if (payable) {
        payable.status = 'pago';
      }
    }

    const receiptId = `rec_${Date.now()}`;
    const scannedRecord = {
      receipt_id: receiptId,
      company_id: this.companyId,
      filename,
      extracted,
      matched_payable: matchResult.matched_payable,
      match_confidence: matchResult.match_confidence,
      match_status: matchResult.match_status,
      scanned_at: new Date().toISOString()
    };

    this.db.receiptsOcr.push(scannedRecord);

    return {
      success: true,
      data: scannedRecord
    };
  }

  addFavoriteCatalogItem(item) {
    if (!item.descricao || !item.valor) {
      throw new Error('Descrição e valor do favorito são obrigatórios.');
    }
    const newFav = {
      id: `fav_${Date.now()}`,
      company_id: this.companyId,
      nome_atalho: item.descricao.slice(0, 20),
      descricao_padrao: item.descricao,
      valor_padrao: Number(item.valor),
      aliquota_iss_padrao: Number(item.aliquota_iss || 2.0)
    };
    this.db.favoriteItems.push(newFav);
    return newFav;
  }

  setConnectivity(isOnline) {
    this.isOnline = isOnline;
    if (isOnline && this.offlineQueue.length > 0) {
      const results = [];
      while (this.offlineQueue.length > 0) {
        const item = this.offlineQueue.shift();
        this.issuerDraft = item.draft;
        this.issuerStep = 3;
        const res = this.emitInvoiceStep3();
        results.push(res);
      }
      return { reconnected: true, processedQueue: results };
    }
    return { reconnected: isOnline, processedQueue: [] };
  }
}
