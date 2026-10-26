import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Home, List, Receipt, Menu, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { ToastProvider } from './components/toast';
import { AccionesProvider, useAcciones } from './components/Acciones';
import { SyncBadge } from './components/SyncBadge';
import { Tour } from './components/Tour';
import { Inicio } from './pages/Inicio';
import { Movimientos } from './pages/Movimientos';
import { Viaticos } from './pages/Viaticos';
import { Mas } from './pages/Mas';
import { Reglas } from './pages/Reglas';
import { Presupuestos } from './pages/Presupuestos';
import { Guardias } from './pages/Guardias';
import { Respaldo } from './pages/Respaldo';

const TABS = [
  { to: '/', label: 'Inicio', icono: Home },
  { to: '/movimientos', label: 'Movimientos', icono: List },
  { to: '/viaticos', label: 'Viáticos', icono: Receipt },
  { to: '/mas', label: 'Más', icono: Menu },
];

function Estructura() {
  const { nuevo } = useAcciones();
  const { pathname } = useLocation();
  useEffect(() => {
    // Sin return: en navegadores nuevos scrollTo devuelve una Promise
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-slate-50/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur dark:bg-slate-950/90">
        <span className="text-lg font-extrabold tracking-tight text-marca-700 dark:text-marca-500">Control Economía</span>
        <SyncBadge />
      </header>
      <main className="px-4 pb-32">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/movimientos" element={<Movimientos />} />
          <Route path="/viaticos" element={<Viaticos />} />
          <Route path="/mas" element={<Mas />} />
          <Route path="/mas/reglas" element={<Reglas />} />
          <Route path="/mas/presupuesto" element={<Presupuestos />} />
          <Route path="/mas/guardias" element={<Guardias />} />
          <Route path="/mas/respaldo" element={<Respaldo />} />
          <Route path="*" element={<Inicio />} />
        </Routes>
      </main>

      <button
        onClick={nuevo}
        aria-label="Agregar movimiento"
        className="fixed right-[max(1rem,calc(50%-15rem))] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex h-16 w-16 items-center justify-center rounded-full bg-marca-700 text-white shadow-xl shadow-marca-900/30 active:scale-95 dark:bg-marca-600"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map(({ to, label, icono: Icono }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${isActive ? 'text-marca-700 dark:text-marca-500' : 'text-slate-500 dark:text-slate-400'}`
              }
            >
              <Icono size={24} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Tour />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AccionesProvider>
          <Estructura />
        </AccionesProvider>
      </ToastProvider>
    </HashRouter>
  );
}
