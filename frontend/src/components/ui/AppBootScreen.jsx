// Pantalla completa (no un banner) mientras esperamos la PRIMERA respuesta del backend
// al arrancar la app — el caso típico es Render despertando tras estar dormido (plan
// free, 30-50s). Una vez que el backend responde una sola vez (ok o degraded), esta
// pantalla desaparece para siempre y los problemas posteriores los cubre el banner
// discreto (ServerStatusBanner) — no queremos tapar la app entera si el backend se cae
// después de que el usuario ya estaba trabajando.
import { useServerStatusStore } from '../../stores/serverStatusStore';
import { useSyncStore } from '../../stores/syncStore';
import { useSlowLoadingMessage } from '../../hooks/useSlowLoadingMessage';

const BOOT_MESSAGES = [
  'Conectando de forma segura…',
  'Despertando el servidor (puede tardar hasta un minuto tras un período sin uso)…',
  'Preparando tu entorno…',
  'Casi listo…',
];

export default function AppBootScreen() {
  const booted = useServerStatusStore((s) => s.booted);
  const { isOnline } = useSyncStore();
  const message = useSlowLoadingMessage(!booted, { messages: BOOT_MESSAGES });

  // Sin red local no tiene sentido decir "despertando el servidor" — OfflineBanner ya
  // cubre ese caso con el mensaje correcto.
  if (booted || !isOnline) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-gray-50 px-6">
      <div className="animate-spin w-10 h-10 border-4 border-jal-blue-200 border-t-jal-blue-600 rounded-full" />
      <p className="text-sm text-gray-500 text-center max-w-xs">
        {message || 'Cargando…'}
      </p>
    </div>
  );
}
