import { useState } from 'react';
import type { Movimiento, Regla } from '../domain/types';
import { normalizar, sugerirPalabra } from '../domain/classifier';
import { nuevoId } from '../domain/format';
import { useAreas } from '../db/hooks';
import { aplicarReglaASinClasificar, guardarUno } from '../db/repo';
import { useToast } from './toast';

/**
 * Asigna el área a un movimiento "Sin clasificar" con un toque y ofrece crear
 * la regla para la próxima vez.
 */
export function AsignarArea({ mov, onListo }: { mov: Movimiento; onListo: () => void }) {
  const areas = useAreas();
  const toast = useToast();
  const [elegida, setElegida] = useState<string | null>(null);
  const [palabra, setPalabra] = useState(sugerirPalabra(mov.descripcion));

  async function elegir(areaId: string) {
    await guardarUno('movimientos', { ...mov, areaId, areaManual: true });
    if (!sugerirPalabra(mov.descripcion)) {
      onListo();
      return;
    }
    setElegida(areaId);
  }

  async function crearRegla() {
    const p = normalizar(palabra);
    if (!p || !elegida) return;
    const regla: Regla = { id: nuevoId(), palabra: p, areaId: elegida, updatedAt: 0 };
    await guardarUno('reglas', regla);
    const n = await aplicarReglaASinClasificar(regla);
    toast({ texto: `Regla "${p}" creada${n ? ` y aplicada a ${n} movimiento${n > 1 ? 's' : ''} más` : ''}.` });
    onListo();
  }

  if (elegida) {
    const area = areas.find((a) => a.id === elegida);
    return (
      <div className="flex flex-col gap-4">
        <p>
          Listo: <strong>{mov.descripcion}</strong> → {area?.icono} {area?.nombre}.
        </p>
        <p className="texto-suave text-sm">¿Quieres que la próxima vez se clasifique solo? Crea una regla con esta palabra clave:</p>
        <input className="campo" value={palabra} onChange={(e) => setPalabra(e.target.value)} aria-label="Palabra clave" />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secundario" onClick={onListo}>No, gracias</button>
          <button className="btn-primario" onClick={crearRegla} disabled={!normalizar(palabra)}>Crear regla</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3">
        ¿A qué área pertenece <strong>“{mov.descripcion || 'sin descripción'}”</strong>?
      </p>
      <div className="grid grid-cols-3 gap-2">
        {areas.map((a) => (
          <button key={a.id} onClick={() => elegir(a.id)} className="rounded-xl border border-slate-200 p-2 text-xs font-medium active:bg-marca-50 dark:border-slate-700 dark:active:bg-marca-800/40">
            <span className="block text-2xl" aria-hidden>{a.icono}</span>
            {a.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
