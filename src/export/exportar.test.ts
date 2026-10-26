import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { libroRendicion } from './exportar';
import { rendicion } from '../domain/totals';
import type { Guardia, Movimiento } from '../domain/types';

const guardia: Guardia = { id: 'g', nombre: 'Guardia 1', inicio: '2026-10-01', fin: '2026-10-14', estado: 'abierta', updatedAt: 1 };
const base = { updatedAt: 1, createdAt: 1, tipo: 'gasto', reembolsable: true, guardiaId: 'g', areaId: 'alimentacion', areaManual: false, comprobanteFisico: false } as const;
const movs: Movimiento[] = [
  { ...base, id: '1', fecha: '2026-10-02', medio: 'yape', comprobante: 'factura', montoCents: 2800, descripcion: 'Almuerzo', ruc: '20123456789', nroComprobante: 'F001-1' },
  { ...base, id: '2', fecha: '2026-10-03', medio: 'efectivo', comprobante: 'ninguno', montoCents: 1500, descripcion: 'Taxi' },
];

describe('exportación de la rendición a Excel', () => {
  it('incluye el detalle con fechas DD/MM/AAAA y los totales', async () => {
    const wb = await libroRendicion(guardia, rendicion(movs, guardia), () => 'Alimentación');
    // Ida y vuelta por un .xlsx real
    const leido = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    const filas = XLSX.utils.sheet_to_json<unknown[]>(leido.Sheets['Rendición'], { header: 1 });
    expect(filas[0]).toEqual(['Rendición de viáticos — Guardia 1']);
    expect(filas[1]).toEqual(['Del 01/10/2026 al 14/10/2026']);
    expect(filas[4]).toEqual(['02/10/2026', 'Almuerzo', 'Alimentación', 'Yape', 'Factura', '20123456789', 'F001-1', 28, 'Sustentado', 'No', '']);
    expect(filas[5]?.slice(0, 9)).toEqual(['03/10/2026', 'Taxi', 'Alimentación', 'Efectivo', 'Ninguno', '', '', 15, 'SIN SUSTENTO']);
    const resumen = Object.fromEntries(filas.filter((f) => f.length === 2) as [string, number][]);
    expect(resumen['Con factura']).toBe(28);
    expect(resumen['Sin sustento']).toBe(15);
    expect(resumen['Total reembolsable']).toBe(43);
  });
});
