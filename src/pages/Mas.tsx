import { Link } from 'react-router-dom';
import { ChevronRight, CloudUpload, HardHat, PiggyBank, Tags, Sparkles, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMeta, useReglas } from '../db/hooks';
import { borrarEjemplo, cargarEjemplo, hayEjemplo } from '../db/ejemplo';
import { Opciones } from '../components/ui';
import { useToast } from '../components/toast';

type Tema = 'sistema' | 'claro' | 'oscuro';

function leerTema(): Tema {
  try {
    return (localStorage.getItem('tema') as Tema) || 'sistema';
  } catch {
    return 'sistema';
  }
}

export function aplicarTema(t: Tema) {
  const dark = t === 'oscuro' || (t === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

function Fila({ to, icono, titulo, sub }: { to: string; icono: React.ReactNode; titulo: string; sub: string }) {
  return (
    <Link to={to} className="flex min-h-16 items-center gap-3 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-50 text-marca-700 dark:bg-marca-800/40 dark:text-marca-100">{icono}</span>
      <span className="flex-1">
        <span className="block font-semibold">{titulo}</span>
        <span className="texto-suave text-sm">{sub}</span>
      </span>
      <ChevronRight className="texto-suave" />
    </Link>
  );
}

export function Mas() {
  const reglas = useReglas();
  const toast = useToast();
  const [tema, setTema] = useState<Tema>(leerTema);
  const [, setTourHecho] = useMeta('tourHecho', false);
  const ejemplo = useLiveQuery(hayEjemplo) ?? false;

  useEffect(() => {
    try {
      localStorage.setItem('tema', tema);
    } catch {
      /* modo privado: el tema solo dura esta sesión */
    }
    aplicarTema(tema);
  }, [tema]);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <section className="tarjeta divide-y divide-slate-100 py-0! dark:divide-slate-800">
        <Fila to="/mas/guardias" icono={<HardHat size={22} />} titulo="Guardias" sub="Períodos de trabajo para tus viáticos" />
        <Fila to="/mas/presupuesto" icono={<PiggyBank size={22} />} titulo="Presupuesto por área" sub="Topes mensuales y avance" />
        <Fila to="/mas/reglas" icono={<Tags size={22} />} titulo="Reglas de clasificación" sub={`${reglas.length} palabras clave`} />
        <Fila to="/mas/respaldo" icono={<CloudUpload size={22} />} titulo="Respaldo y datos" sub="Google Drive, exportar e importar" />
      </section>

      <section className="tarjeta">
        <h2 className="mb-3 font-bold">Apariencia</h2>
        <Opciones<Tema>
          valor={tema}
          onCambio={setTema}
          opciones={[
            { id: 'claro', label: '☀️ Claro' },
            { id: 'oscuro', label: '🌙 Oscuro' },
            { id: 'sistema', label: '📱 Auto' },
          ]}
        />
      </section>

      <section className="tarjeta">
        <h2 className="mb-1 flex items-center gap-2 font-bold"><Sparkles size={18} /> Datos de ejemplo</h2>
        <p className="texto-suave mb-3 text-sm">
          Carga gastos, ingresos y dos guardias ficticias para explorar la app. Luego bórralos con un toque; tus datos reales no se tocan.
        </p>
        {ejemplo ? (
          <button
            className="btn-peligro w-full"
            onClick={async () => {
              await borrarEjemplo();
              toast({ texto: 'Datos de ejemplo borrados.' });
            }}
          >
            Borrar datos de ejemplo
          </button>
        ) : (
          <button
            className="btn-secundario w-full"
            onClick={async () => {
              await cargarEjemplo();
              toast({ texto: 'Datos de ejemplo cargados. Míralos en Inicio y Viáticos.' });
            }}
          >
            Cargar datos de ejemplo
          </button>
        )}
      </section>

      <button className="btn-secundario" onClick={() => setTourHecho(false)}>
        <GraduationCap size={20} /> Ver el tour de bienvenida otra vez
      </button>

      <p className="texto-suave text-center text-xs">Control Economía · tus datos viven en este dispositivo y en tu Drive.</p>
    </div>
  );
}
