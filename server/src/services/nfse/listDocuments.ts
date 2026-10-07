export function listNfseDocuments(db: any, companyId: string) {
  const issued = db.prepare('SELECT * FROM nfse_issued WHERE company_id = ? ORDER BY issued_at DESC').all(companyId);
  const imported = db.prepare("SELECT id, numero, data_emissao, destinatario_nome, destinatario_cnpj, valor_produtos, info_adicional, status FROM invoices WHERE company_id=? AND modelo='NFS-e' AND tipo='saida' ORDER BY data_emissao DESC").all(companyId);
  const merged = [...issued];
  for (const row of imported) {
    if (issued.some((n: any) => String(n.numero_nfse) === String(row.numero) && String(n.issued_at).slice(0,10) === String(row.data_emissao).slice(0,10))) continue;
    merged.push({id:row.id, document_source:'invoice', numero_nfse:row.numero,
      issued_at:row.data_emissao, prefeitura:'Importada / recuperada',
      tomador_nome:row.destinatario_nome, tomador_cnpj:row.destinatario_cnpj,
      valor_servicos:row.valor_produtos, discriminacao_servico:row.info_adicional, status:row.status});
  }
  return merged.sort((a:any,b:any)=>String(b.issued_at).localeCompare(String(a.issued_at)));
}
