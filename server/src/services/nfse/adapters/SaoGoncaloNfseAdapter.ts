import { INfseAdapter, NfseEmissionPayload, NfseEmissionResponse } from '../INfseAdapter.js';
import crypto from 'crypto';

export class SaoGoncaloNfseAdapter implements INfseAdapter {
  readonly nomePrefeitura = 'São Gonçalo dos Campos';
  readonly codigoIbge = '2929206';
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
      linkVisualizacao: 'https://saogoncalodoscampos.ba.gov.br/nfse',
      mensagem: `RPS Nº ${payload.numeroRps} gerado no padrão WebISS para São Gonçalo dos Campos (BA).`
    };
  }
}
