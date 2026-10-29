import PropTypes from 'prop-types';
import Icon from './Icon';

const TONES = {
  info:    { box: 'bg-info-bg border-info-border',       text: 'text-info-fg',    icon: 'info' },
  success: { box: 'bg-success-bg border-success-border', text: 'text-success-fg', icon: 'check' },
  warning: { box: 'bg-warning-bg border-warning-border', text: 'text-warning-fg', icon: 'alerta' },
  danger:  { box: 'bg-danger-bg border-danger-border',   text: 'text-danger-fg',  icon: 'error' },
};

/**
 * Aviso en línea. `title` dice qué pasó; `children`, qué hacer. Los errores se anuncian
 * con role="alert"; el resto con role="status" para no interrumpir al lector de pantalla.
 */
export default function Notice({ tone = 'info', title, children, action, className = '', role }) {
  const t = TONES[tone];
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      className={`flex gap-3 rounded-lg border px-4 py-3.5 ${t.box} ${className}`}
    >
      <Icon name={t.icon} className={`mt-0.5 ${t.text}`} />
      <div className="min-w-0 flex-1">
        {title && <p className={`font-semibold ${t.text}`}>{title}</p>}
        {children && <div className="text-ink">{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

Notice.propTypes = {
  tone: PropTypes.oneOf(Object.keys(TONES)),
  title: PropTypes.node,
  children: PropTypes.node,
  action: PropTypes.node,
  className: PropTypes.string,
  role: PropTypes.string,
};
