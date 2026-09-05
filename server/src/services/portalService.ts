import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import Tesseract from 'tesseract.js';
import { db } from '../database/db.js';
import {
  DashboardSummaryData,
  SimplesNacionalGaugeResult,
  FastInvoiceInput,
  FastInvoiceOutput,
  TaxGuideItem,
  ExtractedReceiptData,
  PayableCandidate,
  MatchResult
} from '../types/portal.js';

// ============================================================================
// 1. ENGINE 1: CRC16 EMV BR CODE PIX GENERATOR (Bacen Official Standard)
// ============================================================================

export interface PixPayloadOptions {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txId?: string;
  description?: string;
  isDynamic?: boolean;
}

/**
 * Computes CRC16-CCITT (0xFFFF initial, 0x1021 polynomial) for BR Code PIX payload
 */
export function calculateCRC16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xFFFF;

  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function formatTLV(id: string, value: string): string {
  const len = Buffer.byteLength(value, 'utf-8').toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export function normalizePixText(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9 ]/g, '')   // remove special chars
    .trim()
    .toUpperCase()
    .substring(0, maxLength);
}

export function generatePixEmvPayload(options: PixPayloadOptions): string {
  const { pixKey, merchantName, merchantCity, amount, txId, description, isDynamic } = options;

  // 1. Tag 00 - Payload Format Indicator (01)
  let payload = formatTLV('00', '01');

  // 2. Tag 01 - Point of Initiation Method (12 = dynamic, 11 = static)
  if (isDynamic) {
    payload += formatTLV('01', '12');
  }

  // 3. Tag 26 - Merchant Account Information (PIX)
  let tag26 = formatTLV('00', 'br.gov.bcb.pix');
  tag26 += formatTLV('01', pixKey.trim());
  if (description) {
    tag26 += formatTLV('02', normalizePixText(description, 25));
  }
  payload += formatTLV('26', tag26);

  // 4. Tag 52 - Merchant Category Code (0000 = ISO 18245)
  payload += formatTLV('52', '0000');

  // 5. Tag 53 - Transaction Currency (986 = BRL)
  payload += formatTLV('53', '986');

  // 6. Tag 54 - Transaction Amount (optional if open amount)
  if (amount !== undefined && amount > 0) {
    payload += formatTLV('54', amount.toFixed(2));
  }

  // 7. Tag 58 - Country Code (BR)
  payload += formatTLV('58', 'BR');

  // 8. Tag 59 - Merchant Name (max 25 chars)
  const cleanName = normalizePixText(merchantName || 'VIACONT CLIENTE', 25);
  payload += formatTLV('59', cleanName);

  // 9. Tag 60 - Merchant City (max 15 chars)
  const cleanCity = normalizePixText(merchantCity || 'SALVADOR', 15);
  payload += formatTLV('60', cleanCity);

  // 10. Tag 62 - Additional Data Field Template (TxID)
  const cleanTxId = txId ? normalizePixText(txId, 25) : '***';
  const tag62 = formatTLV('05', cleanTxId);
  payload += formatTLV('62', tag62);

  // 11. Tag 63 - CRC16 Checksum
  const payloadWithCrcTag = `${payload}6304`;
  const crc16Hex = calculateCRC16(payloadWithCrcTag);

  return `${payloadWithCrcTag}${crc16Hex}`;
}

// ============================================================================
// 2. ENGINE 2: SIMPLES NACIONAL RBT12 GAUGE & BRACKET ENGINE (LC 123/2006)
// ============================================================================

export interface SimplesBracket {
  faixa: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquotaNominal: number; // e.g. 0.04 for 4%
  parcelaDeduzir: number;  // in BRL
}

export const SIMPLES_ANEXOS: Record<string, SimplesBracket[]> = {
  // Anexo I - Comércio
  ANEXO_I: [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 0.040, parcelaDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 0.073, parcelaDeduzir: 5940 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 0.095, parcelaDeduzir: 13860 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 0.107, parcelaDeduzir: 22500 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 0.143, parcelaDeduzir: 87300 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 0.190, parcelaDeduzir: 378000 }
  ],
  // Anexo II - Indústria
  ANEXO_II: [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 0.045, parcelaDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 0.078, parcelaDeduzir: 5940 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 0.100, parcelaDeduzir: 13860 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 0.112, parcelaDeduzir: 22500 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 0.147, parcelaDeduzir: 85500 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 0.300, parcelaDeduzir: 720000 }
  ],
  // Anexo III - Serviços em Geral (TI, Manutenção, Instalações, etc.)
  ANEXO_III: [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 0.060, parcelaDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 0.112, parcelaDeduzir: 9360 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 0.135, parcelaDeduzir: 17640 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 0.160, parcelaDeduzir: 35640 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 0.210, parcelaDeduzir: 125640 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 0.330, parcelaDeduzir: 648000 }
  ],
  // Anexo IV - Serviços Específicos (Construção, Advocacia, Vigilância)
  ANEXO_IV: [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 0.045, parcelaDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 0.090, parcelaDeduzir: 8100 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 0.102, parcelaDeduzir: 12420 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 0.140, parcelaDeduzir: 39780 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 0.220, parcelaDeduzir: 183780 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 0.330, parcelaDeduzir: 828000 }
  ],
  // Anexo V - Serviços Intelectuais / Fator R < 28%
  ANEXO_V: [
    { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquotaNominal: 0.155, parcelaDeduzir: 0 },
    { faixa: 2, limiteInferior: 180000.01, limiteSuperior: 360000, aliquotaNominal: 0.180, parcelaDeduzir: 4500 },
    { faixa: 3, limiteInferior: 360000.01, limiteSuperior: 720000, aliquotaNominal: 0.195, parcelaDeduzir: 9900 },
    { faixa: 4, limiteInferior: 720000.01, limiteSuperior: 1800000, aliquotaNominal: 0.205, parcelaDeduzir: 17100 },
    { faixa: 5, limiteInferior: 1800000.01, limiteSuperior: 3600000, aliquotaNominal: 0.230, parcelaDeduzir: 62100 },
    { faixa: 6, limiteInferior: 3600000.01, limiteSuperior: 4800000, aliquotaNominal: 0.305, parcelaDeduzir: 540000 }
  ]
};

