export interface Company {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  ie?: string;
  uf: string;
  email?: string;
  telefone?: string;
  status: 'ativo' | 'inativo' | 'pendente';
  cert_filename?: string;
  cert_valid_until?: string;
  sefaz_ambiente: 'producao' | 'homologacao';
  last_nsu?: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
  gdrive_folder_id?: string;
  gdrive_folder_name?: string;
  gdrive_sync_frequency?: 'manual' | 'hourly' | 'every_6h' | 'daily';
  gdrive_active?: number | boolean;
  gdrive_last_status?: 'success' | 'error' | 'running' | 'never';
  inscricao_municipal?: string;
  item_servico_padrao?: string;
  cnae_padrao?: string;
  codigo_tributacao_municipio?: string;
  emite_nfse?: number | boolean;
  nfse_tipo_auth?: 'certificado' | 'login_senha';
  nfse_prefeitura_padrao?: string;
  nfse_aliquota_padrao?: number;
  nfse_iss_retido_padrao?: number;
  ultimo_rps_numero?: number;
  serie_rps?: string;
  total_invoices?: number;
  total_synced_invoices?: number;
  total_volume_financeiro?: number;
}

export interface InvoiceItem {
  itemNumero: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorDesconto?: number;
  icms?: {
    cst?: string;
    origem?: string;
    baseCalculo?: number;
    aliquota?: number;
    valor?: number;
  };
  pis?: {
    cst?: string;
    baseCalculo?: number;
    aliquota?: number;
    valor?: number;
  };
  cofins?: {
    cst?: string;
    baseCalculo?: number;
    aliquota?: number;
    valor?: number;
  };
  ipi?: {
    cst?: string;
    baseCalculo?: number;
    aliquota?: number;
    valor?: number;
  };
}

export interface Invoice {
  id: string;
  company_id: string;
  chave_acesso: string;
  numero: string;
  serie: string;
  modelo: string;
  tipo: 'entrada' | 'saida';
  status: 'autorizada' | 'cancelada' | 'denegada' | 'manifestada';
  natureza_operacao?: string;
  data_emissao: string;
  data_saida_entrada?: string;
  emitente_cnpj: string;
  emitente_nome: string;
  emitente_uf?: string;
  destinatario_cnpj: string;
  destinatario_nome: string;
  destinatario_uf?: string;
  valor_total: number;
  valor_produtos: number;
  valor_icms: number;
  valor_pis: number;
  valor_cofins: number;
  valor_ipi: number;
  itens_json?: string;
  itens?: InvoiceItem[];
  duplicatas_json?: string;
  duplicatas?: { numero: string; vencimento: string; valor: number }[];
  fatura_json?: string;
  fatura?: { numero?: string; valorOriginal?: number; valorDesconto?: number; valorLiquido?: number };
  pagamentos_json?: string;
  pagamentos?: { forma: string; formaCodigo: string; valor: number }[];
  xml_file_path?: string;
  pdf_file_path?: string;
  gdrive_synced: number;
  gdrive_file_id?: string;
  gdrive_synced_at?: string;
  created_at: string;
}

export interface InvoiceSummary {
  totalCount: number;
  totalValor: number;
  valorEntradas: number;
  valorSaidas: number;
  totalGdriveSynced: number;
  totalGdrivePending: number;
}

export interface SyncLog {
  id: string;
  company_id: string;
  company_name?: string;
  trigger_type: 'agendado' | 'manual' | 'importacao_xml';
  service_type: 'sefaz_dfe' | 'gdrive_upload' | 'geral';
  status: 'sucesso' | 'alerta' | 'erro' | 'processando';
  invoices_found: number;
  invoices_downloaded: number;
  gdrive_uploaded: number;
  message?: string;
  executed_at: string;
}

export interface DriveStatus {
  isConfigured: boolean;
  mode: string;
  message: string;
}

// ============================================================================
// SUPER APP VIACONT (ÁREA DO CLIENTE) - DATA CONTRACTS & INTERFACES (R1-R5)
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

export type TaxGuideRecord = TaxGuideItem;

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

export interface MatchResult {
  payable_id?: string;
  match_confidence: number;
  match_status: 'MATCHED' | 'POSSIBLE_MATCH' | 'UNMATCHED';
  matched_payable?: PayableCandidate;
  reasons: string[];
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
