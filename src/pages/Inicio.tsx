import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { useAreaLookup, useAreas, useGuardias, useMovimientos, usePresupuestos } from '../db/hooks';
import { formatSoles, hoyISO, mesDe, nombreMes, sumarMes } from '../domain/format';
import { gastoPersonalPorArea, gastosPor, movimientosDelMes, nivelPresupuesto, resumenMes, topeDelMes, variacion } from '../domain/totals';
import { labelMedio, type MedioPago } from '../domain/types';
import { BarraProgreso, EstadoVacio, InfoTip, SelectorMes, TIPS } from '../components/ui';
import { Barras } from '../components/Barras';
import { useAcciones } from '../components/Acciones';

function Cifra({ titulo, valor, tono, tip }: { titulo: string; valor: number; tono?: 'verde' | 'rojo' | 'marca'; tip?: { t: string; x: string } }) {
  const color = tono === 'verde' ? 'text-emerald-700 dark:text-emerald-400' : tono === 'rojo' ? 'text-red-700 dark:text-red-400' : tono === 'marca' ? 'text-marca-700 dark:text-marca-500' : '';
  return (
    <div className="tarjeta p-3!">
      <div className="texto-suave flex items-center text-xs font-semibold uppercase tracking-wide">
        {titulo}
        {tip && <InfoTip titulo={tip.t} texto={tip.x} />}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{formatSoles(valor)}</div>
    </div>
  );
}

