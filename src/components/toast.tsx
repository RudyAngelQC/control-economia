import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  texto: string;
  accion?: { label: string; onClick: () => void };
  tipo?: 'ok' | 'aviso' | 'error';
}

const Ctx = createContext<(t: Omit<Toast, 'id'>, ms?: number) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  const mostrar = useCallback((t: Omit<Toast, 'id'>, ms = 4000) => {
    const id = ++n.current;
    setToasts((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), ms);
  }, []);
  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-lg ${
              t.tipo === 'error' ? 'bg-red-700' : t.tipo === 'aviso' ? 'bg-amber-700' : 'bg-slate-900 dark:bg-slate-700'
            }`}
          >
            <span className="flex-1">{t.texto}</span>
            {t.accion && (
              <button
                className="shrink-0 rounded-lg bg-white/20 px-3 py-2 font-semibold"
                onClick={() => {
                  t.accion!.onClick();
                  setToasts((xs) => xs.filter((x) => x.id !== t.id));
                }}
              >
                {t.accion.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
