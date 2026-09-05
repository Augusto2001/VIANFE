// ============================================================================
// SUPER APP VIACONT (ÁREA DO CLIENTE) - TYPESCRIPT CONTRATOS & INTERFACES (M1)
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

// ----------------------------------------------------------------------------
// 1. Dashboard & Diagnóstico Financeiro (R5)
// ----------------------------------------------------------------------------

export interface CashFlowDay {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface SimplesNacionalGaugeResult {
  rbt12: number;
  teto_estadual: number;
  teto_federal: number;
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
  projected_end_of_day?: number;
  cash_flow_forecast: CashFlowDay[];
  simples_nacional: SimplesNacionalGaugeResult;
}

export type PortalDashboardSummary = DashboardSummaryData;

// ----------------------------------------------------------------------------
// 2. Emissão Rápida de Notas Fiscais (R2)
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

// ----------------------------------------------------------------------------
// 3. Catálogo de Favoritos em 1 Toque (R2)
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// 4. Clientes & Tomadores Recorrentes (R2)
// ----------------------------------------------------------------------------

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
// 5. Central de Guias & Impostos com PIX 1-Clique (R3)
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
// 6. Scanner OCR & Auto-Match com Contas a Pagar (R4)
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
  match_confidence: number; // 0.00 to 1.00
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
