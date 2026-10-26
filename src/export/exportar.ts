import type { Area, DatosSync, Guardia, Movimiento } from '../domain/types';
import { labelComprobante, labelMedio } from '../domain/types';
import { formatFecha, hoyISO, nuevoId, parseMonto } from '../domain/format';
import type { Rendicion } from '../domain/totals';
import { armarArchivo } from '../sync/engine';
import type { ArchivoSync } from '../sync/drive';

// SheetJS pesa ~400 KB: se carga solo al exportar (queda en caché offline igual).
const cargarXlsx = () => import('xlsx');

export function descargar(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const soles = (cents: number) => Math.round(cents) / 100;
const FMT_SOLES = '"S/" #,##0.00';

type Hoja = import('xlsx').WorkSheet;

function formatoSoles(XLSX: typeof import('xlsx'), ws: Hoja, columnas: number[], desdeFila = 1) {
  const rango = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = desdeFila; r <= rango.e.r; r++) {
    for (const c of columnas) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'number') cell.z = FMT_SOLES;
    }
  }
}

/** Rendición de una guardia: descarga el .xlsx. */
export async function exportarRendicionXlsx(
  guardia: Guardia,
  r: Rendicion,
  areaNombre: (id: string | null) => string,
) {
  const XLSX = await cargarXlsx();
  const wb = await libroRendicion(guardia, r, areaNombre);
  XLSX.writeFile(wb, `rendicion-${guardia.nombre.replace(/[^\w-]+/g, '_')}.xlsx`);
}

