// Pantallas sin sesión (inicio de sesión, aviso de privacidad): sin red no se puede entrar.
import { useSyncStore } from '../../stores/syncStore';
import Icon from './Icon';

export default function OfflineBanner() {
  const { isOnline } = useSyncStore();
  if (isOnline) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-warning-border bg-warning-bg px-4 py-2.5 text-center font-semibold text-warning-fg">
      <Icon name="sinred" size={18} />
      Sin conexión: para iniciar sesión necesitas internet.
    </div>
  );
}
