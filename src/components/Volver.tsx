import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function Encabezado({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 pt-1">
      <Link to="/mas" className="-ml-2 rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800" aria-label="Volver">
        <ChevronLeft size={24} />
      </Link>
      <h1 className="flex flex-1 items-center text-xl font-bold">{titulo}</h1>
      {children}
    </div>
  );
}
