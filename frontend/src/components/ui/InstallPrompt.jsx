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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 w-[calc(100vw-2rem)] max-w-sm">
      <div className="w-10 h-10 bg-jal-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
        <span className="text-white text-[10px] font-bold tracking-wider">JAL</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-tight">Instalar Gestor JAL</p>
        <p className="text-xs text-gray-500 mt-0.5">Acceso rápido desde tu escritorio</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={handleDismiss}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded transition-colors"
        >
          No
        </button>
        <button
          onClick={handleInstall}
          className="text-xs bg-jal-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-jal-blue-600 transition-colors"
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
