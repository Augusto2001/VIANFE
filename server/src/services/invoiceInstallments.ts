import type { DatabaseSync } from 'node:sqlite';
import type { ParsedFiscalInvoice } from './xmlParser.js';
import { randomUUID } from 'node:crypto';

/** Only actual XML duplicatas create dated obligations. Never infer a due date or a settlement. */
export function syncXmlInstallments(db: DatabaseSync, invoiceId: string, companyId: string, tipo: string, parsed: ParsedFiscalInvoice) {
  if (parsed.naturezaOperacao.startsWith('Resumo ')) return;
  const duplicates = parsed.duplicatas || [];
  const valid = duplicates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.vencimento) && Number.isFinite(d.valor) && d.valor > 0);
  if (valid.length !== duplicates.length) throw new Error('Duplicata do XML sem valor/vencimento válido; revisão necessária.');
  const party = tipo === 'entrada' ? parsed.emitente : parsed.destinatario;
  const payment = [...new Set((parsed.pagamentos || []).map(p => p.forma).filter(Boolean))].join(' / ') || null;
  db.exec('SAVEPOINT xml_installments');
  try {
    const existing = db.prepare('SELECT * FROM invoice_installments WHERE invoice_id = ?').all(invoiceId) as any[];
    // Exact fingerprint of the old automatically invented single boleto.
    // Only cancel it when the full XML explicitly says Sem Pagamento and has no duplicata.
    if (!valid.length && parsed.pagamentos?.length && parsed.pagamentos.every(p => p.formaCodigo === '90')) {
      for (const row of existing) {
        if (row.status === 'pendente' && row.numero_parcela === '001' && row.forma_pagamento === 'Boleto / Duplicata' &&
            row.valor === parsed.totais.valorTotal && [parsed.dataEmissao, parsed.dataSaidaEntrada].includes(row.data_vencimento)) {
          db.prepare("UPDATE invoice_installments SET status='cancelado' WHERE id=? AND status='pendente'").run(row.id);
        }
      }
    }
    for (const dup of valid) {
      const rows = existing.filter(row => row.numero_parcela === dup.numero);
      // Settled/reconciled obligations retain their identity and financial history.
      if (rows.some(row => row.status !== 'pendente')) continue;
      if (rows.length) {
        db.prepare(`UPDATE invoice_installments SET data_vencimento=?,valor=?,forma_pagamento=?,
          numero_fatura=?,fornecedor_cliente_nome=?,fornecedor_cliente_cnpj=? WHERE id=?`).run(
          dup.vencimento,dup.valor,payment,parsed.fatura?.numero || null,party.razaoSocial,party.cnpjCpf,rows[0].id);
      } else {
        db.prepare(`INSERT INTO invoice_installments (id,invoice_id,company_id,tipo,numero_fatura,numero_parcela,
          data_vencimento,valor,status,forma_pagamento,fornecedor_cliente_nome,fornecedor_cliente_cnpj,created_at)
          VALUES (?,?,?,?,?,?,?,?,'pendente',?,?,?,?)`).run(randomUUID(),invoiceId,companyId,
          tipo === 'entrada' ? 'pagar' : 'receber',parsed.fatura?.numero || null,dup.numero,dup.vencimento,
          dup.valor,payment,party.razaoSocial,party.cnpjCpf,new Date().toISOString());
      }
    }
    db.exec('RELEASE xml_installments');
  } catch (error) { db.exec('ROLLBACK TO xml_installments'); db.exec('RELEASE xml_installments'); throw error; }
}
