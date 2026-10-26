import { useSyncExternalStore } from 'react';
import { getMeta, setMeta } from '../db/db';
import { EVENTO_CAMBIOS } from '../db/repo';
import { hoyISO } from '../domain/format';
import { crearDriveApi, TokenExpiradoError } from './drive';
import { sincronizarCon } from './engine';
import { CLIENT_ID, desconectarGoogle, olvidarToken, pedirToken, tokenVigente } from './google';

export type FaseSync =
  | 'sin-config' // no hay Client ID en el build
  | 'desconectado' // nunca se conectó Drive en este dispositivo
  | 'offline'
  | 'sincronizando'
  | 'listo'
  | 'reconectar' // el token venció: los cambios esperan en la cola
  | 'error';

export interface EstadoSync {
  fase: FaseSync;
  error?: string;
  ultimaSync?: number;
}

let estado: EstadoSync = { fase: CLIENT_ID ? 'desconectado' : 'sin-config' };
const oyentes = new Set<() => void>();

function set(parcial: EstadoSync) {
  estado = parcial;
  oyentes.forEach((f) => f());
}

export function useEstadoSync(): EstadoSync {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => estado,
  );
}

let enCurso: Promise<void> | null = null;
let otraVez = false;

/** Sincroniza si hay conexión, Drive conectado y token vigente. Nunca pierde pendientes. */
export async function sincronizar(): Promise<void> {
  if (enCurso) {
    otraVez = true;
    return enCurso;
  }
  enCurso = (async () => {
    try {
      do {
        otraVez = false;
        await pasada();
      } while (otraVez);
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

async function pasada() {
  if (!CLIENT_ID) return set({ fase: 'sin-config' });
  const ultimaSync = await getMeta<number | undefined>('ultimaSync', undefined);
  if (!(await getMeta('driveConectado', false))) return set({ fase: 'desconectado' });
  if (!navigator.onLine) return set({ fase: 'offline', ultimaSync });
  const token = await tokenVigente();
  if (!token) return set({ fase: 'reconectar', ultimaSync });

  set({ fase: 'sincronizando', ultimaSync });
  try {
    const api = crearDriveApi(() => token, {
      get: () => getMeta('driveIds', {}),
      set: (ids) => setMeta('driveIds', ids),
    });
    await sincronizarCon(api, hoyISO());
    set({ fase: 'listo', ultimaSync: Date.now() });
  } catch (e) {
    if (e instanceof TokenExpiradoError) {
      await olvidarToken();
      set({ fase: 'reconectar', ultimaSync });
    } else if (!navigator.onLine || e instanceof TypeError) {
      // TypeError = fallo de red en fetch (señal intermitente)
      set({ fase: 'offline', ultimaSync });
    } else {
      set({ fase: 'error', error: e instanceof Error ? e.message : String(e), ultimaSync });
    }
  }
}

/** Conecta (o reconecta) Google Drive. Llamar desde un toque del usuario. */
export async function conectarDrive(): Promise<void> {
  const primeraVez = !(await getMeta('driveConectado', false));
  try {
    await pedirToken(primeraVez);
  } catch (e) {
    set({ ...estado, fase: estado.fase === 'sincronizando' ? 'error' : estado.fase, error: (e as Error).message });
    throw e;
  }
  // En un celular nuevo esto descarga todo desde Drive.
  await sincronizar();
}

export async function desconectarDrive(): Promise<void> {
  await desconectarGoogle();
  set({ fase: 'desconectado' });
}

let timer: ReturnType<typeof setTimeout> | undefined;
function programar(ms = 3000) {
  clearTimeout(timer);
  timer = setTimeout(() => void sincronizar(), ms);
}

/** Dispara la sincronización al iniciar, al guardar, al volver la señal y cada 5 minutos. */
export function iniciarAutoSync(): void {
  window.addEventListener(EVENTO_CAMBIOS, () => programar());
  window.addEventListener('online', () => programar(500));
  window.addEventListener('offline', () => void sincronizar());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') programar(500);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void sincronizar();
  }, 5 * 60_000);
  void sincronizar();
}
