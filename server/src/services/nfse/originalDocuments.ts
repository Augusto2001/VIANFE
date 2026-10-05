import { XMLParser, XMLValidator } from 'fast-xml-parser';
import PDFDocument from 'pdfkit';

/** Extract original subtrees without rebuilding signed fiscal content. */
export function splitMunicipalXml(xml: string): string[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('XML municipal inválido.');
  const stack: Array<{name:string; namespaces:Map<string,string>}> = [];
  const result:string[]=[];
  let start=-1, inherited=new Map<string,string>();
  const tokens=/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w.:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/g;
  for(const m of xml.matchAll(tokens)) {
    const tag=m[0];
    if(/^<[/!?]/.test(tag) && !tag.startsWith('</')) continue;
    const name=tag.match(/^<\/?([^\s/>]+)/)![1];
    if(tag.startsWith('</')) {
      if(name.split(':').pop()==='CompNfse' && start>=0) {
        let part=xml.slice(start,m.index!+tag.length);
        const opening=part.slice(0,part.indexOf('>')+1);
        const declared=new Set([...opening.matchAll(/\s(xmlns(?::[\w.-]+)?)\s*=/g)].map(x=>x[1]));
        const extra=[...inherited].filter(([k])=>!declared.has(k)).map(([k,v])=>` ${k}=${v}`).join('');
        part=part.replace(/^(<[^\s/>]+)/, '$1'+extra);
        if(XMLValidator.validate(part)!==true) throw new Error('Falha ao separar XML original.');
        result.push('<?xml version="1.0" encoding="utf-8"?>\n'+part);
        start=-1;
      }
      stack.pop(); continue;
    }
    const namespaces=new Map(stack.at(-1)?.namespaces || []);
    if(name.split(':').pop()==='CompNfse') { if(start>=0) throw new Error('CompNfse aninhado inválido.'); start=m.index!; inherited=new Map(namespaces); }
    for(const a of tag.matchAll(/\s(xmlns(?::[\w.-]+)?)\s*=\s*("[^"]*"|'[^']*')/g)) namespaces.set(a[1],a[2]);
    if(!tag.endsWith('/>')) stack.push({name,namespaces});
  }
  if(start>=0) throw new Error('CompNfse incompleto.');
  return result;
}

export function municipalDocument(xml:string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml)!==true) throw new Error('XML municipal inválido.');
  let tree=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,parseAttributeValue:false}).parse(xml);
  const notes:any[]=[];
  function visit(n:any) { if(!n || typeof n!=='object')return; for(const [k,v] of Object.entries(n)) {if(k==='InfNfse') notes.push(...[].concat(v as any)); else if(typeof v==='object')visit(v);else if(typeof v==='string'&&v.trim().startsWith('<')){if(/<!DOCTYPE|<!ENTITY/i.test(v)||XMLValidator.validate(v)!==true)throw new Error('XML interno inválido.');tree=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false}).parse(v);visit(tree);} } }
  visit(tree);
  if(notes.length!==1 || !notes[0].Numero || !notes[0].CodigoVerificacao || !notes[0].DataEmissao) throw new Error('XML não contém uma única NFS-e identificada.');
  const service=notes[0].Servico || notes[0].DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico;
  if(!service?.Discriminacao || service.Valores?.ValorServicos===undefined || !Number.isFinite(Number(service.Valores.ValorServicos))) throw new Error('XML sem serviço ou valor original.');
  return {tree,note:notes[0]};
}

/** Display every fiscal field present; absent fields are never replaced by guesses. */
export async function originalNfsePdf(xml:string):Promise<Buffer> {
  const {tree,note}=municipalDocument(xml);
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true});
    const chunks:Buffer[]=[];
    doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.fontSize(18).font('Helvetica-Bold').text('NFS-e '+String(note.Numero));
    doc.moveDown(0.4).font('Helvetica').fontSize(9).text('Representação gerada pelo ViaNFe a partir do XML municipal. Não é o PDF disponibilizado pela prefeitura.');
    doc.moveDown().fontSize(10).text('Emissão: '+note.DataEmissao+'   |   Verificação: '+note.CodigoVerificacao);
    doc.moveDown();
    const labels:Record<string,string>={InfNfse:'Dados da nota',PrestadorServico:'Prestador',TomadorServico:'Tomador',Servico:'Serviço',Valores:'Valores e tributos',ValoresNfse:'Valores da NFS-e',Discriminacao:'Descrição do serviço',CodigoTributacaoMunicipio:'Código de tributação municipal',ItemListaServico:'Item da lista de serviços',OptanteSimplesNacional:'Optante pelo Simples Nacional (código do XML)',IssRetido:'ISS retido (código do XML)',NfseCancelamento:'Cancelamento'};
    function render(n:any,depth=0) {
      for(const [k,v] of Object.entries(n || {})) {
        if(k.startsWith('@_')||k==='Signature'||k==='?xml')continue;
        const label=labels[k] || k.replace(/([a-zà-ú])([A-Z])/g,'$1 $2');
        if(v && typeof v==='object') {
          if(['CompNfse','Nfse'].includes(k)){render(v,depth);continue;}
          if(doc.y>710)doc.addPage();
          doc.moveDown(0.4).font('Helvetica-Bold').fontSize(10).text(label,{width:510});
          for(const entry of Array.isArray(v)?v:[v])render(entry,depth+1);
        } else {
          doc.font('Helvetica').fontSize(9).text(label+': '+(v===''?'Não informado no XML':String(v)),{width:510,lineGap:2});
        }
      }
    }
    render(tree);
    doc.end();
  });
}
