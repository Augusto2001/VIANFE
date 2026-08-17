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
  protocoloAutorizacao?: string;
  dataAutorizacao?: string;
  informacoesComplementares?: string;
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
      throw new Error('Formato XML fiscal não reconhecido (não contém <infNFe> ou <infCte>).');
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
      protocoloAutorizacao: protNFe.nProt ? String(protNFe.nProt) : undefined,
      dataAutorizacao: protNFe.dhRecbto ? String(protNFe.dhRecbto) : undefined,
      informacoesComplementares: infNFe.infAdic?.infCpl ? String(infNFe.infAdic.infCpl) : undefined,
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
    protocoloAutorizacao: prot.nProt ? String(prot.nProt) : undefined,
  };
}
