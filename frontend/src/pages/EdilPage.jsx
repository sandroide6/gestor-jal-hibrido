import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { fetchDocuments, markReviewed, fetchPendingCount } from '../services/edilService';
import { downloadDocument, deleteDocument } from '../services/documentService';
import { useDocTypes } from '../hooks/useDocTypes';
import { useUsers } from '../hooks/useUsers';
import { formatDate } from '../utils/format';
import EmptyState from '../components/ui/EmptyState';

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

function StatusBadge({ synced, reviewed }) {
  if (!reviewed && synced === 'synced') {
    return <span className="badge-pending">Pendiente revisión</span>;
  }
  if (reviewed) {
    return <span className="badge-synced">Revisado</span>;
  }
  if (synced === 'conflict') {
    return <span className="badge-conflict">Conflicto</span>;
  }
  if (synced === 'pending') {
    return <span className="badge-pending">Sin sincronizar</span>;
  }
  return null;
}
StatusBadge.propTypes = {
  synced: PropTypes.string.isRequired,
  reviewed: PropTypes.bool.isRequired,
};


export default function EdilPage() {
  const { token, user } = useAuthStore();
  const isAdmin = user?.role === 'administrador';
  const { data: docTypes = [] } = useDocTypes(token);
  const { data: allUsers = [] } = useUsers(token);
  const auxiliares = allUsers.filter((u) => u.role === 'auxiliar' || u.role === 'administrador');

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [data, setData] = useState({ total: 0, pages: 1, data: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, document_number, doc_type_name, beneficiary_name }
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPendingCount(token)
      .then((cnt) => {
        setPendingCount(cnt);
        if ('setAppBadge' in navigator) navigator.setAppBadge(cnt).catch(() => {});
      })
      .catch(() => {});
  }, [token]);

  const load = useCallback(async (f) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDocuments(f, token);
      setData(res);
    } catch (err) {
      setError(err.message || 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Carga inicial
  useEffect(() => { load(applied); }, [load]);

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleSearch(e) {
    e.preventDefault();
    const next = { ...filters, page: 1 };
    setApplied(next);
    load(next);
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    load(EMPTY_FILTERS);
  }

  function handlePage(p) {
    const next = { ...applied, page: p };
    setApplied(next);
    load(next);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget.id, token);
      setData((prev) => ({
        ...prev,
        total: prev.total - 1,
        data: prev.data.filter((d) => d.id !== deleteTarget.id),
      }));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Error al eliminar el documento');
    } finally {
      setDeleting(false);
    }
  }

  async function handleMarkReviewed(docId) {
    try {
      await markReviewed(docId, token);
      // Actualizar fila localmente
      setData((prev) => ({
        ...prev,
        data: prev.data.map((d) =>
          d.id === docId ? { ...d, reviewed: true, reviewed_at: new Date().toISOString() } : d
        ),
      }));
      const cnt = await fetchPendingCount(token);
      setPendingCount(cnt);
      if ('setAppBadge' in navigator) navigator.setAppBadge(cnt).catch(() => {});
    } catch {
      setError('No se pudo marcar el documento como revisado');
    }
  }

  return (
    <AppLayout title="Documentos">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-jal-blue-500">{data.total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total documentos</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pendientes revisión</p>
        </div>
        <div className="card py-3 text-center col-span-2 sm:col-span-2">
          <p className="text-sm text-gray-500">
            Mostrando página <strong>{applied.page}</strong> de <strong>{data.pages || 1}</strong>
          </p>
        </div>
      </div>

      {/* Filtros */}
      <form onSubmit={handleSearch} className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Auxiliar */}
          <div>
            <label className="label">Auxiliar</label>
            <select
              className="input"
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
            >
              <option value="">Todas las auxiliares</option>
              {auxiliares.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Tipo de documento */}
          <div>
            <label className="label">Tipo de documento</label>
            <select
              className="input"
              value={filters.doc_type_name}
              onChange={(e) => handleFilterChange('doc_type_name', e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {docTypes.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Beneficiario / cédula */}
          <div>
            <label className="label">Beneficiario o cédula</label>
            <input
              type="text"
              className="input"
              placeholder="Buscar nombre o cédula…"
              value={filters.beneficiary}
              onChange={(e) => handleFilterChange('beneficiary', e.target.value)}
            />
          </div>

          {/* Número de radicado */}
          <div>
            <label className="label">N.° de radicado</label>
            <input
              type="text"
              className="input font-mono"
              placeholder="ej. 2026-JALC12-SAL-000045"
              value={filters.numero_radicado}
              onChange={(e) => handleFilterChange('numero_radicado', e.target.value)}
            />
          </div>

          {/* Fecha desde */}
          <div>
            <label className="label">Fecha desde</label>
            <input
              type="date"
              className="input"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="label">Fecha hasta</label>
            <input
              type="date"
              className="input"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
            />
          </div>

          {/* Estado */}
          <div>
            <label className="label">Estado revisión</label>
            <select
              className="input"
              value={filters.reviewed}
              onChange={(e) => handleFilterChange('reviewed', e.target.value)}
            >
              <option value="">Todos</option>
              <option value="false">Pendiente revisión</option>
              <option value="true">Revisados</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Limpiar filtros
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-jal-blue-500 text-white">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-xs">Radicado</th>
                <th className="px-3 py-3 text-left font-medium text-xs hidden lg:table-cell">N.°</th>
                <th className="px-3 py-3 text-left font-medium text-xs hidden sm:table-cell">Auxiliar</th>
                <th className="px-3 py-3 text-left font-medium text-xs">Tipo</th>
                <th className="px-3 py-3 text-left font-medium text-xs">Beneficiario</th>
                <th className="px-3 py-3 text-left font-medium text-xs hidden md:table-cell">Cédula</th>
                <th className="px-3 py-3 text-left font-medium text-xs hidden md:table-cell">Fecha</th>
                <th className="px-3 py-3 text-left font-medium text-xs hidden sm:table-cell">Estado</th>
                <th className="px-3 py-3 text-left font-medium text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-sm">
                    Cargando documentos…
                  </td>
                </tr>
              )}
              {!loading && data.data.length === 0 && (
                <tr><EmptyState message="No se encontraron documentos con los filtros aplicados." colSpan={9} /></tr>
              )}
              {!loading && data.data.map((doc) => (
                <tr
                  key={doc.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    !doc.reviewed && doc.sync_status === 'synced'
                      ? 'bg-amber-50 hover:bg-amber-100'
                      : ''
                  }`}
                >
                  <td className="px-3 py-3 text-gray-700 text-xs font-mono">
                    {doc.numero_radicado || '—'}
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs font-mono hidden lg:table-cell">
                    {doc.document_number || '—'}
                  </td>
                  <td className="px-3 py-3 text-gray-700 text-xs hidden sm:table-cell">
                    {doc.author?.name || '—'}
                  </td>
                  <td className="px-3 py-3 text-gray-700 text-xs font-medium">
                    {doc.doc_type_name}
                  </td>
                  <td className="px-3 py-3 text-gray-700 text-xs">
                    <div>{doc.beneficiary_name}</div>
                    <div className="text-gray-400 sm:hidden">{formatDate(doc.created_at)}</div>
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {doc.beneficiary_id}
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {formatDate(doc.created_at)}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <StatusBadge synced={doc.sync_status} reviewed={doc.reviewed} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        {['pdf', 'docx'].map((fmt) => {
                          const key = `${doc.id}-${fmt}`;
                          return (
                            <button
                              key={fmt}
                              disabled={downloading === key}
                              title={`Descargar ${fmt.toUpperCase()}`}
                              className="text-jal-blue-400 hover:text-jal-blue-600 text-xs font-medium disabled:opacity-50"
                              onClick={async () => {
                                setDownloading(key);
                                try {
                                  const name = `${doc.doc_type_name}_${doc.beneficiary_id}.${fmt}`;
                                  await downloadDocument(doc.id, fmt, token, name);
                                } catch (e) {
                                  setError(e.message || 'Error al descargar');
                                } finally {
                                  setDownloading('');
                                }
                              }}
                            >
                              {downloading === key ? '…' : fmt.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                      {!doc.reviewed && (
                        <button
                          onClick={() => handleMarkReviewed(doc.id)}
                          className="text-xs text-green-600 hover:text-green-700 font-medium text-left"
                          title="Marcar como revisado"
                        >
                          ✓ Revisar
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium text-left"
                          title="Eliminar documento"
                        >
                          ✕ Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              {data.total} documentos en total
            </p>
            <div className="flex gap-1">
              <button
                className="btn-secondary py-1 px-2 text-xs"
                disabled={applied.page <= 1}
                onClick={() => handlePage(applied.page - 1)}
              >
                ← Anterior
              </button>
              <span className="px-2 py-1 text-xs text-gray-500 flex items-center">
                {applied.page} / {data.pages}
              </span>
              <button
                className="btn-secondary py-1 px-2 text-xs"
                disabled={applied.page >= data.pages}
                onClick={() => handlePage(applied.page + 1)}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Modal confirmación eliminar */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Eliminar documento</h3>
                <p className="text-sm text-gray-600 mt-1">
                  ¿Estás seguro de que deseas eliminar el documento{' '}
                  <strong>{deleteTarget.document_number}</strong> —{' '}
                  {deleteTarget.doc_type_name} de{' '}
                  <strong>{deleteTarget.beneficiary_name}</strong>?
                </p>
                <p className="text-xs text-red-600 mt-2 font-medium">Esta acción quedará registrada en auditoría.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn-secondary text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Eliminando…</>
                  : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
