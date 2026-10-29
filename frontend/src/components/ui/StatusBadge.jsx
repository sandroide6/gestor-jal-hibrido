import PropTypes from 'prop-types';

const TONE_CLASS = {
  success: 'badge-synced',
  warning: 'badge-pending',
  danger: 'badge-conflict',
  info: 'badge-info',
  neutral: 'badge-neutral',
};

// Estado con texto siempre visible: el color y el punto refuerzan, nunca sustituyen.
export default function StatusBadge({ tone = 'neutral', children }) {
  return <span className={TONE_CLASS[tone]}>{children}</span>;
}

StatusBadge.propTypes = {
  tone: PropTypes.oneOf(Object.keys(TONE_CLASS)),
  children: PropTypes.node.isRequired,
};

// Estado de un documento en el archivo: revisión del edil + sincronización.
export function DocumentStatus({ syncStatus, reviewed }) {
  if (syncStatus === 'conflict') return <StatusBadge tone="danger">Conflicto</StatusBadge>;
  if (syncStatus === 'pending') return <StatusBadge tone="info">Sin enviar</StatusBadge>;
  if (reviewed) return <StatusBadge tone="success">Revisado</StatusBadge>;
  return <StatusBadge tone="warning">Pendiente de revisión</StatusBadge>;
}

DocumentStatus.propTypes = {
  syncStatus: PropTypes.string,
  reviewed: PropTypes.bool,
};
