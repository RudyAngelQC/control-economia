import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Movimiento } from '../domain/types';
import { formatSoles } from '../domain/format';
import { Hoja } from './ui';
import { MovimientoForm } from './MovimientoForm';
import { AsignarArea } from './AsignarArea';
import { useToast } from './toast';

interface Acciones {
  nuevo: () => void;
  editar: (m: Movimiento) => void;
  asignarArea: (m: Movimiento) => void;
}

const Ctx = createContext<Acciones>({ nuevo() {}, editar() {}, asignarArea() {} });
export const useAcciones = () => useContext(Ctx);

type Abierto = { modo: 'nuevo' } | { modo: 'editar'; mov: Movimiento } | { modo: 'area'; mov: Movimiento } | null;

export function AccionesProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const toast = useToast();
  const cerrar = useCallback(() => setAbierto(null), []);

  const acciones: Acciones = {
    nuevo: useCallback(() => setAbierto({ modo: 'nuevo' }), []),
    editar: useCallback((mov: Movimiento) => setAbierto({ modo: 'editar', mov }), []),
    asignarArea: useCallback((mov: Movimiento) => setAbierto({ modo: 'area', mov }), []),
  };

  function alGuardar(m: Movimiento | null) {
    const eraNuevo = abierto?.modo === 'nuevo';
    setAbierto(null);
    if (!m) return;
    if (m.areaId === null) {
      toast(
        {
          texto: `Guardado ${formatSoles(m.montoCents)} como "Sin clasificar".`,
          tipo: 'aviso',
          accion: { label: 'Asignar área', onClick: () => setAbierto({ modo: 'area', mov: m }) },
        },
        7000,
      );
    } else if (eraNuevo) {
      toast({ texto: `Guardado ${formatSoles(m.montoCents)}.` }, 2500);
    }
  }

  return (
    <Ctx.Provider value={acciones}>
      {children}
      <Hoja
        abierta={abierto?.modo === 'nuevo' || abierto?.modo === 'editar'}
        onCerrar={cerrar}
        titulo={abierto?.modo === 'editar' ? 'Editar movimiento' : 'Nuevo movimiento'}
      >
        {(abierto?.modo === 'nuevo' || abierto?.modo === 'editar') && (
          <MovimientoForm key={abierto.modo === 'editar' ? abierto.mov.id : 'nuevo'} editar={abierto.modo === 'editar' ? abierto.mov : undefined} onListo={alGuardar} />
        )}
      </Hoja>
      <Hoja abierta={abierto?.modo === 'area'} onCerrar={cerrar} titulo="Asignar área">
        {abierto?.modo === 'area' && <AsignarArea mov={abierto.mov} onListo={cerrar} />}
      </Hoja>
    </Ctx.Provider>
  );
}
