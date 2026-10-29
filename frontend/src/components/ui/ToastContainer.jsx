import { useToastStore } from '../../stores/toastStore';
import Icon from './Icon';

const TONES = {
  success: { bar: 'bg-success', icon: 'check',  text: 'text-success-fg' },
  error:   { bar: 'bg-danger',  icon: 'error',  text: 'text-danger-fg' },
  warning: { bar: 'bg-warning', icon: 'alerta', text: 'text-warning-fg' },
  info:    { bar: 'bg-info',    icon: 'info',   text: 'text-info-fg' },
};

// Confirmaciones breves de acciones ya confirmadas por el servidor.
// Por encima de la barra inferior en móvil; esquina inferior derecha en escritorio.
export default function ToastContainer() {
  const { toasts, remove } = useToastStore();

  // Por encima de la barra inferior y del botón del asistente, para no taparlos
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-40 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:w-96 lg:bottom-24">
      {toasts.map((t) => {
        const tone = TONES[t.type] || TONES.info;
        return (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="anim-toast pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-line bg-surface py-3 pl-5 pr-2 shadow-float"
          >
            <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
            <Icon name={tone.icon} className={`mt-0.5 ${tone.text}`} />
            <p className="flex-1 text-ink">{t.message}</p>
            <button type="button" onClick={() => remove(t.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-gray-100" aria-label="Cerrar aviso">
              <Icon name="cerrar" size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
