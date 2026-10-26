import type { Guardia, Movimiento, Presupuesto } from './types';
import { mesDe } from './format';

const vivos = <T extends { deleted?: boolean }>(xs: T[]) => xs.filter((x) => !x.deleted);

export interface ResumenMes {
  ingresos: number;
  gastos: number;
  saldo: number;
  /** Gastos reembolsables del mes cuya guardia aún no se cobró. */
  porCobrar: number;
  cantidad: number;
}

export function movimientosDelMes(movs: Movimiento[], mes: string): Movimiento[] {
  return vivos(movs).filter((m) => mesDe(m.fecha) === mes);
}

export function resumenMes(movs: Movimiento[], mes: string, guardias: Guardia[] = []): ResumenMes {
  const cobradas = new Set(vivos(guardias).filter((g) => g.estado === 'cobrada').map((g) => g.id));
  const delMes = movimientosDelMes(movs, mes);
  let ingresos = 0;
  let gastos = 0;
  let porCobrar = 0;
  for (const m of delMes) {
    if (m.tipo === 'ingreso') ingresos += m.montoCents;
    else {
      gastos += m.montoCents;
      if (m.reembolsable && !(m.guardiaId && cobradas.has(m.guardiaId))) porCobrar += m.montoCents;
    }
  }
  return { ingresos, gastos, saldo: ingresos - gastos, porCobrar, cantidad: delMes.length };
}

/** Suma de gastos agrupados por una clave, ordenados de mayor a menor. */
export function gastosPor(
  movs: Movimiento[],
  clave: (m: Movimiento) => string,
): { clave: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const m of vivos(movs)) {
    if (m.tipo !== 'gasto') continue;
    const k = clave(m);
    mapa.set(k, (mapa.get(k) ?? 0) + m.montoCents);
  }
  return [...mapa.entries()]
    .map(([clave, total]) => ({ clave, total }))
    .sort((a, b) => b.total - a.total);
}

/** Variación porcentual; null si el mes anterior fue 0 (no comparable). */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

// ---------- Presupuesto ----------

export type NivelPresupuesto = 'ok' | 'alerta' | 'excedido';

/** Amarillo desde el 80 %, rojo al pasar el 100 %. */
export function nivelPresupuesto(gastado: number, tope: number): NivelPresupuesto {
  if (tope <= 0) return 'ok';
  const pct = (gastado / tope) * 100;
  if (pct > 100) return 'excedido';
  if (pct >= 80) return 'alerta';
  return 'ok';
}

/** Tope vigente de un área en un mes: el ajuste del mes si existe, si no el tope por defecto. */
export function topeDelMes(presupuestos: Presupuesto[], areaId: string, mes: string): number | null {
  const ps = vivos(presupuestos).filter((p) => p.areaId === areaId);
  const delMes = ps.find((p) => p.mes === mes);
  if (delMes) return delMes.montoCents;
  const base = ps.find((p) => p.mes === null);
  return base ? base.montoCents : null;
}

/** Gasto personal (no reembolsable) por área en el mes: es lo que cuenta para el presupuesto. */
export function gastoPersonalPorArea(movs: Movimiento[], mes: string): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const m of movimientosDelMes(movs, mes)) {
    if (m.tipo !== 'gasto' || m.reembolsable) continue;
    const k = m.areaId ?? 'sin-clasificar';
    mapa.set(k, (mapa.get(k) ?? 0) + m.montoCents);
  }
  return mapa;
}

// ---------- Rendición de viáticos ----------

export interface Rendicion {
  items: Movimiento[];
  total: number;
  factura: number;
  boleta: number;
  /** Reembolsable sin comprobante (Yape/efectivo sin factura ni boleta). */
  sinSustento: number;
  /** Comprobantes marcados como "lo tengo físicamente". */
  fisicos: number;
  /** Cantidad de movimientos con comprobante (factura o boleta). */
  conComprobante: number;
  /** Ingresos "Reembolso viáticos" ligados a la guardia. */
  cobrado: number;
  pendiente: number;
}

export const AREA_REEMBOLSO = 'reembolso';

export function rendicion(movs: Movimiento[], guardia: Guardia): Rendicion {
  const deGuardia = vivos(movs).filter((m) => m.guardiaId === guardia.id);
  const items = deGuardia
    .filter((m) => m.tipo === 'gasto' && m.reembolsable)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.createdAt - b.createdAt);
  const r: Rendicion = {
    items,
    total: 0,
    factura: 0,
    boleta: 0,
    sinSustento: 0,
    fisicos: 0,
    conComprobante: 0,
    cobrado: 0,
    pendiente: 0,
  };
  for (const m of items) {
    r.total += m.montoCents;
    if (m.comprobante === 'factura') r.factura += m.montoCents;
    else if (m.comprobante === 'boleta') r.boleta += m.montoCents;
    else r.sinSustento += m.montoCents;
    if (m.comprobante !== 'ninguno') {
      r.conComprobante++;
      if (m.comprobanteFisico) r.fisicos++;
    }
  }
  r.cobrado = deGuardia
    .filter((m) => m.tipo === 'ingreso' && m.areaId === AREA_REEMBOLSO)
    .reduce((s, m) => s + m.montoCents, 0);
  r.pendiente = guardia.estado === 'cobrada' ? 0 : Math.max(0, r.total - r.cobrado);
  return r;
}

/** Guardia que contiene la fecha (si hay varias, la que empezó más tarde). */
export function guardiaParaFecha(guardias: Guardia[], fecha: string): Guardia | null {
  const candidatas = vivos(guardias)
    .filter((g) => g.inicio <= fecha && fecha <= g.fin)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  return candidatas[0] ?? null;
}
