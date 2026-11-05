import { create } from 'zustand';

// Distinto de syncStore.isOnline (navigator.onLine: conectividad de red del navegador).
// Este store refleja si el backend en sí responde y si su base de datos está disponible
// — relevante en el modo híbrido, donde el backend (Render) puede estar arriba pero sin
// poder alcanzar la base de datos local (túnel caído, PC apagado), o el backend puede
// tardar en responder tras un cold start del free tier.
export const useServerStatusStore = create((set) => ({
  // 'checking' (aún sin primera respuesta — pantalla de arranque) | 'ok' |
  // 'degraded' (backend responde, DB caída) | 'unreachable' (no hay respuesta)
  backendStatus: 'checking',
  // Pasa a true la primera vez que el backend responde algo (ok o degraded) — desde
  // ahí en adelante los problemas se muestran con el banner discreto, no con la
  // pantalla completa de arranque (esa es solo para el primer despertar de Render).
  booted: false,
  setBackendStatus: (status) => set((s) => ({
    backendStatus: status,
    booted: s.booted || status === 'ok' || status === 'degraded',
  })),
}));
