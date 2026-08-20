import PropTypes from 'prop-types';

/**
 * Unified empty-state component.
 *
 * Usage:
 *   – Inside a <tr>:  <EmptyState message="…" colSpan={5} />
 *   – Standalone card: <EmptyState message="…" action={<button …>Crear</button>} />
 *   – Small inline:   <EmptyState message="…" compact />
 */
export default function EmptyState({ message, action, colSpan, compact }) {
  const body = (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-4' : 'py-10'}`}>
      <p className={`text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );

  if (colSpan != null) {
    return <td colSpan={colSpan} className="px-4">{body}</td>;
  }

  if (compact) {
    return body;
  }

  return <div className="card">{body}</div>;
}

EmptyState.propTypes = {
  message:  PropTypes.string.isRequired,
  action:   PropTypes.node,
  colSpan:  PropTypes.number,
  compact:  PropTypes.bool,
};
