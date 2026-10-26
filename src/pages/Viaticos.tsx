import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Download, Square } from 'lucide-react';
import { useAreaLookup, useGuardias, useMeta, useMovimientos } from '../db/hooks';
import { guardarUno } from '../db/repo';
import { formatFecha, formatSoles, hoyISO } from '../domain/format';
import { guardiaParaFecha, rendicion } from '../domain/totals';
import { labelComprobante, labelMedio, type EstadoGuardia } from '../domain/types';
import { EstadoVacio, InfoTip, Opciones, TIPS } from '../components/ui';
import { useAcciones } from '../components/Acciones';
import { useToast } from '../components/toast';
import { exportarRendicionXlsx } from '../export/exportar';

export function Viaticos() {
  const guardias = useGuardias();
  const movs = useMovimientos();
  const areaDe = useAreaLookup();
  const { editar } = useAcciones();
  const toast = useToast();
  const [ultima] = useMeta<string | null>('ultimaGuardia', null);
  const [sel, setSel] = useState<string | null>(null);

  // Por defecto: la guardia de hoy, si no la última usada, si no la más reciente
  useEffect(() => {
    if (sel && guardias.some((g) => g.id === sel)) return;
    const def = guardiaParaFecha(guardias, hoyISO())?.id ?? (ultima && guardias.some((g) => g.id === ultima) ? ultima : guardias[0]?.id);
    setSel(def ?? null);
  }, [guardias, ultima, sel]);

  const guardia = guardias.find((g) => g.id === sel);
  const r = useMemo(() => (guardia ? rendicion(movs, guardia) : null), [movs, guardia]);

  if (guardias.length === 0) {
    return (
      <div className="pt-2">
        <EstadoVacio
          icono="⛏️"
          titulo="Crea tu primera guardia"
          texto="Una guardia es tu período de trabajo en mina (por ejemplo, del 01/11 al 14/11). Los gastos reembolsables se agrupan por guardia para rendirlos y cobrarlos."
          accion={<Link to="/mas/guardias" className="btn-primario">Crear guardia</Link>}
        />
      </div>
    );
  }

  async function cambiarEstado(estado: EstadoGuardia) {
    if (!guardia) return;
    await guardarUno('guardias', { ...guardia, estado });
  }

  async function exportar() {
    if (!guardia || !r) return;
    try {
      await exportarRendicionXlsx(guardia, r, (id) => areaDe(id).nombre);
    } catch (e) {
      toast({ texto: `No se pudo exportar: ${(e as Error).message}`, tipo: 'error' });
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <label className="etiqueta" htmlFor="sel-guardia">
          Guardia <InfoTip titulo="Guardia" texto={TIPS.guardia} />
        </label>
        <select id="sel-guardia" className="campo font-semibold" value={sel ?? ''} onChange={(e) => setSel(e.target.value)}>
          {guardias.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre} ({formatFecha(g.inicio)} – {formatFecha(g.fin)})
            </option>
          ))}
        </select>
      </div>

      {guardia && r && (
        <>
          <section className="tarjeta">
            <div className="texto-suave text-xs font-semibold uppercase tracking-wide">Total reembolsable</div>
            <div className="text-3xl font-extrabold tabular-nums">{formatSoles(r.total)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <dt className="texto-suave">Con factura</dt>
                <dd className="font-bold tabular-nums">{formatSoles(r.factura)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <dt className="texto-suave">Con boleta</dt>
                <dd className="font-bold tabular-nums">{formatSoles(r.boleta)}</dd>
              </div>
              <div className={`col-span-2 rounded-xl p-3 ${r.sinSustento > 0 ? 'border-2 border-red-500 bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-200' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
                <dt className="flex items-center font-semibold">
                  Sin sustento <InfoTip titulo="Sin sustento" texto={TIPS.sinSustento} />
                </dt>
                <dd className="text-xl font-extrabold tabular-nums">{formatSoles(r.sinSustento)}</dd>
                {r.sinSustento > 0 && <p className="text-xs">Pide factura o boleta antes de cerrar la guardia, o la empresa podría no reembolsarlo.</p>}
              </div>
            </dl>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
              <span>Cobrado: <strong className="tabular-nums">{formatSoles(r.cobrado)}</strong></span>
              <span>Pendiente: <strong className="tabular-nums text-marca-700 dark:text-marca-500">{formatSoles(r.pendiente)}</strong></span>
            </div>
          </section>

          <Opciones<EstadoGuardia>
            etiqueta="Estado de la guardia"
            valor={guardia.estado}
            onCambio={cambiarEstado}
            opciones={[
              { id: 'abierta', label: 'Abierta' },
              { id: 'rendida', label: 'Rendida' },
              { id: 'cobrada', label: 'Cobrada' },
            ]}
          />

          <button className="btn-primario" onClick={exportar} disabled={r.items.length === 0}>
            <Download size={20} /> Exportar rendición a Excel (.xlsx)
          </button>

          <section>
            <h2 className="mb-1 px-1 font-bold">Checklist de comprobantes</h2>
            <p className="texto-suave mb-2 px-1 text-sm">
              Marca los que ya tienes en físico: {r.fisicos} de {r.conComprobante}.
            </p>
            {r.items.length === 0 ? (
              <EstadoVacio icono="🧾" titulo="Sin gastos reembolsables" texto="Cuando registres un gasto, activa “¿Reembolsable?” y elige esta guardia para que aparezca aquí." />
            ) : (
              <ul className="tarjeta divide-y divide-slate-100 py-0! dark:divide-slate-800">
                {r.items.map((m) => {
                  const sin = m.comprobante === 'ninguno';
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-3">
                      {sin ? (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300" title="Sin comprobante">
                          S/C
                        </span>
                      ) : (
                        <button
                          className="flex h-11 w-11 shrink-0 items-center justify-center text-marca-700 dark:text-marca-500"
                          role="checkbox"
                          aria-checked={m.comprobanteFisico}
                          aria-label={`Tengo el comprobante de ${m.descripcion}`}
                          onClick={() => guardarUno('movimientos', { ...m, comprobanteFisico: !m.comprobanteFisico })}
                        >
                          {m.comprobanteFisico ? <CheckSquare size={28} /> : <Square size={28} className="text-slate-400" />}
                        </button>
                      )}
                      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => editar(m)}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{m.descripcion || 'Sin descripción'}</span>
                          <span className={`text-xs ${sin ? 'font-semibold text-red-700 dark:text-red-400' : 'texto-suave'}`}>
                            {formatFecha(m.fecha)} · {labelMedio(m.medio)} · {sin ? 'SIN SUSTENTO' : labelComprobante(m.comprobante)}
                            {m.nroComprobante ? ` ${m.nroComprobante}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums">{formatSoles(m.montoCents)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