/** Arma el libro de la rendición: detalle de movimientos + resumen de totales. */
export async function libroRendicion(
  guardia: Guardia,
  r: Rendicion,
  areaNombre: (id: string | null) => string,
) {
  const XLSX = await cargarXlsx();
  const encabezado = ['Fecha', 'Descripción', 'Área', 'Medio de pago', 'Comprobante', 'RUC', 'N° comprobante', 'Monto (S/)', 'Sustento', 'Físico', 'Nota'];
  const filas = r.items.map((m) => [
    formatFecha(m.fecha),
    m.descripcion,
    areaNombre(m.areaId),
    labelMedio(m.medio),
    labelComprobante(m.comprobante),
    m.ruc ?? '',
    m.nroComprobante ?? '',
    soles(m.montoCents),
    m.comprobante === 'ninguno' ? 'SIN SUSTENTO' : 'Sustentado',
    m.comprobante === 'ninguno' ? '' : m.comprobanteFisico ? 'Sí' : 'No',
    m.nota ?? '',
  ]);
  const aoa: (string | number)[][] = [
    [`Rendición de viáticos — ${guardia.nombre}`],
    [`Del ${formatFecha(guardia.inicio)} al ${formatFecha(guardia.fin)}`],
    [],
    encabezado,
    ...filas,
    [],
    ['Resumen'],
    ['Con factura', soles(r.factura)],
    ['Con boleta', soles(r.boleta)],
    ['Sin sustento', soles(r.sinSustento)],
    ['Total reembolsable', soles(r.total)],
    ['Cobrado', soles(r.cobrado)],
    ['Pendiente de cobro', soles(r.pendiente)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [10, 32, 18, 14, 14, 13, 16, 12, 14, 7, 24].map((wch) => ({ wch }));
  formatoSoles(XLSX, ws, [7], 4);
  formatoSoles(XLSX, ws, [1], 4 + filas.length + 2);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rendición');
  return wb;
}

const COLS_MOV = ['ID', 'Fecha', 'Tipo', 'Descripción', 'Área', 'Medio de pago', 'Comprobante', 'Monto (S/)', 'Reembolsable', 'Guardia', 'RUC', 'N° comprobante', 'Nota'] as const;

/** Todos los movimientos en Excel (plan B legible). */
export async function exportarMovimientosXlsx(movs: Movimiento[], areas: Area[], guardias: Guardia[]) {
  const XLSX = await cargarXlsx();
  const area = new Map(areas.map((a) => [a.id, a.nombre]));
  const guardia = new Map(guardias.map((g) => [g.id, g.nombre]));
  const filas = movs
    .filter((m) => !m.deleted)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => [
      m.id,
      formatFecha(m.fecha),
      m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
      m.descripcion,
      m.areaId ? (area.get(m.areaId) ?? '') : 'Sin clasificar',
      labelMedio(m.medio),
      labelComprobante(m.comprobante),
      soles(m.montoCents),
      m.reembolsable ? 'Sí' : 'No',
      m.guardiaId ? (guardia.get(m.guardiaId) ?? '') : '',
      m.ruc ?? '',
      m.nroComprobante ?? '',
      m.nota ?? '',
    ]);
  const ws = XLSX.utils.aoa_to_sheet([[...COLS_MOV], ...filas]);
  ws['!cols'] = [8, 11, 8, 30, 18, 14, 15, 12, 12, 18, 13, 16, 24].map((wch) => ({ wch }));
  formatoSoles(XLSX, ws, [7]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, `movimientos-${hoyISO()}.xlsx`);
}

/**
 * Importa movimientos desde un Excel con las columnas de la exportación.
 * Filas con ID existente actualizan ese movimiento; sin ID, crean uno nuevo.
 */
export async function importarMovimientosXlsx(
  file: File,
  areas: Area[],
  guardias: Guardia[],
): Promise<{ movimientos: Movimiento[]; errores: string[] }> {
  const XLSX = await cargarXlsx();
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: '' });
  const areaPorNombre = new Map(areas.map((a) => [a.nombre.toLowerCase(), a.id]));
  const guardiaPorNombre = new Map(guardias.map((g) => [g.nombre.toLowerCase(), g.id]));
  const medio = (s: string) =>
    (['yape', 'efectivo', 'transferencia', 'tarjeta'] as const).find((m) => s.toLowerCase().startsWith(m)) ?? 'efectivo';
  const comp = (s: string) =>
    s.toLowerCase().startsWith('fact') ? 'factura' : s.toLowerCase().startsWith('bol') ? 'boleta' : 'ninguno';
  const movimientos: Movimiento[] = [];
  const errores: string[] = [];
  filas.forEach((f, i) => {
    const txt = (k: (typeof COLS_MOV)[number]) => String(f[k] ?? '').trim();
    const fechaTxt = txt('Fecha');
    const fm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fechaTxt);
    const monto = typeof f['Monto (S/)'] === 'number' ? Math.round((f['Monto (S/)'] as number) * 100) : parseMonto(txt('Monto (S/)'));
    if (!fm || !monto) {
      errores.push(`Fila ${i + 2}: fecha (DD/MM/AAAA) o monto inválido`);
      return;
    }
    const areaTxt = txt('Área').toLowerCase();
    movimientos.push({
      id: txt('ID') || nuevoId(),
      updatedAt: 0,
      createdAt: Date.now() + i,
      fecha: `${fm[3]}-${fm[2].padStart(2, '0')}-${fm[1].padStart(2, '0')}`,
      tipo: txt('Tipo').toLowerCase().startsWith('ing') ? 'ingreso' : 'gasto',
      descripcion: txt('Descripción'),
      areaId: areaPorNombre.get(areaTxt) ?? null,
      areaManual: areaPorNombre.has(areaTxt),
      medio: medio(txt('Medio de pago')),
      comprobante: comp(txt('Comprobante')),
      montoCents: monto,
      reembolsable: /^s[ií]/i.test(txt('Reembolsable')),
      guardiaId: guardiaPorNombre.get(txt('Guardia').toLowerCase()) ?? null,
      ruc: txt('RUC') || undefined,
      nroComprobante: txt('N° comprobante') || undefined,
      nota: txt('Nota') || undefined,
      comprobanteFisico: false,
    });
  });
  return { movimientos, errores };
}

export function exportarJson(datos: DatosSync) {
  const blob = new Blob([JSON.stringify(armarArchivo(datos), null, 2)], { type: 'application/json' });
  descargar(`control-economia-${hoyISO()}.json`, blob);
}

export async function leerJson(file: File): Promise<DatosSync> {
  const parsed = JSON.parse(await file.text()) as Partial<ArchivoSync>;
  if (parsed.app !== 'control-economia' || !parsed.datos) {
    throw new Error('El archivo no es un respaldo de Control Economía');
  }
  const d = parsed.datos;
  return {
    movimientos: d.movimientos ?? [],
    areas: d.areas ?? [],
    reglas: d.reglas ?? [],
    presupuestos: d.presupuestos ?? [],
    guardias: d.guardias ?? [],
  };
}
