import PropTypes from 'prop-types';
import Icon from './Icon';

/**
 * Estado vacío: dice qué falta y qué hacer a continuación.
 *
 *   – Dentro de una tabla: <EmptyState message="…" colSpan={5} />
 *   – Bloque propio:      <EmptyState title="…" message="…" action={<Link …/>} />
 *   – Compacto:           <EmptyState message="…" compact />
 */
export default function EmptyState({ title, message, action, colSpan, compact, icon = 'carpeta' }) {
  const body = (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-5' : 'py-10 px-4'}`}>
      {!compact && (
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-sunken text-ink-muted">
          <Icon name={icon} size={22} />
        </span>
      )}
      {title && <p className="font-serif text-lg font-semibold text-ink">{title}</p>}
      <p className={`max-w-prose text-ink-muted ${compact ? 'text-[0.9375rem]' : ''}`}>{message}</p>
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );

  if (colSpan != null) return <td colSpan={colSpan} className="px-4">{body}</td>;
  if (compact) return body;
  return <div className="rounded-lg border border-dashed border-line-strong bg-surface/60">{body}</div>;
}

EmptyState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  action: PropTypes.node,
  colSpan: PropTypes.number,
  compact: PropTypes.bool,
  icon: PropTypes.string,
};
