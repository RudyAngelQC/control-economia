import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Comprobante, MedioPago, Movimiento, Tipo } from '../domain/types';
import { COMPROBANTES, MEDIOS } from '../domain/types';
import { clasificar } from '../domain/classifier';
import { formatFecha, formatSoles, hoyISO, nuevoId, parseMonto } from '../domain/format';
import { guardiaParaFecha } from '../domain/totals';
import { getMeta, setMeta } from '../db/db';
import { useAreaLookup, useAreas, useGuardias, useReglas } from '../db/hooks';
import { borrar, guardarUno } from '../db/repo';
import { InfoTip, Interruptor, Opciones, TIPS } from './ui';

interface Props {
  /** Movimiento a editar; undefined = nuevo. */
  editar?: Movimiento;
  onListo: (m: Movimiento | null) => void;
}

/** Formulario de registro rápido (objetivo: menos de 10 segundos). */
export function MovimientoForm({ editar, onListo }: Props) {
  const reglas = useReglas();
  const areas = useAreas();
  const guardias = useGuardias();
  const areaDe = useAreaLookup();
  const montoRef = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<Tipo>(editar?.tipo ?? 'gasto');
  const [monto, setMonto] = useState(editar ? (editar.montoCents / 100).toFixed(2) : '');
  const [descripcion, setDescripcion] = useState(editar?.descripcion ?? '');
  const [fecha, setFecha] = useState(editar?.fecha ?? hoyISO());
  const [medio, setMedio] = useState<MedioPago>(editar?.medio ?? 'yape');
  const [comprobante, setComprobante] = useState<Comprobante>(editar?.comprobante ?? 'ninguno');
  const [reembolsable, setReembolsable] = useState(editar?.reembolsable ?? false);
  const [guardiaId, setGuardiaId] = useState<string | null>(editar?.guardiaId ?? null);
  const [nota, setNota] = useState(editar?.nota ?? '');
  const [ruc, setRuc] = useState(editar?.ruc ?? '');
  const [nro, setNro] = useState(editar?.nroComprobante ?? '');
  const [areaManual, setAreaManual] = useState<string | null>(editar?.areaManual ? editar.areaId : null);
  const [elegirArea, setElegirArea] = useState(false);
  const [masOpciones, setMasOpciones] = useState(!!(editar?.nota || editar?.ruc || editar?.nroComprobante));
  const [error, setError] = useState('');
  const guardiaTocada = useRef(!!editar);

  // Recordar el último medio y la última guardia usados
  useEffect(() => {
    if (editar) return;
    void (async () => {
      setMedio(await getMeta<MedioPago>('ultimoMedio', 'yape'));
      const ultima = await getMeta<string | null>('ultimaGuardia', null);
      if (!guardiaTocada.current) setGuardiaId((g) => g ?? ultima);
    })();
    // foco en el monto: es lo primero que se escribe
    setTimeout(() => montoRef.current?.focus(), 50);
  }, [editar]);

  // La guardia sigue a la fecha (si el usuario no la eligió a mano)
  useEffect(() => {
    if (guardiaTocada.current) return;
    const g = guardiaParaFecha(guardias, fecha);
    if (g) setGuardiaId(g.id);
  }, [fecha, guardias]);

  const auto = useMemo(() => clasificar(descripcion, reglas), [descripcion, reglas]);
  const areaId = areaManual ?? auto?.areaId ?? null;
  const area = areaDe(areaId);
  const cents = parseMonto(monto);

  async function guardar() {
    if (!cents) {
      setError('Ingresa un monto válido');
      montoRef.current?.focus();
      return;
    }
    const base: Movimiento = editar ?? {
      id: nuevoId(),
      updatedAt: 0,
      createdAt: Date.now(),
      comprobanteFisico: false,
    } as Movimiento;
    const m: Movimiento = {
      ...base,
      tipo,
      montoCents: cents,
      descripcion: descripcion.trim(),
      fecha,
      medio,
      comprobante,
      reembolsable: tipo === 'gasto' ? reembolsable : false,
      guardiaId,
      nota: nota.trim() || undefined,
      ruc: comprobante !== 'ninguno' ? ruc.trim() || undefined : undefined,
      nroComprobante: comprobante !== 'ninguno' ? nro.trim() || undefined : undefined,
      areaId,
      areaManual: areaManual !== null,
    };
    const guardado = await guardarUno('movimientos', m);
    await setMeta('ultimoMedio', medio);
    if (guardiaId) await setMeta('ultimaGuardia', guardiaId);
    onListo(guardado);
  }

  async function eliminar() {
    if (!editar || !confirm('¿Borrar este movimiento?')) return;
    await borrar('movimientos', [editar.id]);
    onListo(null);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <Opciones<Tipo>
        valor={tipo}
        onCambio={setTipo}
        opciones={[
          { id: 'gasto', label: 'Gasto' },
          { id: 'ingreso', label: 'Ingreso' },
        ]}
      />

      <div>
        <label className="etiqueta" htmlFor="monto">Monto</label>
        <div className="relative">
          <span className="texto-suave absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold">S/</span>
          <input
            id="monto"
            ref={montoRef}
            className={`campo !py-4 pl-14 text-3xl! font-bold tabular-nums ${error ? 'border-red-500' : ''}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value);
              setError('');
            }}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      <div>
        <label className="etiqueta" htmlFor="desc">Descripción</label>
        <input
          id="desc"
          className="campo"
          placeholder="Ej.: menú, pasaje, casco…"
          autoComplete="off"
          enterKeyHint="done"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setElegirArea((v) => !v)}
          className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
            areaId || !descripcion.trim()
              ? 'border-slate-300 dark:border-slate-700'
              : 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200'
          }`}
        >
          {areaId || descripcion.trim() ? (
            <>
              <span aria-hidden>{area.icono}</span>
              {area.nombre}
              {areaManual ? ' (manual)' : auto ? '' : ' · tocar para elegir'}
            </>
          ) : (
            <span className="texto-suave">Área: se asigna sola al escribir</span>
          )}
          <ChevronDown size={14} />
        </button>
        {elegirArea && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {areas.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAreaManual(a.id);
                  setElegirArea(false);
                }}
                className={`rounded-xl border p-2 text-xs font-medium ${a.id === areaId ? 'border-marca-600 bg-marca-50 dark:bg-marca-800/40' : 'border-slate-200 dark:border-slate-700'}`}
              >
                <span className="block text-xl" aria-hidden>{a.icono}</span>
                {a.nombre}
              </button>
            ))}
            {areaManual && (
              <button type="button" className="col-span-3 text-sm text-marca-700 underline dark:text-marca-500" onClick={() => { setAreaManual(null); setElegirArea(false); }}>
                Volver a clasificación automática
              </button>
            )}
          </div>
        )}
      </div>

      <Opciones<MedioPago> etiqueta="Medio de pago" valor={medio} onCambio={setMedio} opciones={MEDIOS} columnas={2} />
      <Opciones<Comprobante> etiqueta="Comprobante" valor={comprobante} onCambio={setComprobante} opciones={COMPROBANTES} />

      {tipo === 'gasto' && (
        <div className="tarjeta p-3!">
          <Interruptor
            activo={reembolsable}
            onCambio={setReembolsable}
            etiqueta={
              <>
                ¿Reembolsable? <InfoTip titulo="Reembolsable" texto={TIPS.reembolsable} />
              </>
            }
          />
          {reembolsable && comprobante === 'ninguno' && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">Sin comprobante quedará como <strong>sin sustento</strong> en la rendición.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiqueta" htmlFor="fecha">Fecha</label>
          <input id="fecha" type="date" className="campo" value={fecha} max="2100-12-31" onChange={(e) => e.target.value && setFecha(e.target.value)} />
          <span className="texto-suave mt-1 block text-xs">{formatFecha(fecha)}</span>
        </div>
        <div>
          <label className="etiqueta" htmlFor="guardia">
            Guardia <InfoTip titulo="Guardia" texto={TIPS.guardia} />
          </label>
          <select
            id="guardia"
            className="campo"
            value={guardiaId ?? ''}
            onChange={(e) => {
              guardiaTocada.current = true;
              setGuardiaId(e.target.value || null);
            }}
          >
            <option value="">Ninguna</option>
            {guardias.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
          {guardias.length === 0 && (
            <Link to="/mas/guardias" className="mt-1 block text-xs text-marca-700 underline dark:text-marca-500" onClick={() => onListo(null)}>
              Crear guardia
            </Link>
          )}
        </div>
      </div>

      <button type="button" className="texto-suave flex items-center gap-1 text-sm" onClick={() => setMasOpciones((v) => !v)} aria-expanded={masOpciones}>
        <ChevronDown size={16} className={masOpciones ? 'rotate-180' : ''} /> Nota{comprobante !== 'ninguno' ? ', RUC y N° de comprobante' : ''} (opcional)
      </button>
      {masOpciones && (
        <div className="flex flex-col gap-3">
          {comprobante !== 'ninguno' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="etiqueta" htmlFor="ruc">RUC</label>
                <input id="ruc" className="campo" inputMode="numeric" maxLength={11} value={ruc} onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div>
                <label className="etiqueta" htmlFor="nro">N° comprobante</label>
                <input id="nro" className="campo" placeholder="F001-123" value={nro} onChange={(e) => setNro(e.target.value.toUpperCase())} />
              </div>
            </div>
          )}
          <div>
            <label className="etiqueta" htmlFor="nota">Nota</label>
            <textarea id="nota" className="campo" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-200 bg-white px-4 pt-3 pb-1 dark:border-slate-800 dark:bg-slate-900">
        {editar && (
          <button type="button" className="btn-secundario px-3! text-red-600" onClick={eliminar} aria-label="Borrar movimiento">
            <Trash2 size={20} />
          </button>
        )}
        <button type="submit" className="btn-primario flex-1 text-lg">
          {editar ? 'Guardar cambios' : `Guardar${cents ? ` ${formatSoles(cents)}` : ''}`}
        </button>
      </div>
    </form>
  );
}
