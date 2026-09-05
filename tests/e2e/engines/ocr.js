/**
 * Receipt OCR Token Extractor, CNPJ/CPF Validator & Accounts Payable Auto-Match Engine
 */

/**
 * Validates CNPJ check digits (Módulo 11 da Receita Federal)
 * @param {string} cnpj - CNPJ string
 * @returns {boolean} True if valid
 */
export function isValidCNPJ(cnpj) {
  if (!cnpj) return false;
  const clean = String(cnpj).replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false; // all digits same

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i], 10) * weights1[i];
  }
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(clean[12], 10) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean[i], 10) * weights2[i];
  }
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(clean[13], 10) === d2;
}

/**
 * Validates CPF check digits (Módulo 11)
 * @param {string} cpf - CPF string
 * @returns {boolean} True if valid
 */
export function isValidCPF(cpf) {
  if (!cpf) return false;
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i], 10) * (10 - i);
  }
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(clean[9], 10) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i], 10) * (11 - i);
  }
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(clean[10], 10) === d2;
}

/**
 * Extracts structured financial receipt tokens from raw text or simulated OCR output
 * @param {string} text - OCR text dump
 * @returns {Object} Extracted data
 */
export function extractReceiptTokens(text) {
  if (!text || typeof text !== 'string') {
    return { error: 'Invalid text input', extracted: null };
  }

  // 1. Extract CNPJ
  const cnpjMatch = text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  let cnpj = null;
  if (cnpjMatch) {
    const rawCnpj = cnpjMatch[0].replace(/\D/g, '');
    if (rawCnpj.length === 14) {
      cnpj = `${rawCnpj.slice(0, 2)}.${rawCnpj.slice(2, 5)}.${rawCnpj.slice(5, 8)}/${rawCnpj.slice(8, 12)}-${rawCnpj.slice(12, 14)}`;
    }
  }

  // 2. Extract Date (DD/MM/YYYY or YYYY-MM-DD)
  let date = null;
  const dateMatchBr = text.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
  if (dateMatchBr) {
    date = `${dateMatchBr[3]}-${dateMatchBr[2]}-${dateMatchBr[1]}`;
  } else {
    const dateMatchIso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (dateMatchIso) {
      date = dateMatchIso[0];
    }
  }

  // 3. Extract Total Amount (Heuristics: look for TOTAL, VALOR TOTAL, TOTAL A PAGAR, then biggest amount)
  let totalAmount = null;
  const totalKeywords = /(?:TOTAL(?:\s+A\s+PAGAR|\s+FINAL|\s+L[ÍI]QUIDO)?|VALOR\s+TOTAL)\s*[:=]?\s*(?:R\$\s*)?([\d.,]+)/i;
  const totalMatch = text.match(totalKeywords);

  if (totalMatch) {
    const rawVal = totalMatch[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed > 0) {
      totalAmount = parsed;
    }
  }

  // Fallback: search all monetary values and pick largest realistic amount
  if (totalAmount === null) {
    const valMatches = [...text.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/g)];
    const candidates = valMatches
      .map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')))
      .filter(v => !isNaN(v) && v > 0);
    if (candidates.length > 0) {
      totalAmount = Math.max(...candidates);
    }
  }

  // 4. Suggest Category
  let categoria = 'Despesas Gerais & Administrativas';
  const lower = text.toLowerCase();
  if (lower.includes('posto') || lower.includes('combust') || lower.includes('gasolina') || lower.includes('etanol') || lower.includes('diesel')) {
    categoria = 'Combustíveis & Frotas';
  } else if (lower.includes('restaurante') || lower.includes('refeicao') || lower.includes('alimento') || lower.includes('lanche') || lower.includes('padaria')) {
    categoria = 'Alimentação & Refeições';
  } else if (lower.includes('software') || lower.includes('hospedagem') || lower.includes('cloud') || lower.includes('google') || lower.includes('aws')) {
    categoria = 'Tecnologia & Licenças de Software';
  } else if (lower.includes('papelaria') || lower.includes('escritorio') || lower.includes('suprimento') || lower.includes('impressao')) {
    categoria = 'Material de Escritório';
  } else if (lower.includes('honorario') || lower.includes('contabil') || lower.includes('juridico') || lower.includes('advocacia')) {
    categoria = 'Serviços Profissionais & Terceirizados';
  }

  return {
    cnpj,
    data_emissao: date || new Date().toISOString().split('T')[0],
    valor_total: totalAmount ? Number(totalAmount.toFixed(2)) : 0.0,
    categoria_sugerida: categoria
  };
}

/**
 * Multi-factor matching engine linking scanned receipt with open accounts payable installments
 * @param {Object} extractedReceipt
 * @param {Array} openPayables - List of pending accounts payable
 * @returns {Object} Match resolution result
 */
export function autoMatchReceiptWithPayables(extractedReceipt, openPayables = []) {
  if (!extractedReceipt || !openPayables.length) {
    return {
      match_status: 'UNMATCHED',
      match_confidence: 0.0,
      matched_payable: null
    };
  }

  let bestMatch = null;
  let highestScore = 0;

  for (const payable of openPayables) {
    let score = 0;

    // Factor 1: CNPJ Matching (45 points)
    if (extractedReceipt.cnpj && payable.fornecedor_cnpj) {
      const cleanReceiptCnpj = extractedReceipt.cnpj.replace(/\D/g, '');
      const cleanPayableCnpj = payable.fornecedor_cnpj.replace(/\D/g, '');
      if (cleanReceiptCnpj === cleanPayableCnpj) {
        score += 0.45;
      }
    }

    // Factor 2: Amount Matching (40 points)
    if (extractedReceipt.valor_total && payable.valor) {
      const diff = Math.abs(extractedReceipt.valor_total - payable.valor);
      if (diff < 0.01) {
        score += 0.40; // Exact match
      } else if (diff <= 1.00) {
        score += 0.30; // Within R$ 1.00 tolerance (interest/cents)
      } else if (diff <= 5.00) {
        score += 0.15;
      }
    }

    // Factor 3: Date Proximity (15 points)
    if (extractedReceipt.data_emissao && payable.data_vencimento) {
      const d1 = new Date(extractedReceipt.data_emissao).getTime();
      const d2 = new Date(payable.data_vencimento).getTime();
      const daysDiff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 3) {
        score += 0.15;
      } else if (daysDiff <= 10) {
        score += 0.08;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = payable;
    }
  }

  const confidence = Number(highestScore.toFixed(2));
  let status = 'UNMATCHED';

  if (confidence >= 0.80) {
    status = 'MATCHED';
  } else if (confidence >= 0.50) {
    status = 'MANUAL_REVIEW';
  }

  return {
    match_status: status,
    match_confidence: confidence,
    matched_payable: status !== 'UNMATCHED' ? bestMatch : null
  };
}
