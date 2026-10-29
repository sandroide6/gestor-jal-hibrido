import { useSyncStore } from '../../stores/syncStore';
import Icon from './Icon';
import Spinner from './Spinner';

// Estado de conexión siempre visible en la barra superior. Solo afirma lo que sabe:
// "todo enviado" únicamente cuando la cola local está vacía.
export default function ConnectionStatus() {
  const { isOnline, pendingCount, isSyncing, syncProgress } = useSyncStore();

  let tone = 'bg-success-bg text-success-fg border-success-border';
  let content = <><span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />En línea</>;

  if (isSyncing) {
    tone = 'bg-info-bg text-info-fg border-info-border';
    content = <><Spinner className="h-3.5 w-3.5" />Enviando{syncProgress ? ` ${syncProgress.synced} de ${syncProgress.total}` : '…'}</>;
  } else if (!isOnline) {
    tone = 'bg-warning-bg text-warning-fg border-warning-border';
    content = (
      <>
        <Icon name="sinred" size={16} />
        Sin conexión{pendingCount > 0 ? ` · ${pendingCount} por enviar` : ''}
      </>
    );
  } else if (pendingCount > 0) {
    tone = 'bg-info-bg text-info-fg border-info-border';
    content = <><Icon name="nube" size={16} />{pendingCount} por enviar</>;
  }

  return (
    <p role="status" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.875rem] font-semibold whitespace-nowrap ${tone}`}>
      {content}
    </p>
  );
}
