/**
 * PIX EMVCo BR Code Engine & CRC16-CCITT Validator
 * Implements Banco Central do Brasil (BCB) BR Code Specification
 */

/**
 * Computes CRC16-CCITT (False: 0xFFFF initial, 0x1021 polynomial, 0x0000 xorOut)
 * @param {string} payload - String payload ending with "6304"
 * @returns {string} 4-character uppercase hexadecimal checksum
 */
export function calculateCRC16(payload) {
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

/**
 * Formats a single EMV TLV (Tag-Length-Value) element
 * @param {string} id - 2-digit tag ID
 * @param {string} value - String value
 * @returns {string} Formatted TLV string
 */
export function formatTLV(id, value) {
  if (value === undefined || value === null) return '';
  const valStr = String(value);
  const len = Buffer.byteLength(valStr, 'utf8').toString().padStart(2, '0');
  return `${id}${len}${valStr}`;
}

/**
 * Generates an EMVCo compliant PIX Static or Dynamic Payload
 * @param {Object} params
 * @param {string} params.pixKey - Chave PIX (CNPJ, CPF, Email, Phone, EVP)
 * @param {string} params.merchantName - Nome do Beneficiário (max 25 chars)
 * @param {string} params.merchantCity - Cidade do Beneficiário (max 15 chars)
 * @param {number} [params.amount] - Valor da transação em Reais (BRL)
 * @param {string} [params.txid='***'] - Identificador da transação
 * @param {string} [params.description] - Mensagem descritiva (subtag 02)
 * @returns {string} Full EMVCo PIX Copia-e-Cola string with valid CRC16
 */
export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txid = '***',
  description
}) {
  // Normalize strings (remove accents, trim length)
  const normName = (merchantName || 'VIACONT CONTABILIDADE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);

  const normCity = (merchantCity || 'SALVADOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);

  let payload = '';

  // 00: Payload Format Indicator
  payload += formatTLV('00', '01');

  // 01: Point of Initiation (11 = static, 12 = dynamic)
  payload += formatTLV('01', '12');

  // 26: Merchant Account Information (PIX)
  let mai = formatTLV('00', 'br.gov.bcb.pix');
  mai += formatTLV('01', pixKey);
  if (description) {
    mai += formatTLV('02', description.slice(0, 25));
  }
  payload += formatTLV('26', mai);

  // 52: Merchant Category Code (0000 or specific)
  payload += formatTLV('52', '0000');

  // 53: Transaction Currency (986 = BRL)
  payload += formatTLV('53', '986');

  // 54: Transaction Amount (optional for static, required for fixed guides)
  if (amount !== undefined && amount !== null && amount > 0) {
    payload += formatTLV('54', Number(amount).toFixed(2));
  }

  // 58: Country Code
  payload += formatTLV('58', 'BR');

  // 59: Merchant Name
  payload += formatTLV('59', normName);

  // 60: Merchant City
  payload += formatTLV('60', normCity);

  // 62: Additional Data Field Template (TxID)
  const cleanTxId = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';
  const addData = formatTLV('05', cleanTxId);
  payload += formatTLV('62', addData);

  // 63: CRC16 Container Tag & Placeholder
  const payloadWithCrcTag = payload + '6304';
  const crc = calculateCRC16(payloadWithCrcTag);

  return payloadWithCrcTag + crc;
}

/**
 * Parses and verifies an EMVCo PIX payload
 * @param {string} payload - Full PIX BR Code string
 * @returns {Object} Parsed TLV map and validity status
 */
export function parseAndValidatePixPayload(payload) {
  if (!payload || typeof payload !== 'string' || payload.length < 20) {
    return { valid: false, error: 'Payload must be a non-empty string with minimum 20 chars' };
  }

  if (!payload.startsWith('000201')) {
    return { valid: false, error: 'Payload must start with Payload Format Indicator 000201' };
  }

  // Verify CRC16
  const payloadWithoutCrc = payload.slice(0, -4);
  const expectedCrc = payload.slice(-4);
  const computedCrc = calculateCRC16(payloadWithoutCrc);

  if (computedCrc.toUpperCase() !== expectedCrc.toUpperCase()) {
    return {
      valid: false,
      error: `CRC16 mismatch: expected ${expectedCrc} but computed ${computedCrc}`
    };
  }

  // Parse top-level tags
  const tags = {};
  let idx = 0;
  while (idx < payloadWithoutCrc.length) {
    const tag = payload.slice(idx, idx + 2);
    const len = parseInt(payload.slice(idx + 2, idx + 4), 10);
    if (isNaN(len)) break;
    const val = payload.slice(idx + 4, idx + 4 + len);
    tags[tag] = val;
    idx += 4 + len;
  }

  return {
    valid: true,
    tags,
    crc: expectedCrc,
    amount: tags['54'] ? parseFloat(tags['54']) : null,
    merchantName: tags['59'],
    merchantCity: tags['60']
  };
}
