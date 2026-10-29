import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('pwa-install-dismissed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    try { localStorage.setItem('pwa-install-dismissed', '1'); } catch { /* noop */ }
  }

  if (!deferredPrompt || dismissed) return null;

  return (
    // El centrado va en el contenedor: así la transición de entrada (transform) no pisa el translate-x
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-3 lg:bottom-5">
    <div role="dialog" aria-label="Instalar el Gestor JAL" className="anim-toast pointer-events-auto flex w-full max-w-md flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-float">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink leading-tight">Instalar el Gestor JAL</p>
        <p className="text-[0.9375rem] text-ink-muted">Queda como una app en este equipo y abre más rápido.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleDismiss} className="btn-ghost btn-sm">Ahora no</button>
        <button type="button" onClick={handleInstall} className="btn-primary btn-sm">Instalar</button>
      </div>
    </div>
    </div>
  );
}
