import { createHash } from 'node:crypto';
/**
 * Universal Bank Statement Parser for Brazilian Banks
 * Supports:
 * 1. OFX (Itaú, Bradesco, Santander, Banco do Brasil, Inter, Nubank, Sicoob, Sicredi, C6, Safra, BTG, etc.)
 * 2. CSV / TSV (Excel / Planilhas exportadas de qualquer banco brasileiro)
 * 3. TXT (Relatórios e extratos colunados em texto)
 */

export interface OfxTransaction {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: 'CREDITO' | 'DEBITO';
  valor: number;
  documento: string;
  descricao: string;
}

export interface OfxParsedStatement {
  bankId?: string;
  accountId?: string;
  transactions: OfxTransaction[];
}

function cleanXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function parseOfx(rawContent: string): OfxParsedStatement {
  const content = rawContent.replace(/<\s*(\/?)\s*([a-z0-9]+)\s*>/gi, '<$1$2>').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Detecção case-insensitive para arquivos OFX (SGML e XML)
  if (/<STMTTRN>|<OFX>|OFXHEADER|<BANKTRANLIST>|<CCSTMTTRNRS>/i.test(content)) {
    return parseStandardOfx(content);
  }

  // Caso contrário, usa o Parser universal para CSV, TXT e texto extraído de PDF
  return parseCsvOrTxtStatement(content);
}

function parseStandardOfx(content: string): OfxParsedStatement {
  const transactions: OfxTransaction[] = [];

  const bankMatch = content.match(/<BANKID>\s*(.*?)(\n|<)/i);
  const acctMatch = content.match(/<ACCTID>\s*(.*?)(\n|<)/i);

  const bankId = bankMatch ? bankMatch[1].trim() : undefined;
  const accountId = acctMatch ? acctMatch[1].trim() : undefined;

  // Quebra por <STMTTRN> de forma resiliente a SGML (sem fechamento) e XML (com fechamento)
  const parts = content.split(/<STMTTRN>/i);
  for (let i = 1; i < parts.length; i++) {
    let block = parts[i];
    const endTagIdx = block.search(/<\/STMTTRN>/i);
    if (endTagIdx !== -1) {
      block = block.substring(0, endTagIdx);
    } else {
      const closingIdx = block.search(/<\/(?:BANKTRANLIST|CCSTMTTRNRS|STMTRS|CCSTMTRS)>/i);
      if (closingIdx !== -1) {
        block = block.substring(0, closingIdx);
      }
    }

    const typeMatch = block.match(/<TRNTYPE>\s*(.*?)(\n|<|$)/i);
    const dateMatch = block.match(/<DTPOSTED>\s*(\d{4})(\d{2})(\d{2})/i);
    const amtMatch = block.match(/<TRNAMT>\s*([-\d.,]+)/i);
    const fitidMatch = block.match(/<FITID>\s*(.*?)(\n|<|$)/i);
    const checknumMatch = block.match(/<CHECKNUM>\s*(.*?)(\n|<|$)/i);
    const refnumMatch = block.match(/<REFNUM>\s*(.*?)(\n|<|$)/i);
    const memoMatch = block.match(/<MEMO>\s*(.*?)(\n|<|$)/i);
    const nameMatch = block.match(/<NAME>\s*(.*?)(\n|<|$)/i);

    if (dateMatch && amtMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2];
      const day = dateMatch[3];
      const formattedDate = `${year}-${month}-${day}`;

      const rawAmt = amtMatch[1].trim();
      const numAmt = Number(rawAmt.includes(',') ? rawAmt.replace(/\./g, '').replace(',', '.') : rawAmt);
      if (isNaN(numAmt)) continue;

      const trnType = numAmt < 0 ? 'DEBITO' : 'CREDITO';
      const absValor = Math.round(Math.abs(numAmt) * 100) / 100;

      const memo = memoMatch ? cleanXmlEntities(memoMatch[1]) : '';
      const name = nameMatch ? cleanXmlEntities(nameMatch[1]) : '';
      const desc = memo || name || 'Transação Bancária';

      const doc = fitidMatch 
        ? fitidMatch[1].trim() 
        : (checknumMatch 
          ? checknumMatch[1].trim() 
          : (refnumMatch 
            ? refnumMatch[1].trim() 
            : `OFX_${createHash('sha256').update(block.trim()).digest('hex').slice(0, 24)}_${i}`));

      transactions.push({
        id: doc,
        data: formattedDate,
        tipo: trnType,
        valor: absValor,
        documento: doc,
        descricao: desc
      });
    }
  }

  return {
    bankId,
    accountId,
    transactions
  };
}

