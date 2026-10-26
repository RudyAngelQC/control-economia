import { getMeta, setMeta } from '../db/db';

export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }): TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

interface TokenGuardado {
  token: string;
  exp: number;
}

let gisPromise: Promise<void> | null = null;

/** Carga Google Identity Services solo cuando hace falta (requiere conexión). */
function cargarGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('No se pudo cargar Google (¿sin conexión?)'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** Token vigente guardado en este dispositivo, o null si no hay o ya venció. */
export async function tokenVigente(): Promise<string | null> {
  const t = await getMeta<TokenGuardado | null>('googleToken', null);
  if (!t || t.exp - 60_000 < Date.now()) return null;
  return t.token;
}

/**
 * Abre la ventana de Google para obtener un token de Drive. Debe llamarse desde
 * un toque del usuario (si no, el navegador bloquea la ventana). Sin backend no
 * existe refresh token: el token dura ~1 hora y luego hay que reconectar.
 */
export async function pedirToken(primeraVez: boolean): Promise<string> {
  if (!CLIENT_ID) throw new Error('Falta configurar VITE_GOOGLE_CLIENT_ID');
  await cargarGis();
  const token = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) reject(new Error(r.error_description || r.error || 'Sin token'));
        else {
          void setMeta('googleToken', {
            token: r.access_token,
            exp: Date.now() + (r.expires_in ?? 3600) * 1000,
          } satisfies TokenGuardado).then(() => resolve(r.access_token!));
        }
      },
      error_callback: (e) =>
        reject(new Error(e.type === 'popup_closed' ? 'Cerraste la ventana de Google' : e.message || e.type)),
    });
    client.requestAccessToken({ prompt: primeraVez ? 'consent' : '' });
  });
  await setMeta('driveConectado', true);
  return token;
}

export async function olvidarToken(): Promise<void> {
  await setMeta('googleToken', null);
}

export async function desconectarGoogle(): Promise<void> {
  const t = await getMeta<TokenGuardado | null>('googleToken', null);
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t.token);
  await setMeta('googleToken', null);
  await setMeta('driveConectado', false);
  await setMeta('driveIds', {});
}
