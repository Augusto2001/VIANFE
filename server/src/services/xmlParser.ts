import { XMLParser } from 'fast-xml-parser';
import { cleanNumeric } from '../utils/crypto.js';

export interface ParsedFiscalItem {
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

export interface ParsedDuplicata {
  numero: string;
  vencimento: string;
  valor: number;
}

export interface ParsedFatura {
  numero?: string;
  valorOriginal?: number;
  valorDesconto?: number;
  valorLiquido?: number;
}

export interface ParsedPagamento {
  forma: string;
  formaCodigo: string;
  valor: number;
}

export interface ParsedTransporte {
  modalidadeFrete: string;
  modalidadeCodigo: string;
  transportadora?: {
    cnpjCpf?: string;
    razaoSocial?: string;
    ie?: string;
    endereco?: string;
    municipio?: string;
    uf?: string;
  };
  veiculo?: {
    placa?: string;
    uf?: string;
    rntc?: string;
  };
  volumes?: {
    quantidade?: number;
    especie?: string;
    marca?: string;
    numeracao?: string;
    pesoLiquido?: number;
    pesoBruto?: number;
  };
}

export interface ParsedFiscalInvoice {
  chaveAcesso: string;
  numero: string;
  serie: string;
  modelo: string; // '55' (NFe), '65' (NFCe), '57' (CTe)
  naturezaOperacao: string;
  tipoOperacao: '0' | '1'; // 0=Entrada, 1=Saída (do ponto de vista do emitente)
  dataEmissao: string;
  dataSaidaEntrada?: string;
  status: 'autorizada' | 'cancelada' | 'denegada' | 'manifestada';
  
  emitente: {
    cnpjCpf: string;
    razaoSocial: string;
    nomeFantasia?: string;
    ie?: string;
    uf: string;
    municipio?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cep?: string;
    fone?: string;
  };

  destinatario: {
    cnpjCpf: string;
    razaoSocial: string;
    ie?: string;
    uf: string;
    municipio?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cep?: string;
    fone?: string;
  };

  totais: {
    valorProdutos: number;
    valorFrete: number;
    valorSeguro: number;
    valorDesconto: number;
    valorOutrasDespesas: number;
    valorTotal: number;
    baseCalculoIcms: number;
    valorIcms: number;
    baseCalculoIcmsSt: number;
    valorIcmsSt: number;
    valorPis: number;
    valorCofins: number;
    valorIpi: number;
  };

