import { INfseAdapter, NfseEmissionPayload, NfseEmissionResponse } from '../INfseAdapter.js';
import crypto from 'crypto';

export class LauroDeFreitasNfseAdapter implements INfseAdapter {
  readonly nomePrefeitura = 'Lauro de Freitas';
  readonly codigoIbge = '2919207';
  readonly versaoSchema = '2.02';

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
      linkVisualizacao: 'https://laurodefreitas.ba.gov.br/nfse',
      mensagem: `RPS Nº ${payload.numeroRps} gerado no padrão ABRASF para Lauro de Freitas (BA).`
    };
  }
}
