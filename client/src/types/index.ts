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
