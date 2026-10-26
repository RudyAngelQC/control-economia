import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useGuardias, useMovimientos } from '../db/hooks';
import { borrar, guardarUno } from '../db/repo';
import { formatFecha, formatSoles, hoyISO, nuevoId, sumarDias } from '../domain/format';
import { rendicion } from '../domain/totals';
import type { Guardia } from '../domain/types';
import { Encabezado } from '../components/Volver';
import { EstadoVacio, Hoja, InfoTip, TIPS } from '../components/ui';

const ESTADO = {
  abierta: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  rendida: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  cobrada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

function EditorGuardia({ guardia, sugerida, onListo }: { guardia: Guardia | null; sugerida: { inicio: string; fin: string; nombre: string }; onListo: () => void }) {
  const [nombre, setNombre] = useState(guardia?.nombre ?? sugerida.nombre);
  const [inicio, setInicio] = useState(guardia?.inicio ?? sugerida.inicio);
  const [fin, setFin] = useState(guardia?.fin ?? sugerida.fin);
  const [dias, setDias] = useState(14);
  const valido = nombre.trim() && inicio && fin && inicio <= fin;

  async function guardar() {
    if (!valido) return;
    await guardarUno<Guardia>('guardias', {
      ...(guardia ?? { id: nuevoId(), updatedAt: 0, estado: 'abierta' as const }),
      nombre: nombre.trim(),
      inicio,
      fin,
    });
    onListo();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="etiqueta" htmlFor="g-nombre">Nombre</label>
        <input id="g-nombre" className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Guardia noviembre 1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiqueta" htmlFor="g-inicio">Inicio</label>
          <input id="g-inicio" type="date" className="campo" value={inicio} onChange={(e) => { setInicio(e.target.value); if (e.target.value) setFin(sumarDias(e.target.value, dias - 1)); }} />
          <span className="texto-suave text-xs">{formatFecha(inicio)}</span>
        </div>
        <div>
          <label className="etiqueta" htmlFor="g-fin">Fin</label>
          <input id="g-fin" type="date" className="campo" value={fin} min={inicio} onChange={(e) => setFin(e.target.value)} />
          <span className="texto-suave text-xs">{formatFecha(fin)}</span>
        </div>
      </div>
      {!guardia && (
        <div>
          <span className="etiqueta">Duración rápida</span>
          <div className="flex gap-2">
            {[7, 10, 14, 20, 21].map((d) => (
              <button key={d} type="button" className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${dias === d ? 'border-marca-700 bg-marca-700 text-white' : 'border-slate-300 dark:border-slate-700'}`} onClick={() => { setDias(d); setFin(sumarDias(inicio, d - 1)); }}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      )}
      {inicio > fin && <p className="text-sm text-red-600">La fecha de fin debe ser posterior al inicio.</p>}
      <button className="btn-primario" onClick={guardar} disabled={!valido}>Guardar guardia</button>
    </div>
  );
}

export function Guardias() {
  const guardias = useGuardias();
  const movs = useMovimientos();
  const [editando, setEditando] = useState<Guardia | null | 'nueva'>(null);

  const ultima = guardias[0];
  const inicioSug = ultima ? sumarDias(ultima.fin, 8) : hoyISO();
  const sugerida = { inicio: inicioSug, fin: sumarDias(inicioSug, 13), nombre: `Guardia ${formatFecha(inicioSug).slice(0, 5)}` };

  return (
    <div>
      <Encabezado titulo="Guardias">
        <InfoTip titulo="Guardia" texto={TIPS.guardia} />
        <button className="btn-primario min-h-10! px-3! text-sm" onClick={() => setEditando('nueva')}>
          <Plus size={18} /> Nueva
        </button>
      </Encabezado>

      {guardias.length === 0 ? (
        <EstadoVacio
          icono="⛏️"
          titulo="Sin guardias todavía"
          texto="Crea una guardia por cada período en mina. Al registrar un gasto se elige sola según la fecha."
          accion={<button className="btn-primario" onClick={() => setEditando('nueva')}>Crear guardia</button>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {guardias.map((g) => {
            const r = rendicion(movs, g);
            return (
              <li key={g.id} className="tarjeta flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{g.nombre}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ESTADO[g.estado]}`}>{g.estado}</span>
                  </div>
                  <div className="texto-suave text-sm">{formatFecha(g.inicio)} – {formatFecha(g.fin)}</div>
                  <div className="text-sm">
                    Reembolsable: <strong className="tabular-nums">{formatSoles(r.total)}</strong>
                    {r.sinSustento > 0 && <span className="ml-2 font-semibold text-red-700 dark:text-red-400">· sin sustento {formatSoles(r.sinSustento)}</span>}
                  </div>
                </div>
                <button className="rounded-full p-3 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setEditando(g)} aria-label={`Editar ${g.nombre}`}>
                  <Pencil size={18} />
                </button>
                <button
                  className="rounded-full p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  aria-label={`Borrar ${g.nombre}`}
                  onClick={async () => {
                    const usados = movs.filter((m) => m.guardiaId === g.id);
                    const msg = usados.length
                      ? `¿Borrar “${g.nombre}”? Sus ${usados.length} movimientos quedarán sin guardia (no se borran).`
                      : `¿Borrar “${g.nombre}”?`;
                    if (!confirm(msg)) return;
                    for (const m of usados) await guardarUno('movimientos', { ...m, guardiaId: null });
                    await borrar('guardias', [g.id]);
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Hoja abierta={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === 'nueva' ? 'Nueva guardia' : 'Editar guardia'}>
        {editando !== null && <EditorGuardia guardia={editando === 'nueva' ? null : editando} sugerida={sugerida} onListo={() => setEditando(null)} />}
      </Hoja>
    </div>
  );
}
