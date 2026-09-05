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

export function parseOfx(rawContent: string): OfxParsedStatement {
  const content = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // If contains OFX tags, use OFX Parser
  if (content.includes('<STMTTRN>') || content.includes('<OFX>') || content.includes('OFXHEADER')) {
    return parseStandardOfx(content);
  }

  // Otherwise, use CSV/TXT Multi-Format Parser
  return parseCsvOrTxtStatement(content);
}

function parseStandardOfx(content: string): OfxParsedStatement {
  const transactions: OfxTransaction[] = [];

  const bankMatch = content.match(/<BANKID>(.*?)(\n|<)/i);
  const acctMatch = content.match(/<ACCTID>(.*?)(\n|<)/i);

  const bankId = bankMatch ? bankMatch[1].trim() : undefined;
  const accountId = acctMatch ? acctMatch[1].trim() : undefined;

  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let match;

  while ((match = trnRegex.exec(content)) !== null) {
    const trnBlock = match[1];

    const typeMatch = trnBlock.match(/<TRNTYPE>(.*?)(\n|<)/i);
    const dateMatch = trnBlock.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})(.*?)(\n|<)/i);
    const amtMatch = trnBlock.match(/<TRNAMT>([-\d.,]+)(\n|<)/i);
    const fitidMatch = trnBlock.match(/<FITID>(.*?)(\n|<)/i);
    const memoMatch = trnBlock.match(/<MEMO>(.*?)(\n|<)/i);
    const nameMatch = trnBlock.match(/<NAME>(.*?)(\n|<)/i);

    if (dateMatch && amtMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2];
      const day = dateMatch[3];
      const formattedDate = `${year}-${month}-${day}`;

      let rawAmt = amtMatch[1].trim().replace(',', '.');
      const numAmt = parseFloat(rawAmt);

      const trnType = numAmt < 0 ? 'DEBITO' : 'CREDITO';
      const absValor = Math.abs(numAmt);

      const desc = (memoMatch ? memoMatch[1].trim() : (nameMatch ? nameMatch[1].trim() : 'Transação Bancária')).replace(/&amp;/g, '&');
      const doc = fitidMatch ? fitidMatch[1].trim() : `OFX_${year}${month}${day}_${Math.random().toString(36).substring(7)}`;

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
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Try date pattern: DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY
    const dateMatch = line.match(/(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/) || line.match(/(\d{4})[\/\.-](\d{2})[\/\.-](\d{2})/);
    if (!dateMatch) continue;

    let formattedDate = '';
    if (dateMatch[1].length === 4) {
      // YYYY-MM-DD
      formattedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    } else {
      // DD/MM/YYYY
      formattedDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }

    // Try splitting by delimiter (;, tab, comma, |)
    let parts = line.split(/[;\t,|]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
    
    // If not delimited, split by multiple spaces (colunado TXT)
    if (parts.length < 2) {
      parts = line.split(/\s{2,}/).map(p => p.trim());
    }

    // Extract amount: look for monetary values like "1.234,56" or "-1234.56" or "1500,00 D"
    let detectedValor = 0;
    let detectedTipo: 'CREDITO' | 'DEBITO' = 'DEBITO';
    let detectedDesc = '';
    let detectedDoc = `TXT_${formattedDate.replace(/-/g, '')}_${i}`;

    // Find token with currency/numbers
    for (let pIdx = 0; pIdx < parts.length; pIdx++) {
      const part = parts[pIdx];
      
      // Clean number
      const numMatch = part.match(/([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2})|([+-]?\s*\d+[.,]\d{2})/);
      if (numMatch) {
        let cleanVal = numMatch[0].replace(/\s+/g, '');
        const isNegative = cleanVal.includes('-') || line.toUpperCase().includes(' D ') || line.toUpperCase().endsWith(' D') || line.toUpperCase().includes('DEBITO') || line.toUpperCase().includes('DÉBITO');
        
        if (cleanVal.includes(',')) {
          cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        }
        
        const parsedNum = parseFloat(cleanVal);
        if (!isNaN(parsedNum) && Math.abs(parsedNum) > 0) {
          detectedValor = Math.abs(parsedNum);
          detectedTipo = isNegative || parsedNum < 0 ? 'DEBITO' : 'CREDITO';
        }
      } else if (part.length > 3 && !part.match(/^\d{2}[\/\.-]\d{2}[\/\.-]\d{4}$/) && !detectedDesc) {
        detectedDesc = part;
      }
    }

    // Fallback description from full line if not parsed cleanly
    if (!detectedDesc) {
      detectedDesc = line
        .replace(/\d{2}[\/\.-]\d{2}[\/\.-]\d{4}/, '')
        .replace(/[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}/, '')
        .replace(/[;,\t|]/g, ' ')
        .trim();
    }

    if (detectedValor > 0 && detectedDesc) {
      transactions.push({
        id: detectedDoc,
        data: formattedDate,
        tipo: detectedTipo,
        valor: detectedValor,
        documento: detectedDoc,
        descricao: detectedDesc
      });
    }
  }

  return {
    transactions
  };
}
