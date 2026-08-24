// Mismo patrón que OfflineBanner.jsx, pero para "el servidor respondió, algo anda mal"
// en vez de "el navegador no tiene red" — casos distintos en el modo híbrido (backend
// en la nube, base de datos en el PC local vía túnel).
import { useEffect, useRef } from 'react';
import { useServerStatusStore } from '../../stores/serverStatusStore';
import { useSyncStore } from '../../stores/syncStore';

const MESSAGES = {
  degraded: 'Base de datos no disponible en este momento — algunas funciones no funcionarán hasta que se restablezca.',
  unreachable: 'Despertando el servidor (puede tardar unos segundos tras un período sin uso) — reintentando…',
};

const POLL_MS = 5000;

export default function ServerStatusBanner() {
  const { backendStatus, setBackendStatus } = useServerStatusStore();
  const { isOnline } = useSyncStore();
  const pollingRef = useRef(false);

  // El texto dice "reintentando…" — sin este poll, el estado solo se actualizaba cuando
  // ALGUNA otra petición pasaba por api.js (navegar, hacer clic). Si nada más llamaba a
  // la API, el banner se quedaba pegado para siempre aunque el backend ya hubiera vuelto
  // (ej. tras el cold start del free tier de Render). Este efecto hace el reintento real.
  useEffect(() => {
    if (backendStatus === 'ok' || !isOnline || pollingRef.current) return undefined;
    pollingRef.current = true;

    const base = (import.meta.env.VITE_API_URL || '').replace(/\/v1\/?$/, '');
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`${base}/health`, { credentials: 'include' });
        if (!cancelled) setBackendStatus(res.status === 503 ? 'degraded' : 'ok');
      } catch {
        // sigue 'unreachable' — el próximo intento lo confirma
      }
      if (!cancelled) setTimeout(poll, POLL_MS);
    };

    const timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      pollingRef.current = false;
    };
  }, [backendStatus, isOnline, setBackendStatus]);

  if (backendStatus === 'ok' || !isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center text-sm py-1.5 px-4 font-medium">
      {MESSAGES[backendStatus]}
    </div>
  );
}
