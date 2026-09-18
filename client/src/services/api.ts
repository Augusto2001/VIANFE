import { 
  Company, 
  Invoice, 
  InvoiceSummary, 
  SyncLog, 
  DriveStatus,
  DashboardSummaryData,
  EmitFastInvoiceDto,
  FastInvoiceResult,
  FavoriteCatalogItem,
  CreateFavoriteDto,
  UpdateFavoriteDto,
  RecurringClientItem,
  SaveRecurringClientDto,
  TaxGuideItem,
  PayTaxGuideDto,
  ReceiptOcrItem,
  ConfirmReceiptMatchDto
} from '../types';

const API_BASE = '/api';

const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
  const token = localStorage.getItem('vianfe_jwt_token');
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const api = {
  // Companies
  async getCompanies(): Promise<Company[]> {
    const res = await fetch(`${API_BASE}/companies`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error);
    return json.data;
  },

  async getCompany(id: string): Promise<Company> {
    const res = await fetch(`${API_BASE}/companies/${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async createCompany(data: Partial<Company>): Promise<Company> {
    const res = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    const res = await fetch(`${API_BASE}/companies/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async deleteCompany(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/companies/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async uploadCertificate(companyId: string, file: File, password?: string): Promise<void> {
    const formData = new FormData();
    formData.append('certificate', file);
    if (password) formData.append('password', password);

    const res = await fetch(`${API_BASE}/companies/${companyId}/certificate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async lookupCnpj(cnpj: string): Promise<any> {
    const clean = cnpj.replace(/\D/g, '');
    const res = await fetch(`${API_BASE}/cnpj/lookup/${clean}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async testCertificate(companyId: string): Promise<{ subject: string; issuer: string; validTo: string }> {
    const res = await fetch(`${API_BASE}/companies/${companyId}/test-certificate`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async syncSefaz(companyId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/companies/${companyId}/sync-sefaz`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  // Invoices
  async getInvoices(params: {
    company_id: string;
    period?: '7d' | '15d' | '30d' | 'all' | 'custom';
    startDate?: string;
    endDate?: string;
    tipo?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ invoices: Invoice[]; summary: InvoiceSummary; totalPages: number }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    });

    const res = await fetch(`${API_BASE}/invoices?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || json.error);
    return {
      invoices: json.data || [],
      summary: json.summary || {
        totalCount: 0,
        totalValor: 0,
        valorEntradas: 0,
        valorSaidas: 0,
        totalGdriveSynced: 0,
        totalGdrivePending: 0,
      },
      totalPages: json.pagination?.totalPages || 1,
    };
  },

  async getInvoice(id: string): Promise<Invoice> {
    const res = await fetch(`${API_BASE}/invoices/${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  getXmlDownloadUrl(id: string): string {
    const token = localStorage.getItem('vianfe_jwt_token');
    return `${API_BASE}/invoices/${id}/xml${token ? `?token=${token}` : ''}`;
  },

  getPdfDownloadUrl(id: string): string {
    const token = localStorage.getItem('vianfe_jwt_token');
    return `${API_BASE}/invoices/${id}/pdf${token ? `?token=${token}` : ''}`;
  },

  getNfsePdfUrl(id: string): string {
    const token = localStorage.getItem('vianfe_jwt_token');
    return `${API_BASE}/portal/nfse/${id}/pdf${token ? `?token=${token}` : ''}`;
  },

  getNfseXmlUrl(id: string): string {
    const token = localStorage.getItem('vianfe_jwt_token');
    return `${API_BASE}/portal/nfse/${id}/xml${token ? `?token=${token}` : ''}`;
  },

  async downloadZip(
    companyId: string, 
    type: 'xml' | 'pdf', 
    ids?: string[],
    filterOptions?: {
      period?: string;
      startDate?: string;
      endDate?: string;
      tipo?: string;
      status?: string;
      search?: string;
    }
  ): Promise<Blob> {
    const res = await fetch(`${API_BASE}/invoices/download-zip`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ 
        company_id: companyId, 
        type, 
        ids,
        period: filterOptions?.period,
        startDate: filterOptions?.startDate,
        endDate: filterOptions?.endDate,
        tipo: filterOptions?.tipo,
        status: filterOptions?.status,
        search: filterOptions?.search,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({ message: 'Falha ao gerar ZIP' }));
      throw new Error(json.message || 'Falha ao baixar arquivo ZIP.');
    }
    return await res.blob();
  },

  async uploadBatchXml(companyId: string, files: File[]): Promise<{ processed: number; errors?: string[] }> {
    const formData = new FormData();
    formData.append('company_id', companyId);
    files.forEach((f) => formData.append('xmlFiles', f));

    const res = await fetch(`${API_BASE}/invoices/upload-batch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  async syncInvoiceToDrive(invoiceId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/sync-drive`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async syncCompanyToDrive(companyId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/invoices/sync-company-drive`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ company_id: companyId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  // Google Drive & Logs
  async getDriveStatus(): Promise<DriveStatus> {
    const res = await fetch(`${API_BASE}/drive/status`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async saveDriveCredentials(credentialsJson: string): Promise<void> {
    const res = await fetch(`${API_BASE}/drive/credentials`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ credentialsJson }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async getDriveFolders(parentId?: string): Promise<any[]> {
    const url = parentId ? `${API_BASE}/drive/folders?parentId=${parentId}` : `${API_BASE}/drive/folders`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async getLogs(companyId?: string): Promise<SyncLog[]> {
    const url = companyId ? `${API_BASE}/drive/logs?company_id=${companyId}` : `${API_BASE}/drive/logs`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  // Auth & Multi-Tenant Users
  async login(email: string, password: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  async getMe(token: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  async getUsers(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.users;
  },

  async createUser(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  async updateUserPassword(id: string, newPassword: string): Promise<any> {
    const res = await fetch(`${API_BASE}/users/${id}/password`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ newPassword }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Falha ao alterar senha');
    return json;
  },

  async deleteUser(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  // NF-e Manifestação do Destinatário
  async submitManifestation(invoiceId: string, eventType: string, justificativa?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/portal/manifest`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ invoice_id: invoiceId, event_type: eventType, justificativa }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  // NFS-e Prefeituras & WhatsApp n8n
  async getNfseList(companyId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/portal/nfse?company_id=${companyId}`, { headers: getAuthHeaders() });
    return await res.json();
  },

  async emitNfse(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/portal/nfse/emit`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || 'Falha ao emitir NFS-e');
    return json;
  },

  async deleteNfse(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/portal/nfse/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao excluir NFS-e');
  },

  async getNfseClients(companyId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/portal/nfse/clients?company_id=${companyId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar tomadores recorrentes');
    return json.data;
  },

  async saveNfseClient(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/portal/nfse/clients`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao salvar tomador recorrente');
    return json;
  },

  async deleteNfseClient(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/portal/nfse/clients/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao excluir tomador recorrente');
  },

  // BPO Financeiro & Conciliação Bancária
  async getBpoAccounts(companyId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/bpo/accounts?company_id=${companyId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar contas');
    return json.data;
  },

  async createBpoAccount(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/accounts`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao criar conta');
    return json.data;
  },

  async uploadBpoStatement(companyId: string, accountId: string | null, ofxContent: string, isPdf?: boolean, fileName?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/upload-statement`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ 
        company_id: companyId, 
        bank_account_id: accountId, 
        ofx_content: ofxContent,
        is_pdf: isPdf,
        file_name: fileName
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao importar extrato');
    return json;
  },

  async getBpoTransactions(companyId: string, status?: string): Promise<any> {
    const url = status ? `${API_BASE}/bpo/transactions?company_id=${companyId}&status=${status}` : `${API_BASE}/bpo/transactions?company_id=${companyId}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar transações');
    return json;
  },

  async reconcileBpoTransaction(id: string, data: {
    categoria_id?: string;
    invoice_id?: string;
    descricao_custom?: string;
    fornecedor_cliente_nome?: string;
    centro_custo?: string;
    forma_lancamento?: string;
    observacoes_cliente?: string;
    learn_rule?: boolean;
    desconciliar?: boolean;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/reconcile/${id}`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao conciliar transação');
    return json;
  },

  async seedSampleBpoTransactions(companyId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/transactions/seed-sample`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ company_id: companyId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao gerar transações de exemplo');
    return json;
  },

  async getBpoCategories(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/bpo/categories`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar categorias');
    return json.data;
  },

  async getBusinessSuccess(companyId: string, month?: number, year?: number): Promise<any> {
    const url = `${API_BASE}/bpo/business-success?company_id=${companyId}${month ? `&month=${month}` : ''}${year ? `&year=${year}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao calcular KPIs');
    return json.data;
  },

  // Multi-Office SaaS Tenants (Escritórios Contábeis)
  async getTenants(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/tenants`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar escritórios');
    return json.data;
  },

  async createTenant(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/tenants`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao criar escritório');
    return json;
  },

  async updateTenant(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/tenants/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao atualizar escritório');
    return json;
  },

  async deleteTenant(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/tenants/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao excluir escritório');
  },

  async exportDominioBatches(companyId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/bpo/export-dominio?company_id=${companyId}`, { headers: getAuthHeaders() });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LANCAMENTOS_DOMINIO_${companyId}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Tax Audit & Recuperação Tributária
  async getTaxAuditSummary(companyId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/tax-audit/summary?company_id=${companyId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Falha ao processar auditoria tributária');
    return json;
  },

  // Safe WhatsApp ZapCont Sender
  async sendWhatsAppSafe(data: { phone: string; message: string; pdfUrl?: string; companyName?: string; isManualTrigger?: boolean }): Promise<any> {
    const res = await fetch(`${API_BASE}/notifications/whatsapp-send`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Falha ao enviar WhatsApp');
    return json;
  },

  // Plano de Contas Domínio & Provisões Contábeis
  async importChartOfAccounts(companyId: string, rawContent: string, replaceExisting: boolean = false): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/chart-of-accounts/import`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ company_id: companyId, raw_content: rawContent, replace_existing: replaceExisting }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao importar Plano de Contas');
    return json;
  },

  async clearChartOfAccounts(companyId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/chart-of-accounts/clear`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ company_id: companyId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao limpar Plano de Contas');
    return json;
  },

  async getChartOfAccounts(companyId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/bpo/chart-of-accounts?company_id=${companyId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar Plano de Contas');
    return json.data;
  },

  async importPayrollProvisions(data: { company_id: string; competencia: string; salarios_brutos?: number; inss_empresa?: number; fgts?: number; pro_labore?: number }): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/provisions/import-payroll`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao gerar provisões de folha');
    return json;
  },

  async importTaxProvisions(data: { company_id: string; competencia: string; valor_das?: number; valor_icms?: number; valor_iss?: number }): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/provisions/import-taxes`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao gerar provisões de impostos');
    return json;
  },

  async getProvisions(companyId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/bpo/provisions?company_id=${companyId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar provisões');
    return json.data;
  },

  // Radar de Alertas Preditivos no WhatsApp (48h de Antecedência)
  async getUpcomingAlerts(companyId: string, daysAhead: number = 2): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/alerts/upcoming?company_id=${companyId}&days_ahead=${daysAhead}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar alertas preditivos');
    return json.data;
  },

  async sendPredictiveAlertWhatsApp(companyId: string, phone?: string): Promise<{ success: boolean; message: string; itemsSent: number }> {
    const res = await fetch(`${API_BASE}/bpo/alerts/send-whatsapp`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ company_id: companyId, phone })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao enviar alerta no WhatsApp');
    return json;
  },

  async getAlertsHistory(companyId: string, limit: number = 20): Promise<any[]> {
    const res = await fetch(`${API_BASE}/bpo/alerts/history?company_id=${companyId}&limit=${limit}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar histórico de alertas');
    return json.data;
  },

  // Open Finance & Sincronização Bancária Plug & Play
  async getOpenFinanceInfo(companyId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/open-finance/info?company_id=${companyId}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao buscar configurações de Open Finance');
    return json.data;
  },

  async sendOpenFinanceWebhook(companyId: string, payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/open-finance/webhook/${companyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha na ingestão Open Finance');
    return json;
  },

  // Mapeador de Plano de Contas Domínio Sistemas
  async autoMapChartOfAccounts(companyId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/chart-of-accounts/auto-map`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ company_id: companyId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao executar auto-mapeamento');
    return json;
  },

  async updateCategoryMapping(id: string, mapping: { conta_debito_dominio?: string; conta_credito_dominio?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/bpo/categories/${id}/mapping`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(mapping)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao atualizar mapeamento');
    return json;
  },

  // Suporte Técnico & Central de Chamados WhatsApp
  async createSupportTicket(data: { solicitante_nome: string; solicitante_phone: string; company_id?: string; company_name?: string; tipo_demanda: string; mensagem_erro: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao abrir chamado');
    return json;
  },

  async getSupportTickets(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/support/tickets`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao carregar chamados');
    return json.data;
  },

  async resolveSupportTicket(id: string, solucao: string): Promise<any> {
    const res = await fetch(`${API_BASE}/support/tickets/${id}/resolve`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ solucao }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao finalizar chamado');
    return json;
  },

  async getCaptchaKey(): Promise<string> {
    const res = await fetch(`${API_BASE}/settings/captcha-key`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.key || '';
  },

  async saveCaptchaKey(key: string): Promise<void> {
    const res = await fetch(`${API_BASE}/settings/captcha-key`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ key }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao salvar chave 2Captcha');
  },

  async getFocusNfeConfig(companyId: string): Promise<{ focus_nfe_token: string; nfse_provedor: string }> {
    const res = await fetch(`${API_BASE}/portal/nfse/focus-config?company_id=${companyId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json || { focus_nfe_token: '', nfse_provedor: 'focus_nfe' };
  },

  async saveFocusNfeConfig(companyId: string, focusNfeToken: string, nfseProvedor: string = 'focus_nfe', ambiente?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/portal/nfse/focus-config`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ company_id: companyId, focus_nfe_token: focusNfeToken, nfse_provedor: nfseProvedor, ambiente }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Falha ao salvar configurações da Focus NFe');
  },

  // ============================================================================
  // SUPER APP VIACONT (ÁREA DO CLIENTE) REST API CLIENT METHODS (R1-R5)
  // ============================================================================

  // 1. Dashboard & Diagnóstico Financeiro (R5)
  async getPortalDashboardSummary(companyId: string): Promise<DashboardSummaryData> {
    const res = await fetch(`${API_BASE}/portal/dashboard-summary?company_id=${encodeURIComponent(companyId)}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao carregar diagnóstico financeiro');
    return json.data;
  },

  // 2. Emissão Rápida de Notas Fiscais (R2)
  async emitFastInvoice(data: EmitFastInvoiceDto): Promise<FastInvoiceResult> {
    const res = await fetch(`${API_BASE}/portal/invoices/emit-fast`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao emitir nota fiscal relâmpago');
    return json.data;
  },

  async getRecentPortalInvoices(companyId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/portal/invoices/recent?company_id=${companyId}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao buscar notas recentes');
    return json.data || [];
  },

  getPortalInvoicePdfUrl(idOrNumero: string): string {
    const token = localStorage.getItem('vianfe_jwt_token');
    return `${API_BASE}/portal/invoices/${idOrNumero}/pdf${token ? `?token=${token}` : ''}`;
  },

  // 3. Catálogo de Favoritos (R2)
  async getPortalFavorites(companyId: string, tipo?: 'servico' | 'produto'): Promise<FavoriteCatalogItem[]> {
    const url = tipo 
      ? `${API_BASE}/portal/favorites?company_id=${companyId}&tipo=${tipo}` 
      : `${API_BASE}/portal/favorites?company_id=${companyId}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao carregar favoritos');
    return json.data || [];
  },

  async createPortalFavorite(data: CreateFavoriteDto): Promise<FavoriteCatalogItem> {
    const res = await fetch(`${API_BASE}/portal/favorites`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao criar item favorito');
    return json.data;
  },

  async updatePortalFavorite(id: string, data: UpdateFavoriteDto): Promise<FavoriteCatalogItem> {
    const res = await fetch(`${API_BASE}/portal/favorites/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao atualizar favorito');
    return json.data;
  },

  async deletePortalFavorite(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/portal/favorites/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao excluir favorito');
  },

  // 4. Clientes & Tomadores Recorrentes (R2)
  async getPortalRecurringClients(companyId: string, search?: string): Promise<RecurringClientItem[]> {
    const url = search 
      ? `${API_BASE}/portal/recurring-clients?company_id=${companyId}&search=${encodeURIComponent(search)}`
      : `${API_BASE}/portal/recurring-clients?company_id=${companyId}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao carregar clientes recorrentes');
    return json.data || [];
  },

  async savePortalRecurringClient(data: SaveRecurringClientDto): Promise<RecurringClientItem> {
    const res = await fetch(`${API_BASE}/portal/recurring-clients`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao salvar cliente recorrente');
    return json.data;
  },

  async deletePortalRecurringClient(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/portal/recurring-clients/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao excluir cliente');
  },

  // 5. Central de Guias & Impostos com 1-Clique PIX (R3)
  async getPortalTaxGuides(companyId: string, status?: string, competencia?: string): Promise<TaxGuideItem[]> {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId);
    if (status) params.append('status', status);
    if (competencia) params.append('competencia', competencia);
    
    const res = await fetch(`${API_BASE}/portal/tax-guides?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao buscar guias fiscais');
    return json.data || [];
  },

  async getPortalTaxGuideById(id: string): Promise<TaxGuideItem> {
    const res = await fetch(`${API_BASE}/portal/tax-guides/${id}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao buscar guia');
    return json.data;
  },

  getPortalTaxGuidePdfUrl(id: string): string {
    const token = localStorage.getItem('vianfe_jwt_token');
    return `${API_BASE}/portal/tax-guides/${id}/pdf${token ? `?token=${token}` : ''}`;
  },

  async getPortalTaxGuidePix(id: string): Promise<{ id: string; pix_copia_cola: string; linha_digitavel?: string; valor: number; vencimento: string; status: string }> {
    const res = await fetch(`${API_BASE}/portal/tax-guides/${id}/pix`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao obter código PIX');
    return json.data;
  },

  async payPortalTaxGuide(id: string, data: PayTaxGuideDto): Promise<TaxGuideItem> {
    const res = await fetch(`${API_BASE}/portal/tax-guides/${id}/pay`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao registrar pagamento da guia');
    return json.data;
  },

  async updatePortalTaxGuideStatus(id: string, status: string, data_pagamento?: string): Promise<TaxGuideItem> {
    const res = await fetch(`${API_BASE}/portal/tax-guides/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, data_pagamento }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao atualizar status da guia');
    return json.data;
  },

  // 6. Scanner OCR & Auto-Match de Recibos (R4)
  async scanPortalReceipt(companyId: string, imageFile?: File, imageBase64?: string, textFallback?: string): Promise<ReceiptOcrItem> {
    let res: Response;
    if (imageFile) {
      const formData = new FormData();
      formData.append('company_id', companyId);
      formData.append('image', imageFile);
      res = await fetch(`${API_BASE}/portal/receipts/scan`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
    } else {
      res = await fetch(`${API_BASE}/portal/receipts/scan`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          company_id: companyId,
          image_base64: imageBase64,
          text: textFallback,
        }),
      });
    }

    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao processar OCR do recibo');
    return json.data;
  },

  async getPortalReceipts(companyId: string, status?: string): Promise<ReceiptOcrItem[]> {
    const url = status 
      ? `${API_BASE}/portal/receipts?company_id=${companyId}&status=${status}` 
      : `${API_BASE}/portal/receipts?company_id=${companyId}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao carregar recibos');
    return json.data || [];
  },

  async confirmPortalReceiptMatch(id: string, data: ConfirmReceiptMatchDto): Promise<ReceiptOcrItem> {
    const res = await fetch(`${API_BASE}/portal/receipts/${id}/confirm`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao confirmar conciliação');
    return json.data;
  },

  async deletePortalReceipt(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/portal/receipts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || json.message || 'Falha ao excluir recibo');
  }
};

