import { formatSoles } from '../domain/format';

export interface FilaBarra {
  id: string;
  etiqueta: string;
  icono?: string;
  valor: number;
  /** Valor del mes anterior (marca fina de referencia). */
  anterior?: number;
}

/**
 * Barras horizontales ordenadas, de un solo color. Comparan magnitudes entre
 * categorías y se leen bien en un celular. El monto se escribe al lado, así
 * que el color no es el único portador de información.
 */
export function Barras({ filas, titulo, maxFilas = 8 }: { filas: FilaBarra[]; titulo: string; maxFilas?: number }) {
  // Más de maxFilas categorías se agrupan en "Otras" (no se inventan colores).
  let visibles = filas;
  if (filas.length > maxFilas) {
    const resto = filas.slice(maxFilas - 1);
    visibles = [
      ...filas.slice(0, maxFilas - 1),
      {
        id: '__otras',
        etiqueta: `Otras (${resto.length})`,
        valor: resto.reduce((s, f) => s + f.valor, 0),
        anterior: resto.reduce((s, f) => s + (f.anterior ?? 0), 0),
      },
    ];
  }
  const max = Math.max(1, ...visibles.map((f) => Math.max(f.valor, f.anterior ?? 0)));
  const total = visibles.reduce((s, f) => s + f.valor, 0);
  return (
    <figure>
      <figcaption className="mb-3 font-bold">{titulo}</figcaption>
      <ul className="flex flex-col gap-3">
        {visibles.map((f) => (
          <li key={f.id} title={`${f.etiqueta}: ${formatSoles(f.valor)}${f.anterior !== undefined ? ` · mes anterior ${formatSoles(f.anterior)}` : ''}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">
                {f.icono && <span aria-hidden className="mr-1">{f.icono}</span>}
                {f.etiqueta}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatSoles(f.valor)}
                <span className="texto-suave ml-1 text-xs font-normal">{total ? Math.round((f.valor / total) * 100) : 0}%</span>
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-marca-600 dark:bg-marca-500" style={{ width: `${(f.valor / max) * 100}%` }} />
              {f.anterior !== undefined && f.anterior > 0 && (
                <div
                  className="absolute -top-1 h-[18px] w-0.5 rounded bg-slate-500 dark:bg-slate-300"
                  style={{ left: `calc(${(f.anterior / max) * 100}% - 1px)` }}
                  aria-hidden
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      {visibles.some((f) => f.anterior) && (
        <p className="texto-suave mt-3 flex items-center gap-2 text-xs">
          <span className="inline-block h-3 w-0.5 bg-slate-500 dark:bg-slate-300" aria-hidden /> Marca = mes anterior
        </p>
      )}
    </figure>
  );
}