function Variacion({ etiqueta, actual, anterior, subirEsMalo }: { etiqueta: string; actual: number; anterior: number; subirEsMalo: boolean }) {
  const v = variacion(actual, anterior);
  if (v === null) return <li className="texto-suave text-sm">{etiqueta}: sin datos del mes anterior</li>;
  const sube = v > 0;
  const malo = sube === subirEsMalo && Math.abs(v) >= 0.5;
  const Icono = sube ? TrendingUp : TrendingDown;
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span>{etiqueta}</span>
      <span className={`flex items-center gap-1 font-semibold ${malo ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
        <Icono size={16} />
        {sube ? '+' : ''}
        {v.toFixed(0)}% <span className="texto-suave font-normal">(antes {formatSoles(anterior)})</span>
      </span>
    </li>
  );
}

export function Inicio() {
  const [mes, setMes] = useState(mesDe(hoyISO()));
  const movs = useMovimientos();
  const guardias = useGuardias();
  const areas = useAreas();
  const areaDe = useAreaLookup();
  const presupuestos = usePresupuestos();
  const { nuevo, asignarArea } = useAcciones();

  const datos = useMemo(() => {
    const anteriorMes = sumarMes(mes, -1);
    const delMes = movimientosDelMes(movs, mes);
    const delAnterior = movimientosDelMes(movs, anteriorMes);
    const previoPorArea = new Map(gastosPor(delAnterior, (m) => m.areaId ?? 'sin-clasificar').map((x) => [x.clave, x.total]));
    const previoPorMedio = new Map(gastosPor(delAnterior, (m) => m.medio).map((x) => [x.clave, x.total]));
    return {
      r: resumenMes(movs, mes, guardias),
      ant: resumenMes(movs, anteriorMes, guardias),
      porArea: gastosPor(delMes, (m) => m.areaId ?? 'sin-clasificar').map((x) => ({ ...x, anterior: previoPorArea.get(x.clave) ?? 0 })),
      porMedio: gastosPor(delMes, (m) => m.medio).map((x) => ({ ...x, anterior: previoPorMedio.get(x.clave) ?? 0 })),
      sinClasificar: delMes.filter((m) => m.areaId === null),
      personal: gastoPersonalPorArea(movs, mes),
    };
  }, [movs, mes, guardias]);

  const presupuestosMes = useMemo(
    () =>
      areas
        .map((a) => {
          const tope = topeDelMes(presupuestos, a.id, mes);
          if (!tope) return null;
          const gastado = datos.personal.get(a.id) ?? 0;
          return { a, tope, gastado, pct: (gastado / tope) * 100, nivel: nivelPresupuesto(gastado, tope) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((x, y) => y.pct - x.pct),
    [areas, presupuestos, mes, datos.personal],
  );

  if (movs.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <EstadoVacio
          icono="📒"
          titulo="Aún no hay movimientos"
          texto="Toca el botón + para registrar tu primer gasto o ingreso. Tarda menos de 10 segundos y funciona sin señal."
          accion={<button className="btn-primario" onClick={nuevo}>Registrar el primero</button>}
        />
        <p className="texto-suave text-center text-sm">
          ¿Quieres ver cómo se ve con datos? Ve a <Link className="underline" to="/mas">Más → Datos de ejemplo</Link>.
        </p>
      </div>
    );
  }

  const { r, ant } = datos;
  return (
    <div className="flex flex-col gap-4 pt-2">
      <SelectorMes mes={mes} onCambio={setMes} />

      <div className="grid grid-cols-2 gap-3">
        <Cifra titulo="Ingresos" valor={r.ingresos} tono="verde" />
        <Cifra titulo="Gastos" valor={r.gastos} tono="rojo" />
        <Cifra titulo="Saldo" valor={r.saldo} tono={r.saldo >= 0 ? 'verde' : 'rojo'} />
        <Cifra titulo="Por cobrar" valor={r.porCobrar} tono="marca" tip={{ t: 'Por cobrar', x: TIPS.porCobrar }} />
      </div>

      {datos.sinClasificar.length > 0 && (
        <button
          onClick={() => asignarArea(datos.sinClasificar[0])}
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-left text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100"
        >
          <AlertCircle className="shrink-0" />
          <span className="flex-1 text-sm">
            <strong>{datos.sinClasificar.length} sin clasificar.</strong> Toca para asignar el área de “{datos.sinClasificar[0].descripcion || 'sin descripción'}”.
          </span>
        </button>
      )}

      {r.cantidad === 0 ? (
        <EstadoVacio icono="🗓️" titulo={`Nada en ${nombreMes(mes)}`} texto="No hay movimientos este mes. Cambia de mes con las flechas o registra uno con el botón +." />
      ) : (
        <>
          <section className="tarjeta">
            <h2 className="mb-2 font-bold">Frente a {nombreMes(sumarMes(mes, -1)).toLowerCase()}</h2>
            <ul className="flex flex-col gap-2">
              <Variacion etiqueta="Gastos" actual={r.gastos} anterior={ant.gastos} subirEsMalo />
              <Variacion etiqueta="Ingresos" actual={r.ingresos} anterior={ant.ingresos} subirEsMalo={false} />
            </ul>
          </section>

          {datos.porArea.length > 0 && (
            <section className="tarjeta">
              <Barras
                titulo="Gasto por área"
                filas={datos.porArea.map((x) => {
                  const a = areaDe(x.clave === 'sin-clasificar' ? null : x.clave);
                  return { id: x.clave, etiqueta: a.nombre, icono: a.icono, valor: x.total, anterior: x.anterior };
                })}
              />
            </section>
          )}

          {datos.porMedio.length > 0 && (
            <section className="tarjeta">
              <Barras
                titulo="Gasto por medio de pago"
                filas={datos.porMedio.map((x) => ({ id: x.clave, etiqueta: labelMedio(x.clave as MedioPago), valor: x.total, anterior: x.anterior }))}
              />
            </section>
          )}
        </>
      )}

      <section className="tarjeta">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center font-bold">
            Presupuesto <InfoTip titulo="Presupuesto" texto={TIPS.presupuesto} />
          </h2>
          <Link to="/mas/presupuesto" className="text-sm font-semibold text-marca-700 dark:text-marca-500">
            {presupuestosMes.length ? 'Editar' : 'Definir topes'}
          </Link>
        </div>
        {presupuestosMes.length === 0 ? (
          <p className="texto-suave text-sm">Ponte un tope mensual por área (por ejemplo, S/ 600 en Alimentación) y aquí verás cuánto llevas.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {presupuestosMes.slice(0, 5).map(({ a, tope, gastado, pct, nivel }) => (
              <li key={a.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{a.icono} {a.nombre}</span>
                  <span className="tabular-nums">
                    {formatSoles(gastado)} <span className="texto-suave">/ {formatSoles(tope)}</span>
                  </span>
                </div>
                <BarraProgreso pct={pct} nivel={nivel} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
