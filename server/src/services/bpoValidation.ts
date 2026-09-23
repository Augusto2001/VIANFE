// Reject binary/PDF streams before they can become account/category names.
export function isReadableFinancialText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/.test(value) &&
    !/%PDF-|data:application\/pdf|\/FontBBox|\/FontFile|endstream|startxref/i.test(value);
}

export function reconciliationSummary(db: any, companyId: string) {
  // Status tabs filter rows, never the company-wide accounting totals.
  const row = db.prepare(`SELECT COUNT(*) AS totalCount,
    COALESCE(SUM(CASE WHEN conciliado = 1 THEN 1 ELSE 0 END), 0) AS reconciledCount,
    COALESCE(SUM(CASE WHEN conciliado = 0 OR conciliado IS NULL THEN 1 ELSE 0 END), 0) AS pendingCount,
    COALESCE(SUM(CASE WHEN tipo = 'CREDITO' THEN valor ELSE 0 END), 0) AS totalEntradas,
    COALESCE(SUM(CASE WHEN tipo = 'DEBITO' THEN valor ELSE 0 END), 0) AS totalSaidas
    FROM bank_transactions WHERE company_id = ?`).get(companyId);
  return { ...row,
    reconciledPercent: row.totalCount ? Math.round(row.reconciledCount / row.totalCount * 100) : 0,
    saldoLiquido: row.totalEntradas - row.totalSaidas };
}
