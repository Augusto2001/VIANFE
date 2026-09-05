# Frontend Architecture & Implementation Plan: Super App Viacont (Área do Cliente)
## M2-M5 Technical Specification & Component Blueprint

---

### Executive Summary

This document specifies the complete frontend architecture and component blueprint for the **Super App Viacont (Área do Cliente)**, fulfilling requirements **R1 through R5** defined in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `survey_domain_specs.md`.

The client application is built with **React 18 + Vite 6 + TailwindCSS 3 + TypeScript 5** and delivers a seamless hybrid experience:
- **Mobile PWA Mode (< 768px)**: Native app experience with fixed bottom dock navigation, thumb-friendly touch targets (≥ 48px), responsive bottom-sheets, camera capture trigger (`capture="environment"`), and quick 1-touch actions.
- **Desktop Expanded Mode (≥ 768px)**: Full multi-column dashboard, side/top navigation, rich data tables, live RPS/DANFE visual mirrors, and interactive gauges.
- **Zero-Reload SPA Navigation**: Instant switching between 4 master tabs (`inicio_financas`, `emitir_notas`, `guias_impostos`, `recibos_scanner`) plus supplier manifestation (`manifestar_nfe`), with persistent state in `localStorage`.

---

## 1. Data Contracts & Type Definitions (`client/src/types/index.ts`)

The existing `client/src/types/index.ts` will be extended with the following TypeScript interfaces, directly aligned with the backend database schema and `/api/portal/*` endpoints:

```typescript
// ============================================================================
// SUPER APP VIACONT (ÁREA DO CLIENTE) - DATA CONTRACTS (R1-R5)
// ============================================================================

// ----------------------------------------------------------------------------
// R1. Navigation & Shell Types
// ----------------------------------------------------------------------------
export type PortalTab = 
  | 'inicio_financas' 
  | 'emitir_notas' 
  | 'guias_impostos' 
  | 'recibos_scanner'
  | 'manifestar_nfe';

export interface PortalNotification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// R5. Real-Time Financial Dashboard & Simples Nacional RBT12 Gauge
// ----------------------------------------------------------------------------
export interface CashFlowDay {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface SimplesNacionalGaugeResult {
  rbt12: number;
  teto_estadual: number;              // 3.600.000,00
  teto_federal: number;               // 4.800.000,00
  percentual_atingido_estadual: number;
  percentual_atingido_federal: number;
  faixa_atual: string;
  faixa_numero: number;
  anexo: string;
  aliquota_nominal: number;
  aliquota_efetiva: number;
  parcela_deduzir: number;
  alerta: 'normal' | 'atencao' | 'alerta_subteto' | 'critico';
  alerta_mensagem: string;
  monthly_breakdown?: Array<{ mes: string; faturamento: number }>;
}

export interface DashboardSummaryData {
  bank_balance: number;
  payables_today: number;
  receivables_today: number;
  cash_flow_forecast: CashFlowDay[];
  simples_nacional: SimplesNacionalGaugeResult;
}

export type PortalDashboardSummary = DashboardSummaryData;

// ----------------------------------------------------------------------------
// R2. Fast 3-Step Invoice Issuer & Favorites Catalog
// ----------------------------------------------------------------------------
export interface TomadorInvoiceDto {
  cnpj_cpf: string;
  razao_social: string;
  email?: string;
  whatsapp?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  inscricao_municipal?: string;
  inscricao_estadual?: string;
}

export interface ItemInvoiceDto {
  descricao: string;
  valor: number;
  aliquota_iss?: number;
  iss_retido?: boolean;
  item_servico?: string;
  cnae?: string;
  ncm?: string;
  cfop?: string;
  unidade?: string;
}

export interface EmitFastInvoiceDto {
  company_id: string;
  tipo: 'NFS-e' | 'NF-e';
  tomador: TomadorInvoiceDto;
  item: ItemInvoiceDto;
  condicao_pagamento?: 'PIX' | 'Boleto' | 'A_VISTA' | 'PARCELADO';
}

export type FastInvoiceInput = EmitFastInvoiceDto;

export interface FastInvoiceResult {
  id: string;
  numero_nota: string;
  codigo_verificacao: string;
  status: 'AUTORIZADA' | 'EMITIDA' | 'PENDENTE';
  pdf_url: string;
  pix_code: string;
  pix_qr_base64?: string;
  whatsapp_share_url: string;
  issued_at: string;
  valor_total: number;
  destinatario_nome: string;
  tipo: string;
}

export type FastInvoiceOutput = FastInvoiceResult;

export interface FavoriteCatalogItem {
  id: string;
  company_id: string;
  tenant_id?: string;
  tipo: 'servico' | 'produto';
  nome_atalho: string;
  descricao_padrao: string;
  item_lista_servico?: string | null;
  cnae?: string | null;
  codigo_tributacao_municipio?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  unidade_medida?: string;
  valor_padrao: number;
  aliquota_iss_padrao?: number;
  iss_retido_padrao?: number;
  aliquota_icms_padrao?: number;
  aliquota_pis_padrao?: number;
  aliquota_cofins_padrao?: number;
  aliquota_ipi_padrao?: number;
  total_usos?: number;
  is_ativo?: number;
  created_at: string;
  updated_at?: string;
}

export interface CreateFavoriteDto {
  company_id: string;
  tipo: 'servico' | 'produto';
  nome_atalho: string;
  descricao_padrao: string;
  valor_padrao: number;
  item_lista_servico?: string;
  cnae?: string;
  codigo_tributacao_municipio?: string;
  ncm?: string;
  cfop?: string;
  unidade_medida?: string;
  aliquota_iss_padrao?: number;
  iss_retido_padrao?: number;
  aliquota_icms_padrao?: number;
}

export interface UpdateFavoriteDto {
  nome_atalho?: string;
  descricao_padrao?: string;
  valor_padrao?: number;
  tipo?: 'servico' | 'produto';
  item_lista_servico?: string;
  cnae?: string;
  codigo_tributacao_municipio?: string;
  ncm?: string;
  cfop?: string;
  unidade_medida?: string;
  aliquota_iss_padrao?: number;
  iss_retido_padrao?: number;
  aliquota_icms_padrao?: number;
  is_ativo?: number;
}

export interface RecurringClientItem {
  id: string;
  company_id: string;
  tenant_id?: string;
  tipo_pessoa: 'PJ' | 'PF';
  cnpj_cpf: string;
  razao_social: string;
  nome_fantasia?: string | null;
  email?: string | null;
  telefone_whatsapp?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  codigo_ibge_municipio?: string | null;
  uf?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  iss_retido?: number;
  aliquota_iss?: number;
  item_servico?: string | null;
  discriminacao_padrao?: string | null;
  valor_padrao?: number;
  condicao_pagamento_padrao?: string;
  total_notas_emitidas?: number;
  valor_total_emitido?: number;
  ultimo_servico_utilizado?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SaveRecurringClientDto {
  company_id: string;
  cnpj_cpf: string;
  razao_social: string;
  nome_fantasia?: string;
  email?: string;
  telefone_whatsapp?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  codigo_ibge_municipio?: string;
  uf?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  iss_retido?: number | boolean;
  aliquota_iss?: number;
  item_servico?: string;
  discriminacao_padrao?: string;
  valor_padrao?: number;
  condicao_pagamento_padrao?: string;
}

// ----------------------------------------------------------------------------
// R3. Tax Guides Center with 1-Click PIX Copy-Paste
// ----------------------------------------------------------------------------
export interface TaxGuideItem {
  id: string;
  company_id: string;
  tenant_id?: string;
  tipo_tributo: 'DAS_SIMPLES' | 'ICMS_DAE' | 'FGTS_DIGITAL' | 'INSS_DARF' | 'ISS_MUNICIPAL' | 'IRRF_FOLHA' | 'OUTROS' | string;
  titulo: string;
  competencia: string;
  data_vencimento: string;
  valor_principal: number;
  valor_multa_juros: number;
  valor_total: number;
  codigo_barras_linha_digitavel?: string | null;
  pix_copia_e_cola?: string | null;
  pix_qr_code_url?: string | null;
  pdf_file_path?: string | null;
  pdf_url?: string;
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado' | 'PENDENTE' | 'PAGO' | 'VENCIDO';
  data_pagamento?: string | null;
  comprovante_file_path?: string | null;
  origem_apuracao?: string;
  notificado_whatsapp?: number;
  notificado_em?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PayTaxGuideDto {
  status?: 'PAGO' | 'pago';
  data_pagamento?: string;
  comprovante_url?: string;
  observacoes?: string;
}

export interface UpdateTaxGuideStatusDto {
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado' | 'PENDENTE' | 'PAGO' | 'VENCIDO';
  data_pagamento?: string;
}

// ----------------------------------------------------------------------------
// R4. Receipt OCR Scanner & Auto-Match with Payables
// ----------------------------------------------------------------------------
export interface ExtractedReceiptData {
  cnpj?: string;
  cpf?: string;
  fornecedor?: string;
  data_emissao?: string;
  valor_total?: number;
  categoria_sugerida: string;
  categoria_sugerida_id?: string;
  itens_detectados?: Array<{ descricao: string; valor: number }>;
  linha_digitavel?: string;
  raw_text?: string;
  confidence?: number;
}

export interface PayableCandidate {
  id: string;
  invoice_id?: string;
  fornecedor_nome?: string;
  fornecedor_cnpj?: string;
  valor: number;
  data_vencimento: string;
  status: string;
  numero_parcela?: string;
}

export interface MatchedPayableData {
  payable_id: string;
  descricao?: string;
  fornecedor?: string;
  valor: number;
  vencimento: string;
  match_confidence: number;
  match_status: 'MATCHED' | 'POSSIBLE_MATCH' | 'UNMATCHED';
}

export interface ReceiptOcrItem {
  id: string;
  company_id: string;
  tenant_id?: string;
  arquivo_nome: string;
  arquivo_path: string;
  arquivo_tamanho?: number;
  mime_type?: string;
  raw_ocr_text?: string;
  ocr_confidence_score: number;
  fornecedor_nome_detectado?: string | null;
  fornecedor_cnpj_detectado?: string | null;
  data_despesa_detectada?: string | null;
  valor_total_detectado?: number | null;
  categoria_sugerida_id?: string | null;
  categoria_sugerida_nome?: string | null;
  itens_detectados_json?: string | null;
  descricao_final?: string | null;
  valor_final?: number | null;
  data_final?: string | null;
  forma_pagamento?: string | null;
  observacoes_cliente?: string | null;
  status_match: 'pendente' | 'sugerido' | 'conciliado' | 'ignorado' | 'PROCESSADO' | 'CONFIRMADO' | 'REJEITADO';
  matched_payable_id?: string | null;
  matched_transaction_id?: string | null;
  matched_confidence?: number;
  matched_at?: string | null;
  created_at: string;
  updated_at?: string;
  image_url?: string;
  extracted?: ExtractedReceiptData;
  matched_payable?: MatchedPayableData;
}

export interface ConfirmReceiptMatchDto {
  payable_id?: string;
  bank_transaction_id?: string;
  categoria_id?: string;
  valor_ajustado?: number;
  data_ajustada?: string;
  fornecedor_ajustado?: string;
  forma_pagamento?: string;
  observacoes?: string;
}
```