  itens: ParsedFiscalItem[];
  fatura?: ParsedFatura;
  duplicatas: ParsedDuplicata[];
  pagamentos: ParsedPagamento[];
  transporte?: ParsedTransporte;
  protocoloAutorizacao?: string;
  dataAutorizacao?: string;
  informacoesComplementares?: string;
  informacoesFisco?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

export function parseFiscalXml(xmlContent: string): ParsedFiscalInvoice {
  try {
    const parsed = parser.parse(xmlContent);

    // 1. Check for resNFe (Resumo de NF-e da SEFAZ)
    if (parsed.resNFe) {
      return parseResNFe(parsed.resNFe);
    }

    // 2. Check for resCTe (Resumo de CT-e da SEFAZ)
    if (parsed.resCTe) {
      return parseResCTe(parsed.resCTe);
    }

    // Support both <nfeProc> (with protocol) and root <NFe>
    const nfeProc = parsed.nfeProc || parsed;
    const nfe = nfeProc.NFe || parsed.NFe;

    if (!nfe || !nfe.infNFe) {
      // Check if it's CTe
      const cteProc = parsed.cteProc || parsed;
      const cte = cteProc.CTe || parsed.CTe;
      if (cte && cte.infCte) {
        return parseCte(cte, cteProc.protCTe);
      }
      throw new Error('Formato XML fiscal não reconhecido (não contém <infNFe>, <infCte>, <resNFe> ou <resCTe>).');
    }

    const infNFe = nfe.infNFe;
    const ide = infNFe.ide || {};
    const emit = infNFe.emit || {};
    const dest = infNFe.dest || {};
    const total = infNFe.total?.ICMSTot || {};
    const protNFe = nfeProc.protNFe?.infProt || {};

    // Extract Chave de Acesso (from Id attribute or protocol)
    let chave = '';
    if (infNFe['@_Id']) {
      chave = cleanNumeric(infNFe['@_Id']);
    } else if (protNFe.chNFe) {
      chave = cleanNumeric(protNFe.chNFe);
    }

    // Extract Items
    const rawDet = Array.isArray(infNFe.det) ? infNFe.det : (infNFe.det ? [infNFe.det] : []);
    const itens: ParsedFiscalItem[] = rawDet.map((det: any, index: number) => {
      const prod = det.prod || {};
      const imposto = det.imposto || {};
      const icmsNode = imposto.ICMS ? Object.values(imposto.ICMS)[0] as any : {};
      const pisNode = imposto.PIS ? Object.values(imposto.PIS)[0] as any : {};
      const cofinsNode = imposto.COFINS ? Object.values(imposto.COFINS)[0] as any : {};
      const ipiNode = imposto.IPI?.IPITrib || {};

      return {
        itemNumero: parseInt(det['@_nItem'] || String(index + 1), 10),
        codigo: String(prod.cProd || ''),
        descricao: String(prod.xProd || ''),
        ncm: String(prod.NCM || ''),
        cfop: String(prod.CFOP || ''),
        unidade: String(prod.uCom || 'UN'),
        quantidade: parseFloat(prod.qCom || '0'),
        valorUnitario: parseFloat(prod.vUnCom || '0'),
        valorTotal: parseFloat(prod.vProd || '0'),
        valorDesconto: parseFloat(prod.vDesc || '0'),
        icms: {
          cst: icmsNode?.CST || icmsNode?.CSOSN || '',
          origem: icmsNode?.orig || '',
          baseCalculo: parseFloat(icmsNode?.vBC || '0'),
          aliquota: parseFloat(icmsNode?.pICMS || '0'),
          valor: parseFloat(icmsNode?.vICMS || '0'),
        },
        pis: {
          cst: pisNode?.CST || '',
          baseCalculo: parseFloat(pisNode?.vBC || '0'),
          aliquota: parseFloat(pisNode?.pPIS || '0'),
          valor: parseFloat(pisNode?.vPIS || '0'),
        },
        cofins: {
          cst: cofinsNode?.CST || '',
          baseCalculo: parseFloat(cofinsNode?.vBC || '0'),
          aliquota: parseFloat(cofinsNode?.pCOFINS || '0'),
          valor: parseFloat(cofinsNode?.vCOFINS || '0'),
        },
        ipi: {
          cst: ipiNode?.CST || '',
          baseCalculo: parseFloat(ipiNode?.vBC || '0'),
          aliquota: parseFloat(ipiNode?.pIPI || '0'),
          valor: parseFloat(ipiNode?.vIPI || '0'),
        }
      };
    });

    const emitEnder = emit.enderEmit || {};
    const destEnder = dest.enderDest || {};

    // Extract Fatura & Duplicatas (Cobrança)
    const cobr = infNFe.cobr || {};
    const fat = cobr.fat || {};
    const fatura: ParsedFatura | undefined = fat.nFat || fat.vLiq ? {
      numero: String(fat.nFat || ''),
      valorOriginal: parseFloat(fat.vOrig || '0'),
      valorDesconto: parseFloat(fat.vDesc || '0'),
      valorLiquido: parseFloat(fat.vLiq || '0'),
    } : undefined;

    const rawDup = Array.isArray(cobr.dup) ? cobr.dup : (cobr.dup ? [cobr.dup] : []);
    const duplicatas: ParsedDuplicata[] = rawDup.map((d: any, idx: number) => ({
      numero: String(d.nDup || String(idx + 1).padStart(3, '0')),
      vencimento: String(d.dVenc || ''),
      valor: parseFloat(d.vDup || '0'),
    }));

    // Extract Pagamentos
    const formaPagamentoMap: Record<string, string> = {
      '01': 'Dinheiro',
      '02': 'Cheque',
      '03': 'Cartão de Crédito',
      '04': 'Cartão de Débito',
      '05': 'Crédito Loja',
      '10': 'Vale Alimentação',
      '11': 'Vale Refeição',
      '12': 'Vale Presente',
      '13': 'Vale Combustível',
      '14': 'Duplicata Mercantil',
      '15': 'Boleto Bancário',
      '16': 'Depósito Bancário',
      '17': 'PIX (Pagamento Instantâneo)',
      '18': 'Transferência bancária',
      '19': 'Programa de fidelidade',
      '90': 'Sem Pagamento',
      '99': 'Outros'
    };

    const pag = infNFe.pag || {};
    const rawDetPag = Array.isArray(pag.detPag) ? pag.detPag : (pag.detPag ? [pag.detPag] : []);
    const pagamentos: ParsedPagamento[] = rawDetPag.map((p: any) => {
      const code = String(p.tPag || '99').padStart(2, '0');
      return {
        formaCodigo: code,
        forma: formaPagamentoMap[code] || `Forma (${code})`,
        valor: parseFloat(p.vPag || '0'),
      };
    });

    // Extract Transporte
    const transp = infNFe.transp || {};
    const modFreteMap: Record<string, string> = {
      '0': '0 - Por conta do Emitente (CIF)',
      '1': '1 - Por conta do Destinatário (FOB)',
      '2': '2 - Por conta de Terceiros',
      '3': '3 - Transporte Próprio (Remetente)',
      '4': '4 - Transporte Próprio (Destinatário)',
      '9': '9 - Sem Ocorrência de Transporte',
    };
    const modCode = String(transp.modFrete ?? '9');
    const transporta = transp.transporta || {};
    const veicTransp = transp.veicTransp || {};
    const volNode = Array.isArray(transp.vol) ? transp.vol[0] : (transp.vol || {});

    const transporte: ParsedTransporte = {
      modalidadeCodigo: modCode,
      modalidadeFrete: modFreteMap[modCode] || `Frete (${modCode})`,
      transportadora: transporta.xNome || transporta.CNPJ || transporta.CPF ? {
        cnpjCpf: cleanNumeric(transporta.CNPJ || transporta.CPF || ''),
        razaoSocial: String(transporta.xNome || ''),
        ie: transporta.IE ? String(transporta.IE) : undefined,
        endereco: transporta.xEnder ? String(transporta.xEnder) : undefined,
        municipio: transporta.xMun ? String(transporta.xMun) : undefined,
        uf: transporta.UF ? String(transporta.UF) : undefined,
      } : undefined,
      veiculo: veicTransp.placa ? {
        placa: String(veicTransp.placa || ''),
        uf: String(veicTransp.UF || ''),
        rntc: veicTransp.RNTC ? String(veicTransp.RNTC) : undefined,
      } : undefined,
      volumes: volNode.qVol || volNode.pesoB || volNode.pesoL || volNode.esp ? {
        quantidade: volNode.qVol ? parseFloat(volNode.qVol) : undefined,
        especie: volNode.esp ? String(volNode.esp) : undefined,
        marca: volNode.marca ? String(volNode.marca) : undefined,
        numeracao: volNode.nVol ? String(volNode.nVol) : undefined,
        pesoLiquido: volNode.pesoL ? parseFloat(volNode.pesoL) : undefined,
        pesoBruto: volNode.pesoB ? parseFloat(volNode.pesoB) : undefined,
      } : undefined,
    };

    return {
      chaveAcesso: chave,
      numero: String(ide.nNF || '0'),
      serie: String(ide.serie || '1'),
      modelo: String(ide.mod || '55'),
      naturezaOperacao: String(ide.natOp || 'Venda de Mercadorias'),
      tipoOperacao: String(ide.tpNF || '1') as '0' | '1',
      dataEmissao: ide.dhEmi || ide.dEmi || new Date().toISOString(),
      dataSaidaEntrada: ide.dhSaiEnt || ide.dSaiEnt,
      status: (protNFe.cStat === '100' || !protNFe.cStat) ? 'autorizada' : 'cancelada',
      
      emitente: {
        cnpjCpf: cleanNumeric(emit.CNPJ || emit.CPF || ''),
        razaoSocial: String(emit.xNome || ''),
        nomeFantasia: emit.xFant ? String(emit.xFant) : undefined,
        ie: emit.IE ? String(emit.IE) : undefined,
        uf: String(emitEnder.UF || emit.UF || ''),
        municipio: String(emitEnder.xMun || ''),
        logradouro: String(emitEnder.xLgr || ''),
        numero: String(emitEnder.nro || ''),
        bairro: String(emitEnder.xBairro || ''),
        cep: cleanNumeric(emitEnder.CEP || ''),
        fone: emitEnder.fone ? String(emitEnder.fone) : undefined,
      },

      destinatario: {
        cnpjCpf: cleanNumeric(dest.CNPJ || dest.CPF || ''),
        razaoSocial: String(dest.xNome || ''),
        ie: dest.IE ? String(dest.IE) : undefined,
        uf: String(destEnder.UF || dest.UF || ''),
        municipio: String(destEnder.xMun || ''),
        logradouro: String(destEnder.xLgr || ''),
        numero: String(destEnder.nro || ''),
        bairro: String(destEnder.xBairro || ''),
        cep: cleanNumeric(destEnder.CEP || ''),
        fone: destEnder.fone ? String(destEnder.fone) : undefined,
      },

      totais: {
        valorProdutos: parseFloat(total.vProd || '0'),
        valorFrete: parseFloat(total.vFrete || '0'),
        valorSeguro: parseFloat(total.vSeg || '0'),
        valorDesconto: parseFloat(total.vDesc || '0'),
        valorOutrasDespesas: parseFloat(total.vOutro || '0'),
        valorTotal: parseFloat(total.vNF || '0'),
        baseCalculoIcms: parseFloat(total.vBC || '0'),
        valorIcms: parseFloat(total.vICMS || '0'),
        baseCalculoIcmsSt: parseFloat(total.vBCST || '0'),
        valorIcmsSt: parseFloat(total.vST || '0'),
        valorPis: parseFloat(total.vPIS || '0'),
        valorCofins: parseFloat(total.vCOFINS || '0'),
        valorIpi: parseFloat(total.vIPI || '0'),
      },

      itens,
      fatura,
      duplicatas,
      pagamentos,
      transporte,
      protocoloAutorizacao: protNFe.nProt ? String(protNFe.nProt) : undefined,
      dataAutorizacao: protNFe.dhRecbto ? String(protNFe.dhRecbto) : undefined,
      informacoesComplementares: infNFe.infAdic?.infCpl ? String(infNFe.infAdic.infCpl) : undefined,
      informacoesFisco: infNFe.infAdic?.infAdFisco ? String(infNFe.infAdic.infAdFisco) : undefined,
    };
  } catch (err: any) {
    throw new Error(`Erro ao processar XML Fiscal: ${err.message}`);
  }
}

function parseCte(cte: any, protCTe: any): ParsedFiscalInvoice {
  const infCte = cte.infCte || {};
  const ide = infCte.ide || {};
  const emit = infCte.emit || {};
  const dest = infCte.dest || infCte.rem || {};
  const vPrest = infCte.vPrest || {};
  const prot = protCTe?.infProt || {};

  let chave = '';
  if (infCte['@_Id']) {
    chave = cleanNumeric(infCte['@_Id']);
  } else if (prot.chCTe) {
    chave = cleanNumeric(prot.chCTe);
  }

  return {
    chaveAcesso: chave,
    numero: String(ide.nCT || '0'),
    serie: String(ide.serie || '1'),
    modelo: String(ide.mod || '57'),
    naturezaOperacao: String(ide.natOp || 'Prestação de Serviço de Transporte'),
    tipoOperacao: '1',
    dataEmissao: ide.dhEmi || new Date().toISOString(),
    status: 'autorizada',
    emitente: {
      cnpjCpf: cleanNumeric(emit.CNPJ || ''),
      razaoSocial: String(emit.xNome || ''),
      uf: String(emit.enderEmit?.UF || ''),
      municipio: String(emit.enderEmit?.xMun || ''),
    },
    destinatario: {
      cnpjCpf: cleanNumeric(dest.CNPJ || dest.CPF || ''),
      razaoSocial: String(dest.xNome || ''),
      uf: String(dest.enderDest?.UF || dest.enderReme?.UF || ''),
      municipio: String(dest.enderDest?.xMun || dest.enderReme?.xMun || ''),
    },
    totais: {
      valorProdutos: parseFloat(vPrest.vTPrest || '0'),
      valorFrete: 0,
      valorSeguro: 0,
      valorDesconto: 0,
      valorOutrasDespesas: 0,
      valorTotal: parseFloat(vPrest.vRec || vPrest.vTPrest || '0'),
      baseCalculoIcms: 0,
      valorIcms: 0,
      baseCalculoIcmsSt: 0,
      valorIcmsSt: 0,
      valorPis: 0,
      valorCofins: 0,
      valorIpi: 0,
    },
    itens: [],
    duplicatas: [],
    pagamentos: [],
    protocoloAutorizacao: prot.nProt ? String(prot.nProt) : undefined,
  };
}

const UF_CODE_MAP: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
};

function parseResNFe(resNFe: any): ParsedFiscalInvoice {
  const chNFe = cleanNumeric(resNFe.chNFe || '');
  const modelo = chNFe.length >= 22 ? chNFe.substring(20, 22) : '55';
  const serie = chNFe.length >= 25 ? parseInt(chNFe.substring(22, 25) || '1', 10).toString() : '1';
  const numero = chNFe.length >= 34 ? parseInt(chNFe.substring(25, 34) || '0', 10).toString() : '0';
  const vNF = parseFloat(resNFe.vNF || '0');
  const cSitNFe = String(resNFe.cSitNFe || '1');
  const status = cSitNFe === '1' ? 'autorizada' : (cSitNFe === '2' ? 'cancelada' : 'denegada');

  return {
    chaveAcesso: chNFe,
    numero: numero || '0',
    serie: serie || '1',
    modelo: modelo || '55',
    naturezaOperacao: 'Resumo NF-e (SEFAZ DFe)',
    tipoOperacao: String(resNFe.tpNF ?? '1') as '0' | '1',
    dataEmissao: resNFe.dhEmi || new Date().toISOString(),
    status,
    emitente: {
      cnpjCpf: cleanNumeric(resNFe.CNPJ || resNFe.CPF || ''),
      razaoSocial: String(resNFe.xNome || 'Emitente'),
      ie: resNFe.IE ? String(resNFe.IE) : undefined,
      uf: chNFe.length >= 2 ? (UF_CODE_MAP[chNFe.substring(0, 2)] || '') : '',
    },
    destinatario: {
      cnpjCpf: '',
      razaoSocial: '',
      uf: '',
    },
    totais: {
      valorProdutos: vNF,
      valorFrete: 0,
      valorSeguro: 0,
      valorDesconto: 0,
      valorOutrasDespesas: 0,
      valorTotal: vNF,
      baseCalculoIcms: 0,
      valorIcms: 0,
      baseCalculoIcmsSt: 0,
      valorIcmsSt: 0,
      valorPis: 0,
      valorCofins: 0,
      valorIpi: 0,
    },
    itens: [],
    duplicatas: [],
    pagamentos: [],
    protocoloAutorizacao: resNFe.dhRecbto ? String(resNFe.dhRecbto) : undefined,
    dataAutorizacao: resNFe.dhRecbto ? String(resNFe.dhRecbto) : undefined,
    informacoesComplementares: 'Resumo de NF-e obtido via SEFAZ Nacional (Aguardando manifestação / XML completo).',
  };
}

function parseResCTe(resCTe: any): ParsedFiscalInvoice {
  const chCTe = cleanNumeric(resCTe.chCTe || '');
  const modelo = chCTe.length >= 22 ? chCTe.substring(20, 22) : '57';
  const serie = chCTe.length >= 25 ? parseInt(chCTe.substring(22, 25) || '1', 10).toString() : '1';
  const numero = chCTe.length >= 34 ? parseInt(chCTe.substring(25, 34) || '0', 10).toString() : '0';
  const vNF = parseFloat(resCTe.vNF || '0');
  const cSitCTe = String(resCTe.cSitCTe || '1');
  const status = cSitCTe === '1' ? 'autorizada' : (cSitCTe === '2' ? 'cancelada' : 'denegada');

  return {
    chaveAcesso: chCTe,
    numero: numero || '0',
    serie: serie || '1',
    modelo: modelo || '57',
    naturezaOperacao: 'Resumo CT-e (SEFAZ DFe)',
    tipoOperacao: String(resCTe.tpNF ?? '1') as '0' | '1',
    dataEmissao: resCTe.dhEmi || new Date().toISOString(),
    status,
    emitente: {
      cnpjCpf: cleanNumeric(resCTe.CNPJ || resCTe.CPF || ''),
      razaoSocial: String(resCTe.xNome || 'Transportador'),
      ie: resCTe.IE ? String(resCTe.IE) : undefined,
      uf: chCTe.length >= 2 ? (UF_CODE_MAP[chCTe.substring(0, 2)] || '') : '',
    },
    destinatario: {
      cnpjCpf: '',
      razaoSocial: '',
      uf: '',
    },
    totais: {
      valorProdutos: vNF,
      valorFrete: 0,
      valorSeguro: 0,
      valorDesconto: 0,
      valorOutrasDespesas: 0,
      valorTotal: vNF,
      baseCalculoIcms: 0,
      valorIcms: 0,
      baseCalculoIcmsSt: 0,
      valorIcmsSt: 0,
      valorPis: 0,
      valorCofins: 0,
      valorIpi: 0,
    },
    itens: [],
    duplicatas: [],
    pagamentos: [],
    protocoloAutorizacao: resCTe.dhRecbto ? String(resCTe.dhRecbto) : undefined,
    dataAutorizacao: resCTe.dhRecbto ? String(resCTe.dhRecbto) : undefined,
    informacoesComplementares: 'Resumo de CT-e obtido via SEFAZ Nacional (Aguardando manifestação / XML completo).',
  };
}