function parseCsvOrTxtStatement(content: string): OfxParsedStatement {
  const transactions: OfxTransaction[] = [];
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Palavras-chave a ignorar (cabeçalhos, saldos diários e totalizadores)
  const IGNORE_KEYWORDS = [
    'SALDO ANTERIOR', 'SALDO DO DIA', 'SALDO ATUAL', 'SALDO DISPONIVEL', 'SALDO DISPONÍVEL',
    'SALDO EM CONTA', 'SALDO BLOQUEADO', 'TOTALIZADOR', 'EXTRATO DE CONTA', 'EXTRATO BANCARIO',
    'EXTRATO MENSAL', 'EXTRATO PERIODO', 'PERIODO:', 'PERÍODO:', 'AGENCIA:', 'AGÊNCIA:',
    'CONTA:', 'CONTA CORRENTE', 'TITULAR:', 'CNPJ:', 'CPF:', 'DATA;LANCAMENTO', 'DATA;HISTORICO'
  ];


  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    // Ignora linhas de saldo e cabeçalhos informativos
    if (IGNORE_KEYWORDS.some(kw => upperLine.includes(kw))) {
      continue;
    }

    // 1. Detecção de Data: YYYY-MM-DD ou DD/MM/YYYY ou DD/MM/YY ou DD/MM
    let formattedDate = '';
    let dateStrRaw = '';

    const dateIsoMatch = line.match(/\b(\d{4})[\/\.-](\d{2})[\/\.-](\d{2})\b/);
    const dateFullMatch = line.match(/\b(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})\b/);
    const dateShortYearMatch = line.match(/\b(\d{2})[\/\.-](\d{2})[\/\.-](\d{2})\b/);
    const dateNoYearMatch = line.match(/\b(\d{2})[\/\.-](\d{2})\b/);

    if (dateIsoMatch) {
      formattedDate = `${dateIsoMatch[1]}-${dateIsoMatch[2]}-${dateIsoMatch[3]}`;
      dateStrRaw = dateIsoMatch[0];
    } else if (dateFullMatch) {
      formattedDate = `${dateFullMatch[3]}-${dateFullMatch[2]}-${dateFullMatch[1]}`;
      dateStrRaw = dateFullMatch[0];
    } else if (dateShortYearMatch) {
      const year = parseInt(dateShortYearMatch[3], 10) > 50 ? `19${dateShortYearMatch[3]}` : `20${dateShortYearMatch[3]}`;
      formattedDate = `${year}-${dateShortYearMatch[2]}-${dateShortYearMatch[1]}`;
      dateStrRaw = dateShortYearMatch[0];
    } else if (dateNoYearMatch && (upperLine.includes('PIX') || upperLine.includes('TED') || upperLine.includes('PAGTO') || upperLine.includes('TAR') || upperLine.includes('DEB') || upperLine.includes('CRED'))) {
      throw new Error(`Linha ${i + 1}: data sem ano. Informe o ano no extrato; ele não será estimado.`);
    } else {
      continue;
    }

    // 2. Extração de valores monetários
    const moneyRegex = /[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+(?:\.\d{3})*,\d{2}|[+-]?\s*\d+\.\d{2}/g;
    // A data não pode participar da extração monetária (ex.: 19.09.2026).
    const amountLine = line.replace(dateStrRaw, '');
    const matches = [...amountLine.matchAll(moneyRegex)];

    if (matches.length === 0) continue;

    const targetMatch = matches[0][0].replace(/\s+/g, '');

    // D/C pertence ao valor da movimentação, nunca ao saldo da última coluna.
    const afterValue = amountLine.slice(matches[0].index! + matches[0][0].length);
    const marker = afterValue.match(/^\s*(?:[;|\t]\s*)?([DC])(?=\s|[;|\t]|$)/i)?.[1]?.toUpperCase();
    if ((targetMatch.startsWith('-') && marker === 'C') || (targetMatch.startsWith('+') && marker === 'D')) {
      throw new Error(`Linha ${i + 1}: sinal e indicador de débito/crédito conflitantes.`);
    }
    const isNegative = marker ? marker === 'D' : targetMatch.startsWith('-');

    let cleanVal = targetMatch.replace('+', '').replace('-', '');
    if (cleanVal.includes(',')) {
      cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
    }
    const numVal = parseFloat(cleanVal);
    if (isNaN(numVal) || numVal === 0) continue;

    const absValor = Math.round(numVal * 100) / 100;
    const tipo = isNegative ? 'DEBITO' : 'CREDITO';

    // 3. Descrição limpa da transação
    let desc = line
      .replace(dateStrRaw, '')
      .replace(matches[0][0], '');

    if (matches.length > 1) {
      desc = desc.replace(matches[matches.length - 1][0], '');
    }

    desc = desc
      .replace(/[;,\t|]/g, ' ')
      .replace(/\s+[DC]\s*$/i, '')
      .replace(/\s+[DC]\s+/i, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!desc || desc.length < 2) {
      desc = `Transação ${tipo === 'DEBITO' ? 'Débito' : 'Crédito'}`;
    }

    const docId = `EXT_${createHash('sha256').update(line).digest('hex').slice(0, 24)}_${i}`;

    transactions.push({
      id: docId,
      data: formattedDate,
      tipo,
      valor: absValor,
      documento: docId,
      descricao: desc
    });
  }

  return {
    transactions
  };
}
