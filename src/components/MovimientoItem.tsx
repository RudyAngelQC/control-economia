import type { Area, Movimiento } from '../domain/types';
import { labelComprobante, labelMedio } from '../domain/types';
import { formatSoles } from '../domain/format';

export function MovimientoItem({
  m,
  area,
  onEditar,
  onAsignar,
}: {
  m: Movimiento;
  area: Pick<Area, 'icono' | 'nombre' | 'color'>;
  onEditar: () => void;
  onAsignar: () => void;
}) {
  const sinSustento = m.reembolsable && m.comprobante === 'ninguno';
  return (
    <li className="flex items-center gap-3 py-3">
      <button
        onClick={m.areaId ? onEditar : onAsignar}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${m.areaId ? '' : 'ring-2 ring-amber-400'}`}
        style={{ backgroundColor: `${area.color}22` }}
        aria-label={m.areaId ? `Área ${area.nombre}` : 'Asignar área'}
      >
        <span aria-hidden>{area.icono}</span>
      </button>
      <button onClick={onEditar} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{m.descripcion || <em className="texto-suave">Sin descripción</em>}</span>
          <span className="texto-suave flex flex-wrap items-center gap-x-1.5 text-xs">
            {m.areaId ? area.nombre : <span className="font-semibold text-amber-700 dark:text-amber-400">Sin clasificar</span>}
            <span aria-hidden>·</span>
            {labelMedio(m.medio)}
            {m.comprobante !== 'ninguno' && <> · {labelComprobante(m.comprobante)}</>}
            {m.reembolsable && (
              <span className={`rounded px-1.5 py-0.5 font-semibold ${sinSustento ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : 'bg-marca-100 text-marca-800 dark:bg-marca-800/40 dark:text-marca-100'}`}>
                {sinSustento ? 'Reemb. sin sustento' : 'Reembolsable'}
              </span>
            )}
          </span>
        </span>
        <span className={`shrink-0 font-bold tabular-nums ${m.tipo === 'ingreso' ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
          {m.tipo === 'ingreso' ? '+' : '−'}
          {formatSoles(m.montoCents)}
        </span>
      </button>
    </li>
  );
}
