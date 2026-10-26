import { Link } from 'react-router-dom';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react';
import { usePendientes } from '../db/hooks';
import { useEstadoSync, type EstadoSync } from '../sync/controller';

export function textoSync(e: EstadoSync, pendientes: number): { texto: string; tono: 'ok' | 'aviso' | 'error' | 'neutro' } {
  const pend = pendientes > 0 ? ` (${pendientes} cambio${pendientes > 1 ? 's' : ''})` : '';
  switch (e.fase) {
    case 'offline':
      return { texto: `Sin conexión${pend}`, tono: 'neutro' };
    case 'sincronizando':
      return { texto: 'Sincronizando…', tono: 'neutro' };
    case 'reconectar':
      return { texto: `Reconectar Drive${pend}`, tono: 'aviso' };
    case 'error':
      return { texto: `Error de sync${pend}`, tono: 'error' };
    case 'listo':
      return pendientes > 0 ? { texto: `Pendiente${pend}`, tono: 'aviso' } : { texto: 'Sincronizado', tono: 'ok' };
    default:
      return { texto: 'Solo en este celular', tono: 'neutro' };
  }
}

/** Indicador de sincronización en la cabecera; lleva a la pantalla de respaldo. */
export function SyncBadge() {
  const estado = useEstadoSync();
  const pendientes = usePendientes();
  const { texto, tono } = textoSync(estado, pendientes);
  const Icono =
    estado.fase === 'offline'
      ? CloudOff
      : estado.fase === 'sincronizando'
        ? RefreshCw
        : estado.fase === 'reconectar' || estado.fase === 'error'
          ? AlertTriangle
          : estado.fase === 'listo'
            ? pendientes
              ? Cloud
              : CheckCircle2
            : Smartphone;
  const color = {
    ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    aviso: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    neutro: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }[tono];
  return (
    <Link to="/mas/respaldo" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${color}`} aria-label={`Estado de respaldo: ${texto}`}>
      <Icono size={14} className={estado.fase === 'sincronizando' ? 'animate-spin' : ''} />
      {texto}
    </Link>
  );
}
