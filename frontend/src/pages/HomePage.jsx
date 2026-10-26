import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useDocTypes } from '../hooks/useDocTypes';
import { useAsync } from '../hooks/useAsync';
import { fetchMyDocuments, downloadDocument } from '../services/documentService';
import { fetchPendingCount } from '../services/edilService';
import { getProfile } from '../services/profileService';
import { formatDate } from '../utils/format';
import AppLayout from '../components/ui/AppLayout';

// Pantalla de inicio por tareas: crear un documento o encontrar uno ya hecho, sin pasar por menús.
export default function HomePage() {
  const { token, user, hasRole } = useAuthStore();
  const { isOnline } = useSyncStore();
  const canReview = hasRole('edil', 'administrador');

  const { data: allTypes = [], loading: loadingTypes, error: typesError } = useDocTypes(token);
  const docTypes = allTypes.filter((t) => t.active);

  const [limit, setLimit] = useState(10);
  const { data: mine, loading: loadingMine, error: mineError } = useAsync(
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
    <AppLayout title="Inicio">
      <div className="max-w-4xl space-y-10">
        {profile && !profile.has_firma && (
          <div role="status" className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 text-amber-900">
            <p className="font-semibold">Antes de crear tu primer documento: registra tu firma.</p>
            <p className="mt-1">Se hace una sola vez y es necesaria para los documentos que salen a tu nombre.</p>
            <Link to="/perfil" className="btn-primary mt-3">Registrar mi firma</Link>
          </div>
        )}

        <section aria-labelledby="crear">
          <h2 id="crear" className="text-2xl font-bold text-gray-900">
            {firstName ? `Hola, ${firstName}. ` : ''}¿Qué documento necesitas hacer?
          </h2>
          <p className="text-gray-600 mt-1 mb-5">Elige uno. Te pediremos solo los datos que lleva.</p>

          {loadingTypes ? (
            <p className="text-gray-500">Cargando…</p>
          ) : typesError ? (
            <p role="alert" className="text-red-700">No se pudo cargar la lista de documentos. Recarga la página para intentarlo de nuevo.</p>
          ) : docTypes.length === 0 ? (
            <p className="text-gray-600">Todavía no hay documentos configurados. Pide al administrador que los agregue.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {docTypes.map((type) => (
                <Link
                  key={type.id}
                  to={`/generador?tipo=${type.id}`}
                  className="card !p-5 flex items-center justify-between gap-3 text-lg font-semibold text-jal-blue-600
                             hover:border-jal-blue-400 hover:bg-jal-blue-50 focus:outline-none focus:ring-2 focus:ring-jal-blue-400"
                >
                  <span>{type.name}</span>
                  <span aria-hidden="true" className="text-2xl">›</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {canReview && (
          <section className="card !p-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-gray-800">
              {pending > 0
                ? <><strong>{pending}</strong> documento{pending === 1 ? '' : 's'} esperando tu revisión.</>
                : 'Puedes buscar y revisar todos los documentos de la JAL.'}
            </p>
            <Link to="/edil" className="btn-primary">Buscar y revisar documentos</Link>
          </section>
        )}

        <section aria-labelledby="recientes">
          <h2 id="recientes" className="text-xl font-bold text-gray-900">Mis documentos recientes</h2>
          <p className="text-gray-600 mt-1 mb-4">
            Todo lo que creas queda guardado en el sistema. Desde aquí lo vuelves a descargar o imprimir.
          </p>

          {downloadError && (
            <p role="alert" className="mb-3 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{downloadError}</p>
          )}

          {loadingMine && docs.length === 0 ? (
            <p className="text-gray-500">Cargando…</p>
          ) : mineError ? (
            <p className="text-gray-600">
              {isOnline
                ? 'No se pudo cargar tu lista de documentos. Recarga la página para intentarlo de nuevo.'
                : 'Sin conexión: la lista aparecerá cuando vuelva internet. Igual puedes crear documentos.'}
            </p>
          ) : docs.length === 0 ? (
            <p className="text-gray-600">Aún no has creado documentos. Cuando crees uno, aparecerá aquí.</p>
          ) : (
            <ul className="card !p-0 divide-y divide-gray-200">
              {docs.map((doc) => (
                <li key={doc.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{doc.doc_type_name}</p>
                    <p className="text-gray-700">{doc.beneficiary_name}{doc.beneficiary_id ? ` · C.C. ${doc.beneficiary_id}` : ''}</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(doc.created_at)}
                      {doc.numero_radicado ? ` · Radicado ${doc.numero_radicado}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {['pdf', 'docx'].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        className="btn-secondary"
                        disabled={!!downloading}
                        onClick={() => handleDownload(doc, fmt)}
                        aria-label={`Descargar ${fmt === 'pdf' ? 'PDF' : 'Word'} de ${doc.doc_type_name}, ${doc.beneficiary_name}`}
                      >
                        {downloading === `${doc.id}-${fmt}` ? 'Descargando…' : fmt === 'pdf' ? 'PDF' : 'Word'}
                      </button>
                    ))}
                  </div>
                </li>
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
