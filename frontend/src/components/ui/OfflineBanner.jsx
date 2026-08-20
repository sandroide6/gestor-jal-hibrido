// Muestra en pantallas sin AppLayout (ej: LoginPage)
import { useSyncStore } from '../../stores/syncStore';

export default function OfflineBanner() {
  const { isOnline } = useSyncStore();
  if (isOnline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-sm py-1.5 px-4 font-medium">
      Sin conexión — no es posible iniciar sesión en este momento
    </div>
  );
}
