import { create } from 'zustand';

// Distinto de syncStore.isOnline (navigator.onLine: conectividad de red del navegador).
// Este store refleja si el backend en sí responde y si su base de datos está disponible
// — relevante en el modo híbrido, donde el backend (Render) puede estar arriba pero sin
// poder alcanzar la base de datos local (túnel caído, PC apagado), o el backend puede
// tardar en responder tras un cold start del free tier.
export const useServerStatusStore = create((set) => ({
  // 'ok' | 'degraded' (backend responde, DB caída) | 'unreachable' (no hay respuesta)
  backendStatus: 'ok',
  setBackendStatus: (status) => set({ backendStatus: status }),
}));