---

## 2. API Client Methods (`client/src/services/api.ts`)

The API client will be enhanced with dedicated methods targeting the `/api/portal/*` endpoints:

```typescript
// ============================================================================
// SUPER APP VIACONT (ÁREA DO CLIENTE) REST API CLIENT METHODS
// ============================================================================

// 1. Dashboard & Diagnóstico Financeiro (R5)
async getPortalDashboardSummary(companyId: string): Promise<DashboardSummaryData> {
  const res = await fetch(`${API_BASE}/portal/dashboard/summary?company_id=${companyId}`, {
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
```

---

## 3. Master Responsive Shell (`client/src/components/ClientPortalView.tsx`)

### 3.1 Architecture & Layout Strategy

`ClientPortalView.tsx` acts as the master responsive shell for the Super App Viacont:
1. **Responsive View Detection**:
   - Uses `window.matchMedia('(max-width: 767px)')` listener to seamlessly adapt UI between Mobile PWA and Desktop.
2. **Zero-Reload SPA Tab Switching**:
   - Tab switching changes internal React state (`activeTab: PortalTab`), instantly rendering the respective subcomponent without full page reload.
   - Synchronizes `localStorage.setItem('viacont_portal_active_tab', tab)` to preserve the user's active tab across browser restarts.
3. **Mobile PWA Mode Navigation (< 768px)**:
   - **Fixed Bottom Dock Bar**: Positioned at `fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800`.
   - **4 Master Thumb Buttons**:
     - `Início` (`TrendingUp` icon, opens `inicio_financas`)
     - `Emitir` (`Zap` icon with emerald glowing badge, opens `emitir_notas`)
     - `Guias` (`FileText` icon with pending badge count, opens `guias_impostos`)
     - `Recibos` (`Camera` icon, opens `recibos_scanner`)
   - **Touch Target Standard**: Height 56px with generous hit area, satisfying WCAG AAA standards (≥ 48px).
   - **Mobile Safe Area**: Adds `pb-20` padding at the bottom of the scroll container to prevent bottom bar collision.
