import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useAreaLookup, useAreas, useGuardias, useMovimientos } from '../db/hooks';
import { normalizar } from '../domain/classifier';
import { formatFecha, formatSoles, hoyISO, mesDe, nombreMes } from '../domain/format';
import { MEDIOS, type Movimiento } from '../domain/types';
import { EstadoVacio } from '../components/ui';
import { MovimientoItem } from '../components/MovimientoItem';
import { useAcciones } from '../components/Acciones';

interface Filtros {
  mes: string; // '' = todos
  area: string; // '' = todas, 'sin-clasificar'
  medio: string;
  reembolsable: '' | 'si' | 'no';
  guardia: string;
}

const SIN_FILTROS: Filtros = { mes: '', area: '', medio: '', reembolsable: '', guardia: '' };

export function Movimientos() {
  const movs = useMovimientos();
  const areas = useAreas();
  const guardias = useGuardias();
  const areaDe = useAreaLookup();
  const { editar, asignarArea, nuevo } = useAcciones();
  const [texto, setTexto] = useState('');
  const [filtros, setFiltros] = useState<Filtros>({ ...SIN_FILTROS, mes: mesDe(hoyISO()) });
  const [verFiltros, setVerFiltros] = useState(false);

  const meses = useMemo(() => {
    const set = new Set(movs.map((m) => mesDe(m.fecha)));
    set.add(mesDe(hoyISO()));
    return [...set].sort().reverse();
  }, [movs]);

  const filtrados = useMemo(() => {
    const q = normalizar(texto);
    return movs.filter((m) => {
      if (filtros.mes && mesDe(m.fecha) !== filtros.mes) return false;
      if (filtros.area && (m.areaId ?? 'sin-clasificar') !== filtros.area) return false;
      if (filtros.medio && m.medio !== filtros.medio) return false;
      if (filtros.reembolsable && m.reembolsable !== (filtros.reembolsable === 'si')) return false;
      if (filtros.guardia && m.guardiaId !== filtros.guardia) return false;
      if (q && !normalizar(`${m.descripcion} ${m.nota ?? ''} ${areaDe(m.areaId).nombre}`).includes(q)) return false;
      return true;
    });
  }, [movs, filtros, texto, areaDe]);

  const grupos = useMemo(() => {
    const g = new Map<string, Movimiento[]>();
    for (const m of filtrados) g.set(m.fecha, [...(g.get(m.fecha) ?? []), m]);
    return [...g.entries()];
  }, [filtrados]);

  const activos = Object.entries(filtros).filter(([k, v]) => v && k !== 'mes').length;
  const totalGasto = filtrados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.montoCents, 0);
  const totalIngreso = filtrados.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.montoCents, 0);
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setFiltros((f) => ({ ...f, [k]: v }));

  if (movs.length === 0) {
    return (
      <div className="pt-2">
        <EstadoVacio
          icono="🧾"
          titulo="Tu lista está vacía"
          texto="Aquí aparecerán todos tus gastos e ingresos. Podrás buscarlos, filtrarlos, editarlos y borrarlos."
          accion={<button className="btn-primario" onClick={nuevo}>Agregar movimiento</button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search size={18} className="texto-suave absolute top-1/2 left-3 -translate-y-1/2" />
          <input className="campo pl-10" placeholder="Buscar…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar movimientos" />
        </label>
        <button className={`btn-secundario relative !px-3 ${verFiltros ? 'ring-2 ring-marca-500' : ''}`} onClick={() => setVerFiltros((v) => !v)} aria-label="Filtros" aria-expanded={verFiltros}>
          <SlidersHorizontal size={20} />
          {activos > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-marca-700 text-xs text-white">{activos}</span>}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Mes">
        <button role="tab" aria-selected={filtros.mes === ''} onClick={() => set('mes', '')} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${filtros.mes === '' ? 'bg-marca-700 text-white' : 'bg-white dark:bg-slate-900'}`}>
          Todos
        </button>
        {meses.slice(0, 12).map((m) => (
          <button key={m} role="tab" aria-selected={filtros.mes === m} onClick={() => set('mes', m)} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${filtros.mes === m ? 'bg-marca-700 text-white' : 'bg-white dark:bg-slate-900'}`}>
            {nombreMes(m)}
          </button>
        ))}
      </div>

      {verFiltros && (
        <div className="tarjeta grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="etiqueta" htmlFor="f-area">Área</label>
            <select id="f-area" className="campo" value={filtros.area} onChange={(e) => set('area', e.target.value)}>
              <option value="">Todas</option>
              <option value="sin-clasificar">❓ Sin clasificar</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.icono} {a.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="f-medio">Medio</label>
            <select id="f-medio" className="campo" value={filtros.medio} onChange={(e) => set('medio', e.target.value)}>
              <option value="">Todos</option>
              {MEDIOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="f-reemb">Reembolsable</label>
            <select id="f-reemb" className="campo" value={filtros.reembolsable} onChange={(e) => set('reembolsable', e.target.value as Filtros['reembolsable'])}>
              <option value="">Todos</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="etiqueta" htmlFor="f-guardia">Guardia</label>
            <select id="f-guardia" className="campo" value={filtros.guardia} onChange={(e) => set('guardia', e.target.value)}>
              <option value="">Todas</option>
              {guardias.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          {activos > 0 && (
            <button className="btn-secundario col-span-2" onClick={() => setFiltros((f) => ({ ...SIN_FILTROS, mes: f.mes }))}>
              <X size={18} /> Quitar filtros
            </button>
          )}
        </div>
      )}

      <div className="texto-suave flex justify-between px-1 text-sm">
        <span>{filtrados.length} movimiento{filtrados.length === 1 ? '' : 's'}</span>
        <span className="tabular-nums">
          <span className="text-emerald-700 dark:text-emerald-400">+{formatSoles(totalIngreso)}</span> · −{formatSoles(totalGasto)}
        </span>
      </div>

      {filtrados.length === 0 ? (
        <EstadoVacio icono="🔍" titulo="Sin resultados" texto="Ningún movimiento coincide con la búsqueda o los filtros. Prueba quitando alguno." />
      ) : (
        grupos.map(([fecha, items]) => (
          <section key={fecha}>
            <h3 className="texto-suave px-1 text-xs font-semibold uppercase tracking-wide">{formatFecha(fecha)}</h3>
            <ul className="tarjeta divide-y divide-slate-100 py-0! dark:divide-slate-800">
              {items.map((m) => (
                <MovimientoItem key={m.id} m={m} area={areaDe(m.areaId)} onEditar={() => editar(m)} onAsignar={() => asignarArea(m)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
