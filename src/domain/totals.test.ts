import { describe, expect, it } from 'vitest';
import {
  gastoPersonalPorArea,
  gastosPor,
  guardiaParaFecha,
  nivelPresupuesto,
  rendicion,
  resumenMes,
  topeDelMes,
  variacion,
} from './totals';
import { formatFecha, formatSoles, parseMonto, sumarMes } from './format';
import type { Guardia, Movimiento } from './types';

let n = 0;
function mov(p: Partial<Movimiento>): Movimiento {
  n++;
  return {
    id: `m${n}`,
    updatedAt: n,
    createdAt: n,
    fecha: '2026-10-10',
    tipo: 'gasto',
    medio: 'yape',
    comprobante: 'ninguno',
    montoCents: 1000,
    descripcion: '',
    reembolsable: false,
    guardiaId: null,
    areaId: null,
    areaManual: false,
    comprobanteFisico: false,
    ...p,
  };
}

const guardia: Guardia = {
  id: 'g1',
  nombre: 'Guardia 1',
  inicio: '2026-10-01',
  fin: '2026-10-14',
  estado: 'abierta',
  updatedAt: 1,
};

describe('formato', () => {
  it('formatea soles y fechas', () => {
    expect(formatSoles(123450)).toBe('S/ 1,234.50');
    expect(formatSoles(5)).toBe('S/ 0.05');
    expect(formatFecha('2026-03-07')).toBe('07/03/2026');
  });
  it('interpreta montos con coma o punto decimal', () => {
    expect(parseMonto('12')).toBe(1200);
    expect(parseMonto('12,5')).toBe(1250);
    expect(parseMonto('12.50')).toBe(1250);
    expect(parseMonto('1,234.50')).toBe(123450);
    expect(parseMonto('S/ 8.90')).toBe(890);
    expect(parseMonto('0')).toBeNull();
    expect(parseMonto('abc')).toBeNull();
    expect(parseMonto('1.234')).toBeNull();
  });
  it('suma meses cruzando el año', () => {
    expect(sumarMes('2026-01', -1)).toBe('2025-12');
    expect(sumarMes('2026-12', 1)).toBe('2027-01');
  });
});

describe('resumenMes', () => {
  const movs = [
    mov({ tipo: 'ingreso', montoCents: 500000, areaId: 'sueldo' }),
    mov({ montoCents: 2000, areaId: 'alimentacion' }),
    mov({ montoCents: 3000, reembolsable: true, guardiaId: 'g1' }),
    mov({ montoCents: 9999, fecha: '2026-09-30' }), // otro mes
    mov({ montoCents: 7777, deleted: true }), // borrado
  ];

  it('calcula ingresos, gastos, saldo y por cobrar', () => {
    expect(resumenMes(movs, '2026-10', [guardia])).toEqual({
      ingresos: 500000,
      gastos: 5000,
      saldo: 495000,
      porCobrar: 3000,
      cantidad: 3,
    });
  });

  it('una guardia cobrada ya no suma en por cobrar', () => {
    expect(resumenMes(movs, '2026-10', [{ ...guardia, estado: 'cobrada' }]).porCobrar).toBe(0);
  });

  it('agrupa gastos de mayor a menor', () => {
    expect(gastosPor(movs, (m) => m.medio)).toEqual([{ clave: 'yape', total: 14999 }]);
  });

  it('variación contra el mes anterior', () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(50, 100)).toBe(-50);
    expect(variacion(100, 0)).toBeNull();
  });
});

describe('presupuesto', () => {
  it('amarillo desde 80 %, rojo al pasar 100 %', () => {
    expect(nivelPresupuesto(79, 100)).toBe('ok');
    expect(nivelPresupuesto(80, 100)).toBe('alerta');
    expect(nivelPresupuesto(100, 100)).toBe('alerta');
    expect(nivelPresupuesto(101, 100)).toBe('excedido');
    expect(nivelPresupuesto(50, 0)).toBe('ok');
  });

  it('el ajuste del mes reemplaza al tope por defecto', () => {
    const ps = [
      { id: 'a', areaId: 'ropa', mes: null, montoCents: 10000, updatedAt: 1 },
      { id: 'b', areaId: 'ropa', mes: '2026-12', montoCents: 30000, updatedAt: 1 },
    ];
    expect(topeDelMes(ps, 'ropa', '2026-10')).toBe(10000);
    expect(topeDelMes(ps, 'ropa', '2026-12')).toBe(30000);
    expect(topeDelMes(ps, 'salud', '2026-10')).toBeNull();
  });

  it('solo cuenta gastos personales (no reembolsables)', () => {
    const movs = [
      mov({ areaId: 'alimentacion', montoCents: 1000 }),
      mov({ areaId: 'alimentacion', montoCents: 5000, reembolsable: true }),
      mov({ areaId: null, montoCents: 300 }),
    ];
    const g = gastoPersonalPorArea(movs, '2026-10');
    expect(g.get('alimentacion')).toBe(1000);
    expect(g.get('sin-clasificar')).toBe(300);
  });
});

describe('rendición de viáticos', () => {
  const movs = [
    mov({ guardiaId: 'g1', reembolsable: true, comprobante: 'factura', montoCents: 10000, comprobanteFisico: true }),
    mov({ guardiaId: 'g1', reembolsable: true, comprobante: 'boleta', montoCents: 2500 }),
    mov({ guardiaId: 'g1', reembolsable: true, medio: 'yape', montoCents: 1500 }),
    mov({ guardiaId: 'g1', reembolsable: true, medio: 'efectivo', montoCents: 500 }),
    mov({ guardiaId: 'g1', reembolsable: false, montoCents: 99999 }), // personal: no entra
    mov({ guardiaId: 'g2', reembolsable: true, montoCents: 88888 }), // otra guardia
    mov({ guardiaId: 'g1', reembolsable: true, montoCents: 4444, deleted: true }),
  ];

  it('separa factura, boleta y sin sustento', () => {
    const r = rendicion(movs, guardia);
    expect(r.items).toHaveLength(4);
    expect(r.total).toBe(14500);
    expect(r.factura).toBe(10000);
    expect(r.boleta).toBe(2500);
    expect(r.sinSustento).toBe(2000);
    expect(r.factura + r.boleta + r.sinSustento).toBe(r.total);
    expect(r.conComprobante).toBe(2);
    expect(r.fisicos).toBe(1);
    expect(r.pendiente).toBe(14500);
  });

  it('descuenta lo cobrado y deja en cero si la guardia está cobrada', () => {
    const conCobro = [
      ...movs,
      mov({ guardiaId: 'g1', tipo: 'ingreso', areaId: 'reembolso', montoCents: 10000, medio: 'transferencia' }),
    ];
    expect(rendicion(conCobro, guardia).cobrado).toBe(10000);
    expect(rendicion(conCobro, guardia).pendiente).toBe(4500);
    expect(rendicion(movs, { ...guardia, estado: 'cobrada' }).pendiente).toBe(0);
  });

  it('una guardia sin gastos da todo en cero', () => {
    const r = rendicion([], guardia);
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
  });

  it('encuentra la guardia de una fecha', () => {
    expect(guardiaParaFecha([guardia], '2026-10-05')?.id).toBe('g1');
    expect(guardiaParaFecha([guardia], '2026-10-14')?.id).toBe('g1');
    expect(guardiaParaFecha([guardia], '2026-10-15')).toBeNull();
  });
});
