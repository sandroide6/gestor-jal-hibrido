import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { fetchDocuments, markReviewed, fetchPendingCount } from '../services/edilService';
import { downloadDocument, deleteDocument } from '../services/documentService';
import { useDocTypes } from '../hooks/useDocTypes';
import { useUsers } from '../hooks/useUsers';
import { formatDate } from '../utils/format';
import EmptyState from '../components/ui/EmptyState';
import Notice from '../components/ui/Notice';
import Radicado from '../components/ui/Radicado';
import Spinner from '../components/ui/Spinner';
import Icon from '../components/ui/Icon';
import { DocumentStatus } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/Dialog';
import { LedgerDate } from '../components/documents/DocumentRow';
import { toast } from '../stores/toastStore';

const EMPTY_FILTERS = {
  doc_type_name: '',
  user_id: '',
  beneficiary: '',
  numero_radicado: '',
  date_from: '',
  date_to: '',
  sync_status: '',
  reviewed: '',
  page: 1,
  limit: 50,
};

const ADVANCED_KEYS = ['doc_type_name', 'user_id', 'numero_radicado', 'date_from', 'date_to', 'reviewed'];
const countAdvanced = (f) => ADVANCED_KEYS.filter((k) => f[k] !== '').length;
const isFiltered = (f) => f.beneficiary !== '' || countAdvanced(f) > 0;

// Acciones de un documento: descargas, revisar (edil/admin) y eliminar (solo admin).
function DocActions({ doc, downloading, onDownload, onReview, reviewing, onDelete }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {['pdf', 'docx'].map((fmt) => {
        const key = `${doc.id}-${fmt}`;
        return (
          <button
            key={fmt}
            type="button"
            className="btn-secondary btn-sm"
            disabled={!!downloading}
            aria-busy={downloading === key || undefined}
            aria-label={`Descargar ${fmt === 'pdf' ? 'PDF' : 'Word'} de ${doc.doc_type_name}, ${doc.beneficiary_name}`}
            onClick={() => onDownload(doc, fmt)}
          >
            {downloading === key && <Spinner />}
            {fmt === 'pdf' ? 'PDF' : 'Word'}
          </button>
        );
      })}
      {!doc.reviewed && (
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => onReview(doc.id)}
          disabled={reviewing === doc.id}
          aria-busy={reviewing === doc.id || undefined}
          aria-label={`Marcar como revisado: ${doc.doc_type_name}, ${doc.beneficiary_name}`}
        >
          {reviewing === doc.id ? <Spinner /> : <Icon name="check" size={18} />}
          Revisado
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          className="btn-ghost btn-sm text-danger-fg hover:bg-danger-bg"
          onClick={() => onDelete(doc)}
          aria-label={`Eliminar ${doc.doc_type_name} de ${doc.beneficiary_name}`}
        >
          <Icon name="papelera" size={18} />
          <span className="xl:sr-only">Eliminar</span>
        </button>
      )}
    </div>
  );
}
DocActions.propTypes = {
  doc: PropTypes.object.isRequired,
  downloading: PropTypes.string,
  onDownload: PropTypes.func.isRequired,
  onReview: PropTypes.func.isRequired,
  reviewing: PropTypes.string,
  onDelete: PropTypes.func,
};