4. **Desktop Mode Navigation (≥ 768px)**:
   - **Top Sub-Navigation Bar**: Modern segmented pill bar with clean indicators, icons, and hotkeys.
   - Additional tab: `Manifestar NF-e` (`ShieldCheck` icon) to manage supplier invoice receipt and SEFAZ manifestation directly in the portal.
5. **Toast Notification System**:
   - Global feedback toast for 1-click PIX code copied, invoice authorized, receipt auto-matched, or errors.

### 3.2 Component Code Layout

```
client/src/components/
├── ClientPortalView.tsx            (Master Responsive Shell)
└── portal/
    ├── PortalDashboardTab.tsx      (R5: Cash Flow & Simples Nacional RBT12 Gauge)
    ├── PortalInvoiceIssuerTab.tsx  (R2: 3-Step Guided Invoice Issuer & Mirror)
    ├── PortalFavoritesModal.tsx    (R2: Favorites Catalog Modal)
    ├── PortalTaxGuidesTab.tsx      (R3: Tax Guides Center & 1-Click PIX)
    └── PortalReceiptScannerTab.tsx (R4: Receipt OCR Capture & Auto-Match)
```

---

## 4. Subcomponents Detailed Blueprint

### 4.1 `PortalDashboardTab.tsx` (R5: Real-Time Financial Diagnostics & RBT12 Gauge)

#### Key Capabilities
- **Summary Cards (4 Key Metrics)**:
  1. *Saldo Consolidado em Bancos*: Real-time aggregate bank balance from reconciled accounts.
  2. *Contas a Pagar Hoje*: Value and count of titles due today.
  3. *Contas a Receber Hoje*: Value and count of titles receivable today.
  4. *Saldo Projetado Fim do Dia*: Calculated as `Saldo Bancário + Recebíveis Hoje - A Pagar Hoje`.
- **Simples Nacional RBT12 Gauge & Thermometer**:
  - **Sublimite Estadual R$ 3.600.000,00**: Horizontal/Radial progress bar displaying percentage consumed (e.g. `51.38%`) and remaining margin until state ICMS/ISS exclusion.
  - **Teto Nacional R$ 4.800.000,00**: Federal limit indicator displaying total consumption (e.g. `38.54%`).
  - **Faixa do Simples & Alíquota Efetiva**: Shows current Faixa (1 to 6), calculated effective tax rate (e.g. `10.45%`), nominal rate, and deduction amount.
  - **Status de Risco**: Badge with color semantics:
    - 🟢 *Normal / Seguro* (< 75% of sublimite)
    - 🟡 *Atenção / Planejamento Tributário* (75% to 90% of sublimite)
    - 🟠 *Alerta Subteto* (> 90% to 100% of sublimite)
    - 🔴 *Risco Crítico de Desenquadramento* (> 100%)
- **7 / 15 / 30-Day Cash Flow Forecast Bars**: Visual chart bars showing projected cash inflows vs outflows.
- **Urgent Action Shortcuts**: Quick 1-touch buttons to "Emitir Nova Nota", "Copiar PIX do DAS", and "Fotografar Recibo".

---

