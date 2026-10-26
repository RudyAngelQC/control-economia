import Dexie, { type Table } from 'dexie';
import type { Area, Coleccion, Guardia, Movimiento, Presupuesto, Regla } from '../domain/types';
import { AREAS_SEMILLA, REGLAS_SEMILLA } from '../domain/seeds';

/** Cambio local que aún no llegó a Drive. Una entrada por registro (se sobrescribe). */
export interface Pendiente {
  key: string; // `${coleccion}:${id}`
  coleccion: Coleccion;
  id: string;
  updatedAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class EconomiaDB extends Dexie {
  movimientos!: Table<Movimiento, string>;
  areas!: Table<Area, string>;
  reglas!: Table<Regla, string>;
  presupuestos!: Table<Presupuesto, string>;
  guardias!: Table<Guardia, string>;
  pendientes!: Table<Pendiente, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('control-economia');
    this.version(1).stores({
      movimientos: 'id, fecha, guardiaId, areaId',
      areas: 'id',
      reglas: 'id',
      presupuestos: 'id, areaId',
      guardias: 'id, inicio',
      pendientes: 'key',
      meta: 'key',
    });
  }
}

export const db = new EconomiaDB();

export async function getMeta<T>(key: string, def: T): Promise<T> {
  const row = await db.meta.get(key);
  return row === undefined ? def : (row.value as T);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/**
 * Siembra áreas y reglas iniciales una sola vez. No genera pendientes: se suben
 * en la primera sincronización y, en un celular nuevo, coinciden por id con Drive.
 */
export async function sembrarSiHaceFalta(): Promise<void> {
  if (await getMeta('sembrado', false)) return;
  await db.transaction('rw', db.areas, db.reglas, db.meta, async () => {
    const areasExist = new Set(await db.areas.toCollection().primaryKeys());
    const reglasExist = new Set(await db.reglas.toCollection().primaryKeys());
    await db.areas.bulkPut(AREAS_SEMILLA.filter((a) => !areasExist.has(a.id)));
    await db.reglas.bulkPut(REGLAS_SEMILLA.filter((r) => !reglasExist.has(r.id)));
    await db.meta.put({ key: 'sembrado', value: true });
  });
}
