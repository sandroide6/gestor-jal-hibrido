import { useToastStore } from '../../stores/toastStore';

const STYLES = {
  success: 'bg-green-600  text-white',
  error:   'bg-red-600    text-white',
  warning: 'bg-amber-500  text-white',
  info:    'bg-blue-600   text-white',
};

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

export default function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg pointer-events-auto text-sm ${STYLES[t.type] || STYLES.info}`}
        >
          <span className="font-bold shrink-0">{ICONS[t.type]}</span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="shrink-0 opacity-70 hover:opacity-100 ml-1"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
