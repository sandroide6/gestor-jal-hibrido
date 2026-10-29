import { useId, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import Icon from './Icon';
import Spinner from './Spinner';

/**
 * Diálogo modal accesible: foco atrapado, Escape cierra, título y descripción enlazados.
 * En móvil ocupa el ancho disponible y se desplaza si el contenido es alto.
 */
export default function Dialog({ title, description, children, onClose, role = 'dialog', size = 'md', footer }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, { onEscape: onClose });
  const width = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-md' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6">
      <div className="anim-backdrop absolute inset-0 bg-brand-900/45" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`anim-dialog relative w-full ${width} max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-surface rounded-lg shadow-float border border-line`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 id={titleId} className="title-card">{title}</h2>
            {description && <p id={descId} className="mt-1 text-ink-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm !px-2 -mr-2" aria-label="Cerrar">
            <Icon name="cerrar" />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
        {footer && <div className="flex flex-wrap-reverse justify-end gap-2 border-t border-line bg-gray-50 px-6 py-4 rounded-b-lg">{footer}</div>}
      </div>
    </div>
  );
}

Dialog.propTypes = {
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  children: PropTypes.node,
  onClose: PropTypes.func.isRequired,
  role: PropTypes.oneOf(['dialog', 'alertdialog']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  footer: PropTypes.node,
};

/**
 * Confirmación de una acción. `danger` para lo que borra o no se puede deshacer:
 * botón rojo y texto que nombra exactamente qué se pierde.
 */
export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Dialog
      role="alertdialog"
      size="sm"
      title={title}
      description={message}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

ConfirmDialog.propTypes = {
  title: PropTypes.node.isRequired,
  message: PropTypes.node,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  danger: PropTypes.bool,
  busy: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
