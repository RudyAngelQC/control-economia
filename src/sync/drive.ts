import type { DatosSync } from '../domain/types';

export const CARPETA = 'Control Economía';
export const ARCHIVO = 'control-economia.json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export interface ArchivoSync {
  app: 'control-economia';
  version: 1;
  exportadoEn: string;
  datos: DatosSync;
}

export interface ArchivoDrive {
  id: string;
  name: string;
}

/** Lo mínimo que el motor de sincronización necesita de Drive (se reemplaza en los tests). */
export interface DriveApi {
  leerDatos(): Promise<ArchivoSync | null>;
  escribirDatos(archivo: ArchivoSync): Promise<void>;
  listarBackups(): Promise<ArchivoDrive[]>;
  crearBackup(nombre: string, archivo: ArchivoSync): Promise<void>;
  borrarArchivo(id: string): Promise<void>;
}

export class TokenExpiradoError extends Error {
  constructor() {
    super('La sesión de Google expiró');
  }
}

export class DriveError extends Error {}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export interface IdsCache {
  get(): Promise<{ folderId?: string; fileId?: string }>;
  set(ids: { folderId?: string; fileId?: string }): Promise<void>;
}

/**
 * Cliente de Drive v3 con el scope drive.file: solo ve los archivos que creó
 * esta app (en cualquier dispositivo con el mismo Client ID).
 */
export function crearDriveApi(token: () => string, cache: IdsCache): DriveApi {
  async function req(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
    });
    if (res.status === 401) throw new TokenExpiradoError();
    if (!res.ok && res.status !== 404) {
      throw new DriveError(`Drive respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return res;
  }

  async function buscar(query: string, extra = ''): Promise<ArchivoDrive[]> {
    const url = `${API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive&pageSize=100${extra}`;
    const res = await req(url);
    return ((await res.json()) as { files: ArchivoDrive[] }).files ?? [];
  }

  async function carpetaId(): Promise<string> {
    const c = await cache.get();
    if (c.folderId) return c.folderId;
    const found = await buscar(`name='${q(CARPETA)}' and mimeType='${FOLDER_MIME}' and trashed=false`);
    let id = found[0]?.id;
    if (!id) {
      const res = await req(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: CARPETA, mimeType: FOLDER_MIME }),
      });
      id = ((await res.json()) as { id: string }).id;
    }
    await cache.set({ ...c, folderId: id });
    return id;
  }

  async function crearArchivo(nombre: string, contenido: string): Promise<string> {
    const parent = await carpetaId();
    const boundary = `ce-${Math.random().toString(36).slice(2)}`;
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: nombre, parents: [parent], mimeType: 'application/json' }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${contenido}\r\n--${boundary}--`;
    const res = await req(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return ((await res.json()) as { id: string }).id;
  }

  async function archivoId(): Promise<string | null> {
    const c = await cache.get();
    if (c.fileId) return c.fileId;
    const parent = await carpetaId();
    const found = await buscar(`name='${q(ARCHIVO)}' and '${parent}' in parents and trashed=false`);
    const id = found[0]?.id ?? null;
    if (id) await cache.set({ ...c, folderId: parent, fileId: id });
    return id;
  }

  /** Si un id cacheado ya no existe (borrado/en papelera), limpia la caché y reintenta. */
  async function conReintento<T>(fn: () => Promise<T | 'no-existe'>): Promise<T> {
    const r = await fn();
    if (r !== 'no-existe') return r;
    await cache.set({});
    const r2 = await fn();
    if (r2 === 'no-existe') throw new DriveError('No se encontró el archivo en Drive');
    return r2;
  }

  return {
    async leerDatos() {
      return conReintento(async () => {
        const id = await archivoId();
        if (!id) return null;
        const res = await req(`${API}/files/${id}?alt=media`);
        if (res.status === 404) return 'no-existe' as const;
        return (await res.json()) as ArchivoSync;
      });
    },
    async escribirDatos(archivo) {
      const contenido = JSON.stringify(archivo);
      await conReintento(async () => {
        const id = await archivoId();
        if (!id) {
          const nuevo = await crearArchivo(ARCHIVO, contenido);
          await cache.set({ ...(await cache.get()), fileId: nuevo });
          return true;
        }
        const res = await req(`${UPLOAD}/files/${id}?uploadType=media`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: contenido,
        });
        return res.status === 404 ? ('no-existe' as const) : true;
      });
    },
    async listarBackups() {
      const parent = await carpetaId();
      return buscar(`name contains 'backup-' and '${parent}' in parents and trashed=false`, '&orderBy=name desc');
    },
    async crearBackup(nombre, archivo) {
      await crearArchivo(nombre, JSON.stringify(archivo));
    },
    async borrarArchivo(id) {
      await req(`${API}/files/${id}`, { method: 'DELETE' });
    },
  };
}
