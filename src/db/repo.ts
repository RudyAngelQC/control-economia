import { db } from './db';
import type { Coleccion, DatosSync, Movimiento, Regla, SyncMeta } from '../domain/types';
import { COLECCIONES } from '../domain/types';
import { clasificar, coincide, normalizar } from '../domain/classifier';
import { ganador, iguales } from '../domain/merge';

/** Avisa al motor de sincronización que hay cambios locales. */
export const EVENTO_CAMBIOS = 'datos-cambiados';
function avisarCambios() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_CAMBIOS));
}

const tabla = (c: Coleccion) => db.table<SyncMeta, string>(c);

/**
 * Guarda registros: pone updatedAt (estrictamente creciente por registro) y deja
 * cada uno en la cola de pendientes para Drive.
 */
export async function guardar<T extends SyncMeta>(coleccion: Coleccion, registros: T[]): Promise<T[]> {
  if (!registros.length) return [];
  const t = tabla(coleccion);
  const out: T[] = [];
  await db.transaction('rw', t, db.pendientes, async () => {
    const now = Date.now();
    const previos = await t.bulkGet(registros.map((r) => r.id));
    registros.forEach((r, i) => {
      const prev = previos[i];
      out.push({ ...r, updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1) });
    });
    await t.bulkPut(out);
    await db.pendientes.bulkPut(
      out.map((r) => ({ key: `${coleccion}:${r.id}`, coleccion, id: r.id, updatedAt: r.updatedAt })),
    );
  });
  avisarCambios();
  return out;
}

export async function guardarUno<T extends SyncMeta>(coleccion: Coleccion, registro: T): Promise<T> {
  return (await guardar(coleccion, [registro]))[0];
}

/** Borrado lógico (tombstone): el registro viaja a Drive con deleted: true. */
export async function borrar(coleccion: Coleccion, ids: string[]): Promise<void> {
  const actuales = (await tabla(coleccion).bulkGet(ids)).filter((x): x is SyncMeta => !!x);
  await guardar(
    coleccion,
    actuales.map((r) => ({ ...r, deleted: true })),
  );
}

/** Asigna el área automática salvo que el usuario la haya fijado a mano. */
export function aplicarClasificacion(m: Movimiento, reglas: Regla[]): Movimiento {
  if (m.areaManual) return m;
  return { ...m, areaId: clasificar(m.descripcion, reglas)?.areaId ?? null };
}

/**
 * Tras crear una regla nueva, clasifica los movimientos "Sin clasificar" que
 * coinciden con ella. Devuelve cuántos se actualizaron.
 */
export async function aplicarReglaASinClasificar(regla: Regla): Promise<number> {
  const palabra = normalizar(regla.palabra);
  const candidatos = (await db.movimientos.toArray()).filter(
    (m) => !m.deleted && m.areaId === null && coincide(normalizar(m.descripcion), palabra),
  );
  await guardar(
    'movimientos',
    candidatos.map((m) => ({ ...m, areaId: regla.areaId })),
  );
  return candidatos.length;
}

/** Todos los registros (incluidos tombstones), para sincronizar o exportar. */
export async function leerTodo(): Promise<DatosSync> {
  const [movimientos, areas, reglas, presupuestos, guardias] = await Promise.all([
    db.movimientos.toArray(),
    db.areas.toArray(),
    db.reglas.toArray(),
    db.presupuestos.toArray(),
    db.guardias.toArray(),
  ]);
  return { movimientos, areas, reglas, presupuestos, guardias };
}

/**
 * Escribe en local registros que vienen de afuera (Drive o un archivo importado).
 * Vuelve a comparar dentro de la transacción para no pisar una edición local
 * hecha mientras se descargaba. Si `marcarPendiente`, también los encola para subir.
 */
export async function aplicarExternos(datos: DatosSync, marcarPendiente = false): Promise<number> {
  let n = 0;
  for (const c of COLECCIONES) {
    const entrantes = datos[c] as SyncMeta[];
    if (!entrantes.length) continue;
    const t = tabla(c);
    await db.transaction('rw', t, db.pendientes, async () => {
      const actuales = await t.bulkGet(entrantes.map((r) => r.id));
      const aEscribir = entrantes.filter((r, i) => {
        const a = actuales[i];
        return !a || (!iguales(a, r) && ganador(a, r) === r);
      });
      await t.bulkPut(aEscribir);
      if (marcarPendiente) {
        await db.pendientes.bulkPut(
          aEscribir.map((r) => ({ key: `${c}:${r.id}`, coleccion: c, id: r.id, updatedAt: r.updatedAt })),
        );
      }
      n += aEscribir.length;
    });
  }
  if (marcarPendiente && n) avisarCambios();
  return n;
}
