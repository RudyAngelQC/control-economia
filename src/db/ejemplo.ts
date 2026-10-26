import { db } from './db';
import { aplicarClasificacion, borrar, guardar } from './repo';
import type { Comprobante, Guardia, MedioPago, Movimiento, Tipo } from '../domain/types';
import { hoyISO, nuevoId, sumarDias } from '../domain/format';

type Fila = [dias: number, tipo: Tipo, desc: string, soles: number, medio: MedioPago, comp: Comprobante, reemb: boolean, guardia: 'actual' | 'anterior' | null];

const FILAS: Fila[] = [
  [-40, 'ingreso', 'Sueldo', 5200, 'transferencia', 'ninguno', false, null],
  [-36, 'gasto', 'Pasaje Juliaca', 45, 'yape', 'boleta', true, 'anterior'],
  [-35, 'gasto', 'Menú en Juliaca', 15, 'yape', 'ninguno', true, 'anterior'],
  [-33, 'gasto', 'Guantes de nitrilo', 38, 'efectivo', 'factura', true, 'anterior'],
  [-31, 'gasto', 'Pensión del mes', 450, 'transferencia', 'ninguno', false, null],
  [-28, 'gasto', 'Inkafarma ibuprofeno', 12.5, 'yape', 'boleta', false, null],
  [-25, 'ingreso', 'Reembolso viáticos', 98, 'transferencia', 'ninguno', false, 'anterior'],
  [-10, 'ingreso', 'Sueldo', 5200, 'transferencia', 'ninguno', false, null],
  [-9, 'gasto', 'Cuota préstamo', 680, 'transferencia', 'ninguno', false, null],
  [-6, 'gasto', 'Pasaje bus a Juliaca', 50, 'yape', 'boleta', true, 'actual'],
  [-6, 'gasto', 'Taxi terminal', 15, 'yape', 'ninguno', true, 'actual'],
  [-5, 'gasto', 'Almuerzo pollería', 28, 'yape', 'factura', true, 'actual'],
  [-4, 'gasto', 'Chaleco reflectivo', 65, 'efectivo', 'factura', true, 'actual'],
  [-4, 'gasto', 'Recarga Claro', 30, 'yape', 'ninguno', false, null],
  [-3, 'gasto', 'Lavandería', 20, 'efectivo', 'ninguno', false, null],
  [-2, 'gasto', 'Cena chifa', 32, 'yape', 'ninguno', true, 'actual'],
  [-1, 'gasto', 'Netflix', 44.9, 'tarjeta', 'ninguno', false, null],
  [0, 'gasto', 'Grifo gasolina', 120, 'tarjeta', 'boleta', false, null],
];

export async function cargarEjemplo(): Promise<void> {
  const hoy = hoyISO();
  const guardias: Guardia[] = [
    { id: nuevoId(), nombre: 'Guardia ejemplo anterior', inicio: sumarDias(hoy, -37), fin: sumarDias(hoy, -24), estado: 'cobrada', updatedAt: 0, ejemplo: true },
    { id: nuevoId(), nombre: 'Guardia ejemplo actual', inicio: sumarDias(hoy, -7), fin: sumarDias(hoy, 6), estado: 'abierta', updatedAt: 0, ejemplo: true },
  ];
  const reglas = (await db.reglas.toArray()).filter((r) => !r.deleted);
  const movs: Movimiento[] = FILAS.map(([dias, tipo, descripcion, soles, medio, comprobante, reembolsable, g], i) =>
    aplicarClasificacion(
      {
        id: nuevoId(),
        updatedAt: 0,
        createdAt: Date.now() + i,
        fecha: sumarDias(hoy, dias),
        tipo,
        descripcion,
        montoCents: Math.round(soles * 100),
        medio,
        comprobante,
        reembolsable,
        guardiaId: g === 'actual' ? guardias[1].id : g === 'anterior' ? guardias[0].id : null,
        areaId: null,
        areaManual: false,
        comprobanteFisico: comprobante !== 'ninguno' && i % 2 === 0,
        ejemplo: true,
      },
      reglas,
    ),
  );
  await guardar('guardias', guardias);
  await guardar('movimientos', movs);
}

export async function hayEjemplo(): Promise<boolean> {
  return (await db.movimientos.filter((m) => !!m.ejemplo && !m.deleted).count()) > 0;
}

export async function borrarEjemplo(): Promise<void> {
  const movs = await db.movimientos.filter((m) => !!m.ejemplo && !m.deleted).primaryKeys();
  const gs = await db.guardias.filter((g) => !!g.ejemplo && !g.deleted).primaryKeys();
  await borrar('movimientos', movs);
  await borrar('guardias', gs);
}
