import { useState } from 'react';
import { useAreas, useMovimientos, usePresupuestos } from '../db/hooks';
import { borrar, guardarUno } from '../db/repo';
import { formatSoles, hoyISO, mesDe, nombreMes, nuevoId, parseMonto } from '../domain/format';
import { gastoPersonalPorArea, nivelPresupuesto, topeDelMes } from '../domain/totals';
import type { Area, Presupuesto } from '../domain/types';
import { Encabezado } from '../components/Volver';
import { BarraProgreso, Hoja, InfoTip, SelectorMes, TIPS } from '../components/ui';

function EditorTope({ area, mes, onListo }: { area: Area; mes: string; onListo: () => void }) {
  const presupuestos = usePresupuestos();
  const base = presupuestos.find((p) => p.areaId === area.id && p.mes === null);
  const delMes = presupuestos.find((p) => p.areaId === area.id && p.mes === mes);
  const [montoBase, setMontoBase] = useState(base ? (base.montoCents / 100).toFixed(2) : '');
  const [ajuste, setAjuste] = useState(!!delMes);
  const [montoMes, setMontoMes] = useState(delMes ? (delMes.montoCents / 100).toFixed(2) : '');

  async function guardarTope(existente: Presupuesto | undefined, texto: string, m: string | null) {
    const cents = parseMonto(texto);
    if (!cents) {
      if (existente) await borrar('presupuestos', [existente.id]);
      return;
    }
    await guardarUno<Presupuesto>('presupuestos', { ...(existente ?? { id: nuevoId(), updatedAt: 0 }), areaId: area.id, mes: m, montoCents: cents });
  }

  async function guardar() {
    await guardarTope(base, montoBase, null);
    await guardarTope(delMes, ajuste ? montoMes : '', mes);
    onListo();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="etiqueta" htmlFor="tope">Tope mensual (todos los meses)</label>
        <input id="tope" className="campo text-xl font-bold" inputMode="decimal" placeholder="Sin tope" value={montoBase} onChange={(e) => setMontoBase(e.target.value)} autoFocus />
        <p className="texto-suave mt-1 text-xs">Déjalo vacío para quitar el tope.</p>
      </div>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-marca-700" checked={ajuste} onChange={(e) => setAjuste(e.target.checked)} />
        <span>Usar otro tope solo en {nombreMes(mes)}</span>
      </label>
      {ajuste && (
        <input className="campo" inputMode="decimal" placeholder={`Tope de ${nombreMes(mes)}`} value={montoMes} onChange={(e) => setMontoMes(e.target.value)} aria-label={`Tope de ${nombreMes(mes)}`} />
      )}
      <button className="btn-primario" onClick={guardar}>Guardar</button>
    </div>
  );
}

export function Presupuestos() {
  const [mes, setMes] = useState(mesDe(hoyISO()));
  const areas = useAreas();
  const movs = useMovimientos();
  const presupuestos = usePresupuestos();
  const [editando, setEditando] = useState<Area | null>(null);
  const gastado = gastoPersonalPorArea(movs, mes);
  const areasGasto = areas.filter((a) => a.id !== 'sueldo' && a.id !== 'reembolso');

  const totalTope = areasGasto.reduce((s, a) => s + (topeDelMes(presupuestos, a.id, mes) ?? 0), 0);
  const totalGastado = areasGasto.reduce((s, a) => s + (topeDelMes(presupuestos, a.id, mes) ? (gastado.get(a.id) ?? 0) : 0), 0);

  return (
    <div>
      <Encabezado titulo="Presupuesto">
        <InfoTip titulo="Presupuesto" texto={TIPS.presupuesto} />
      </Encabezado>
      <SelectorMes mes={mes} onCambio={setMes} />

      {totalTope > 0 && (
        <section className="tarjeta mt-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">Total con tope</span>
            <span className="tabular-nums">{formatSoles(totalGastado)} / {formatSoles(totalTope)}</span>
          </div>
          <BarraProgreso pct={(totalGastado / totalTope) * 100} nivel={nivelPresupuesto(totalGastado, totalTope)} />
        </section>
      )}

      <p className="texto-suave my-3 px-1 text-sm">Toca un área para ponerle o cambiarle el tope.</p>
      <ul className="tarjeta divide-y divide-slate-100 py-0! dark:divide-slate-800">
        {areasGasto.map((a) => {
          const tope = topeDelMes(presupuestos, a.id, mes);
          const g = gastado.get(a.id) ?? 0;
          const nivel = tope ? nivelPresupuesto(g, tope) : 'ok';
          const ajustado = presupuestos.some((p) => p.areaId === a.id && p.mes === mes);
          return (
            <li key={a.id}>
              <button className="w-full py-3 text-left" onClick={() => setEditando(a)}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{a.icono} {a.nombre}{ajustado && <span className="texto-suave text-xs"> · ajustado este mes</span>}</span>
                  <span className="tabular-nums">
                    {tope ? (
                      <>
                        <span className={nivel === 'excedido' ? 'font-bold text-red-700 dark:text-red-400' : nivel === 'alerta' ? 'font-bold text-amber-700 dark:text-amber-400' : ''}>{formatSoles(g)}</span>
                        <span className="texto-suave"> / {formatSoles(tope)}</span>
                      </>
                    ) : (
                      <span className="texto-suave">{g ? `${formatSoles(g)} · ` : ''}sin tope</span>
                    )}
                  </span>
                </div>
                {tope ? <BarraProgreso pct={(g / tope) * 100} nivel={nivel} /> : null}
                {nivel === 'excedido' && tope && <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">Te pasaste por {formatSoles(g - tope)}</p>}
              </button>
            </li>
          );
        })}
      </ul>

      <Hoja abierta={!!editando} onCerrar={() => setEditando(null)} titulo={editando ? `${editando.icono} ${editando.nombre}` : ''}>
        {editando && <EditorTope key={editando.id + mes} area={editando} mes={mes} onListo={() => setEditando(null)} />}
      </Hoja>
    </div>
  );
}
