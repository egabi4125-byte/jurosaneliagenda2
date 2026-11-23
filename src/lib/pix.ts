import QRCode from 'qrcode';

export type PixKeyType =
  | 'CPF'
  | 'CNPJ'
  | 'Celular'
  | 'E-mail'
  | 'Chave Aleatória'
  | 'Personalizada';

export interface NormalizedPixKey {
  normalized: string;
  type: PixKeyType;
  valid: boolean;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePixKey(rawKey: string): NormalizedPixKey {
  const trimmed = (rawKey || '').trim();
  if (!trimmed) {
    return { normalized: '', type: 'Personalizada', valid: false };
  }

  // Email
  if (EMAIL_REGEX.test(trimmed)) {
    return {
      normalized: trimmed.toLowerCase(),
      type: 'E-mail',
      valid: true,
    };
  }

  // UUID / Random Key
  if (UUID_REGEX.test(trimmed)) {
    return {
      normalized: trimmed.toLowerCase(),
      type: 'Chave Aleatória',
      valid: true,
    };
  }

  // Phone with explicit +55 or formatted phone with DDD (10-11 digits starting with DDD + 9)
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    const cleaned = '+' + digits;
    if (cleaned.length >= 13 && cleaned.length <= 15) {
      return { normalized: cleaned, type: 'Celular', valid: true };
    }
  }

  // Formatted phone indicator: parentheses or starts with 55 and 13 digits
  const hasPhoneHint = /[()+\s-]/.test(trimmed) && !trimmed.includes('.');
  if (digits.length === 13 && digits.startsWith('55')) {
    return { normalized: `+${digits}`, type: 'Celular', valid: true };
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return { normalized: `+${digits}`, type: 'Celular', valid: true };
  }

  // CNPJ: 14 digits
  if (digits.length === 14) {
    return { normalized: digits, type: 'CNPJ', valid: true };
  }

  // CPF vs Celular (both have 11 digits)
  if (digits.length === 11) {
    // If formatted with dots (000.000.000-00), definitely CPF
    if (trimmed.includes('.')) {
      return { normalized: digits, type: 'CPF', valid: true };
    }
    // If formatted like (11) 99999-9999 or third digit is 9 with phone formatting
    if (hasPhoneHint && digits[2] === '9') {
      return { normalized: `+55${digits}`, type: 'Celular', valid: true };
    }
    // Validate CPF check digits to distinguish unformatted CPF vs cell phone
    if (isValidCpfDigits(digits)) {
      return { normalized: digits, type: 'CPF', valid: true };
    }
    // If not valid CPF and 3rd digit is 9, treat as Brazilian mobile phone
    if (digits[2] === '9') {
      return { normalized: `+55${digits}`, type: 'Celular', valid: true };
    }
    return { normalized: digits, type: 'CPF', valid: true };
  }

  if (digits.length === 10 && hasPhoneHint) {
    return { normalized: `+55${digits}`, type: 'Celular', valid: true };
  }

  return { normalized: trimmed, type: 'Personalizada', valid: trimmed.length >= 3 };
}

function isValidCpfDigits(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(cpf.charAt(10), 10);
}

function stripDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s.-]/g, '')
    .trim();
}

function formatEmvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * CRC16-CCITT (polynomial 0x1021, initial value 0xFFFF) per EMVCo / BCB Pix specification.
 */
export function computeCrc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixPayloadInput {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
  description?: string;
}

export interface PixPayloadResult {
  payload: string;
  normalizedKey: string;
  keyType: PixKeyType;
  valid: boolean;
  txid: string;
}

export function generatePixBrCode(input: PixPayloadInput): PixPayloadResult {
  const { normalized, type, valid } = normalizePixKey(input.pixKey);

  const sanitizedName = (stripDiacritics(input.merchantName || 'JU NAIL DESIGNER') || 'JU NAIL DESIGNER')
    .toUpperCase()
    .slice(0, 25);

  const sanitizedCity = (stripDiacritics(input.merchantCity || 'SAO PAULO') || 'SAO PAULO')
    .toUpperCase()
    .slice(0, 15);

  const rawTxid = (input.txid || 'JUNAILDESIGNER')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 25);
  const txid = rawTxid || '***';

  if (!valid || !normalized) {
    return {
      payload: '',
      normalizedKey: '',
      keyType: type,
      valid: false,
      txid,
    };
  }

  // Merchant Account Information (ID 26)
  const gui = formatEmvField('00', 'br.gov.bcb.pix');
  const keyField = formatEmvField('01', normalized);
  const descClean = input.description
    ? stripDiacritics(input.description).slice(0, 40)
    : '';
  const descField = descClean ? formatEmvField('02', descClean) : '';
  const merchantAccountInfo = formatEmvField('26', `${gui}${keyField}${descField}`);

  const payloadParts: string[] = [
    formatEmvField('00', '01'), // Payload Format Indicator
    merchantAccountInfo,
    formatEmvField('52', '0000'), // Merchant Category Code
    formatEmvField('53', '986'), // Currency (BRL = 986)
  ];

  if (typeof input.amount === 'number' && input.amount > 0) {
    payloadParts.push(formatEmvField('54', input.amount.toFixed(2)));
  }

  payloadParts.push(
    formatEmvField('58', 'BR'), // Country Code
    formatEmvField('59', sanitizedName),
    formatEmvField('60', sanitizedCity),
    formatEmvField('62', formatEmvField('05', txid))
  );

  const withoutCrc = `${payloadParts.join('')}6304`;
  const crc = computeCrc16Ccitt(withoutCrc);

  return {
    payload: `${withoutCrc}${crc}`,
    normalizedKey: normalized,
    keyType: type,
    valid: true,
    txid,
  };
}

export async function generatePixQrDataUrl(payload: string): Promise<string> {
  if (!payload) return '';
  return QRCode.toDataURL(payload, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#16141C',
      light: '#FFFFFF',
    },
  });
}
