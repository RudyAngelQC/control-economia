import { describe, expect, it } from 'vitest';
import { clasificar, normalizar, sugerirPalabra } from './classifier';
import { REGLAS_SEMILLA } from './seeds';
import type { Regla } from './types';

const r = (palabra: string, areaId: string): Regla => ({
  id: palabra,
  palabra,
  areaId,
  updatedAt: 1,
});

describe('normalizar', () => {
  it('quita tildes, mayúsculas y signos', () => {
    expect(normalizar('  Pensión  JUNIO!! ')).toBe('pension junio');
    // la ñ también se simplifica a n (igual en descripción y en reglas, así que coinciden)
    expect(normalizar('Menú del día — Ñandú')).toBe('menu del dia nandu');
    expect(normalizar('Año')).toBe(normalizar('ano'));
  });
});

describe('clasificar', () => {
  const reglas = [r('pensión', 'alimentacion'), r('menu', 'alimentacion'), r('casco', 'epp')];

  it('ignora tildes en la descripción y en la regla', () => {
    expect(clasificar('pension de octubre', reglas)?.areaId).toBe('alimentacion');
    expect(clasificar('Menú ejecutivo', reglas)?.areaId).toBe('alimentacion');
  });

  it('ignora mayúsculas', () => {
    expect(clasificar('CASCO NUEVO', reglas)?.areaId).toBe('epp');
  });

  it('admite plurales pero no coincide dentro de otra palabra', () => {
    const rs = [r('pasaje', 'transporte'), r('pan', 'alimentacion')];
    expect(clasificar('pasajes juliaca', rs)?.areaId).toBe('transporte');
    expect(clasificar('pantalon jean', rs)).toBeNull();
  });

  it('con varias coincidencias gana la palabra clave más larga', () => {
    const rs = [r('pasaje', 'transporte'), r('pasaje mina', 'movilidad-trabajo')];
    expect(clasificar('Pasaje mina Juliaca', rs)?.areaId).toBe('movilidad-trabajo');
    expect(clasificar('Pasaje Lima', rs)?.areaId).toBe('transporte');
    // con las reglas semilla: "agua mineral" le gana a "agua"
    expect(clasificar('agua mineral 2L', REGLAS_SEMILLA)?.areaId).toBe('alimentacion');
    expect(clasificar('recibo de agua', REGLAS_SEMILLA)?.areaId).toBe('servicios');
  });

  it('descripción vacía o sin coincidencias queda sin clasificar', () => {
    expect(clasificar('', reglas)).toBeNull();
    expect(clasificar('   ', reglas)).toBeNull();
    expect(clasificar('¿¿??', reglas)).toBeNull();
    expect(clasificar('algo raro', reglas)).toBeNull();
  });

  it('ignora reglas borradas', () => {
    expect(clasificar('casco', [{ ...r('casco', 'epp'), deleted: true }])).toBeNull();
  });

  it('las reglas semilla cubren el contexto peruano', () => {
    const casos: [string, string][] = [
      ['Grifo Repsol', 'transporte'],
      ['Inkafarma paracetamol', 'salud'],
      ['Chaleco reflectivo', 'epp'],
      ['Cuota préstamo BCP', 'deudas'],
      ['Sueldo octubre', 'sueldo'],
      ['Pensión universidad', 'estudios'],
    ];
    for (const [desc, area] of casos) expect(clasificar(desc, REGLAS_SEMILLA)?.areaId).toBe(area);
  });

  it('las reglas semilla tienen ids únicos', () => {
    expect(new Set(REGLAS_SEMILLA.map((x) => x.id)).size).toBe(REGLAS_SEMILLA.length);
  });
});

describe('sugerirPalabra', () => {
  it('propone la palabra más larga sin tildes', () => {
    expect(sugerirPalabra('Lavandería 15 kg')).toBe('lavanderia');
    expect(sugerirPalabra('')).toBe('');
  });
});
