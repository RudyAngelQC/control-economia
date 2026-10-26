import { db, getMeta, setMeta } from '../db/db';
import { aplicarExternos, leerTodo } from '../db/repo';
import { mergeDatos } from '../domain/merge';
import { sumarDias } from '../domain/format';
import type { ArchivoSync, DriveApi } from './drive';

export const BACKUPS_A_CONSERVAR = 8;
export const DIAS_ENTRE_BACKUPS = 7;

export function armarArchivo(datos: ArchivoSync['datos']): ArchivoSync {
  return { app: 'control-economia', version: 1, exportadoEn: new Date().toISOString(), datos };
}

export interface ResultadoSync {
  descargados: number;
  subido: boolean;
  backupCreado: string | null;
}

/**
 * Una pasada de sincronización:
 * 1. toma una foto de la cola de pendientes,
 * 2. descarga el archivo de Drive y hace merge por registro,
 * 3. aplica en local lo que ganó en remoto (sin pisar ediciones hechas mientras tanto),
 * 4. sube el resultado si cambió,
 * 5. quita de la cola solo los pendientes que no se volvieron a editar durante la pasada,
 * 6. hace el backup semanal si corresponde.
 */
export async function sincronizarCon(api: DriveApi, hoy: string): Promise<ResultadoSync> {
  const fotoPendientes = await db.pendientes.toArray();

  const remoto = await api.leerDatos();
  const local = await leerTodo();
  const { merged, aplicarLocal, cambiaRemoto } = mergeDatos(local, remoto?.datos ?? {});

  const descargados = await aplicarExternos(aplicarLocal);

  const subido = cambiaRemoto || !remoto;
  if (subido) await api.escribirDatos(armarArchivo(merged));

  await db.transaction('rw', db.pendientes, async () => {
    const actuales = await db.pendientes.bulkGet(fotoPendientes.map((p) => p.key));
    const sincronizados = fotoPendientes
      .filter((p, i) => actuales[i]?.updatedAt === p.updatedAt)
      .map((p) => p.key);
    await db.pendientes.bulkDelete(sincronizados);
  });

  const backupCreado = await backupSemanal(api, merged, hoy);
  await setMeta('ultimaSync', Date.now());
  return { descargados, subido, backupCreado };
}

/**
 * Crea `backup-AAAA-MM-DD.json` si el último tiene 7 días o más, y conserva los
 * 8 más recientes. Se revisa como mucho una vez al día por dispositivo.
 */
export async function backupSemanal(
  api: DriveApi,
  datos: ArchivoSync['datos'],
  hoy: string,
): Promise<string | null> {
  if ((await getMeta('ultimaRevisionBackup', '')) === hoy) return null;
  const backups = (await api.listarBackups())
    .filter((b) => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(b.name))
    .sort((a, b) => b.name.localeCompare(a.name));
  const ultimaFecha = backups[0]?.name.slice(7, 17);
  let creado: string | null = null;
  if (!ultimaFecha || ultimaFecha <= sumarDias(hoy, -DIAS_ENTRE_BACKUPS)) {
    creado = `backup-${hoy}.json`;
    await api.crearBackup(creado, armarArchivo(datos));
    backups.unshift({ id: '', name: creado });
  }
  for (const viejo of backups.slice(BACKUPS_A_CONSERVAR)) {
    if (viejo.id) await api.borrarArchivo(viejo.id);
  }
  await setMeta('ultimaRevisionBackup', hoy);
  return creado;
}
