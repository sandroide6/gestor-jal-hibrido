import { useState, useEffect } from 'react';

export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handler = () => setReady(true);
    window.addEventListener('sw-need-refresh', handler);
    return () => window.removeEventListener('sw-need-refresh', handler);
  }, []);

  function handleUpdate() {
    if (window.__pwaUpdateSW) {
      window.__pwaUpdateSW(true);
    } else {
      window.location.reload();
    }
  }

  if (!ready) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-jal-blue-500 text-white rounded-xl shadow-2xl px-5 py-4 flex items-center gap-4 w-[calc(100vw-2rem)] max-w-sm"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">Nueva versión disponible</p>
        <p className="text-xs text-blue-200 mt-0.5">Actualiza para obtener las últimas mejoras.</p>
      </div>
      <button
        onClick={handleUpdate}
        className="text-xs bg-white text-jal-blue-500 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0"
      >
        Actualizar
      </button>
    </div>
  );
}
