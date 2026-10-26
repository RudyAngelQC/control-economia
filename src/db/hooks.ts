import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db, getMeta, setMeta } from './db';
import type { Area, Guardia, Movimiento, Presupuesto, Regla } from '../domain/types';
import { AREA_SIN_CLASIFICAR } from '../domain/seeds';

const VACIO: never[] = [];

export function useMovimientos(): Movimiento[] {
  return (
    useLiveQuery(async () => {
      const xs = await db.movimientos.toArray();
      return xs
        .filter((m) => !m.deleted)
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt - a.createdAt);
    }) ?? VACIO
  );
}

export function useAreas(): Area[] {
  return (
    useLiveQuery(async () =>
      (await db.areas.toArray()).filter((a) => !a.deleted).sort((a, b) => a.orden - b.orden),
    ) ?? VACIO
  );
}

/** Mapa id → área, con "Sin clasificar" para null. */
export function useAreaLookup() {
  const areas = useAreas();
  return useMemo(() => {
    const mapa = new Map(areas.map((a) => [a.id, a]));
    return (id: string | null) => {
      const a = id ? mapa.get(id) : undefined;
      return a ?? { ...AREA_SIN_CLASIFICAR, orden: 999, updatedAt: 0 };
    };
  }, [areas]);
}

export function useReglas(): Regla[] {
  return (
    useLiveQuery(async () =>
      (await db.reglas.toArray()).filter((r) => !r.deleted).sort((a, b) => a.palabra.localeCompare(b.palabra)),
    ) ?? VACIO
  );
}

export function useGuardias(): Guardia[] {
  return (
    useLiveQuery(async () =>
      (await db.guardias.toArray()).filter((g) => !g.deleted).sort((a, b) => b.inicio.localeCompare(a.inicio)),
    ) ?? VACIO
  );
}

export function usePresupuestos(): Presupuesto[] {
  return useLiveQuery(async () => (await db.presupuestos.toArray()).filter((p) => !p.deleted)) ?? VACIO;
}

export function usePendientes(): number {
  return useLiveQuery(() => db.pendientes.count()) ?? 0;
}

/** Valor de configuración local (no se sincroniza). */
export function useMeta<T>(key: string, def: T): [T, (v: T) => Promise<void>, boolean] {
  const row = useLiveQuery(async () => ({ v: await getMeta<T>(key, def) }), [key]);
  const set = useCallback((v: T) => setMeta(key, v), [key]);
  return [row ? row.v : def, set, row !== undefined];
}
