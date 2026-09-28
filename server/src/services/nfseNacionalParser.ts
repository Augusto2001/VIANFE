import type { ParsedFiscalInvoice } from './xmlParser.js';

/** Padrão Nacional NFSe/infNFSe/DPS/infDPS. Never synthesize a key or protocol. */
export function parseNfseNacional(root: any): ParsedFiscalInvoice {
  const inf = root.infNFSe, dps = inf?.DPS?.infDPS;
  const key = String(inf?.['@_Id'] || '').replace(/^NFS/, '');
  const emit = inf?.emit, toma = dps?.toma;
  const gross = Number(dps?.valores?.vServPrest?.vServ);
  const net = Number(inf?.valores?.vLiq);
  if (!/^\d{50}$/.test(key) || !dps || !emit?.CNPJ || !inf.nNFSe ||
      !/^\d{4}-\d{2}-\d{2}T/.test(dps.dhEmi || '') ||
      dps?.valores?.vServPrest?.vServ == null || inf?.valores?.vLiq == null ||
      !Number.isFinite(gross) || !Number.isFinite(net) || gross < 0 || net < 0 ||
      String(dps.tpAmb) !== '1' || String(inf.cStat) !== '100')
    throw new Error('NFS-e Nacional sem identificação, valores ou autorização de produção válidos.');
  if (dps.prest?.CNPJ && dps.prest.CNPJ !== emit.CNPJ) throw new Error('Prestador da DPS diverge do emitente da NFS-e.');
  const addr = emit.enderNac || {}, dest = toma?.end || {};
  return {
    chaveAcesso: key, numero: String(inf.nNFSe), serie: String(dps.serie || ''),
    modelo: 'NFS-e', naturezaOperacao: 'Prestação de Serviços', tipoOperacao: '1',
    dataEmissao: dps.dhEmi, dataAutorizacao: inf.dhProc, status: 'autorizada',
    emitente: { cnpjCpf: emit.CNPJ, razaoSocial: emit.xNome || '', uf: addr.UF || '',
      municipio: inf.xLocEmi || '', logradouro: addr.xLgr || '', numero: addr.nro || '',
      bairro: addr.xBairro || '', cep: addr.CEP || '', fone: emit.fone || '' },
    destinatario: { cnpjCpf: toma?.CNPJ || toma?.CPF || '', razaoSocial: toma?.xNome || '',
      uf: '', municipio: dest.endNac?.cMun || '', logradouro: dest.xLgr || '',
      numero: dest.nro || '', bairro: dest.xBairro || '', cep: dest.endNac?.CEP || '' },
    totais: { valorProdutos: gross, valorTotal: net,
      valorFrete: 0, valorSeguro: 0, valorDesconto: Number(dps.valores?.vDescCondIncond?.vDescIncond || 0),
      valorOutrasDespesas: 0, baseCalculoIcms: 0, valorIcms: 0, baseCalculoIcmsSt: 0, valorIcmsSt: 0,
      valorPis: Number(dps.valores?.trib?.tribFed?.piscofins?.vPis || 0),
      valorCofins: Number(dps.valores?.trib?.tribFed?.piscofins?.vCofins || 0), valorIpi: 0 },
    // Service descriptions are not goods with an invented quantity/unit/NCM.
    itens: [], duplicatas: [], pagamentos: [],
    informacoesComplementares: dps.serv?.cServ?.xDescServ || '',
    nfseNacional: true,
  };
}
