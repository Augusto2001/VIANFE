import { INfseAdapter, NfseEmissionPayload, NfseEmissionResponse, NfseConsultationPayload } from '../INfseAdapter.js';
import { cleanNumeric } from '../../../utils/crypto.js';

export class FocusNfeAdapter implements INfseAdapter {
  readonly nomePrefeitura = 'Salvador (BA) via Focus NFe';
  readonly codigoIbge = '2927408';
  readonly versaoSchema = 'Focus NFe v2 REST API (NFS-e Salvador)';

  private getBaseUrl(ambiente?: string): string {
    if (ambiente === 'homologacao') {
      return 'https://homologacao.focusnfe.com.br/v2';
    }
    return 'https://api.focusnfe.com.br/v2';
  }

  private getAuthHeader(token: string): string {
    const cleanToken = token.trim();
    const encoded = Buffer.from(`${cleanToken}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * Emissão oficial de NFS-e de Salvador via Focus NFe API
   */
  async emitir(payload: NfseEmissionPayload): Promise<NfseEmissionResponse> {
    const token = payload.focusNfeToken || payload.company.focus_nfe_token || process.env.FOCUS_NFE_TOKEN || '';
    if (!token) {
      throw new Error(
        'Token da Focus NFe não configurado. Por favor, informe o Token Focus NFe nas configurações da empresa ou na variável de ambiente FOCUS_NFE_TOKEN.'
      );
    }

    const baseUrl = this.getBaseUrl(payload.ambiente || payload.company.sefaz_ambiente);
    const authHeader = this.getAuthHeader(token);

    // Referência única da requisição (ex: VIANFE_RPS_359_17869...)
    const referencia = `VIANFE_RPS_${payload.numeroRps}_${Date.now()}`;
    const cleanCpfCnpj = cleanNumeric(payload.tomadorCnpjCpf);
    const isCpf = cleanCpfCnpj.length === 11;

    // Normalização dos dados do tomador
    const tomadorBody: any = {
      razao_social: payload.tomadorNome.trim(),
      email: payload.tomadorEmail || undefined,
      telefone: payload.tomadorTelefone ? cleanNumeric(payload.tomadorTelefone) : undefined,
      endereco: {
        logradouro: payload.tomadorEndereco?.logradouro || 'Avenida Tancredo Neves',
        numero: payload.tomadorEndereco?.numero || 'S/N',
        complemento: payload.tomadorEndereco?.complemento || undefined,
        bairro: payload.tomadorEndereco?.bairro || 'Caminho das Árvores',
        codigo_municipio: payload.tomadorEndereco?.codigoMunicipio || '2927408',
        uf: payload.tomadorEndereco?.uf || 'BA',
        cep: payload.tomadorEndereco?.cep ? cleanNumeric(payload.tomadorEndereco.cep) : '41820020'
      }
    };

    if (isCpf) {
      tomadorBody.cpf = cleanCpfCnpj;
    } else {
      tomadorBody.cnpj = cleanCpfCnpj;
    }

    const aliquotaNum = Number(payload.aliquotaIss) || 5.0;

    const focusPayload = {
      data_emissao: new Date().toISOString(),
      prestador: {
        cnpj: cleanNumeric(payload.company.cnpj),
        inscricao_municipal: payload.company.ie || payload.company.inscricao_municipal || undefined,
        codigo_municipio: '2927408'
      },
      tomador: tomadorBody,
      servico: {
        valor_servicos: Number(payload.valorServicos),
        valor_deducoes: Number(payload.valorDeducoes || 0),
        valor_pis: Number(payload.valorPis || 0),
        valor_cofins: Number(payload.valorCofins || 0),
        valor_inss: Number(payload.valorInss || 0),
        valor_ir: Number(payload.valorIr || 0),
        valor_csll: Number(payload.valorCsll || 0),
        iss_retido: !!payload.issRetido,
        aliquota: aliquotaNum,
        item_lista_servico: payload.itemServico || '17.01',
        codigo_tributario_municipio: payload.codigoTributacaoMunicipio || (payload.itemServico || '17.01').replace(/\./g, ''),
        discriminacao: payload.discriminacao.trim(),
        codigo_municipio: '2927408'
      },
      natureza_operacao: payload.naturezaOperacao || '1',
      optante_simples_nacional: payload.optanteSimplesNacional === '1',
      incentivador_cultural: payload.incentivadorCultural === '1'
    };

    console.log(`[Focus NFe] Transmitindo NFS-e Salvador (Ref: ${referencia})...`);

    try {
      const response = await fetch(`${baseUrl}/nfse?ref=${referencia}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(focusPayload)
      });

      const json = await response.json();
      console.log(`[Focus NFe] Resposta inicial HTTP ${response.status}:`, JSON.stringify(json));

      if (!response.ok && response.status !== 202) {
        const errorMsg = json.mensagem || json.erros?.map((e: any) => e.mensagem || e).join('; ') || 'Erro na Focus NFe';
        return {
          success: false,
          status: 'rejeitada',
          numeroRps: payload.numeroRps,
          serieRps: payload.serieRps || '1',
          dataEmissao: new Date().toISOString(),
          mensagem: `Focus NFe Rejeição: ${errorMsg}`,
          motivoRejeicao: errorMsg,
          erros: Array.isArray(json.erros) ? json.erros : [{ codigo: 'FOCUS_ERR', mensagem: errorMsg }]
        };
      }

