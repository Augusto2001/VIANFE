// Reject binary/PDF streams before they can become account/category names.
export function isReadableFinancialText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f�]/.test(value) &&
    !/%PDF-|data:application\/pdf|\/FontBBox|\/FontFile|endstream|startxref/i.test(value);
}

// Domínio > Utilitários > Exportação > Contas: largura fixa, sem separador.
// Código (7) + classificação sem pontos (20) + nome (40) + tipo S/A (1); última linha só com 9.
const DOMINIO_FIXA = /^\d{8,}/;
export function parseDominioFixedChart(lines: string[]): string[][] | null {
  const linhas = lines.filter(l => l.trim() && !/^9+$/.test(l.trim()));
  if (!linhas.length || !linhas.every(l => DOMINIO_FIXA.test(l) && l.length >= 28)) return null;
  const contas = linhas.map(l => ({
    codigo: String(parseInt(l.slice(0, 7), 10)),
    digitos: l.slice(7, 27).trim(),
    nome: l.slice(27, 67).trim(),
    tipo: l.slice(67, 68).toUpperCase() === 'S' ? 'sintetica' : 'analitica',
  }));
  if (contas.some(c => !/^\d+$/.test(c.digitos) || !isReadableFinancialText(c.nome))) return null;
  // A máscara não vem no arquivo: cada tamanho distinto de classificação é um nível (ex.: 1,2,3,5,8 -> 1.1.1.01.001).
  const niveis = [...new Set(contas.map(c => c.digitos.length))].sort((a, b) => a - b);
  const pontuar = (d: string) => niveis.filter(n => n <= d.length)
    .map((n, i, arr) => d.slice(i ? arr[i - 1] : 0, n)).join('.');
  return contas.map(c => [c.codigo, pontuar(c.digitos), c.nome, c.tipo, '']);
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
