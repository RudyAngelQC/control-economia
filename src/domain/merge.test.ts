import { describe, expect, it } from 'vitest';
import { ganador, mergeColeccion, mergeDatos, datosVacios } from './merge';
import type { SyncMeta } from './types';

type Rec = SyncMeta & { monto: number };
const rec = (id: string, updatedAt: number, monto: number, deleted?: boolean): Rec => ({
  id,
  updatedAt,
  monto,
  ...(deleted ? { deleted } : {}),
});

describe('merge por registro', () => {
  it('mismo registro editado en dos dispositivos: gana el updatedAt más reciente', () => {
    const celular = [rec('a', 200, 50)];
    const drive = [rec('a', 100, 30)];
    const r1 = mergeColeccion(celular, drive);
    expect(r1.merged).toEqual([rec('a', 200, 50)]);
    expect(r1.cambiaRemoto).toBe(true);
    expect(r1.aplicarLocal).toEqual([]);

    // al revés: la edición de Drive es más nueva → se aplica en local
    const r2 = mergeColeccion([rec('a', 100, 30)], [rec('a', 300, 80)]);
    expect(r2.merged).toEqual([rec('a', 300, 80)]);
    expect(r2.aplicarLocal).toEqual([rec('a', 300, 80)]);
    expect(r2.cambiaRemoto).toBe(false);
  });

  it('borrado contra edición: el tombstone más nuevo gana y no resucita', () => {
    // Celular A borró (t=300). Celular B, desactualizado, tenía la versión t=100.
    const drive = [rec('a', 300, 30, true)];
    const desactualizado = [rec('a', 100, 30)];
    const r = mergeColeccion(desactualizado, drive);
    expect(r.merged).toEqual([rec('a', 300, 30, true)]);
    expect(r.aplicarLocal).toEqual([rec('a', 300, 30, true)]);
    expect(r.cambiaRemoto).toBe(false);
  });

  it('borrado contra edición: una edición posterior al borrado sí gana', () => {
    const r = mergeColeccion([rec('a', 400, 99)], [rec('a', 300, 30, true)]);
    expect(r.merged).toEqual([rec('a', 400, 99)]);
    expect(r.cambiaRemoto).toBe(true);
  });

  it('empate exacto de updatedAt: gana el borrado y el resultado es simétrico', () => {
    const vivo = rec('a', 100, 1);
    const borrado = rec('a', 100, 1, true);
    expect(ganador(vivo, borrado)).toBe(borrado);
    expect(ganador(borrado, vivo)).toBe(borrado);
    const x = rec('b', 5, 1);
    const y = rec('b', 5, 2);
    expect(ganador(x, y)).toEqual(ganador(y, x));
  });

  it('cambios hechos offline se suben al reconectar sin pisar los de otro dispositivo', () => {
    // Estado en Drive cuando el celular se quedó sin señal
    const driveInicial = [rec('a', 100, 10), rec('b', 100, 20)];
    // Offline: el celular crea "c", edita "a" y borra "b"
    const localOffline = [rec('a', 500, 11), rec('b', 510, 20, true), rec('c', 520, 30)];
    // Mientras tanto la PC agregó "d" y editó "a" (antes que el celular)
    const driveAlReconectar = [...driveInicial.map((x) => (x.id === 'a' ? rec('a', 400, 99) : x)), rec('d', 450, 40)];

    const r = mergeColeccion(localOffline, driveAlReconectar);
    const porId = Object.fromEntries(r.merged.map((x) => [x.id, x]));
    expect(porId.a).toEqual(rec('a', 500, 11)); // la edición offline es más reciente
    expect(porId.b).toEqual(rec('b', 510, 20, true)); // el borrado viaja como tombstone
    expect(porId.c).toEqual(rec('c', 520, 30)); // lo creado offline se sube
    expect(porId.d).toEqual(rec('d', 450, 40)); // lo de la PC no se pierde
    expect(r.cambiaRemoto).toBe(true);
    expect(r.aplicarLocal).toEqual([rec('d', 450, 40)]);

    // Segunda pasada (ya sincronizado): no hay nada más que subir ni bajar
    const r2 = mergeColeccion(r.merged, r.merged);
    expect(r2.cambiaRemoto).toBe(false);
    expect(r2.aplicarLocal).toEqual([]);
  });

  it('celular nuevo (local vacío): descarga todo desde Drive', () => {
    const drive = { ...datosVacios(), reglas: [{ id: 'r1', updatedAt: 9, palabra: 'x', areaId: 'otros' }] };
    const r = mergeDatos(datosVacios(), drive);
    expect(r.aplicarLocal.reglas).toHaveLength(1);
    expect(r.cambiaRemoto).toBe(false);
  });

  it('archivo de Drive sin alguna colección no rompe el merge', () => {
    const local = { ...datosVacios(), guardias: [{ id: 'g', updatedAt: 1, nombre: 'G', inicio: '', fin: '', estado: 'abierta' as const }] };
    const r = mergeDatos(local, {});
    expect(r.merged.guardias).toHaveLength(1);
    expect(r.cambiaRemoto).toBe(true);
  });
});