export default function EdilPage() {
  const { token, user } = useAuthStore();
  const isAdmin = user?.role === 'administrador';
  const { data: docTypes = [] } = useDocTypes(token);
  const { data: allUsers = [] } = useUsers(token);
  const auxiliares = allUsers.filter((u) => u.role === 'auxiliar' || u.role === 'administrador');

  // Desde Inicio: ?pendientes=1 abre la lista filtrada por lo que falta revisar
  const [searchParams] = useSearchParams();
  const initial = searchParams.get('pendientes') ? { ...EMPTY_FILTERS, reviewed: 'false' } : EMPTY_FILTERS;

  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [showMore, setShowMore] = useState(countAdvanced(initial) > 0);
  const [data, setData] = useState({ total: 0, pages: 1, data: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [reviewing, setReviewing] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const refreshPending = useCallback(() => {
    fetchPendingCount(token)
      .then((cnt) => {
        setPendingCount(cnt);
        if ('setAppBadge' in navigator) navigator.setAppBadge(cnt).catch(() => {});
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  const load = useCallback(async (f) => {
    setLoading(true);
    setLoadError('');
    try {
      setData(await fetchDocuments(f, token));
    } catch (err) {
      setLoadError(err.message || 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Carga inicial
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(applied); }, [load]);

  function apply(next) {
    setFilters(next);
    setApplied(next);
    load(next);
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleSearch(e) {
    e.preventDefault();
    apply({ ...filters, page: 1 });
  }

  function handleClear() {
    apply(EMPTY_FILTERS);
  }

  function togglePendingOnly() {
    apply({ ...applied, reviewed: applied.reviewed === 'false' ? '' : 'false', page: 1 });
  }

  async function handleDownload(doc, fmt) {
    setDownloading(`${doc.id}-${fmt}`);
    setActionError('');
    try {
      await downloadDocument(doc.id, fmt, token, `${doc.doc_type_name}_${doc.beneficiary_id}.${fmt}`);
    } catch (e) {
      setActionError(e.message || 'No se pudo descargar. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setDownloading('');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget.id, token);
      setData((prev) => ({ ...prev, total: prev.total - 1, data: prev.data.filter((d) => d.id !== deleteTarget.id) }));
      toast.success(`Se eliminó ${deleteTarget.doc_type_name} de ${deleteTarget.beneficiary_name}.`);
      setDeleteTarget(null);
      refreshPending();
    } catch (err) {
      setActionError(err.message || 'No se pudo eliminar el documento.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleMarkReviewed(docId) {
    setReviewing(docId);
    setActionError('');
    try {
      await markReviewed(docId, token);
      setData((prev) => ({
        ...prev,
        data: prev.data.map((d) => (d.id === docId ? { ...d, reviewed: true, reviewed_at: new Date().toISOString() } : d)),
      }));
      refreshPending();
    } catch {
      setActionError('No se pudo marcar el documento como revisado. Inténtalo de nuevo.');
    } finally {
      setReviewing('');
    }
  }

  const docs = data.data ?? [];
  const advanced = countAdvanced(filters);
  const pendingOnly = applied.reviewed === 'false';

  const summary = (
    <>
      {data.total} documento{data.total === 1 ? '' : 's'}{isFiltered(applied) ? ' con estos filtros' : ' en el archivo'}
      {pendingCount > 0 && <> · <strong className="text-warning-fg">{pendingCount} esperan revisión</strong></>}
    </>
  );

  return (
    <AppLayout
      title="Buscar documentos"
      eyebrow="Archivo"
      description={loading && !docs.length ? 'Busca por persona, cédula o número de radicado.' : summary}
      actions={pendingCount > 0 && (
        <button type="button" className={pendingOnly ? 'btn-primary' : 'btn-secondary'} aria-pressed={pendingOnly} onClick={togglePendingOnly}>
          {pendingOnly ? <Icon name="check" size={18} /> : null}
          Solo pendientes ({pendingCount})
        </button>
      )}
    >
      {/* Búsqueda: un campo principal y el resto de filtros a un clic */}
      <form onSubmit={handleSearch} role="search" aria-label="Buscar documentos" className="card mb-6 !p-4 sm:!p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="f-beneficiary">Nombre o cédula de la persona</label>
            <span className="hint" id="f-beneficiary-hint">Puedes escribir solo una parte. Ejemplo: Pérez o 1017</span>
            <input
              id="f-beneficiary"
              type="search"
              className="input"
              aria-describedby="f-beneficiary-hint"
              value={filters.beneficiary}
              onChange={(e) => handleFilterChange('beneficiary', e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 md:flex-none" disabled={loading} aria-busy={loading || undefined}>
              {loading ? <Spinner /> : <Icon name="buscar" size={18} />}
              Buscar
            </button>
            <button
              type="button"
              className="btn-ghost"
              aria-expanded={showMore}
              aria-controls="filtros-avanzados"
              onClick={() => setShowMore((v) => !v)}
            >
              <Icon name="filtro" size={18} />
              Más filtros{advanced > 0 ? ` (${advanced})` : ''}
            </button>
          </div>
        </div>

        {showMore && (
          <div id="filtros-avanzados" className="anim-step mt-5 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="f-type">Tipo de documento</label>
              <select id="f-type" className="input" value={filters.doc_type_name} onChange={(e) => handleFilterChange('doc_type_name', e.target.value)}>
                <option value="">Todos los tipos</option>
                {docTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-radicado">Número de radicado</label>
              <input
                id="f-radicado"
                type="text"
                className="input font-mono"
                placeholder="2026-JALC12-SAL-000045"
                value={filters.numero_radicado}
                onChange={(e) => handleFilterChange('numero_radicado', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="f-reviewed">Revisión</label>
              <select id="f-reviewed" className="input" value={filters.reviewed} onChange={(e) => handleFilterChange('reviewed', e.target.value)}>
                <option value="">Todos</option>
                <option value="false">Pendientes de revisión</option>
                <option value="true">Ya revisados</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-user">Hecho por</label>
              <select id="f-user" className="input" value={filters.user_id} onChange={(e) => handleFilterChange('user_id', e.target.value)}>
                <option value="">Cualquier persona del equipo</option>
                {auxiliares.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-from">Desde</label>
              <input id="f-from" type="date" className="input" value={filters.date_from} onChange={(e) => handleFilterChange('date_from', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="f-to">Hasta</label>
              <input id="f-to" type="date" className="input" value={filters.date_to} min={filters.date_from || undefined} onChange={(e) => handleFilterChange('date_to', e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              <button type="submit" className="btn-primary" disabled={loading}>Aplicar filtros</button>
              <button type="button" className="btn-secondary" onClick={handleClear}>Quitar filtros</button>
            </div>
          </div>
        )}
      </form>

      {actionError && <Notice tone="danger" className="mb-4">{actionError}</Notice>}

      {loadError ? (
        <Notice
          tone="danger"
          title="No se pudo cargar el archivo de documentos"
          action={<button type="button" className="btn-secondary btn-sm" onClick={() => load(applied)}>Intentar de nuevo</button>}
        >
          {loadError}
        </Notice>
      ) : loading && docs.length === 0 ? (
        <div role="status" aria-label="Cargando documentos" className="table-wrap divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 animate-pulse rounded bg-sunken" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-sunken" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        isFiltered(applied) ? (
          <EmptyState
            icon="buscar"
            title="No hay documentos con esa búsqueda"
            message="Revisa que el nombre o la cédula estén bien escritos, o quita algunos filtros."
            action={<button type="button" className="btn-secondary" onClick={handleClear}>Quitar filtros</button>}
          />
        ) : (
          <EmptyState title="El archivo todavía está vacío" message="Cuando el equipo cree documentos, aparecerán aquí para buscarlos y revisarlos." />
        )
      ) : (
        <div className={`transition-opacity duration-fast ${loading ? 'opacity-60' : ''}`} aria-busy={loading || undefined}>
          {/* Escritorio: tabla */}
          <div className="table-wrap hidden xl:block">
            <table className="table">
              <caption className="sr-only">Documentos encontrados</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Documento y persona</th>
                  <th scope="col">Radicado</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const pending = !doc.reviewed && doc.sync_status === 'synced';
                  return (
                    <tr key={doc.id} className={pending ? '!bg-warning-bg/50' : ''}>
                      <td className="whitespace-nowrap">{formatDate(doc.created_at)}</td>
                      <td>
                        <p className="font-semibold">{doc.doc_type_name}</p>
                        <p className="text-ink-muted">
                          {doc.beneficiary_name}{doc.beneficiary_id ? ` · C.C. ${doc.beneficiary_id}` : ''}
                          {doc.author?.name ? ` · por ${doc.author.name}` : ''}
                        </p>
                      </td>
                      <td>{doc.numero_radicado ? <Radicado value={doc.numero_radicado} label="" /> : <span className="text-ink-muted">—</span>}</td>
                      <td><DocumentStatus syncStatus={doc.sync_status} reviewed={doc.reviewed} /></td>
                      <td className="text-right">
                        <DocActions
                          doc={doc}
                          downloading={downloading}
                          onDownload={handleDownload}
                          onReview={handleMarkReviewed}
                          reviewing={reviewing}
                          onDelete={isAdmin ? setDeleteTarget : undefined}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Móvil y tablet: fichas apiladas, misma información y acciones */}
          <ul className="space-y-3 xl:hidden">
            {docs.map((doc) => (
              <li key={doc.id} className="card !p-4">
                <div className="flex gap-4">
                  <LedgerDate iso={doc.created_at} />
                  <div className="min-w-0 flex-1">
                    <p className="title-card">{doc.doc_type_name}</p>
                    <p className="text-ink-muted">{doc.beneficiary_name}{doc.beneficiary_id ? ` · C.C. ${doc.beneficiary_id}` : ''}</p>
                    {doc.author?.name && <p className="text-[0.9375rem] text-ink-muted">Hecho por {doc.author.name}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <DocumentStatus syncStatus={doc.sync_status} reviewed={doc.reviewed} />
                      <Radicado value={doc.numero_radicado} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-line pt-3">
                  <DocActions
                    doc={doc}
                    downloading={downloading}
                    onDownload={handleDownload}
                    onReview={handleMarkReviewed}
                    reviewing={reviewing}
                    onDelete={isAdmin ? setDeleteTarget : undefined}
                  />
                </div>
              </li>
            ))}
          </ul>

          {data.pages > 1 && (
            <nav aria-label="Páginas de resultados" className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink-muted">Página {applied.page} de {data.pages} · {data.total} documentos</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary btn-sm" disabled={applied.page <= 1 || loading} onClick={() => apply({ ...applied, page: applied.page - 1 })}>
                  ← Anterior
                </button>
                <button type="button" className="btn-secondary btn-sm" disabled={applied.page >= data.pages || loading} onClick={() => apply({ ...applied, page: applied.page + 1 })}>
                  Siguiente →
                </button>
              </div>
            </nav>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          danger
          busy={deleting}
          title="¿Eliminar este documento?"
          message={`${deleteTarget.doc_type_name} de ${deleteTarget.beneficiary_name}${deleteTarget.numero_radicado ? ` (radicado ${deleteTarget.numero_radicado})` : ''}. Dejará de estar en el archivo y la acción queda registrada en Auditoría.`}
          confirmLabel={deleting ? 'Eliminando…' : 'Sí, eliminar'}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}
