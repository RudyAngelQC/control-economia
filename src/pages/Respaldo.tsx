import { useRef, useState } from 'react';
import { CloudUpload, Download, FileJson, FileSpreadsheet, LogOut, RefreshCw, Upload } from 'lucide-react';
import { useAreas, useGuardias, useMovimientos, usePendientes, useReglas } from '../db/hooks';
import { aplicarClasificacion, aplicarExternos, guardar, leerTodo } from '../db/repo';
import { mergeDatos } from '../domain/merge';
import { Encabezado } from '../components/Volver';
import { useToast } from '../components/toast';
import { textoSync } from '../components/SyncBadge';
import { conectarDrive, desconectarDrive, sincronizar, useEstadoSync } from '../sync/controller';
import { CARPETA, ARCHIVO } from '../sync/drive';
import { exportarJson, exportarMovimientosXlsx, importarMovimientosXlsx, leerJson } from '../export/exportar';

export function Respaldo() {
  const estado = useEstadoSync();
  const pendientes = usePendientes();
  const movs = useMovimientos();
  const areas = useAreas();
  const reglas = useReglas();
  const guardias = useGuardias();
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const jsonRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const { texto } = textoSync(estado, pendientes);

  async function conectar() {
    setOcupado(true);
    try {
      await conectarDrive();
      toast({ texto: 'Google Drive conectado.' });
    } catch (e) {
      toast({ texto: (e as Error).message, tipo: 'error' });
    } finally {
      setOcupado(false);
    }
  }

  async function importarJson(file: File) {
    try {
      const entrantes = await leerJson(file);
      // Merge por registro: no reemplaza, solo trae lo que es más nuevo
      const { aplicarLocal } = mergeDatos(await leerTodo(), entrantes);
      const n = await aplicarExternos(aplicarLocal, true);
      toast({ texto: n ? `Importados ${n} registros.` : 'No había nada nuevo en el archivo.' });
    } catch (e) {
      toast({ texto: `No se pudo importar: ${(e as Error).message}`, tipo: 'error' });
    }
  }

  async function importarXlsx(file: File) {
    try {
      const { movimientos, errores } = await importarMovimientosXlsx(file, areas, guardias);
      await guardar('movimientos', movimientos.map((m) => aplicarClasificacion(m, reglas)));
      toast({ texto: `Importados ${movimientos.length} movimientos${errores.length ? `; ${errores.length} filas con error (${errores[0]})` : ''}.`, tipo: errores.length ? 'aviso' : 'ok' }, 7000);
    } catch (e) {
      toast({ texto: `No se pudo importar: ${(e as Error).message}`, tipo: 'error' });
    }
  }

  const conectado = estado.fase !== 'desconectado' && estado.fase !== 'sin-config';

  return (
    <div className="flex flex-col gap-4">
      <Encabezado titulo="Respaldo y datos" />

      <section className="tarjeta">
        <h2 className="mb-1 flex items-center gap-2 font-bold"><CloudUpload size={20} /> Google Drive</h2>
        <p className="mb-3 text-sm">
          Estado: <strong>{texto}</strong>
          {estado.ultimaSync && <span className="texto-suave"> · última sync {new Date(estado.ultimaSync).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span>}
        </p>

        {estado.fase === 'sin-config' && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
            Falta configurar el Client ID de Google (<code>VITE_GOOGLE_CLIENT_ID</code>). Sigue los pasos del README. Mientras tanto usa la exportación manual de abajo.
          </p>
        )}

        {estado.fase === 'desconectado' && (
          <>
            <p className="texto-suave mb-3 text-sm">
              Conecta tu cuenta para respaldar todo automáticamente en la carpeta <strong>“{CARPETA}”</strong> de tu Drive. La app solo puede ver los archivos que ella misma crea. Si cambias de celular, conéctate aquí y se descarga todo.
            </p>
            <button className="btn-primario w-full" onClick={conectar} disabled={ocupado}>Conectar Google Drive</button>
          </>
        )}

        {estado.fase === 'reconectar' && (
          <>
            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
              La sesión de Google venció (dura ~1 hora). Tus {pendientes} cambios pendientes están a salvo en el celular y se subirán al reconectar.
            </p>
            <button className="btn-primario w-full" onClick={conectar} disabled={ocupado}>Reconectar</button>
          </>
        )}

        {estado.fase === 'error' && <p className="mb-3 text-sm text-red-700 dark:text-red-400">{estado.error}</p>}

        {conectado && estado.fase !== 'reconectar' && (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secundario" onClick={() => void sincronizar()} disabled={estado.fase === 'sincronizando' || estado.fase === 'offline'}>
              <RefreshCw size={18} className={estado.fase === 'sincronizando' ? 'animate-spin' : ''} /> Sincronizar
            </button>
            <button className="btn-secundario" onClick={() => confirm('¿Desconectar Drive en este celular? Tus datos se quedan aquí y en Drive.') && desconectarDrive()}>
              <LogOut size={18} /> Desconectar
            </button>
          </div>
        )}
        {conectado && (
          <p className="texto-suave mt-3 text-xs">
            Archivo: {CARPETA}/{ARCHIVO}. Cada semana se guarda además una copia fechada (backup-AAAA-MM-DD.json) y se conservan las últimas 8.
          </p>
        )}
      </section>

      <section className="tarjeta">
        <h2 className="mb-1 font-bold">Plan B: exportar</h2>
        <p className="texto-suave mb-3 text-sm">Guarda un archivo en el celular por si acaso. El JSON es el respaldo completo; el Excel es para leer o editar.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secundario" onClick={async () => exportarJson(await leerTodo())}>
            <FileJson size={18} /> JSON
          </button>
          <button className="btn-secundario" onClick={() => exportarMovimientosXlsx(movs, areas, guardias).catch((e: Error) => toast({ texto: e.message, tipo: 'error' }))} disabled={!movs.length}>
            <FileSpreadsheet size={18} /> Excel
          </button>
        </div>
      </section>

      <section className="tarjeta">
        <h2 className="mb-1 font-bold">Importar</h2>
        <p className="texto-suave mb-3 text-sm">
          JSON: combina registro por registro (gana lo más reciente, nada se pierde). Excel: usa las mismas columnas que la exportación; las filas con ID actualizan, las demás se agregan.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secundario" onClick={() => jsonRef.current?.click()}>
            <Upload size={18} /> JSON
          </button>
          <button className="btn-secundario" onClick={() => xlsxRef.current?.click()}>
            <Download size={18} className="rotate-180" /> Excel
          </button>
        </div>
        <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importarJson(f); e.target.value = ''; }} />
        <input ref={xlsxRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importarXlsx(f); e.target.value = ''; }} />
      </section>
    </div>
  );
}
