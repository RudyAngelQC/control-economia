import type { Area, Regla } from './types';

/**
 * Las semillas tienen ids fijos y updatedAt = 1: así un celular nuevo puede
 * sembrarlas sin chocar con Drive, y cualquier edición del usuario (updatedAt
 * real) siempre les gana en el merge.
 */
export const SEED_TS = 1;

const AREAS_BASE: [id: string, nombre: string, icono: string, color: string][] = [
  ['alimentacion', 'Alimentación', '🍽️', '#f97316'],
  ['transporte', 'Transporte', '🚌', '#0ea5e9'],
  ['vivienda', 'Vivienda', '🏠', '#8b5cf6'],
  ['servicios', 'Servicios', '💡', '#eab308'],
  ['salud', 'Salud', '💊', '#ef4444'],
  ['epp', 'EPP', '🦺', '#f59e0b'],
  ['herramientas', 'Herramientas', '🔧', '#64748b'],
  ['movilidad-trabajo', 'Movilidad trabajo', '🚐', '#06b6d4'],
  ['ropa', 'Ropa', '👕', '#ec4899'],
  ['cuidado-personal', 'Cuidado personal', '🧴', '#d946ef'],
  ['tecnologia', 'Tecnología', '💻', '#6366f1'],
  ['entretenimiento', 'Entretenimiento', '🎬', '#a855f7'],
  ['estudios', 'Estudios', '📚', '#14b8a6'],
  ['deudas', 'Deudas/Tarjetas', '💳', '#dc2626'],
  ['ahorro', 'Ahorro/Metas', '🐷', '#22c55e'],
  ['sueldo', 'Sueldo', '💰', '#16a34a'],
  ['reembolso', 'Reembolso viáticos', '🧾', '#0d9488'],
  ['otros', 'Otros', '📦', '#94a3b8'],
];

export const AREAS_SEMILLA: Area[] = AREAS_BASE.map(([id, nombre, icono, color], i) => ({
  id,
  nombre,
  icono,
  color,
  orden: i,
  updatedAt: SEED_TS,
}));

const REGLAS_BASE: Record<string, string[]> = {
  alimentacion: [
    'menu', 'almuerzo', 'desayuno', 'cena', 'comida', 'pension', 'pollo', 'polleria', 'chifa',
    'ceviche', 'mercado', 'abarrotes', 'bodega', 'plaza vea', 'tottus', 'metro', 'wong',
    'supermercado', 'restaurante', 'pan', 'agua mineral', 'gaseosa', 'cafe', 'fruta', 'snack',
  ],
  transporte: [
    'pasaje', 'taxi', 'combi', 'colectivo', 'bus', 'cruz del sur', 'civa', 'uber', 'indriver',
    'peaje', 'grifo', 'gasolina', 'combustible', 'petroleo', 'cochera', 'estacionamiento',
  ],
  'movilidad-trabajo': ['movilidad', 'traslado', 'pasaje mina', 'bus mina', 'taxi mina'],
  vivienda: ['alquiler', 'cuarto', 'hospedaje', 'hotel', 'hostal', 'departamento'],
  servicios: [
    'luz', 'agua', 'internet', 'recarga', 'plan celular', 'movistar', 'claro', 'entel', 'bitel',
    'gas', 'cable', 'telefono',
  ],
  salud: [
    'inkafarma', 'mifarma', 'farmacia', 'botica', 'medicina', 'pastillas', 'clinica', 'consulta',
    'doctor', 'dentista', 'analisis', 'essalud', 'seguro salud',
  ],
  epp: [
    'casco', 'chaleco', 'botas', 'guantes', 'lentes de seguridad', 'tapones', 'respirador',
    'mameluco', 'barbiquejo', 'careta', 'epp',
  ],
  herramientas: [
    'herramienta', 'linterna', 'wincha', 'multimetro', 'alicate', 'destornillador', 'llave',
    'cinta aislante',
  ],
  ropa: ['ropa', 'polo', 'pantalon', 'casaca', 'chompa', 'zapatillas', 'zapatos', 'medias', 'jean'],
  'cuidado-personal': [
    'peluqueria', 'barberia', 'corte de pelo', 'shampoo', 'jabon', 'pasta dental', 'desodorante',
    'afeitar',
  ],
  tecnologia: ['laptop', 'audifonos', 'cargador', 'mouse', 'usb', 'memoria', 'celular nuevo'],
  entretenimiento: ['netflix', 'spotify', 'disney', 'cine', 'cerveza', 'fiesta', 'juego', 'salida'],
  estudios: [
    'curso', 'libro', 'universidad', 'colegio', 'matricula', 'diplomado', 'certificacion',
    'pension colegio', 'pension universidad',
  ],
  deudas: ['cuota', 'tarjeta', 'prestamo', 'interes', 'pago tarjeta'],
  ahorro: ['ahorro', 'plazo fijo', 'meta'],
  sueldo: ['sueldo', 'remuneracion', 'quincena', 'gratificacion', 'cts', 'utilidades', 'bono'],
  reembolso: ['reembolso', 'viaticos', 'reembolso viaticos'],
  otros: ['regalo', 'donacion', 'propina'],
};

export const REGLAS_SEMILLA: Regla[] = Object.entries(REGLAS_BASE).flatMap(([areaId, palabras]) =>
  palabras.map((palabra) => ({
    id: `regla-${palabra.replace(/\s+/g, '-')}`,
    palabra,
    areaId,
    updatedAt: SEED_TS,
  })),
);

export const AREA_SIN_CLASIFICAR = {
  id: 'sin-clasificar',
  nombre: 'Sin clasificar',
  icono: '❓',
  color: '#9ca3af',
};
