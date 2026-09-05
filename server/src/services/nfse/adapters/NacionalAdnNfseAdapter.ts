import { INfseAdapter, NfseEmissionPayload, NfseEmissionResponse } from '../INfseAdapter.js';
import crypto from 'crypto';

export class NacionalAdnNfseAdapter implements INfseAdapter {
  readonly nomePrefeitura = 'Portal Nacional ADN (nfse.gov.br)';
  readonly codigoIbge = '0000000';
  readonly versaoSchema = '1.00';

  async emitir(payload: NfseEmissionPayload): Promise<NfseEmissionResponse> {
    const codigoVerificacao = crypto.randomBytes(4).toString('hex').toUpperCase();
    return {
      success: true,
      status: 'rps_gerado',
      numeroNfse: `DPS-${payload.numeroRps}`,
      numeroRps: payload.numeroRps,
      serieRps: payload.serieRps || '1',
      codigoVerificacao,
      dataEmissao: new Date().toISOString(),
      linkVisualizacao: 'https://www.nfse.gov.br/EmissorNacional',
      mensagem: `Declaração de Prestação de Serviço (DPS Nº ${payload.numeroRps}) gerada no Padrão Nacional ADN.`
    };
  }
}
