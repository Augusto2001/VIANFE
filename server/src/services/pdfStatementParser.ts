import { v4 as uuidv4 } from 'uuid';

export interface ExtractedBankTransaction {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  tipo: 'DEBITO' | 'CREDITO';
  valor: number;
  documento?: string;
}

export function parsePdfStatementText(pdfText: string): ExtractedBankTransaction[] {
  const transactions: ExtractedBankTransaction[] = [];
  const lines = pdfText.split(/\r?\n/);

  // Regex patterns for standard Brazilian bank statements (DD/MM/YYYY or DD/MM with description and currency)
  // Example: 15/07/2026 PIX TRANSF ENVIADA -150,00 D
  // Example: 15/07/2026 PGTO BOLETO 1.250,00-
  // Example: 15/07 TED RECEBIDA 3.400,00 C
  const dateRegex = /(\d{2}\/\d{2}(?:\/\d{4})?)/;
  const currencyRegex = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/;

  const currentYear = new Date().getFullYear();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 8) continue;

    const dateMatch = line.match(dateRegex);
    const currMatch = line.match(currencyRegex);

    if (dateMatch && currMatch) {
      const rawDate = dateMatch[1];
      const rawVal = currMatch[1];

      // Format date YYYY-MM-DD
      let formattedDate = '';
      const dateParts = rawDate.split('/');
      if (dateParts.length === 3) {
        formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      } else if (dateParts.length === 2) {
        formattedDate = `${currentYear}-${dateParts[1]}-${dateParts[0]}`;
      }

      // Format valor
      const cleanValStr = rawVal.replace(/\./g, '').replace(',', '.');
      let valor = parseFloat(cleanValStr);
      let tipo: 'DEBITO' | 'CREDITO' = 'DEBITO';

      const lineUpper = line.toUpperCase();
      if (lineUpper.includes(' D') || lineUpper.includes('-') || lineUpper.includes('DEBITO') || lineUpper.includes('PGTO') || lineUpper.includes('PAGAMENTO') || lineUpper.includes('SAQUE') || lineUpper.includes('TARIFA') || lineUpper.includes('COMPRA') || valor < 0) {
        tipo = 'DEBITO';
        valor = Math.abs(valor);
      } else {
        tipo = 'CREDITO';
        valor = Math.abs(valor);
      }

      // Extract description
      let desc = line
        .replace(rawDate, '')
        .replace(rawVal, '')
        .replace(/[DC\-\+]/g, '')
        .trim();

      if (desc.length < 3) {
        desc = `Lançamento Bancário ${rawDate}`;
      }

      if (valor > 0) {
        transactions.push({
          id: uuidv4(),
          data: formattedDate,
          descricao: desc,
          tipo,
          valor,
          documento: `DOC_${Math.floor(100000 + Math.random() * 900000)}`
        });
      }
    }
  }

  return transactions;
}
