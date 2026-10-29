import PropTypes from 'prop-types';

// Número de radicado con aspecto de sello: borde discontinuo y cifra monoespaciada.
export default function Radicado({ value, label = 'Rad.', stamp = false, className = '' }) {
  if (!value) return null;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-sm border border-dashed border-accent/60 bg-accent-tint px-2 py-0.5
                  text-accent-600 whitespace-nowrap ${stamp ? 'anim-stamp' : ''} ${className}`}
    >
      <span className="text-eyebrow uppercase">{label}</span>
      <span className="font-mono text-sm font-medium tracking-tight">{value}</span>
    </span>
  );
}

Radicado.propTypes = {
  value: PropTypes.string,
  label: PropTypes.string,
  stamp: PropTypes.bool,
  className: PropTypes.string,
};
