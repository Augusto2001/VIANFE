import { INfseAdapter, NfseEmissionPayload, NfseEmissionResponse } from '../INfseAdapter.js';
import crypto from 'crypto';

export class CuritibaNfseAdapter implements INfseAdapter {
  readonly nomePrefeitura = 'Curitiba';
  readonly codigoIbge = '4106902';
  readonly versaoSchema = '1.00';

  async emitir(payload: NfseEmissionPayload): Promise<NfseEmissionResponse> {
    const codigoVerificacao = crypto.randomBytes(4).toString('hex').toUpperCase();
    return {
      success: true,
      status: 'rps_gerado',
      numeroNfse: `RPS-${payload.numeroRps}`,
      numeroRps: payload.numeroRps,
      serieRps: payload.serieRps || '1',
      codigoVerificacao,
      dataEmissao: new Date().toISOString(),
      linkVisualizacao: 'https://isscuritiba.curitiba.pr.gov.br/portal',
      mensagem: `RPS Nº ${payload.numeroRps} gerado no padrão ISS Curitiba para Curitiba (PR).`
    };
  }
}
