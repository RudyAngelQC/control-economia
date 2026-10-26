import { useState } from 'react';
import { useMeta } from '../db/hooks';
import { cargarEjemplo } from '../db/ejemplo';

const PASOS = [
  {
    icono: '👋',
    titulo: 'Bienvenido a Control Economía',
    texto: 'Registra cada gasto en el momento, aunque no tengas señal. Todo se guarda en tu celular y se respalda en tu Google Drive cuando vuelve la conexión.',
  },
  {
    icono: '➕',
    titulo: 'Registra en 10 segundos',
    texto: 'Toca el botón “+” verde: escribe el monto y una descripción como “menú” o “pasaje”. La app adivina el área sola y recuerda tu último medio de pago y guardia.',
  },
  {
    icono: '🧾',
    titulo: 'Viáticos por guardia',
    texto: 'Marca los gastos de trabajo como “reembolsables”. En la pestaña Viáticos verás cuánto tienes con factura, con boleta y cuánto está sin sustento, y podrás exportar la rendición a Excel.',
  },
  {
    icono: '☁️',
    titulo: 'Respaldo y presupuesto',
    texto: 'En “Más” conecta Google Drive para no perder nada si pierdes el celular, define topes por área y edita las reglas de clasificación.',
  },
];

/** Tour de bienvenida de 4 pasos (se muestra solo la primera vez). */
export function Tour() {
  const [hecho, setHecho, cargado] = useMeta('tourHecho', false);
  const [paso, setPaso] = useState(0);
  if (!cargado || hecho) return null;
  const p = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Tour de bienvenida">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center dark:bg-slate-900">
        <div className="mb-3 text-5xl" aria-hidden>{p.icono}</div>
        <h2 className="mb-2 text-xl font-bold">{p.titulo}</h2>
        <p className="texto-suave mb-5">{p.texto}</p>
        <div className="mb-5 flex justify-center gap-2" aria-label={`Paso ${paso + 1} de ${PASOS.length}`}>
          {PASOS.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === paso ? 'w-6 bg-marca-600' : 'w-2 bg-slate-300 dark:bg-slate-700'}`} />
          ))}
        </div>
        {ultimo ? (
          <div className="flex flex-col gap-2">
            <button className="btn-primario" onClick={() => setHecho(true)}>Empezar</button>
            <button
              className="btn-secundario"
              onClick={async () => {
                await cargarEjemplo();
                await setHecho(true);
              }}
            >
              Empezar con datos de ejemplo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secundario" onClick={() => setHecho(true)}>Saltar</button>
            <button className="btn-primario" onClick={() => setPaso(paso + 1)}>Siguiente</button>
          </div>
        )}
      </div>
    </div>
  );
}
