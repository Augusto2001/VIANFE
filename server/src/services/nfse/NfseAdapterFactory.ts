import { INfseAdapter } from './INfseAdapter.js';
import { SalvadorNfseAdapter } from './adapters/SalvadorNfseAdapter.js';
import { FocusNfeAdapter } from './adapters/FocusNfeAdapter.js';
import { FeiraDeSantanaNfseAdapter } from './adapters/FeiraDeSantanaNfseAdapter.js';
import { CuritibaNfseAdapter } from './adapters/CuritibaNfseAdapter.js';
import { LauroDeFreitasNfseAdapter } from './adapters/LauroDeFreitasNfseAdapter.js';
import { SaoGoncaloNfseAdapter } from './adapters/SaoGoncaloNfseAdapter.js';
import { NacionalAdnNfseAdapter } from './adapters/NacionalAdnNfseAdapter.js';

export class NfseAdapterFactory {
  private static adapters: Map<string, INfseAdapter> = new Map<string, INfseAdapter>([
    ['salvador', new SalvadorNfseAdapter()],
    ['2927408', new SalvadorNfseAdapter()],
    ['salvador (focus nfe)', new FocusNfeAdapter()],
    ['focus_nfe', new FocusNfeAdapter()],
    ['focus nfe', new FocusNfeAdapter()],
    ['feira de santana', new FeiraDeSantanaNfseAdapter()],
    ['2910800', new FeiraDeSantanaNfseAdapter()],
    ['curitiba', new CuritibaNfseAdapter()],
    ['4106902', new CuritibaNfseAdapter()],
    ['lauro de freitas', new LauroDeFreitasNfseAdapter()],
    ['2919207', new LauroDeFreitasNfseAdapter()],
    ['são gonçalo dos campos', new SaoGoncaloNfseAdapter()],
    ['sao goncalo dos campos', new SaoGoncaloNfseAdapter()],
    ['2929206', new SaoGoncaloNfseAdapter()],
    ['portal nacional adn (nfse.gov.br)', new NacionalAdnNfseAdapter()],
    ['nacional', new NacionalAdnNfseAdapter()]
  ]);

  /**
   * Obtém o Adapter correto pela identificação do município ou código IBGE
   */
  static getAdapter(prefeituraOuIbge: string): INfseAdapter {
    const key = (prefeituraOuIbge || 'salvador').trim().toLowerCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      // Fallback para Salvador ou Nacional
      return new SalvadorNfseAdapter();
    }
    return adapter;
  }

  /**
   * Lista todas as cidades suportadas
   */
  static getSupportedCities(): Array<{ nome: string; ibge: string; schema: string }> {
    return [
      { nome: 'Salvador (BA)', ibge: '2927408', schema: 'ABRASF 2.03 / Nota Salvador' },
      { nome: 'Feira de Santana (BA)', ibge: '2910800', schema: 'IPM / ABRASF 2.04' },
      { nome: 'Curitiba (PR)', ibge: '4106902', schema: 'ISS Curitiba 1.00' },
      { nome: 'Lauro de Freitas (BA)', ibge: '2919207', schema: 'ABRASF 2.02' },
      { nome: 'São Gonçalo dos Campos (BA)', ibge: '2929206', schema: 'WebISS 2.02' },
      { nome: 'Portal Nacional ADN (nfse.gov.br)', ibge: '0000000', schema: 'ADN 1.00' }
    ];
  }
}