      // Se foi autorizada de imediato
      if (json.status === 'autorizado') {
        return {
          success: true,
          status: 'autorizada',
          numeroNfse: json.numero || `NFSE-${payload.numeroRps}`,
          codigoVerificacao: json.codigo_verificacao || '',
          numeroRps: payload.numeroRps,
          serieRps: payload.serieRps || '1',
          dataEmissao: json.data_emissao || new Date().toISOString(),
          protocolo: json.protocolo || json.referencia || referencia,
          linkVisualizacao: json.url_danfse || json.url || undefined,
          pdfUrl: json.url_danfse || json.caminho_danfse || undefined,
          mensagem: `NFS-e Salvador autorizada com sucesso via Focus NFe (Nº ${json.numero || payload.numeroRps})!`,
          xmlRetorno: json.caminho_xml_nota_fiscal || undefined
        };
      }

      // Se está em processamento assíncrono, faz polling rápido de confirmação (até 3 tentativas)
      if (json.status === 'processando_autorizacao') {
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            const checkRes = await fetch(`${baseUrl}/nfse/${referencia}`, {
              headers: { 'Authorization': authHeader }
            });
            const checkJson = await checkRes.json();
            if (checkJson.status === 'autorizado') {
              return {
                success: true,
                status: 'autorizada',
                numeroNfse: checkJson.numero || `NFSE-${payload.numeroRps}`,
                codigoVerificacao: checkJson.codigo_verificacao || '',
                numeroRps: payload.numeroRps,
                serieRps: payload.serieRps || '1',
                dataEmissao: checkJson.data_emissao || new Date().toISOString(),
                protocolo: checkJson.protocolo || referencia,
                linkVisualizacao: checkJson.url_danfse || checkJson.url || undefined,
                pdfUrl: checkJson.url_danfse || undefined,
                mensagem: `NFS-e Salvador autorizada com sucesso via Focus NFe (Nº ${checkJson.numero || payload.numeroRps})!`,
                xmlRetorno: checkJson.caminho_xml_nota_fiscal || undefined
              };
            }
          } catch (_) {}
        }
      }

      return {
        success: true,
        status: 'processando',
        numeroNfse: json.numero || `RPS-${payload.numeroRps}`,
        codigoVerificacao: json.codigo_verificacao || '',
        numeroRps: payload.numeroRps,
        serieRps: payload.serieRps || '1',
        dataEmissao: new Date().toISOString(),
        protocolo: json.referencia || referencia,
        linkVisualizacao: json.url_danfse || undefined,
        mensagem: 'NFS-e transmitida para a Focus NFe e em processamento na Prefeitura de Salvador.'
      };

    } catch (err: any) {
      console.error('[Focus NFe] Falha de comunicação:', err);
      throw new Error(`Falha na comunicação com a API Focus NFe: ${err.message}`);
    }
  }

  /**
   * Consulta de NFS-e na Focus NFe pela referência ou protocolo
   */
  async consultarNfse(payload: NfseConsultationPayload): Promise<NfseEmissionResponse> {
    const token = payload.company.focus_nfe_token || process.env.FOCUS_NFE_TOKEN || '';
    if (!token) {
      throw new Error('Token da Focus NFe não configurado.');
    }

    const baseUrl = this.getBaseUrl(payload.company.sefaz_ambiente);
    const authHeader = this.getAuthHeader(token);
    const ref = payload.protocolo || `VIANFE_RPS_${payload.numeroRps}`;

    const response = await fetch(`${baseUrl}/nfse/${ref}`, {
      headers: { 'Authorization': authHeader }
    });

    const json = await response.json();

    if (json.status === 'autorizado') {
      return {
        success: true,
        status: 'autorizada',
        numeroNfse: json.numero,
        codigoVerificacao: json.codigo_verificacao,
        numeroRps: payload.numeroRps || '1',
        serieRps: payload.serieRps || '1',
        dataEmissao: json.data_emissao || new Date().toISOString(),
        protocolo: ref,
        linkVisualizacao: json.url_danfse,
        pdfUrl: json.url_danfse,
        mensagem: 'NFS-e localizada e autorizada na Focus NFe.'
      };
    }

    return {
      success: false,
      status: json.status === 'erro_autorizacao' ? 'rejeitada' : 'processando',
      numeroRps: payload.numeroRps || '1',
      serieRps: payload.serieRps || '1',
      dataEmissao: new Date().toISOString(),
      mensagem: json.mensagem_sefaz || json.erros?.[0]?.mensagem || 'NFS-e em processamento.'
    };
  }

  /**
   * Cancelamento de NFS-e na Focus NFe
   */
  async cancelarNfse(company: any, numeroNfse: string, codigoCancelamento: string, motivo: string): Promise<any> {
    const token = company.focus_nfe_token || process.env.FOCUS_NFE_TOKEN || '';
    if (!token) {
      throw new Error('Token da Focus NFe não configurado.');
    }

    const baseUrl = this.getBaseUrl(company.sefaz_ambiente);
    const authHeader = this.getAuthHeader(token);

    const response = await fetch(`${baseUrl}/nfse/${numeroNfse}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        justificativa: motivo || 'Cancelamento solicitado pelo emitente'
      })
    });

    return await response.json();
  }
}
