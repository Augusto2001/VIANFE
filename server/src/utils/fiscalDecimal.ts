/** Accept decimal separators used by municipal exports, without truncating cents. */
export function fiscalDecimal(value: unknown): number {
  const text = String(value).trim();
  if (!/^-?\d+(?:[.,]\d+)?$/.test(text)) throw new Error('Valor decimal fiscal inválido.');
  const result = Number(text.replace(',', '.'));
  if (!Number.isFinite(result)) throw new Error('Valor decimal fiscal inválido.');
  return result;
}
