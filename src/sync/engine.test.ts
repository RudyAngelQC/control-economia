import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { borrar, guardarUno } from '../db/repo';
import type { Movimiento } from '../domain/types';
import type { ArchivoDrive, ArchivoSync, DriveApi } from './drive';
import { sincronizarCon } from './engine';

/** Drive en memoria compartido entre "dispositivos". */
class DriveFalso implements DriveApi {
  archivo: ArchivoSync | null = null;
  backups: ArchivoDrive[] = [];
  escrituras = 0;
  async leerDatos() {
    return this.archivo ? structuredClone(this.archivo) : null;
  }
  async escribirDatos(a: ArchivoSync) {
    this.escrituras++;
    this.archivo = structuredClone(a);
  }
  async listarBackups() {
    return [...this.backups];
  }
  async crearBackup(nombre: string) {
    this.backups.push({ id: nombre, name: nombre });
  }
  async borrarArchivo(id: string) {
    this.backups = this.backups.filter((b) => b.id !== id);
  }
}

const mov = (id: string, monto: number): Movimiento => ({
  id,
  updatedAt: 0,
  createdAt: 0,
  fecha: '2026-10-20',
  tipo: 'gasto',
  medio: 'yape',
  comprobante: 'ninguno',
  montoCents: monto,
  descripcion: 'menu',
  reembolsable: true,
  guardiaId: null,
  areaId: 'alimentacion',
  areaManual: false,
  comprobanteFisico: false,
});

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('motor de sincronización', () => {
  it('cambios hechos offline quedan en la cola y se suben al sincronizar', async () => {
    const drive = new DriveFalso();
    await guardarUno('movimientos', mov('a', 1000));
    await guardarUno('movimientos', mov('b', 2000));
    await borrar('movimientos', ['b']);
    expect(await db.pendientes.count()).toBe(2); // sin señal: todo espera en la cola

    const r = await sincronizarCon(drive, '2026-10-24');
    expect(r.subido).toBe(true);
    expect(await db.pendientes.count()).toBe(0);
    const enDrive = drive.archivo!.datos.movimientos;
    expect(enDrive.find((m) => m.id === 'a')?.montoCents).toBe(1000);
    expect(enDrive.find((m) => m.id === 'b')?.deleted).toBe(true); // tombstone

    // Nada nuevo: la siguiente pasada no vuelve a subir
    const antes = drive.escrituras;
    await sincronizarCon(drive, '2026-10-24');
    expect(drive.escrituras).toBe(antes);
  });

  it('"perdí el celular": un dispositivo vacío descarga todo desde Drive', async () => {
    const drive = new DriveFalso();
    await guardarUno('movimientos', mov('a', 1000));
    await sincronizarCon(drive, '2026-10-24');

    await Promise.all(db.tables.map((t) => t.clear())); // celular nuevo
    const r = await sincronizarCon(drive, '2026-10-24');
    expect(r.descargados).toBeGreaterThan(0);
    expect((await db.movimientos.get('a'))?.montoCents).toBe(1000);
    expect(await db.pendientes.count()).toBe(0);
  });

  it('un borrado en otro dispositivo no resucita con una copia vieja', async () => {
    const drive = new DriveFalso();
    await guardarUno('movimientos', mov('a', 1000));
    await sincronizarCon(drive, '2026-10-24');
    const viejo = (await db.movimientos.get('a'))!;

    // Otro dispositivo borra "a" más tarde y sube el tombstone
    drive.archivo!.datos.movimientos = [{ ...viejo, deleted: true, updatedAt: viejo.updatedAt + 1000 }];

    await sincronizarCon(drive, '2026-10-24');
    expect((await db.movimientos.get('a'))?.deleted).toBe(true);
    expect(drive.archivo!.datos.movimientos.find((m) => m.id === 'a')?.deleted).toBe(true);
  });

  it('un pendiente editado durante la pasada sigue en la cola', async () => {
    const drive = new DriveFalso();
    await guardarUno('movimientos', mov('a', 1000));
    const leerOriginal = drive.leerDatos.bind(drive);
    drive.leerDatos = async () => {
      // el usuario edita mientras se descarga el archivo
      await guardarUno('movimientos', { ...(await db.movimientos.get('a'))!, montoCents: 5555 });
      return leerOriginal();
    };
    await sincronizarCon(drive, '2026-10-24');
    expect(await db.pendientes.count()).toBe(1);
    expect((await db.movimientos.get('a'))?.montoCents).toBe(5555);
  });

  it('backup semanal: crea uno cada 7 días y conserva los últimos 8', async () => {
    const drive = new DriveFalso();
    for (let d = 1; d <= 9; d++) {
      const n = `backup-2026-08-${String(d).padStart(2, '0')}.json`;
      drive.backups.push({ id: n, name: n });
    }
    const r = await sincronizarCon(drive, '2026-10-24');
    expect(r.backupCreado).toBe('backup-2026-10-24.json');
    expect(drive.backups).toHaveLength(8);
    expect(drive.backups.map((b) => b.name)).toContain('backup-2026-10-24.json');
    expect(drive.backups.map((b) => b.name)).not.toContain('backup-2026-08-01.json');

    // Al día siguiente no se crea otro (no pasaron 7 días)
    const r2 = await sincronizarCon(drive, '2026-10-25');
    expect(r2.backupCreado).toBeNull();
    const r3 = await sincronizarCon(drive, '2026-10-31');
    expect(r3.backupCreado).toBe('backup-2026-10-31.json');
  });
});
