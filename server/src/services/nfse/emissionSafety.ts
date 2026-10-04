import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createHash } from 'crypto';

export function emissionKey(companyId: string, input: any): string {
  const fields = ['numero_rps', 'tomador_cnpj', 'tomador_nome', 'valor_servicos', 'aliquota_iss', 'discriminacao_servico', 'iss_retido', 'item_servico', 'serie_rps', 'prefeitura', 'ambiente', 'optante_simples_nacional'];
  return createHash('sha256').update(JSON.stringify([companyId, ...fields.map(k => input[k] ?? null)])).digest('hex');
}

// Only a complete returned municipal document is evidence of authorization.
// Never accept the submitted RPS, an acknowledgement, or a locally built XML.
export function officialNfse(xml: string, expected: {cnpj: string; tomador?: string; valor?: number}) {
  if (!xml || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('XML oficial completo indisponível.');
  const parser = new XMLParser({ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false});
  let tree = parser.parse(xml);
  const found: any[] = [];
  function visit(node: any) {
    if (!node || typeof node !== 'object') return;
    for (const [key,value] of Object.entries(node)) {
      if (key === 'InfNfse') found.push(...(Array.isArray(value) ? value : [value]));
      else if (typeof value === 'object') visit(value);
      else if (typeof value === 'string' && value.trim().startsWith('<') && XMLValidator.validate(value) === true) visit(parser.parse(value));
    }
  }
  visit(tree);
  if (found.length !== 1) throw new Error('Retorno não contém uma única NFS-e oficial completa.');
  const n=found[0], d=n.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico || n;
  const prestador=n.PrestadorServico?.IdentificacaoPrestador || d.Prestador;
  const tomador=d.TomadorServico || n.TomadorServico;
  const cnpj=String(prestador?.CpfCnpj?.Cnpj || prestador?.Cnpj || '');
  const doc=String(tomador?.IdentificacaoTomador?.CpfCnpj?.Cnpj || tomador?.IdentificacaoTomador?.CpfCnpj?.Cpf || '');
  const valor=Number(d.Servico?.Valores?.ValorServicos);
  if (!n.Numero || !n.CodigoVerificacao || !n.DataEmissao || !d.Servico?.Discriminacao || !Number.isFinite(valor) || !doc || cnpj !== expected.cnpj) throw new Error('Documento oficial incompleto ou de outro prestador.');
  if (expected.tomador && doc !== expected.tomador) throw new Error('Tomador do retorno difere do pedido.');
  if (expected.valor !== undefined && Math.abs(valor-expected.valor)>0.005) throw new Error('Valor do retorno difere do pedido.');
  const iss=n.ValoresNfse?.ValorIss ?? d.Servico?.Valores?.ValorIss;
  if(iss===undefined || !Number.isFinite(Number(iss))) throw new Error('Valor do ISS ausente no XML oficial.');
  return {numero:String(n.Numero), codigo:String(n.CodigoVerificacao), data:String(n.DataEmissao), valor, valorIss:Number(iss), prestador:n.PrestadorServico?.RazaoSocial || '', cnpj, tomador:tomador?.RazaoSocial || '', doc, descricao:String(d.Servico.Discriminacao)};
}
