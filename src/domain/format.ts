const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 123450 → "S/ 1,234.50" (formato peruano). */
export function formatSoles(cents: number): string {
  // Intl puede usar espacio duro; lo normalizamos a espacio simple.
  return soles.format(cents / 100).replace(/\u00a0/g, ' ');
}

/** Acepta "12", "12.5", "12,50", "1,234.50", "S/ 15" → céntimos. null si no es válido. */
export function parseMonto(input: string): number | null {
  let s = input.replace(/s\/?/gi, '').replace(/\s/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // coma decimal ("12,50") si tiene 1-2 dígitos después; si no, separador de miles
    const dec = s.length - lastComma - 1;
    s = dec <= 2 ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents > 0 ? cents : null;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. */
export function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Fecha local de hoy en 'AAAA-MM-DD'. */
export function hoyISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'AAAA-MM-DD' → 'AAAA-MM'. */
export const mesDe = (iso: string) => iso.slice(0, 7);

/** Suma (o resta) meses a 'AAAA-MM'. */
export function sumarMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** '2026-10' → 'Octubre 2026'. */
export function nombreMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return hoyISO(new Date(y, m - 1, d + dias));
}

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Respaldo para navegadores viejos / contextos no seguros
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
