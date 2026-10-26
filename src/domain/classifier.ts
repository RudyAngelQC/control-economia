import type { Regla } from './types';

/** Minúsculas, sin tildes ni signos, espacios colapsados. "Pensión  Junio!" → "pension junio". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * La palabra clave debe coincidir con palabras completas (admite plural -s/-es):
 * "pasaje" coincide con "pasajes a juliaca", pero "pan" no coincide con "pantalon".
 */
export function coincide(descripcionNorm: string, palabraNorm: string): boolean {
  if (!palabraNorm) return false;
  const re = new RegExp(`(^| )${escapeRegex(palabraNorm)}(s|es)?( |$)`);
  return re.test(descripcionNorm);
}

export interface Clasificacion {
  areaId: string;
  regla: Regla;
}

/**
 * Devuelve el área según las reglas. Si varias coinciden gana la palabra clave
 * más larga (más específica). Sin coincidencias o descripción vacía → null ("Sin clasificar").
 */
export function clasificar(descripcion: string, reglas: Regla[]): Clasificacion | null {
  const desc = normalizar(descripcion);
  if (!desc) return null;
  let mejor: { regla: Regla; len: number } | null = null;
  for (const regla of reglas) {
    if (regla.deleted) continue;
    const palabra = normalizar(regla.palabra);
    if (!coincide(desc, palabra)) continue;
    if (
      !mejor ||
      palabra.length > mejor.len ||
      // empate: orden alfabético para que el resultado sea determinista
      (palabra.length === mejor.len && palabra < normalizar(mejor.regla.palabra))
    ) {
      mejor = { regla, len: palabra.length };
    }
  }
  return mejor ? { areaId: mejor.regla.areaId, regla: mejor.regla } : null;
}

/** Sugiere una palabra clave a partir de la descripción (la palabra más larga). */
export function sugerirPalabra(descripcion: string): string {
  const palabras = normalizar(descripcion)
    .split(' ')
    .filter((p) => p.length >= 3 && !/^\d+$/.test(p));
  return palabras.sort((a, b) => b.length - a.length)[0] ?? '';
}
