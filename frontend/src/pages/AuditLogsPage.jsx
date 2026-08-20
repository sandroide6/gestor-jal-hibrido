import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { fetchAuditLogs } from '../services/adminService';
import { useUsers } from '../hooks/useUsers';
import { formatDateTime } from '../utils/format';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

const ACTION_LABELS = {
  // Sesión
  'auth.login':               'Inicio de sesión',
  'auth.logout':              'Cierre de sesión',
  'auth.logout_all':          'Cierre de todas las sesiones',
  'auth.change_password':     'Cambio de contraseña',
  'auth.refresh':             'Renovación de sesión',
  'auth.consent_accepted':    'Aceptación de política de datos',
  // Verificación en dos pasos
  'auth.login.2fa_required':  'Inicio de sesión — 2FA requerido',
  'auth.login.2fa':           'Inicio de sesión con verificación',
  'auth.2fa.enabled':         'Verificación en dos pasos activada',
  'auth.2fa.disabled':        'Verificación en dos pasos desactivada',
  'auth.2fa.failed':          'Código de verificación incorrecto',
  // Documentos
  'document.create':          'Documento creado',
  'document.review':          'Documento revisado',
  'document.delete':          'Documento eliminado',
  'document.sync_create':     'Documento creado desde dispositivo',
  // Tipos de documento
  'doc_type.create':          'Tipo de documento creado',
  'doc_type.update':          'Tipo de documento modificado',
  // Usuarios
  'user.create':              'Usuario creado',
  'user.update':              'Usuario modificado',
  'user.deactivate':          'Usuario desactivado',
  'user.update_profile':      'Perfil actualizado',
  // Configuración
  'jal.config.update':        'Configuración de la JAL actualizada',
  // Reportes y exportaciones
  'report.export_documents':  'Reporte de documentos exportado',
  'backup.export':            'Copia de seguridad exportada',
  'admin.export_data':        'Datos del sistema exportados',
  // Sincronización
  'sync.batch':               'Sincronización completada',
  'sync.batch_item_error':    'Error en elemento de sincronización',
};

function actionLabel(action) {
  if (!action) return '—';
  return ACTION_LABELS[action] ?? action.replace(/\./g, ' · ').replace(/_/g, ' ');
}

const ACTIONS = [
  { value: '', label: 'Todas las acciones' },
  { value: 'auth.login',               label: 'Inicio de sesión' },
  { value: 'auth.logout',              label: 'Cierre de sesión' },
  { value: 'auth.change_password',     label: 'Cambio de contraseña' },
  { value: 'auth.2fa',                 label: 'Verificación en dos pasos' },
  { value: 'document',                 label: 'Documentos' },
  { value: 'doc_type',                 label: 'Tipos de documento' },
  { value: 'user',                     label: 'Usuarios' },
  { value: 'jal.config',              label: 'Configuración JAL' },
  { value: 'report',                   label: 'Reportes' },
  { value: 'backup',                   label: 'Copias de seguridad' },
  { value: 'sync',                     label: 'Sincronización' },
];

const RESULTS = [
  { value: '',        label: 'Todos los resultados' },
  { value: 'success', label: 'Exitoso' },
  { value: 'failure', label: 'Fallido' },
  { value: 'error',   label: 'Error' },
];

const RESULT_CLASS = {
  success: 'badge-synced',
  failure: 'badge-conflict',
  error:   'bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium',
};

const EMPTY_FILTERS = { user_id: '', action: '', result: '', date_from: '', date_to: '' };

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        className="btn-secondary text-xs px-3 py-1.5"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
      >
        ← Anterior
      </button>
      <span className="text-xs text-gray-500">Página {page} de {pages}</span>
      <button
        className="btn-secondary text-xs px-3 py-1.5"
        onClick={() => onChange(page + 1)}
        disabled={page === pages}
      >
        Siguiente →
      </button>
    </div>
  );
}
Pagination.propTypes = {
  page: PropTypes.number.isRequired,
  pages: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default function AuditLogsPage() {
  const { token } = useAuthStore();
  const { data: users = [] } = useUsers(token);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage]       = useState(1);
  const [data, setData]       = useState({ rows: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchAuditLogs({ ...applied, page, limit: 50 }, token)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [applied, page, token]);

  useEffect(load, [load]);

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  function setField(k, v) { setFilters(f => ({ ...f, [k]: v })); }

  return (
    <AppLayout title="Registros de Auditoría">
      {/* Filtros */}
      <form onSubmit={handleSearch} className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="label">Usuario</label>
            <select className="input text-xs" value={filters.user_id} onChange={e => setField('user_id', e.target.value)}>
              <option value="">Todos</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Acción</label>
            <select className="input text-xs" value={filters.action} onChange={e => setField('action', e.target.value)}>
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Resultado</label>
            <select className="input text-xs" value={filters.result} onChange={e => setField('result', e.target.value)}>
              {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input text-xs" value={filters.date_from} onChange={e => setField('date_from', e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input text-xs" value={filters.date_to} onChange={e => setField('date_to', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit" className="btn-primary text-xs">Buscar</button>
          <button type="button" className="btn-secondary text-xs" onClick={handleReset}>Limpiar</button>
          <span className="ml-auto text-xs text-gray-400 self-center">
            {data.total} registro(s) encontrado(s)
          </span>
        </div>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-jal-blue-500 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Fecha y hora</th>
                <th className="px-4 py-3 text-left font-medium">Usuario</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Recurso</th>
                <th className="px-4 py-3 text-left font-medium">Resultado</th>
                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-4"><SkeletonTable rows={5} cols={6} /></td></tr>
              )}
              {!loading && data.rows.length === 0 && (
                <tr><EmptyState message="No hay registros para los filtros seleccionados." colSpan={6} /></tr>
              )}
              {!loading && data.rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {formatDateTime(row.timestamp)}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.user ? (
                      <div>
                        <p className="font-medium text-gray-800">{row.user.name}</p>
                        <p className="text-gray-400">{row.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-gray-300 italic">Sistema</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-gray-800" title={row.action}>{actionLabel(row.action)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell max-w-[200px] truncate">
                    {row.resource || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={RESULT_CLASS[row.result] || 'text-gray-500'}>
                      {row.result === 'success' ? 'Exitoso' : row.result === 'failure' ? 'Fallido' : 'Error'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 hidden lg:table-cell font-mono">
                    {row.ip || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pages={data.pages} onChange={setPage} />
    </AppLayout>
  );
}
