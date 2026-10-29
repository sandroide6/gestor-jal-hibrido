import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useDocTypes } from '../hooks/useDocTypes';
import { useAsync } from '../hooks/useAsync';
import { fetchMyDocuments, downloadDocument } from '../services/documentService';
import { fetchPendingCount } from '../services/edilService';
import { getProfile } from '../services/profileService';
import AppLayout from '../components/ui/AppLayout';
import DocTypeCard from '../components/documents/DocTypeCard';
import DocumentRow from '../components/documents/DocumentRow';
import Notice from '../components/ui/Notice';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import Icon from '../components/ui/Icon';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const today = () => new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

// Inicio por tareas: dónde estoy, qué documento hago y dónde quedó lo que ya hice.
export default function HomePage() {
  const { token, user, hasRole } = useAuthStore();
  const { isOnline } = useSyncStore();
  const canReview = hasRole('edil', 'administrador');

  const { data: allTypes = [], loading: loadingTypes, error: typesError } = useDocTypes(token);
  const docTypes = allTypes.filter((t) => t.active);

  const [limit, setLimit] = useState(10);
  const { data: mine, loading: loadingMine, error: mineError, reload: reloadMine } = useAsync(
    () => fetchMyDocuments(limit, token), [limit, token]
  );
  const { data: pending } = useAsync(
    () => (canReview ? fetchPendingCount(token) : Promise.resolve(0)), [canReview, token]
  );

  // Sin firma el servidor rechaza el documento al final; mejor avisarlo antes de llenar el formulario
  const { data: profile } = useAsync(() => getProfile(token), [token]);

  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');

  async function handleDownload(doc, fmt) {
    setDownloading(`${doc.id}-${fmt}`);
    setDownloadError('');
    try {
      await downloadDocument(doc.id, fmt, token, `${doc.doc_type_name}_${doc.beneficiary_name}.${fmt}`);
    } catch {
      setDownloadError(`No se pudo descargar «${doc.doc_type_name}» de ${doc.beneficiary_name}. Revisa la conexión e inténtalo de nuevo.`);
    } finally {
      setDownloading('');
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? '';
  const docs = mine?.data ?? [];

  return (
    <AppLayout
      title="Inicio"
      eyebrow={`Inicio · ${today()}`}
      heading={`${greeting()}${firstName ? `, ${firstName}` : ''}. ¿Qué documento necesitas hacer?`}
      description="Elige uno. Te pediremos solo los datos que lleva y podrás revisarlos antes de crearlo."
    >
      <div className="space-y-12">
        {profile && !profile.has_firma && (
          <Notice
            tone="warning"
            title="Antes de crear tu primer documento, registra tu firma"
            action={<Link to="/perfil" className="btn-primary btn-sm">Registrar mi firma</Link>}
          >
            Se hace una sola vez y es necesaria para los documentos que salen a tu nombre.
          </Notice>
        )}

        {canReview && pending > 0 && (
          <Notice
            tone="info"
            title={`${pending} documento${pending === 1 ? '' : 's'} esperando tu revisión`}
            action={<Link to="/edil?pendientes=1" className="btn-secondary btn-sm">Revisarlos ahora</Link>}
          />
        )}

        <section aria-labelledby="crear">
          <h2 id="crear" className="sr-only">Crear un documento</h2>
          {loadingTypes ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => <SkeletonCard key={i} rows={2} />)}
            </div>
          ) : typesError ? (
            <Notice tone="danger" title="No se pudo cargar la lista de documentos">
              Revisa la conexión y recarga la página.
            </Notice>
          ) : docTypes.length === 0 ? (
            <EmptyState
              title="Todavía no hay documentos configurados"
              message={hasRole('administrador') ? 'Agrega el primero en Tipos de documento.' : 'Pide al administrador de la JAL que los agregue.'}
              action={hasRole('administrador') && <Link to="/admin/tipos-documento" className="btn-primary">Ir a Tipos de documento</Link>}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {docTypes.map((type, i) => (
                <li key={type.id} className="flex">
                  <DocTypeCard type={type} index={i} to={`/generador?tipo=${type.id}`} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recientes">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="recientes" className="title-section">Mis documentos recientes</h2>
              <p className="text-ink-muted">Todo lo que creas queda guardado. Desde aquí lo vuelves a descargar o imprimir.</p>
            </div>
            {canReview && (
              <Link to="/edil" className="btn-ghost btn-sm"><Icon name="buscar" size={18} />Buscar en todo el archivo</Link>
            )}
          </div>

          {downloadError && <Notice tone="danger" className="my-3">{downloadError}</Notice>}

          {loadingMine && docs.length === 0 ? (
            <p role="status" className="py-6 text-ink-muted">Cargando tus documentos…</p>
          ) : mineError ? (
            <Notice
              tone={isOnline ? 'danger' : 'warning'}
              title={isOnline ? 'No se pudo cargar tu lista de documentos' : 'Sin conexión'}
              action={isOnline && <button type="button" className="btn-secondary btn-sm" onClick={reloadMine}>Intentar de nuevo</button>}
              className="mt-3"
            >
              {isOnline ? 'Puede ser un problema momentáneo del servidor.' : 'La lista aparecerá cuando vuelva internet. Igual puedes crear documentos.'}
            </Notice>
          ) : docs.length === 0 ? (
            <EmptyState
              compact
              message="Aún no has creado documentos. Cuando crees uno, aparecerá aquí con su número de radicado."
            />
          ) : (
            <ul className="border-b border-line">
              {docs.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} downloading={downloading} onDownload={handleDownload} />
              ))}
            </ul>
          )}

          {/* shortcut: tope de 100 (máximo de la API); añadir búsqueda propia si un usuario pasa de esa cifra */}
          {mine?.total > docs.length && limit < 100 && (
            <button type="button" className="btn-secondary mt-4" onClick={() => setLimit(100)} disabled={loadingMine}>
              {loadingMine ? 'Cargando…' : `Ver más (${mine.total} en total)`}
            </button>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
