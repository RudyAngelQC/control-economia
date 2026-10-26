/** Campos comunes a todo registro sincronizable. */
export interface SyncMeta {
  id: string;
  /** Epoch ms de la última modificación. En un conflicto gana el más reciente. */
  updatedAt: number;
  /** Tombstone: el registro se borró pero se conserva para que no "resucite". */
  deleted?: boolean;
}

export type Tipo = 'ingreso' | 'gasto';
export type MedioPago = 'yape' | 'efectivo' | 'transferencia' | 'tarjeta';
export type Comprobante = 'factura' | 'boleta' | 'ninguno';

export interface Movimiento extends SyncMeta {
  /** AAAA-MM-DD (formato ISO interno; se muestra como DD/MM/AAAA). */
  fecha: string;
  tipo: Tipo;
  medio: MedioPago;
  comprobante: Comprobante;
  /** Monto en céntimos, siempre positivo. */
  montoCents: number;
  descripcion: string;
  reembolsable: boolean;
  guardiaId: string | null;
  nota?: string;
  /** null = "Sin clasificar". */
  areaId: string | null;
  /** true si el área se asignó a mano (no se reclasifica al editar reglas). */
  areaManual: boolean;
  ruc?: string;
  nroComprobante?: string;
  /** Checklist de rendición: ya tengo el comprobante físico. */
  comprobanteFisico: boolean;
  /** Dato de ejemplo (se puede borrar en bloque). */
  ejemplo?: boolean;
  createdAt: number;
}

export interface Area extends SyncMeta {
  nombre: string;
  icono: string;
  color: string;
  orden: number;
}

export interface Regla extends SyncMeta {
  palabra: string;
  areaId: string;
}

export interface Presupuesto extends SyncMeta {
  areaId: string;
  /** null = tope por defecto para todos los meses; 'AAAA-MM' = ajuste de ese mes. */
  mes: string | null;
  montoCents: number;
}

export type EstadoGuardia = 'abierta' | 'rendida' | 'cobrada';

export interface Guardia extends SyncMeta {
  nombre: string;
  inicio: string;
  fin: string;
  estado: EstadoGuardia;
  ejemplo?: boolean;
}

export const MEDIOS: { id: MedioPago; label: string }[] = [
  { id: 'yape', label: 'Yape' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

export const COMPROBANTES: { id: Comprobante; label: string }[] = [
  { id: 'ninguno', label: 'Ninguno' },
  { id: 'boleta', label: 'Boleta' },
  { id: 'factura', label: 'Factura' },
];

export const labelMedio = (m: MedioPago) => MEDIOS.find((x) => x.id === m)?.label ?? m;
export const labelComprobante = (c: Comprobante) =>
  COMPROBANTES.find((x) => x.id === c)?.label ?? c;

/** Colecciones que se sincronizan con Drive. */
export interface DatosSync {
  movimientos: Movimiento[];
  areas: Area[];
  reglas: Regla[];
  presupuestos: Presupuesto[];
  guardias: Guardia[];
}

export const COLECCIONES = ['movimientos', 'areas', 'reglas', 'presupuestos', 'guardias'] as const;
export type Coleccion = (typeof COLECCIONES)[number];
