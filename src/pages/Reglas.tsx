import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAreaLookup, useAreas, useReglas } from '../db/hooks';
import { aplicarReglaASinClasificar, borrar, guardarUno } from '../db/repo';
import { clasificar, normalizar } from '../domain/classifier';
import { nuevoId } from '../domain/format';
import type { Regla } from '../domain/types';
import { Encabezado } from '../components/Volver';
import { Hoja } from '../components/ui';
import { useToast } from '../components/toast';

function EditorRegla({ regla, onListo }: { regla: Regla | null; onListo: () => void }) {
  const areas = useAreas();
  const reglas = useReglas();
  const toast = useToast();
  const [palabra, setPalabra] = useState(regla?.palabra ?? '');
  const [areaId, setAreaId] = useState(regla?.areaId ?? areas[0]?.id ?? 'otros');
  const norm = normalizar(palabra);
  const duplicada = reglas.find((r) => normalizar(r.palabra) === norm && r.id !== regla?.id);

  async function guardar() {
    if (!norm || duplicada) return;
    const r = await guardarUno<Regla>('reglas', { ...(regla ?? { id: nuevoId(), updatedAt: 0 }), palabra: norm, areaId });
    const n = await aplicarReglaASinClasificar(r);
    toast({ texto: `Regla guardada${n ? `; ${n} movimiento${n > 1 ? 's' : ''} sin clasificar ahora tienen área` : ''}.` });
    onListo();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="etiqueta" htmlFor="palabra">Palabra clave</label>
        <input id="palabra" className="campo" value={palabra} onChange={(e) => setPalabra(e.target.value)} placeholder="Ej.: lavanderia" autoFocus />
        <p className="texto-suave mt-1 text-xs">
          Se compara sin tildes ni mayúsculas, por palabra completa (acepta plural). Si varias reglas coinciden, gana la más larga.
        </p>
        {duplicada && <p className="mt-1 text-sm text-red-600">Ya existe una regla con esa palabra.</p>}
      </div>
      <div>
        <label className="etiqueta" htmlFor="area-regla">Área</label>
        <select id="area-regla" className="campo" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.icono} {a.nombre}</option>)}
        </select>
      </div>
      <button className="btn-primario" onClick={guardar} disabled={!norm || !!duplicada}>Guardar regla</button>
    </div>
  );
}

export function Reglas() {
  const reglas = useReglas();
  const areaDe = useAreaLookup();
  const [q, setQ] = useState('');
  const [prueba, setPrueba] = useState('');
  const [editando, setEditando] = useState<Regla | null | 'nueva'>(null);

  const filtradas = useMemo(() => {
    const n = normalizar(q);
    return reglas.filter((r) => !n || normalizar(r.palabra).includes(n) || normalizar(areaDe(r.areaId).nombre).includes(n));
  }, [reglas, q, areaDe]);

  const resultadoPrueba = prueba ? clasificar(prueba, reglas) : null;

  return (
    <div>
      <Encabezado titulo="Reglas">
        <button className="btn-primario min-h-10! px-3! text-sm" onClick={() => setEditando('nueva')}>
          <Plus size={18} /> Nueva
        </button>
      </Encabezado>

      <section className="tarjeta mb-4">
        <label className="etiqueta" htmlFor="probar">Probar una descripción</label>
        <input id="probar" className="campo" placeholder="Ej.: Pasaje mina Juliaca" value={prueba} onChange={(e) => setPrueba(e.target.value)} />
        {prueba && (
          <p className="mt-2 text-sm">
            {resultadoPrueba ? (
              <>→ {areaDe(resultadoPrueba.areaId).icono} <strong>{areaDe(resultadoPrueba.areaId).nombre}</strong> <span className="texto-suave">(por “{resultadoPrueba.regla.palabra}”)</span></>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">Sin clasificar: ninguna regla coincide.</span>
            )}
          </p>
        )}
      </section>

      <label className="relative mb-3 block">
        <Search size={18} className="texto-suave absolute top-1/2 left-3 -translate-y-1/2" />
        <input className="campo pl-10" placeholder="Buscar regla o área…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar reglas" />
      </label>

      <ul className="tarjeta divide-y divide-slate-100 py-0! dark:divide-slate-800">
        {filtradas.map((r) => {
          const a = areaDe(r.areaId);
          return (
            <li key={r.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.palabra}</span>
                <span className="texto-suave text-sm">{a.icono} {a.nombre}</span>
              </span>
              <button className="rounded-full p-3 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setEditando(r)} aria-label={`Editar regla ${r.palabra}`}>
                <Pencil size={18} />
              </button>
              <button
                className="rounded-full p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => confirm(`¿Borrar la regla “${r.palabra}”?`) && borrar('reglas', [r.id])}
                aria-label={`Borrar regla ${r.palabra}`}
              >
                <Trash2 size={18} />
              </button>
            </li>
          );
        })}
        {filtradas.length === 0 && <li className="texto-suave py-6 text-center text-sm">No hay reglas que coincidan.</li>}
      </ul>

      <Hoja abierta={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === 'nueva' ? 'Nueva regla' : 'Editar regla'}>
        {editando !== null && <EditorRegla regla={editando === 'nueva' ? null : editando} onListo={() => setEditando(null)} />}
      </Hoja>
    </div>
  );
}
