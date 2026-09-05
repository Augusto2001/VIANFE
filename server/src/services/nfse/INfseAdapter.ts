export interface NfseEmissionPayload {
  company: any;
  numeroRps: string;
  serieRps?: string;
  tipoRps?: '1' | '2' | '3'; // 1 = RPS, 2 = Nota Fiscal Conjugada Mista, 3 = Cupom
  dataEmissaoRps?: string;
  naturezaOperacao?: string; // 1 = Tributação no município
  optanteSimplesNacional: '1' | '2'; // 1 = Sim, 2 = Não
  incentivadorCultural?: '1' | '2'; // 1 = Sim, 2 = Não
  regimeEspecialTributacao?: string;
  tomadorCnpjCpf: string;
  tomadorNome: string;
  tomadorEmail?: string;
  tomadorTelefone?: string;
  tomadorEndereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    codigoMunicipio?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
  valorServicos: number;
  valorDeducoes?: number;
  valorPis?: number;
  valorCofins?: number;
  valorInss?: number;
  valorIr?: number;
  valorCsll?: number;
  aliquotaIss: number;
  valorIss?: number;
  issRetido: boolean;
  itemServico: string; // Ex: '17.01'
  cnae?: string; // Ex: '6920601'
  codigoTributacaoMunicipio?: string;
  codigoMunicipio?: string; // Ex: '2927408' para Salvador
  discriminacao: string;
  ambiente?: 'producao' | 'homologacao';
  focusNfeToken?: string;
}

export interface NfseEmissionResponse {
  success: boolean;
  status: 'autorizada' | 'processando' | 'rps_gerado' | 'rejeitada' | 'erro';
  numeroNfse?: string;
  codigoVerificacao?: string;
  numeroRps: string;
  serieRps: string;
  dataEmissao: string;
  protocolo?: string;
  linkVisualizacao?: string;
  mensagem: string;
  motivoRejeicao?: string;
  erros?: Array<{ codigo: string; mensagem: string; correcao?: string }>;
  xmlEnviado?: string;
  xmlRetorno?: string;
  pdfUrl?: string;
}

export interface NfseConsultationPayload {
  company: any;
  protocolo?: string;
  numeroRps?: string;
  serieRps?: string;
  numeroNfse?: string;
  dataInicial?: string;
  dataFinal?: string;
}

export interface INfseAdapter {
  readonly nomePrefeitura: string;
  readonly codigoIbge: string;
  readonly versaoSchema: string;

  emitir(payload: NfseEmissionPayload): Promise<NfseEmissionResponse>;
  consultarLoteRps?(payload: NfseConsultationPayload): Promise<NfseEmissionResponse>;
  consultarNfse?(payload: NfseConsultationPayload): Promise<NfseEmissionResponse>;
  cancelarNfse?(company: any, numeroNfse: string, codigoCancelamento: string, motivo: string): Promise<any>;
}
