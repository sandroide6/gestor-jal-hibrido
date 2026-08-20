export const ROLE_LABEL = { administrador: 'Administrador', edil: 'Edil', auxiliar: 'Auxiliar' };
export const ROLES = ['administrador', 'edil', 'auxiliar'];

export const FIELD_TYPES = ['text', 'textarea', 'date', 'time', 'number', 'select', 'checkbox', 'checklist', 'duracion', 'periodo'];
export const FIELD_TYPE_LABEL = {
  text:      'Texto corto',
  textarea:  'Texto largo',
  date:      'Fecha',
  time:      'Hora',
  number:    'Número',
  select:    'Lista desplegable',
  checkbox:  'Casilla de verificación',
  checklist: 'Lista de verificación (múltiple)',
  duracion:  'Tiempo (meses/años)',
  periodo:   'Periodo académico (año + semestre)',
};

export const SYNC_LABEL = { pending: 'Pendiente', synced: 'Sincronizado', conflict: 'Conflicto' };
export const SYNC_CLASS  = { pending: 'badge-pending', synced: 'badge-synced', conflict: 'badge-conflict' };

export const TIPOS_TRAMITE = ['entrada', 'salida', 'interno'];
export const TIPO_TRAMITE_LABEL = { entrada: 'Entrada', salida: 'Salida', interno: 'Interno' };
