import { Company, Invoice, InvoiceSummary, SyncLog, DriveStatus } from '../types';

const API_BASE = '/api';

export const api = {
  // Companies
  async getCompanies(): Promise<Company[]> {
    const res = await fetch(`${API_BASE}/companies`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async getCompany(id: string): Promise<Company> {
    const res = await fetch(`${API_BASE}/companies/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async createCompany(data: Partial<Company>): Promise<Company> {
    const res = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    const res = await fetch(`${API_BASE}/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async deleteCompany(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/companies/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async uploadCertificate(companyId: string, file: File, password?: string): Promise<void> {
    const formData = new FormData();
    formData.append('certificate', file);
    if (password) formData.append('password', password);

    const res = await fetch(`${API_BASE}/companies/${companyId}/certificate`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async lookupCnpj(cnpj: string): Promise<any> {
    const clean = cnpj.replace(/\D/g, '');
    const res = await fetch(`${API_BASE}/cnpj/lookup/${clean}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  // Invoices
  async getInvoices(params: {
    company_id: string;
    period?: '7d' | '15d' | '30d' | 'custom';
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

    const res = await fetch(`${API_BASE}/invoices?${query.toString()}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return {
      invoices: json.data,
      summary: json.summary,
      totalPages: json.pagination.totalPages,
    };
  },

  async getInvoice(id: string): Promise<Invoice> {
    const res = await fetch(`${API_BASE}/invoices/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  getXmlDownloadUrl(id: string): string {
    return `${API_BASE}/invoices/${id}/xml`;
  },

  getPdfDownloadUrl(id: string): string {
    return `${API_BASE}/invoices/${id}/pdf`;
  },

  async downloadZip(companyId: string, type: 'xml' | 'pdf', ids?: string[]): Promise<Blob> {
    const res = await fetch(`${API_BASE}/invoices/download-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, type, ids }),
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
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  async syncInvoiceToDrive(invoiceId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/sync-drive`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async syncCompanyToDrive(companyId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/invoices/sync-company-drive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json;
  },

  // Google Drive & Logs
  async getDriveStatus(): Promise<DriveStatus> {
    const res = await fetch(`${API_BASE}/drive/status`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async saveDriveCredentials(credentialsJson: string): Promise<void> {
    const res = await fetch(`${API_BASE}/drive/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialsJson }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async getDriveFolders(parentId?: string): Promise<any[]> {
    const url = parentId ? `${API_BASE}/drive/folders?parentId=${parentId}` : `${API_BASE}/drive/folders`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async getLogs(companyId?: string): Promise<SyncLog[]> {
    const url = companyId ? `${API_BASE}/drive/logs?company_id=${companyId}` : `${API_BASE}/drive/logs`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },
};
