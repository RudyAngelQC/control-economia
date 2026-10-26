import { COLECCIONES, type DatosSync, type SyncMeta } from './types';

/** JSON con claves ordenadas y sin valores undefined: dos registros iguales dan el mismo texto. */
export function canonico(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}

export const iguales = (a: unknown, b: unknown) => canonico(a) === canonico(b);

/**
 * Decide qué versión de un registro gana. Gana el updatedAt más reciente.
 * Empate exacto: gana el borrado (un tombstone nunca pierde contra una edición
 * simultánea); si siguen iguales, se compara el contenido para que todos los
 * dispositivos lleguen al mismo resultado. Si son idénticos devuelve `b`.
 */
export function ganador<T extends SyncMeta>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  if (!!a.deleted !== !!b.deleted) return a.deleted ? a : b;
  return canonico(a) > canonico(b) ? a : b;
}

export interface ResultadoMerge<T> {
  /** Unión de ambos lados con el ganador de cada id. */
  merged: T[];
  /** Registros remotos que deben escribirse en local (ganaron o no existían). */
  aplicarLocal: T[];
  /** true si el resultado difiere de lo remoto (hay que subir el archivo). */
  cambiaRemoto: boolean;
}

/** Merge por registro (no reemplazo del archivo completo). */
export function mergeColeccion<T extends SyncMeta>(local: T[], remoto: T[]): ResultadoMerge<T> {
  const mapa = new Map<string, T>();
  for (const r of remoto) mapa.set(r.id, r);
  const remotoPorId = new Map(mapa);
  const localPorId = new Map(local.map((l) => [l.id, l]));
  let cambiaRemoto = false;

  for (const l of local) {
    const r = mapa.get(l.id);
    if (!r) {
      mapa.set(l.id, l);
      cambiaRemoto = true;
      continue;
    }
    if (!iguales(l, r) && ganador(r, l) === l) {
      mapa.set(l.id, l);
      cambiaRemoto = true;
    }
  }

  const aplicarLocal: T[] = [];
  for (const [id, r] of remotoPorId) {
    const l = localPorId.get(id);
    if (!l || (!iguales(l, r) && ganador(l, r) === r)) aplicarLocal.push(r);
  }

  return { merged: [...mapa.values()], aplicarLocal, cambiaRemoto };
}

export interface ResultadoMergeDatos {
  merged: DatosSync;
  aplicarLocal: DatosSync;
  cambiaRemoto: boolean;
}

export function datosVacios(): DatosSync {
  return { movimientos: [], areas: [], reglas: [], presupuestos: [], guardias: [] };
}

export function mergeDatos(local: DatosSync, remoto: Partial<DatosSync>): ResultadoMergeDatos {
  const merged = datosVacios();
  const aplicarLocal = datosVacios();
  let cambiaRemoto = false;
  for (const c of COLECCIONES) {
    // Los tipos de cada colección son distintos; el merge es genérico sobre SyncMeta.
    const res = mergeColeccion<SyncMeta>(local[c], remoto[c] ?? []);
    (merged[c] as SyncMeta[]) = res.merged;
    (aplicarLocal[c] as SyncMeta[]) = res.aplicarLocal;
    if (res.cambiaRemoto) cambiaRemoto = true;
  }
  return { merged, aplicarLocal, cambiaRemoto };
}
