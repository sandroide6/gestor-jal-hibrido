// Mismo patrón que OfflineBanner.jsx, pero para "el servidor respondió, algo anda mal"
// en vez de "el navegador no tiene red" — casos distintos en el modo híbrido (backend
// en la nube, base de datos en el PC local vía túnel).
import { useServerStatusStore } from '../../stores/serverStatusStore';
import { useSyncStore } from '../../stores/syncStore';

const MESSAGES = {
  degraded: 'Base de datos no disponible en este momento — algunas funciones no funcionarán hasta que se restablezca.',
  unreachable: 'No se pudo contactar al servidor — reintentando…',
};

export default function ServerStatusBanner() {
  const { backendStatus } = useServerStatusStore();
  const { isOnline } = useSyncStore();
  // Sin red local, OfflineBanner ya cubre el mensaje — evita mostrar los dos apilados
  // (misma posición fixed top-0) con mensajes redundantes.
  if (backendStatus === 'ok' || !isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center text-sm py-1.5 px-4 font-medium">
      {MESSAGES[backendStatus]}
    </div>
  );
}
