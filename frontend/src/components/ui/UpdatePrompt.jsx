import { useState, useEffect } from 'react';
import Icon from './Icon';

export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handler = () => setReady(true);
    window.addEventListener('sw-need-refresh', handler);
    return () => window.removeEventListener('sw-need-refresh', handler);
  }, []);

  function handleUpdate() {
    if (window.__pwaUpdateSW) window.__pwaUpdateSW(true);
    else window.location.reload();
  }

  if (!ready) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-3 lg:bottom-5">
    <div role="status" className="anim-toast pointer-events-auto flex w-full max-w-md items-center gap-4 rounded-lg bg-brand px-5 py-4 text-white shadow-float">
      <Icon name="descargar" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">Hay una versión nueva</p>
        <p className="text-[0.9375rem] text-white/85">Actualiza cuando termines lo que estás haciendo.</p>
      </div>
      <button type="button" onClick={handleUpdate} className="btn btn-sm bg-white text-brand hover:bg-brand-tint">Actualizar</button>
    </div>
    </div>
  );
}
