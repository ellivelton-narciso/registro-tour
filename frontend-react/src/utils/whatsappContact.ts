/** Países / DDIs usados na comunidade Subway (+ alguns comuns). */
export const WHATSAPP_COUNTRY_OPTIONS = [
  { value: '55', label: 'Brasil (+55)' },
  { value: '351', label: 'Portugal (+351)' },
  { value: '1', label: 'EUA/Canadá (+1)' },
  { value: '54', label: 'Argentina (+54)' },
  { value: '34', label: 'Espanha (+34)' },
  { value: '44', label: 'Reino Unido (+44)' },
  { value: '49', label: 'Alemanha (+49)' },
  { value: '33', label: 'França (+33)' },
  { value: '39', label: 'Itália (+39)' },
  { value: '52', label: 'México (+52)' },
  { value: '56', label: 'Chile (+56)' },
  { value: '57', label: 'Colômbia (+57)' },
  { value: '595', label: 'Paraguai (+595)' },
  { value: '598', label: 'Uruguai (+598)' },
] as const;

export type WhatsappCountryCode = (typeof WHATSAPP_COUNTRY_OPTIONS)[number]['value'];

export const DEFAULT_WHATSAPP_COUNTRY: WhatsappCountryCode = '55';

const COUNTRY_CODES = new Set<string>(WHATSAPP_COUNTRY_OPTIONS.map((o) => o.value));

export function parseWhatsappCountryCode(value: string): WhatsappCountryCode {
  if (COUNTRY_CODES.has(value)) return value as WhatsappCountryCode;
  return DEFAULT_WHATSAPP_COUNTRY;
}

/** Mantém apenas dígitos no número local (sem DDI). */
export function sanitizeLocalWhatsappNumber(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/**
 * Monta o valor canônico para `players.email`, compatível com `!who`:
 * `+{DDI}{digitos}` sem espaços/hífens.
 */
export function buildWhatsappContact(ddi: string, localNumber: string): string | null {
  const country = sanitizeLocalWhatsappNumber(ddi);
  const local = sanitizeLocalWhatsappNumber(localNumber);
  if (!country || !local) return null;

  // Evita DDI duplicado se o usuário colar o número internacional no campo local
  let national = local;
  if (national.startsWith(country) && national.length > country.length + 6) {
    national = national.slice(country.length);
  }

  if (national.length < 8 || national.length > 15) return null;

  const full = `${country}${national}`;
  if (full.length > 15) return null;

  return `+${full}`;
}

export function validateWhatsappContact(ddi: string, localNumber: string): string | null {
  const contact = buildWhatsappContact(ddi, localNumber);
  if (!contact) {
    return 'Informe um número de WhatsApp válido (só dígitos, com DDI do país).';
  }
  return null;
}