### 4.2 `PortalInvoiceIssuerTab.tsx` (R2: 3-Step Lightning Invoice Issuer & WhatsApp Share)

#### Key Capabilities
- **Step 1 — Tomador / Cliente**:
  - Auto-formatting mask for CPF (`999.999.999-99`) and CNPJ (`99.999.999/9999-99`).
  - Fast CNPJ lookup button calling `api.lookupCnpj` to auto-fill Razão Social, Logradouro, Bairro, Município, and UF.
  - "Escolher dos Favoritos / Recorrentes" modal selector to populate in 1 touch.
  - Checkbox: "Salvar tomador nos clientes frequentes".
- **Step 2 — Produto / Serviço & Valores**:
  - Switcher between `NFS-e (Serviços)` and `NF-e (Mercadorias)`.
  - "Catálogo de Favoritos" button: opens modal or renders quick pills for recurring items (e.g., "Honorários Mensais", "Consultoria em TI").
  - Description textarea, Item LC 116 / NCM input, Unit Value (R$), ISS rate (%), Retained ISS toggle.
  - Payment condition selector (PIX, Boleto, A Vista, Parcelado).
- **Step 3 — Revisão, Emissão & Compartilhamento WhatsApp**:
  - **Live Visual Mirror Preview**: Renders a realistic simulated RPS / DANFE document box with company header, client details, item table, and tax calculations.
  - **1-Click Emission Action**: Calls `api.emitFastInvoice` with loading spinner.
  - **Emission Success Modal / Banner**:
    - Confetti animation via `canvas-confetti`.
    - Authorization status badge, Nota Fiscal number, and Verification Code.
    - PDF Direct Link & View button.
    - Official EMV PIX Copia-e-Cola box with 1-click Copy button.
    - PIX QR Code image display.
    - **"Enviar no WhatsApp do Cliente"**: Generates instant WhatsApp link (`https://api.whatsapp.com/send?phone=...&text=...`) with pre-formatted greeting, PDF link, and PIX Copia-e-Cola code.
- **Recent Emitted Invoices List**: Quick access to recent invoices with direct PDF download, PIX copying, and WhatsApp resending.

---

### 4.3 `PortalFavoritesModal.tsx` (R2: Favorites Catalog Management)

#### Key Capabilities
- Modal dialog for managing recurring services and products.
- Tab filter between `Serviços` and `Produtos`.
- Search bar filtering by title or description.
- 1-Click "Usar Este Item" button returning the selected favorite item to the caller (`PortalInvoiceIssuerTab`).
- Create / Edit / Delete favorite items with fields:
  - Nome do atalho (e.g. "Manutenção Preventiva")
  - Descrição detalhada
  - Tipo (`servico` / `produto`)
  - Valor padrão (R$)
  - Alíquota ISS (%) / ICMS (%)
  - Item LC 116 / CNAE / NCM / CFOP
  - Unidade de medida (UN, HORA, MES)

---

### 4.4 `PortalTaxGuidesTab.tsx` (R3: Tax Guides Center with 1-Click PIX)

#### Key Capabilities
- **Consolidated Tax Listing**: Displays DAS Simples Nacional, ICMS/DAE, FGTS Digital, INSS/DARF, and ISS.
- **Quick Status Filter Tabs**: `Todas`, `A Vencer / Pendentes`, `Vencidas`, `Pagas`.
- **Urgency Semaphore Badges**:
  - 🔴 `Vencido` (Data de vencimento anterior à data atual)
  - 🟡 `Vence Hoje` (Vencimento no dia corrente, badge com efeito pulsante)
  - 🟡 `A Vencer` (Vencimento nos próximos dias)
  - 🟢 `Pago` (Guia baixada)
- **1-Click PIX Copia-e-Cola Action**:
  - Copies EMV payload string to clipboard via `navigator.clipboard.writeText`.
  - Triggers haptic feedback (`navigator.vibrate(50)` on mobile) and animated toast: *"Código PIX Copiado com Sucesso! Cole no App do seu Banco"*.
  - Changes button icon temporarily to a green checkmark.