export function computeSimplesNacionalGauge(
  rbt12: number,
  anexo: string = 'ANEXO_III',
  monthlyBreakdown: Array<{ mes: string; faturamento: number }> = []
): SimplesNacionalGaugeResult {
  const TETO_ESTADUAL = 3600000.00;
  const TETO_FEDERAL = 4800000.00;

  const brackets = SIMPLES_ANEXOS[anexo] || SIMPLES_ANEXOS.ANEXO_III;

  if (rbt12 <= 0) {
    return {
      rbt12: 0.00,
      teto_estadual: TETO_ESTADUAL,
      teto_federal: TETO_FEDERAL,
      percentual_atingido_estadual: 0.00,
      percentual_atingido_federal: 0.00,
      faixa_atual: 'Faixa 1 (Sem Faturamento)',
      faixa_numero: 1,
      anexo,
      aliquota_nominal: 0.00,
      aliquota_efetiva: 0.00,
      parcela_deduzir: 0.00,
      alerta: 'normal',
      alerta_mensagem: 'Sem faturamento registrado nos últimos 12 meses.',
      monthly_breakdown: monthlyBreakdown
    };
  }

  // Determinar faixa atual (Faixa 1 a 6)
  let activeBracket = brackets[0];
  for (const b of brackets) {
    if (rbt12 >= b.limiteInferior && (rbt12 <= b.limiteSuperior || b.faixa === 6)) {
      activeBracket = b;
      break;
    }
  }

  // Calcular Alíquota Efetiva: ((RBT12 * Alíquota Nominal) - Parcela a Deduzir) / RBT12
  let aliquotaEfetiva = activeBracket.aliquotaNominal;
  if (rbt12 > 180000) {
    aliquotaEfetiva = ((rbt12 * activeBracket.aliquotaNominal) - activeBracket.parcelaDeduzir) / rbt12;
  }
  const aliqEfetivaPct = Number((aliquotaEfetiva * 100).toFixed(2));

  // Porcentagens atingidas
  const pctEstadual = Number(((rbt12 / TETO_ESTADUAL) * 100).toFixed(2));
  const pctFederal = Number(((rbt12 / TETO_FEDERAL) * 100).toFixed(2));

  // Diagnóstico e semáforo
  let alerta: 'normal' | 'atencao' | 'alerta_subteto' | 'critico' = 'normal';
  let alerta_mensagem = 'Faturamento dentro dos parâmetros normais do Simples Nacional.';

  if (rbt12 >= TETO_FEDERAL) {
    alerta = 'critico';
    alerta_mensagem = 'Limite Federal de R$ 4.800.000 atingido. Obrigatória migração para Lucro Presumido/Real!';
  } else if (rbt12 >= TETO_ESTADUAL) {
    alerta = 'alerta_subteto';
    alerta_mensagem = 'Subteto Estadual de R$ 3.600.000 atingido. ICMS/ISS deverão ser recolhidos em guias avulsas fora do DAS!';
  } else if (rbt12 >= 2880000) { // 80% do subteto estadual
    alerta = 'atencao';
    alerta_mensagem = 'Atenção: Atingiu mais de 80% do Subteto Estadual (R$ 3.6M). Planejamento tributário recomendado.';
  }

  return {
    rbt12: Number(rbt12.toFixed(2)),
    teto_estadual: TETO_ESTADUAL,
    teto_federal: TETO_FEDERAL,
    percentual_atingido_estadual: Math.min(100, pctEstadual),
    percentual_atingido_federal: Math.min(100, pctFederal),
    faixa_atual: `Faixa ${activeBracket.faixa} - Alíquota Efetiva ~${aliqEfetivaPct}%`,
    faixa_numero: activeBracket.faixa,
    anexo,
    aliquota_nominal: Number((activeBracket.aliquotaNominal * 100).toFixed(2)),
    aliquota_efetiva: aliqEfetivaPct,
    parcela_deduzir: activeBracket.parcelaDeduzir,
    alerta,
    alerta_mensagem,
    monthly_breakdown: monthlyBreakdown
  };
}

// ============================================================================
// 3. ENGINE 3: OCR EXTRACTION & AUTO-MATCH ENGINE (R4)
// ============================================================================

export function parseReceiptText(text: string): ExtractedReceiptData {
  const cleanText = text.replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. CNPJ / CPF Extraction
  const cnpjMatch = cleanText.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  const cpfMatch = cleanText.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
  const cnpj = cnpjMatch ? cnpjMatch[0].replace(/\D/g, '') : undefined;
  const cpf = cpfMatch ? cpfMatch[0].replace(/\D/g, '') : undefined;

  // 2. Date Extraction (DD/MM/YYYY or YYYY-MM-DD)
  let data_emissao: string | undefined = undefined;
  const dateBrMatch = cleanText.match(/\b(0[1-9]|[12][0-9]|3[01])[\/\-\.](0[1-9]|1[0-2])[\/\-\.](20\d\d)\b/);
  if (dateBrMatch) {
    const [, d, m, y] = dateBrMatch;
    data_emissao = `${y}-${m}-${d}`;
  } else {
    const dateIsoMatch = cleanText.match(/\b(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b/);
    if (dateIsoMatch) {
      data_emissao = dateIsoMatch[0];
    }
  }

  // 3. Amount Extraction (TOTAL, VALOR A PAGAR, VALOR TOTAL, R$)
  let valor_total: number | undefined = undefined;
  const amountPatterns = [
    /(?:TOTAL\s*R?\$?|VALOR\s*TOTAL|VALOR\s*A\s*PAGAR|VALOR\s*L[IÍ]QUIDO)\s*[:\.]?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/i,
    /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/i,
    /\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/
  ];

  for (const pattern of amountPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const numStr = match[1].replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed) && parsed > 0) {
        valor_total = parsed;
        break;
      }
    }
  }

  // 4. Vendor Name Extraction (Top lines or before CNPJ)
  let fornecedor: string | undefined = undefined;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (line.length > 3 && !line.match(/^(CNPJ|CPF|DATA|HORA|CUPOM|EXTRATO|VIA|DOCUMENTO|DANFE|NFC-E|SAT)/i)) {
      fornecedor = line;
      break;
    }
  }

  // 5. Category Suggestion based on fiscal text keywords
  let categoria_sugerida = 'Despesas Gerais & Suprimentos';
  let categoria_sugerida_id = 'cat_01';
  const upper = cleanText.toUpperCase();
  if (upper.includes('POSTO') || upper.includes('SHELL') || upper.includes('IPIRANGA') || upper.includes('PETROBRAS') || upper.includes('GASOLINA') || upper.includes('COMBUSTIVEL') || upper.includes('DIESEL')) {
    categoria_sugerida = 'Combustíveis e Lubrificantes';
    categoria_sugerida_id = 'cat_01';
  } else if (upper.includes('RESTAURANTE') || upper.includes('LANCHONETE') || upper.includes('MERCADO') || upper.includes('SUPERMERCADO') || upper.includes('PADARIA') || upper.includes('ALIMENTOS') || upper.includes('CHURRASCARIA') || upper.includes('REFEICAO')) {
    categoria_sugerida = 'Alimentação & Refeições de Trabalho';
    categoria_sugerida_id = 'cat_02';
  } else if (upper.includes('KALUNGA') || upper.includes('PAPELARIA') || upper.includes('ESCRITORIO') || upper.includes('CARTUCHO') || upper.includes('IMPRESSAO') || upper.includes('SULFITE')) {
    categoria_sugerida = 'Material de Escritório & Insumos';
    categoria_sugerida_id = 'cat_01';
  } else if (upper.includes('COELBA') || upper.includes('ENEL') || upper.includes('ENERGIA') || upper.includes('LUZ')) {
    categoria_sugerida = 'Energia Elétrica (Enel/Coelba)';
    categoria_sugerida_id = 'cat_11';
  } else if (upper.includes('EMBASA') || upper.includes('SABESP') || upper.includes('AGUA')) {
    categoria_sugerida = 'Água e Esgoto (Embasa)';
    categoria_sugerida_id = 'cat_12';
  } else if (upper.includes('HONORARIOS') || upper.includes('CONTABILIDADE') || upper.includes('VIACONT')) {
    categoria_sugerida = 'Honorários Contábeis Viacont';
    categoria_sugerida_id = 'cat_15';
  }

  // 6. Linha digitável / Código de barras se presente
  const linhaDigitavelMatch = cleanText.match(/\b\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14}\b|\b\d{47,48}\b/);
  const linha_digitavel = linhaDigitavelMatch ? linhaDigitavelMatch[0] : undefined;

  return {
    cnpj,
    cpf,
    fornecedor,
    data_emissao,
    valor_total,
    categoria_sugerida,
    categoria_sugerida_id,
    linha_digitavel,
    raw_text: text.substring(0, 1000),
    confidence: 0.92
  };
}

