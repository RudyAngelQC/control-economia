import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { nombreMes, sumarMes } from '../domain/format';

/** Hoja que sube desde abajo (modal pensado para una mano). */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  children,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!abierta) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [abierta, onCerrar]);
  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="animar-subir pb-safe max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button className="-mr-2 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onCerrar} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/** Botones de opción grandes (reemplazan a los desplegables). */
export function Opciones<T extends string>({
  valor,
  opciones,
  onCambio,
  etiqueta,
  columnas,
}: {
  valor: T;
  opciones: { id: T; label: string }[];
  onCambio: (v: T) => void;
  etiqueta?: ReactNode;
  columnas?: number;
}) {
  return (
    <div>
      {etiqueta && <span className="etiqueta">{etiqueta}</span>}
      <div
        role="radiogroup"
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columnas ?? opciones.length}, minmax(0, 1fr))` }}
      >
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={valor === o.id}
            onClick={() => onCambio(o.id)}
            className={`min-h-12 rounded-xl border px-2 text-sm font-semibold transition ${
              valor === o.id
                ? 'border-marca-700 bg-marca-700 text-white dark:border-marca-500 dark:bg-marca-600'
                : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Ícono (i) con explicación breve; se abre con un toque. */
export function InfoTip({ texto, titulo }: { texto: string; titulo?: string }) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', cerrar);
    return () => document.removeEventListener('pointerdown', cerrar);
  }, [abierto]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`¿Qué es ${titulo ?? 'esto'}?`}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
        className="ml-1 rounded-full p-1 text-slate-400 hover:text-marca-700 dark:hover:text-marca-500"
      >
        <Info size={16} />
      </button>
      {abierto && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-full left-1/2 z-40 mt-1 w-60 -translate-x-1/2 rounded-xl bg-slate-900 p-3 text-left text-sm leading-snug font-normal text-white shadow-lg dark:bg-slate-700"
        >
          {titulo && <strong className="mb-1 block">{titulo}</strong>}
          {texto}
        </span>
      )}
    </span>
  );
}

export const TIPS = {
  reembolsable:
    'Gasto de trabajo que la empresa te devuelve al cerrar la guardia. Cuenta para la rendición de viáticos y no para tu presupuesto personal.',
  sinSustento:
    'Gasto reembolsable sin factura ni boleta (por ejemplo, un Yape o efectivo sin comprobante). La empresa podría no devolvértelo.',
  presupuesto:
    'Tope mensual que te pones por área. Solo cuentan tus gastos personales (no los reembolsables). Amarillo desde el 80 %, rojo al pasarte.',
  porCobrar: 'Gastos reembolsables del mes cuya guardia todavía no te pagaron.',
  guardia: 'Período de trabajo en mina. Los viáticos se rinden y se cobran por guardia.',
};

export function EstadoVacio({
  icono,
  titulo,
  texto,
  accion,
}: {
  icono: ReactNode;
  titulo: string;
  texto: string;
  accion?: ReactNode;
}) {
  return (
    <div className="tarjeta flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 text-4xl" aria-hidden>
        {icono}
      </div>
      <h3 className="mb-1 text-lg font-bold">{titulo}</h3>
      <p className="texto-suave mb-4 max-w-xs text-sm">{texto}</p>
      {accion}
    </div>
  );
}

export function SelectorMes({ mes, onCambio }: { mes: string; onCambio: (m: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white p-1 shadow-sm dark:bg-slate-900">
      <button className="rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onCambio(sumarMes(mes, -1))} aria-label="Mes anterior">
        <ChevronLeft size={22} />
      </button>
      <label className="relative font-bold">
        {nombreMes(mes)}
        <input
          type="month"
          value={mes}
          onChange={(e) => e.target.value && onCambio(e.target.value)}
          className="absolute inset-0 opacity-0"
          aria-label="Elegir mes"
        />
      </label>
      <button className="rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onCambio(sumarMes(mes, 1))} aria-label="Mes siguiente">
        <ChevronRight size={22} />
      </button>
    </div>
  );
}

export function Interruptor({
  activo,
  onCambio,
  etiqueta,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  etiqueta: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium">{etiqueta}</span>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        onClick={() => onCambio(!activo)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${activo ? 'bg-marca-700 dark:bg-marca-600' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition ${activo ? 'translate-x-6' : ''}`} />
        <span className="sr-only">{activo ? 'Sí' : 'No'}</span>
      </button>
    </div>
  );
}

/** Barra de progreso de presupuesto: amarillo ≥ 80 %, rojo > 100 %. */
export function BarraProgreso({ pct, nivel }: { pct: number; nivel: 'ok' | 'alerta' | 'excedido' }) {
  const color = nivel === 'excedido' ? 'bg-red-600' : nivel === 'alerta' ? 'bg-amber-500' : 'bg-marca-600';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}