- **Linha Digitável Copy**: Alternative copy button for traditional barcode line (47/48 digits).
- **View PDF Guide**: Opens `/api/portal/tax-guides/:id/pdf` directly in a new tab or in-app viewer.
- **WhatsApp Share**: Quick button to forward the guide and PIX code via WhatsApp.
- **"Marcar como Paga" Dialog**: Modal allowing the user to confirm payment date, attach bank receipt/voucher, and write notes.

---

### 4.5 `PortalReceiptScannerTab.tsx` (R4: Receipt OCR Capture & Auto-Match)

#### Key Capabilities
- **Camera & Upload Trigger**:
  - Mobile camera direct trigger: `<input type="file" accept="image/*" capture="environment" />`
  - Desktop drag-and-drop zone supporting `.jpg`, `.jpeg`, `.png`, and `.pdf`.
- **OCR Extraction Analysis Card**:
  - Detected supplier name & CNPJ/CPF.
  - Detected expense date.
  - Detected total monetary value (R$).
  - Suggested accounting category (e.g. *Combustíveis & Frotas*, *Alimentação & Refeições*, *Material de Escritório*).
  - Detected line items list.
  - OCR Confidence score badge (e.g. `98% Confiança Alta`).
- **Auto-Match with Accounts Payable**:
  - Displays best matching account payable or bank transaction.
  - Matching Score indicator (e.g. `95% Match Perfeito`).
  - 1-Click "Confirmar Conciliação & Baixar Título": Immediately updates status to `conciliado` and links to the payable installment.
  - Editable form to adjust value, category, or payment method before confirming.
- **Receipts History List**: Filterable by `Pendentes`, `Conciliados`, and `Todos`.

---

## 5. Build Verification Plan

To ensure clean compilation with `npm run build --prefix client`:

1. **TypeScript Strict Type Safety**:
   - All components must import strict types from `../types` (`Company`, `PortalTab`, `DashboardSummaryData`, `EmitFastInvoiceDto`, `FastInvoiceResult`, `TaxGuideItem`, `ReceiptOcrItem`, etc.).
   - Zero `any` casts in public prop interfaces.
   - Clean handling of optional properties (`?.`) and number/date formatting.
2. **Lucide Icons Verification**:
   - Ensure all imported Lucide icons are valid exported members of `lucide-react@0.475.0`:
     - `TrendingUp`, `Zap`, `FileText`, `Camera`, `ShieldCheck`, `CheckCircle2`, `XCircle`, `Copy`, `Check`, `Share2`, `ExternalLink`, `Plus`, `Search`, `Download`, `RefreshCw`, `DollarSign`, `Building2`, `Calendar`, `Smartphone`, `Laptop`, `Eye`, `Edit2`, `Trash2`, `AlertTriangle`, `Clock`, `QrCode`, `Sparkles`, `Filter`, `Layers`.
3. **TailwindCSS Class Verification**:
   - Ensure all color variables map to configured Tailwind tokens (`brand-*`, `surface-*`, `slate-*`, `emerald-*`, `amber-*`, `rose-*`).
   - Use standard responsive utility prefixes (`sm:`, `md:`, `lg:`).
4. **Zero-Broken-Link Build**:
   - Verify `api.ts` exports all referenced methods with proper parameter types.
   - Verify no leftover debugging code or invalid JSX tags.

---

## 6. Implementation Sequence for Future Implementer

1. **Step 1**: Update `client/src/types/index.ts` with all R1-R5 interfaces.
2. **Step 2**: Update `client/src/services/api.ts` with all `/api/portal/*` client methods.
3. **Step 3**: Create directory `client/src/components/portal/`.
4. **Step 4**: Create `client/src/components/portal/PortalFavoritesModal.tsx`.
5. **Step 5**: Create `client/src/components/portal/PortalDashboardTab.tsx`.
6. **Step 6**: Create `client/src/components/portal/PortalInvoiceIssuerTab.tsx`.
7. **Step 7**: Create `client/src/components/portal/PortalTaxGuidesTab.tsx`.
8. **Step 8**: Create `client/src/components/portal/PortalReceiptScannerTab.tsx`.
9. **Step 9**: Overhaul `client/src/components/ClientPortalView.tsx` with responsive shell, tab switching, and subcomponent rendering.
10. **Step 10**: Verify build using Vite build checks.