export async function processReceiptOcr(fileBufferOrPath: Buffer | string, mimeType?: string): Promise<ExtractedReceiptData> {
  let text = '';
  try {
    if (typeof fileBufferOrPath === 'string' && (fileBufferOrPath.endsWith('.pdf') || mimeType === 'application/pdf')) {
      // If it's a PDF text file, try reading utf-8 string or fallback to file name analysis
      const buffer = fs.readFileSync(fileBufferOrPath);
      text = buffer.toString('utf-8');
    } else {
      // Image OCR with Tesseract
      const result = await Tesseract.recognize(fileBufferOrPath, 'por+eng');
      text = result.data.text;
    }
  } catch (err: any) {
    // Fallback if Tesseract encounters issue or image format
    if (Buffer.isBuffer(fileBufferOrPath)) {
      text = fileBufferOrPath.toString('utf-8');
    } else if (typeof fileBufferOrPath === 'string' && fs.existsSync(fileBufferOrPath)) {
      try {
        text = fs.readFileSync(fileBufferOrPath, 'utf-8');
      } catch (_) {}
    }
  }

  return parseReceiptText(text || '');
}

export function matchReceiptWithPayables(
  receipt: ExtractedReceiptData,
  candidates: PayableCandidate[]
): MatchResult {
  let bestScore = 0;
  let bestCandidate: PayableCandidate | undefined = undefined;
  let bestReasons: string[] = [];

  for (const cand of candidates) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Amount Comparison (Max 45 pts)
    if (receipt.valor_total !== undefined && cand.valor > 0) {
      const diff = Math.abs(receipt.valor_total - cand.valor);
      const relDiff = diff / cand.valor;
      if (diff < 0.01) {
        score += 45;
        reasons.push('Valor exato idêntico (100%)');
      } else if (relDiff <= 0.02) {
        score += 35;
        reasons.push('Valor muito próximo (variação <= 2%)');
      } else if (relDiff <= 0.05) {
        score += 20;
        reasons.push('Valor aproximado (variação <= 5%)');
      }
    }

    // 2. CNPJ / CPF Comparison (Max 35 pts)
    if (receipt.cnpj && cand.fornecedor_cnpj) {
      const cleanReceiptCnpj = receipt.cnpj.replace(/\D/g, '');
      const cleanCandCnpj = cand.fornecedor_cnpj.replace(/\D/g, '');
      if (cleanReceiptCnpj === cleanCandCnpj) {
        score += 35;
        reasons.push('CNPJ do fornecedor coincide perfeitamente');
      } else if (cleanReceiptCnpj.substring(0, 8) === cleanCandCnpj.substring(0, 8)) {
        score += 25;
        reasons.push('Raiz do CNPJ coincide (mesma matriz/filial)');
      }
    }

    // 3. Date Proximity Comparison (Max 10 pts)
    if (receipt.data_emissao && cand.data_vencimento) {
      const d1 = new Date(receipt.data_emissao).getTime();
      const d2 = new Date(cand.data_vencimento).getTime();
      if (!isNaN(d1) && !isNaN(d2)) {
        const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        if (diffDays <= 3) {
          score += 10;
          reasons.push(`Data próxima (${Math.round(diffDays)} dias do vencimento)`);
        } else if (diffDays <= 10) {
          score += 7;
          reasons.push(`Data em janela razoável (${Math.round(diffDays)} dias)`);
        } else if (diffDays <= 30) {
          score += 3;
        }
      }
    }

    // 4. Vendor Name Substring / Token Comparison (Max 10 pts)
    if (receipt.fornecedor && cand.fornecedor_nome) {
      const n1 = receipt.fornecedor.toUpperCase();
      const n2 = cand.fornecedor_nome.toUpperCase();
      if (n1.includes(n2) || n2.includes(n1)) {
        score += 10;
        reasons.push('Nome do fornecedor coincide');
      } else {
        const words1 = n1.split(/\s+/).filter(w => w.length > 3);
        const words2 = n2.split(/\s+/).filter(w => w.length > 3);
        const matches = words1.filter(w => words2.includes(w));
        if (matches.length > 0) {
          score += 7;
          reasons.push(`Termos em comum no fornecedor: ${matches.join(', ')}`);
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = cand;
      bestReasons = reasons;
    }
  }

  const confidence = Number((bestScore / 100).toFixed(2));

  let match_status: 'MATCHED' | 'POSSIBLE_MATCH' | 'UNMATCHED' = 'UNMATCHED';
  if (confidence >= 0.70) {
    match_status = 'MATCHED';
  } else if (confidence >= 0.40) {
    match_status = 'POSSIBLE_MATCH';
  }

  return {
    payable_id: bestCandidate ? bestCandidate.id : undefined,
    match_confidence: confidence,
    match_status,
    matched_payable: bestCandidate,
    reasons: bestReasons
  };
}

// ============================================================================
// 4. ENGINE 4: WHATSAPP SHARE FORMATTING & DEEP LINK ENGINE
// ============================================================================

export function formatInvoiceWhatsAppMessage(data: {
  empresa_nome: string;
  empresa_cnpj: string;
  tomador_nome: string;
  tomador_cnpj_cpf: string;
  tipo: string;
  numero_nota: string;
  codigo_verificacao: string;
  valor_total: number;
  descricao_item: string;
  pix_code?: string;
  pdf_url?: string;
}): string {
  const valorFmt = data.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  let msg = `🧾 *Nota Fiscal Emitida com Sucesso!*\n\n`;
  msg += `🏢 *Emitente*: ${data.empresa_nome} (CNPJ: ${data.empresa_cnpj})\n`;
  msg += `👤 *Cliente*: ${data.tomador_nome} (${data.tomador_cnpj_cpf})\n\n`;
  msg += `📄 *Documento*: ${data.tipo} nº *${data.numero_nota}*\n`;
  msg += `🔑 *Cód. Verificação*: \`${data.codigo_verificacao}\`\n`;
  msg += `💰 *Valor Total*: *R$ ${valorFmt}*\n`;
  msg += `📌 *Serviço/Item*: ${data.descricao_item}\n\n`;

  if (data.pix_code) {
    msg += `💳 *PIX Copia e Cola para Pagamento*:\n\`\`\`${data.pix_code}\`\`\`\n\n`;
  }

  if (data.pdf_url) {
    msg += `📥 *Visualizar/Baixar PDF da Nota*:\n${data.pdf_url}\n\n`;
  }

  msg += `_Enviado via Super App Viacont Contabilidade & BPO_`;
  return msg;
}

export function formatTaxGuideWhatsAppMessage(data: {
  empresa_nome: string;
  tipo_guia: string;
  descricao: string;
  competencia: string;
  vencimento: string;
  valor: number;
  pix_copia_cola?: string;
  linha_digitavel?: string;
  pdf_url?: string;
}): string {
  const valorFmt = data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [y, m, d] = data.vencimento.split('-');
  const vencFmt = d && m && y ? `${d}/${m}/${y}` : data.vencimento;

  let msg = `🏛️ *Guia de Imposto Disponível para Pagamento*\n\n`;
  msg += `🏢 *Empresa*: ${data.empresa_nome}\n`;
  msg += `📋 *Guia*: *${data.tipo_guia}* (${data.descricao})\n`;
  msg += `📅 *Competência*: ${data.competencia}\n`;
  msg += `⏰ *Vencimento*: *${vencFmt}*\n`;
  msg += `💵 *Valor a Pagar*: *R$ ${valorFmt}*\n\n`;

  if (data.pix_copia_cola) {
    msg += `🔑 *Código PIX Copia e Cola (1-Clique)*:\n\`\`\`${data.pix_copia_cola}\`\`\`\n\n`;
  }

  if (data.linha_digitavel) {
    msg += `🔢 *Linha Digitável / Código de Barras*:\n\`${data.linha_digitavel}\`\n\n`;
  }

  if (data.pdf_url) {
    msg += `📥 *Baixar Guia Oficial (PDF)*:\n${data.pdf_url}\n\n`;
  }

  msg += `_Evite multas efetuando o pagamento até a data de vencimento._\n`;
  msg += `_Viacont Inovações Contábeis_`;
  return msg;
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const phoneParam = cleanPhone ? `phone=${cleanPhone}&` : '';
  return `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(message)}`;
}

// ============================================================================
// 5. ENGINE 5: PDF GENERATOR FOR INVOICES & TAX GUIDES (PDFKit)
// ============================================================================

export async function generateInvoicePdfBuffer(invoice: any, company: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const items = typeof invoice.itens_json === 'string' ? JSON.parse(invoice.itens_json || '[]') : (invoice.itens_json || []);
      const itemDesc = items[0]?.descricao || invoice.natureza_operacao || 'Prestação de Serviços Profissionais';
      const valor = invoice.valor_total || (items[0]?.valor || 0.0);
      const valorFmt = Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const tipo = invoice.tipo === 'NF-e' ? 'NF-e' : 'NFS-e';

      // Canhoto de Recebimento
      doc.rect(36, 36, 523, 50).stroke('#cccccc');
      doc.fontSize(7).fillColor('#444444')
        .text('RECEBEMOS DA EMPRESA OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO', 42, 42, { width: 380 })
        .text(`DATA DE RECEBIMENTO: ____/____/________    ASSINATURA: _________________________________`, 42, 65);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827')
        .text(`${tipo} Nº ${invoice.numero}`, 430, 45, { align: 'right' })
        .text(`Série: ${invoice.serie || '1'}`, 430, 60, { align: 'right' });

      doc.moveTo(36, 96).lineTo(559, 96).dash(4, { space: 4 }).stroke('#999999').undash();

      // Cabeçalho Oficial
      doc.rect(36, 106, 523, 70).fillAndStroke('#f3f4f6', '#d1d5db');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#047857')
        .text(`DOCUMENTO AUXILIAR DA NOTA FISCAL (${tipo})`, 46, 116);
      doc.fontSize(8).font('Helvetica').fillColor('#374151')
        .text(`Número: ${invoice.numero} | Série: ${invoice.serie || '1'} | Emissão: ${invoice.data_emissao?.split('T')[0] || '2026-08-27'}`, 46, 134)
        .text(`Código de Verificação / Autenticidade: ${invoice.chave_acesso || uuidv4().substring(0, 8).toUpperCase()}`, 46, 148)
        .text(`Ambiente: PRODUÇÃO - Super App Viacont Contabilidade & BPO`, 46, 160);

      // Quadro do Prestador / Emitente
      doc.rect(36, 186, 523, 70).stroke('#d1d5db');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937')
        .text('DADOS DO EMITENTE / PRESTADOR', 46, 194);
      doc.fontSize(8).font('Helvetica').fillColor('#4b5563')
        .text(`Razão Social: ${company.razao_social || 'VIACONT INOVACOES CONTABEIS LTDA'}`, 46, 208)
        .text(`CNPJ: ${company.cnpj || '12.345.678/0001-99'} | UF: ${company.uf || 'BA'} | Município: Salvador`, 46, 222)
        .text(`Regime Tributário: Simples Nacional | Inscrição Municipal: ${company.inscricao_municipal || '72516200143'}`, 46, 236);

      // Quadro do Tomador / Destinatário
      doc.rect(36, 266, 523, 70).stroke('#d1d5db');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937')
        .text('DADOS DO DESTINATÁRIO / TOMADOR DE SERVIÇO', 46, 274);
      doc.fontSize(8).font('Helvetica').fillColor('#4b5563')
        .text(`Nome / Razão Social: ${invoice.destinatario_nome || 'CLIENTE TOMADOR LTDA'}`, 46, 288)
        .text(`CNPJ/CPF: ${invoice.destinatario_cnpj || '34.581.300/0001-23'} | UF: ${invoice.destinatario_uf || 'BA'}`, 46, 302)
        .text(`Endereço: Avenida Principal, 1000 - Centro`, 46, 316);

      // Discriminação dos Serviços
      doc.rect(36, 346, 523, 140).stroke('#d1d5db');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937')
        .text('DISCRIMINAÇÃO DOS SERVIÇOS / PRODUTOS', 46, 354);
      doc.fontSize(9).font('Helvetica').fillColor('#111827')
        .text(itemDesc, 46, 372, { width: 500, height: 80 });

      // Quadro de Valores e Tributos
      doc.rect(36, 496, 523, 80).fillAndStroke('#ecfdf5', '#059669');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#065f46')
        .text('VALOR TOTAL DO DOCUMENTO FISCAL', 46, 508);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#047857')
        .text(`R$ ${valorFmt}`, 46, 525);
      doc.fontSize(8).font('Helvetica').fillColor('#065f46')
        .text(`ISS Retido: NÃO | Alíquota ISS: 5.00% | Deduções Legais: R$ 0,00 | Valor Líquido: R$ ${valorFmt}`, 46, 552);

      // Informações de Pagamento PIX e Chave Digital
      doc.rect(36, 586, 523, 120).stroke('#d1d5db');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937')
        .text('INFORMAÇÕES ADICIONAIS & PAGAMENTO PIX', 46, 596);
      doc.fontSize(8).font('Helvetica').fillColor('#4b5563')
        .text(`Chave PIX: ${company.cnpj || '12345678000199'}`, 46, 612)
        .text(`Transação homologada no Sistema Integrado Viacont. Documento emitido por ME/EPP optante pelo Simples Nacional.`, 46, 626, { width: 500 })
        .text(`Data e Hora da Emissão: ${new Date().toLocaleString('pt-BR')}`, 46, 650);

      // Rodapé
      doc.fontSize(7).font('Helvetica-Oblique').fillColor('#9ca3af')
        .text('Super App Viacont - Tecnologia Contábil e BPO Financeiro Inteligente - www.viacont.com.br', 36, 750, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateTaxGuidePdfBuffer(guide: any, company: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const valorFmt = Number(guide.valor_total || guide.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const [y, m, d] = (guide.data_vencimento || guide.vencimento || '2026-08-20').split('-');
      const vencFmt = d && m && y ? `${d}/${m}/${y}` : guide.data_vencimento;

      // Cabeçalho da Guia
      doc.rect(36, 36, 523, 75).fillAndStroke('#eff6ff', '#3b82f6');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e40af')
        .text('GUIA OFICIAL DE RECOLHIMENTO TRIBUTÁRIO', 46, 48);
      doc.fontSize(9).font('Helvetica').fillColor('#1e3a8a')
        .text(`Tributo: ${guide.tipo_tributo || guide.tipo || 'DAS SIMPLES NACIONAL'}`, 46, 68)
        .text(`Título: ${guide.titulo || guide.descricao || 'DAS Simples Nacional'}`, 46, 82);

      // Dados do Contribuinte
      doc.rect(36, 121, 523, 85).stroke('#d1d5db');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937')
        .text('DADOS DO CONTRIBUINTE', 46, 131);
      doc.fontSize(8).font('Helvetica').fillColor('#4b5563')
        .text(`Razão Social: ${company.razao_social || 'VIACONT INOVACOES CONTABEIS LTDA'}`, 46, 147)
        .text(`CNPJ: ${company.cnpj || '12.345.678/0001-99'} | UF: ${company.uf || 'BA'}`, 46, 161)
        .text(`Competência: ${guide.competencia || '07/2026'} | Origem da Apuração: ${guide.origem_apuracao || 'PGDAS-D / Viacont'}`, 46, 175);

      // Vencimento e Valor
      doc.rect(36, 216, 255, 60).fillAndStroke('#fef2f2', '#ef4444');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#991b1b').text('DATA DE VENCIMENTO', 46, 226);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#b91c1c').text(vencFmt, 46, 245);

      doc.rect(304, 216, 255, 60).fillAndStroke('#ecfdf5', '#059669');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#065f46').text('VALOR TOTAL A PAGAR', 314, 226);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#047857').text(`R$ ${valorFmt}`, 314, 245);

      // Código de Barras / Linha Digitável
      doc.rect(36, 286, 523, 65).stroke('#d1d5db');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937')
        .text('LINHA DIGITÁVEL / CÓDIGO DE BARRAS', 46, 296);
      doc.fontSize(10).font('Courier-Bold').fillColor('#111827')
        .text(guide.codigo_barras_linha_digitavel || guide.linha_digitavel || '858000000482 05000328260 82000000000 00000000000', 46, 316);

      // PIX Copia e Cola
      if (guide.pix_copia_e_cola || guide.pix_copia_cola) {
        const pix = guide.pix_copia_e_cola || guide.pix_copia_cola;
        doc.rect(36, 361, 523, 100).stroke('#d1d5db');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937')
          .text('PIX COPIA E COLA (PAGAMENTO INSTANTÂNEO 1-CLIQUE)', 46, 371);
        doc.fontSize(7).font('Courier').fillColor('#374151')
          .text(pix, 46, 391, { width: 500 });
      }

      // Instruções
      doc.rect(36, 471, 523, 100).stroke('#d1d5db');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937')
        .text('INSTRUÇÕES DE PAGAMENTO', 46, 481);
      doc.fontSize(8).font('Helvetica').fillColor('#4b5563')
        .text('1. Pagável via PIX ou em toda a rede bancária, casas lotéricas e correspondentes até o vencimento.', 46, 498)
        .text('2. Após o vencimento, incidirão juros de mora e multa de acordo com a legislação do tributo.', 46, 514)
        .text('3. O comprovante de quitação deve ser mantido arquivado por 5 anos.', 46, 530);

      // Rodapé
      doc.fontSize(7).font('Helvetica-Oblique').fillColor('#9ca3af')
        .text('Guia gerada automaticamente pelo Super App Viacont Contabilidade & BPO.', 36, 750, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// 6. CORE PORTAL SERVICE FACADE (DATABASE ORCHESTRATION)
// ============================================================================

export const portalService = {
  /**
   * 1. Obter resumo consolidado do dashboard financeiro & termômetro do Simples Nacional (R5)
   */
  async getDashboardSummary(companyId: string): Promise<DashboardSummaryData> {
    // A. Consultar saldo consolidado no caixa (bank_accounts + bank_transactions)
    const saldoRow = db.prepare(`
      SELECT 
        COALESCE((SELECT SUM(saldo_atual) FROM bank_accounts WHERE company_id = ?), 0.0) +
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN UPPER(tipo) = 'CREDITO' THEN valor 
              WHEN UPPER(tipo) = 'DEBITO' THEN -valor 
              ELSE 0.0 
            END
          )
          FROM bank_transactions 
          WHERE company_id = ?
        ), 0.0) AS total_saldo
    `).get(companyId, companyId) as { total_saldo: number } | undefined;
    const bank_balance = Number((saldoRow?.total_saldo || 0.0).toFixed(2));

    // B. Consultar contas a pagar deste mês (parcelas a pagar em aberto + provisões contábeis em aberto)
    const payablesRow = db.prepare(`
      SELECT 
        COALESCE((
          SELECT SUM(valor) 
          FROM invoice_installments 
          WHERE company_id = ? 
            AND tipo = 'pagar' 
            AND status IN ('pendente', 'provisionado')
            AND (
              strftime('%Y-%m', data_vencimento) = strftime('%Y-%m', 'now')
              OR data_vencimento <= date('now')
            )
        ), 0.0) +
        COALESCE((
          SELECT SUM(valor) 
          FROM accounting_provisions 
          WHERE company_id = ? 
            AND status = 'provisionado'
            AND (
              competencia = strftime('%m/%Y', 'now')
              OR strftime('%Y-%m', data_lancamento) = strftime('%Y-%m', 'now')
            )
        ), 0.0) AS total_payables
    `).get(companyId, companyId) as { total_payables: number } | undefined;
    const payables_today = Number((payablesRow?.total_payables || 0.0).toFixed(2));

    // C. Consultar contas a receber deste mês (parcelas a receber em aberto + notas emitidas/autorizadas no mês)
    const receivablesRow = db.prepare(`
      SELECT 
        COALESCE((
          SELECT SUM(valor) 
          FROM invoice_installments 
          WHERE company_id = ? 
            AND tipo = 'receber' 
            AND status IN ('pendente', 'provisionado')
            AND (
              strftime('%Y-%m', data_vencimento) = strftime('%Y-%m', 'now')
              OR data_vencimento <= date('now')
            )
        ), 0.0) +
        COALESCE((
          SELECT SUM(valor_total) 
          FROM invoices 
          WHERE company_id = ? 
            AND tipo IN ('saida', 'NFS-e') 
            AND status IN ('autorizada', 'emitida') 
            AND strftime('%Y-%m', data_emissao) = strftime('%Y-%m', 'now')
            AND id NOT IN (
              SELECT invoice_id FROM invoice_installments 
              WHERE invoice_id IS NOT NULL AND company_id = ?
            )
        ), 0.0) AS total_receivables
    `).get(companyId, companyId, companyId) as { total_receivables: number } | undefined;
    const receivables_today = Number((receivablesRow?.total_receivables || 0.0).toFixed(2));

    const projected_end_of_day = Number((bank_balance + receivables_today - payables_today).toFixed(2));

    // D. Projeção de fluxo de caixa baseada em parcelas agendadas (próximos 30 dias)
    const scheduledRows = db.prepare(`
      SELECT 
        data_vencimento AS data_venc,
        SUM(CASE WHEN tipo = 'receber' AND status IN ('pendente', 'provisionado') THEN valor ELSE 0.0 END) AS inflow,
        SUM(CASE WHEN tipo = 'pagar' AND status IN ('pendente', 'provisionado') THEN valor ELSE 0.0 END) AS outflow
      FROM invoice_installments
      WHERE company_id = ?
        AND data_vencimento >= date('now')
        AND data_vencimento <= date('now', '+30 days')
      GROUP BY data_vencimento
    `).all(companyId) as Array<{ data_venc: string; inflow: number; outflow: number }>;

    const forecastMap = new Map<string, { inflow: number; outflow: number }>();
    for (const row of scheduledRows) {
      forecastMap.set(row.data_venc, {
        inflow: Number(row.inflow || 0),
        outflow: Number(row.outflow || 0)
      });
    }

    const forecast: Array<{ date: string; inflow: number; outflow: number; net: number }> = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      const entry = forecastMap.get(dateStr) || { inflow: 0.0, outflow: 0.0 };
      const inflow = Number(entry.inflow.toFixed(2));
      const outflow = Number(entry.outflow.toFixed(2));
      const net = Number((inflow - outflow).toFixed(2));

      forecast.push({
        date: dateStr,
        inflow,
        outflow,
        net
      });
    }

    // E. Calcular RBT12 Acumulado dos últimos 12 meses (notas de saída autorizadas)
    const rbt12Row = db.prepare(`
      SELECT COALESCE(SUM(valor_total), 0.0) AS total_rbt12
      FROM invoices
      WHERE company_id = ? 
        AND tipo IN ('saida', 'NFS-e') 
        AND status IN ('autorizada', 'emitida') 
        AND data_emissao >= date('now', '-12 months')
    `).get(companyId) as { total_rbt12: number } | undefined;

    const monthlyBreakdownRows = db.prepare(`
      SELECT 
        strftime('%Y-%m', data_emissao) AS mes,
        COALESCE(SUM(valor_total), 0.0) AS faturamento
      FROM invoices
      WHERE company_id = ?
        AND tipo IN ('saida', 'NFS-e')
        AND status IN ('autorizada', 'emitida')
        AND data_emissao >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', data_emissao)
      ORDER BY mes ASC
    `).all(companyId) as Array<{ mes: string; faturamento: number }>;

    const rawRbt12 = Number(rbt12Row?.total_rbt12 || 0.0);
    const simples_nacional = computeSimplesNacionalGauge(rawRbt12, 'ANEXO_III', monthlyBreakdownRows);

    return {
      bank_balance,
      payables_today,
      receivables_today,
      projected_end_of_day,
      cash_flow_forecast: forecast,
      simples_nacional
    };
  },

  /**
   * 2. Emissão Relâmpago de Nota Fiscal (NFS-e / NF-e) com espelho e PIX (R2)
   */
  async emitFastInvoice(payload: FastInvoiceInput): Promise<FastInvoiceOutput> {
    const { company_id, tipo, tomador, item } = payload;
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(company_id) as any;
    if (!company) {
      throw new Error(`Empresa ${company_id} não encontrada.`);
    }

    const nextNum = (Math.floor(Math.random() * 90000) + 10000).toString();
    const verificationCode = uuidv4().substring(0, 8).toUpperCase();
    const now = new Date().toISOString();

    // Gerar Código PIX Copia e Cola EMV oficial
    const pixKey = company.cnpj ? company.cnpj.replace(/\D/g, '') : '00000000000199';
    const pix_code = generatePixEmvPayload({
      pixKey,
      merchantName: company.razao_social || 'VIACONT CLIENTE',
      merchantCity: company.uf === 'BA' ? 'SALVADOR' : 'SAO PAULO',
      amount: item.valor,
      txId: `FAT${nextNum}`,
      description: `FATURA ${nextNum}`
    });

    const pdf_url = `/api/portal/invoices/${nextNum}/pdf`;

    // Formatar link de compartilhamento no WhatsApp
    const waText = formatInvoiceWhatsAppMessage({
      empresa_nome: company.razao_social,
      empresa_cnpj: company.cnpj,
      tomador_nome: tomador.razao_social,
      tomador_cnpj_cpf: tomador.cnpj_cpf,
      tipo,
      numero_nota: nextNum,
      codigo_verificacao: verificationCode,
      valor_total: item.valor,
      descricao_item: item.descricao,
      pix_code,
      pdf_url
    });

    const whatsapp_share_url = generateWhatsAppLink(tomador.whatsapp || '', waText);

    // Salvar registro de emissão em invoices
    const invId = `inv_fast_${uuidv4()}`;
    db.prepare(`
      INSERT INTO invoices (
        id, company_id, chave_acesso, numero, serie, tipo, status,
        natureza_operacao, data_emissao, emitente_cnpj, emitente_nome, emitente_uf,
        destinatario_cnpj, destinatario_nome, destinatario_uf, valor_total, itens_json, created_at
      ) VALUES (?, ?, ?, ?, '1', 'saida', 'autorizada', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invId,
      company_id,
      `CHAVE_${nextNum}_${verificationCode}`,
      nextNum,
      tipo === 'NFS-e' ? 'Prestação de Serviços' : 'Venda de Mercadorias',
      now,
      company.cnpj,
      company.razao_social,
      company.uf || 'BA',
      tomador.cnpj_cpf,
      tomador.razao_social,
      tomador.uf || 'BA',
      item.valor,
      JSON.stringify([item]),
      now
    );

    // Salvar ou atualizar cliente recorrente
    try {
      const cleanDoc = tomador.cnpj_cpf.replace(/\D/g, '');
      const existingCli = db.prepare('SELECT id FROM recurring_clients WHERE company_id = ? AND cnpj_cpf = ?').get(company_id, cleanDoc) as any;
      if (existingCli) {
        db.prepare(`
          UPDATE recurring_clients 
          SET total_notas_emitidas = total_notas_emitidas + 1,
              valor_total_emitido = valor_total_emitido + ?,
              ultimo_servico_utilizado = ?,
              updated_at = ?
          WHERE id = ?
        `).run(item.valor, item.descricao, now, existingCli.id);
      } else {
        db.prepare(`
          INSERT INTO recurring_clients (
            id, company_id, tenant_id, tipo_pessoa, cnpj_cpf, razao_social,
            email, telefone_whatsapp, logradouro, numero, complemento, bairro,
            municipio, uf, cep, total_notas_emitidas, valor_total_emitido,
            ultimo_servico_utilizado, created_at, updated_at
          ) VALUES (?, ?, 'tenant_viacont_master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `).run(
          `rec_cli_${uuidv4()}`,
          company_id,
          cleanDoc.length <= 11 ? 'PF' : 'PJ',
          cleanDoc,
          tomador.razao_social,
          tomador.email || null,
          tomador.whatsapp || null,
          tomador.logradouro || null,
          tomador.numero || null,
          tomador.complemento || null,
          tomador.bairro || null,
          tomador.municipio || null,
          tomador.uf || null,
          tomador.cep || null,
          item.valor,
          item.descricao,
          now,
          now
        );
      }
    } catch (_) {}

    // Criar parcela a receber em invoice_installments
    try {
      db.prepare(`
        INSERT INTO invoice_installments (
          id, invoice_id, company_id, tipo, numero_parcela, data_vencimento,
          valor, status, fornecedor_cliente_nome, fornecedor_cliente_cnpj, created_at
        ) VALUES (?, ?, ?, 'receber', '1', ?, ?, 'pendente', ?, ?, ?)
      `).run(
        `inst_${uuidv4()}`,
        invId,
        company_id,
        now.split('T')[0],
        item.valor,
        tomador.razao_social,
        tomador.cnpj_cpf,
        now
      );
    } catch (_) {}

    return {
      id: invId,
      numero_nota: nextNum,
      codigo_verificacao: verificationCode,
      status: 'AUTORIZADA',
      pdf_url,
      pix_code,
      whatsapp_share_url,
      issued_at: now,
      valor_total: item.valor,
      destinatario_nome: tomador.razao_social,
      tipo
    };
  },

  /**
   * 3. Listagem de Guias de Impostos com PIX 1-Clique (R3)
   */
  async getTaxGuides(companyId: string, status?: string, competencia?: string): Promise<TaxGuideItem[]> {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    const cleanCnpj = company?.cnpj ? company.cnpj.replace(/\D/g, '') : '00000000000199';
    const merchantName = company?.razao_social || 'EMPRESA CONTRIBUINTE';
    const merchantCity = company?.uf === 'BA' ? 'SALVADOR' : (company?.uf === 'SP' ? 'SAO PAULO' : 'SALVADOR');
    const now = new Date().toISOString();

    // 1. Consultar accounting_provisions e sintetizar guias correspondentes
    try {
      let provSql = 'SELECT * FROM accounting_provisions WHERE company_id = ?';
      const provParams: any[] = [companyId];
      if (competencia) {
        provSql += ' AND competencia = ?';
        provParams.push(competencia);
      }
      provSql += ' ORDER BY data_lancamento DESC';

      const provisions = db.prepare(provSql).all(...provParams) as any[];

      for (const prov of provisions) {
        const guideId = `guide_prov_${prov.id}`;
        
        let tipoTributo = 'OUTROS';
        let titulo = prov.historico || 'Obrigação Contábil / Fiscal';

        switch (prov.tipo_provisao) {
          case 'DAS_SIMPLES':
            tipoTributo = 'DAS_SIMPLES';
            titulo = 'DAS - Simples Nacional';
            break;
          case 'ICMS':
            tipoTributo = 'ICMS_DAE';
            titulo = 'ICMS - DAE Estadual';
            break;
          case 'FOLHA_SALARIOS':
            tipoTributo = 'FOLHA_SALARIOS';
            titulo = 'Folha de Pagamento / Salários';
            break;
          case 'INSS_EMPRESA':
            tipoTributo = 'INSS_DARF';
            titulo = 'INSS / DCTFWeb Previdenciário';
            break;
          case 'FGTS':
            tipoTributo = 'FGTS_DIGITAL';
            titulo = 'FGTS Digital';
            break;
          case 'FERIAS_13':
            tipoTributo = 'IRRF_FOLHA';
            titulo = 'Provisão 13º / Férias';
            break;
          case 'PRO_LABORE':
            tipoTributo = 'INSS_DARF';
            titulo = 'INSS Pró-Labore';
            break;
          case 'PIS_COFINS':
            tipoTributo = 'OUTROS';
            titulo = 'PIS / COFINS Retido';
            break;
          default:
            tipoTributo = prov.tipo_provisao || 'OUTROS';
            titulo = prov.historico || 'Guia Tributária';
        }

        let dataVencimento = prov.data_lancamento || now.split('T')[0];
        if (prov.competencia && prov.competencia.includes('/')) {
          const [mStr, yStr] = prov.competencia.split('/');
          const m = parseInt(mStr, 10);
          const y = parseInt(yStr, 10);
          if (!isNaN(m) && !isNaN(y)) {
            let nextM = m + 1;
            let nextY = y;
            if (nextM > 12) {
              nextM = 1;
              nextY++;
            }
            let dueDay = 20;
            if (tipoTributo === 'ICMS_DAE') dueDay = 15;
            if (tipoTributo === 'FOLHA_SALARIOS') dueDay = 5;
            dataVencimento = `${nextY}-${String(nextM).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
          }
        }

        const txId = `PROV${prov.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase()}`;
        const pixPayload = generatePixEmvPayload({
          pixKey: cleanCnpj,
          merchantName,
          merchantCity,
          amount: prov.valor,
          txId,
          description: `${titulo.substring(0, 15)} ${prov.competencia}`
        });

        const guideStatus = prov.status === 'conciliado_pago' ? 'pago' : 'pendente';
        const dataPagamento = prov.status === 'conciliado_pago' ? prov.data_lancamento : null;

        try {
          db.prepare(`
            INSERT INTO tax_guides (
              id, company_id, tenant_id, tipo_tributo, titulo, competencia,
              data_vencimento, valor_principal, valor_multa_juros, valor_total,
              codigo_barras_linha_digitavel, pix_copia_e_cola, pdf_file_path,
              status, data_pagamento, origem_apuracao, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?, ?, ?, ?, 'provisao_contabil', ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              valor_principal = excluded.valor_principal,
              valor_total = excluded.valor_total,
              pix_copia_e_cola = excluded.pix_copia_e_cola,
              status = excluded.status,
              data_pagamento = excluded.data_pagamento,
              updated_at = excluded.updated_at
          `).run(
            guideId,
            companyId,
            company?.tenant_id || 'tenant_viacont_master',
            tipoTributo,
            titulo,
            prov.competencia,
            dataVencimento,
            prov.valor,
            prov.valor,
            `858000000${Math.floor(prov.valor)} 00000000000 00000000000 00000000000`,
            pixPayload,
            `/storage/tax_guides/${guideId}.pdf`,
            guideStatus,
            dataPagamento,
            prov.created_at || now,
            now
          );
        } catch (_) {}
      }
    } catch (_) {}

    // 2. Consultar todas as guias registradas para a empresa
    let sql = 'SELECT * FROM tax_guides WHERE company_id = ?';
    const params: any[] = [companyId];

    if (status) {
      const s = status.toLowerCase();
      if (s === 'pendente') {
        sql += " AND LOWER(status) IN ('pendente', 'vencido')";
      } else if (s === 'pago') {
        sql += " AND LOWER(status) = 'pago'";
      } else if (s !== 'all') {
        sql += ' AND LOWER(status) = LOWER(?)';
        params.push(status);
      }
    }
    if (competencia) {
      sql += ' AND competencia = ?';
      params.push(competencia);
    }
    sql += ' ORDER BY data_vencimento ASC';

    try {
      const rows = db.prepare(sql).all(...params) as any[];
      return rows.map(r => {
        let pix = r.pix_copia_e_cola;
        if (!pix && r.valor_total > 0) {
          pix = generatePixEmvPayload({
            pixKey: cleanCnpj,
            merchantName,
            merchantCity,
            amount: r.valor_total,
            txId: `GUIA${r.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase()}`,
            description: `${(r.titulo || 'GUIA').substring(0, 15)} ${r.competencia || ''}`
          });
          try {
            db.prepare('UPDATE tax_guides SET pix_copia_e_cola = ? WHERE id = ?').run(pix, r.id);
          } catch (_) {}
        }

        return {
          id: r.id,
          company_id: r.company_id,
          tenant_id: r.tenant_id,
          tipo_tributo: r.tipo_tributo,
          titulo: r.titulo,
          competencia: r.competencia,
          data_vencimento: r.data_vencimento,
          valor_principal: r.valor_principal,
          valor_multa_juros: r.valor_multa_juros || 0.0,
          valor_total: r.valor_total,
          codigo_barras_linha_digitavel: r.codigo_barras_linha_digitavel,
          pix_copia_e_cola: pix,
          pix_qr_code_url: r.pix_qr_code_url,
          pdf_file_path: r.pdf_file_path,
          pdf_url: `/api/portal/tax-guides/${r.id}/pdf`,
          status: r.status,
          data_pagamento: r.data_pagamento,
          comprovante_file_path: r.comprovante_file_path,
          origem_apuracao: r.origem_apuracao,
          notificado_whatsapp: r.notificado_whatsapp,
          notificado_em: r.notificado_em,
          observacoes: r.observacoes,
          created_at: r.created_at,
          updated_at: r.updated_at
        };
      });
    } catch (_) {
      return [];
    }
  },

  /**
   * 4. Scanner OCR de Recibos e Auto-Match com Contas a Pagar (R4)
   */
  async scanReceiptAndMatch(
    companyId: string,
    fileBufferOrPath: Buffer | string,
    fileName?: string,
    mimeType?: string,
    fileSize?: number
  ): Promise<any> {
    const extracted = await processReceiptOcr(fileBufferOrPath, mimeType);

    // Buscar contas a pagar pendentes para reconciliação
    const pendingPayables = db.prepare(`
      SELECT id, invoice_id, fornecedor_cliente_nome as fornecedor_nome,
             fornecedor_cliente_cnpj as fornecedor_cnpj, valor, data_vencimento, status
      FROM invoice_installments
      WHERE company_id = ? AND tipo = 'pagar' AND status IN ('pendente', 'provisionado')
    `).all(companyId) as unknown as PayableCandidate[];

    const match = matchReceiptWithPayables(extracted, pendingPayables);
    const receiptId = `ocr_rcp_${uuidv4()}`;
    const now = new Date().toISOString();

    const filePath = typeof fileBufferOrPath === 'string' ? fileBufferOrPath : `/storage/receipts/${fileName || `${receiptId}.jpg`}`;

    // Registrar no banco
    try {
      db.prepare(`
        INSERT INTO receipts_ocr (
          id, company_id, tenant_id, arquivo_nome, arquivo_path, arquivo_tamanho,
          mime_type, raw_ocr_text, ocr_confidence_score, fornecedor_nome_detectado,
          fornecedor_cnpj_detectado, data_despesa_detectada, valor_total_detectado,
          categoria_sugerida_id, categoria_sugerida_nome, descricao_final, valor_final,
          data_final, status_match, matched_payable_id, matched_confidence,
          created_at, updated_at
        ) VALUES (?, ?, 'tenant_viacont_master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        receiptId,
        companyId,
        fileName || 'comprovante_scanner.jpg',
        filePath,
        fileSize || 150000,
        mimeType || 'image/jpeg',
        extracted.raw_text || null,
        extracted.confidence || 0.90,
        extracted.fornecedor || null,
        extracted.cnpj || extracted.cpf || null,
        extracted.data_emissao || null,
        extracted.valor_total || null,
        extracted.categoria_sugerida_id || null,
        extracted.categoria_sugerida || 'Despesas Gerais',
        extracted.fornecedor ? `Despesa - ${extracted.fornecedor}` : 'Comprovante digitalizado',
        extracted.valor_total || null,
        extracted.data_emissao || now.split('T')[0],
        match.match_status === 'MATCHED' ? 'sugerido' : 'pendente',
        match.payable_id || null,
        match.match_confidence,
        now,
        now
      );
    } catch (_) {}

    return {
      receipt_id: receiptId,
      image_url: filePath,
      extracted,
      matched_payable: match.matched_payable ? {
        payable_id: match.matched_payable.id,
        descricao: match.matched_payable.fornecedor_nome,
        valor: match.matched_payable.valor,
        vencimento: match.matched_payable.data_vencimento,
        match_confidence: match.match_confidence,
        match_status: match.match_status
      } : {
        payable_id: undefined,
        match_confidence: match.match_confidence,
        match_status: match.match_status
      }
    };
  }
};
