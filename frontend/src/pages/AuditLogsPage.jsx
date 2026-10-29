import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { fetchAuditLogs } from '../services/adminService';
import { useUsers } from '../hooks/useUsers';
import { formatDateTime } from '../utils/format';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Notice from '../components/ui/Notice';
import Icon from '../components/ui/Icon';

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
  error:   'badge-pending',
};

const EMPTY_FILTERS = { user_id: '', action: '', result: '', date_from: '', date_to: '' };

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <button type="button" className="btn-secondary btn-sm" onClick={() => onChange(page - 1)} disabled={page === 1}>
        <Icon name="atras" size={18} />Anterior
      </button>
      <span className="text-ink-muted" aria-current="page">Página {page} de {pages}</span>
      <button type="button" className="btn-secondary btn-sm" onClick={() => onChange(page + 1)} disabled={page === pages}>
        Siguiente<Icon name="flecha" size={18} />
      </button>
    </nav>
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
    <AppLayout
      title="Auditoría"
      eyebrow="Administración"
      description="Registro de quién hizo qué y cuándo. No se puede modificar ni borrar desde aquí."
      width="wide"
    >
      <form onSubmit={handleSearch} className="card mb-6 p-5" aria-label="Filtros de auditoría">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label" htmlFor="a-user_id">Usuario</label>
            <select id="a-user_id" className="input" value={filters.user_id} onChange={e => setField('user_id', e.target.value)}>
              <option value="">Todos</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="a-action">Acción</label>
            <select id="a-action" className="input" value={filters.action} onChange={e => setField('action', e.target.value)}>
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="a-result">Resultado</label>
            <select id="a-result" className="input" value={filters.result} onChange={e => setField('result', e.target.value)}>
              {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="a-date_from">Desde</label>
            <input type="date" id="a-date_from" className="input" value={filters.date_from} onChange={e => setField('date_from', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="a-date_to">Hasta</label>
            <input type="date" id="a-date_to" className="input" value={filters.date_to} onChange={e => setField('date_to', e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary">Buscar</button>
          <button type="button" className="btn-ghost" onClick={handleReset}>Quitar filtros</button>
          <p className="text-ink-muted sm:ml-auto" role="status">
            {loading ? 'Buscando…' : `${data.total} registro${data.total === 1 ? '' : 's'}`}
          </p>
        </div>
      </form>

      {error && (
        <Notice tone="danger" title="No se pudo cargar el registro" className="mb-4"
          action={<button type="button" className="btn-secondary btn-sm" onClick={load}>Intentar de nuevo</button>}>
          {error}
        </Notice>
      )}

      {/* Tabla */}
      <div className="table-wrap">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Registros de auditoría">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Usuario</th>
                <th scope="col">Acción</th>
                <th scope="col" className="hidden md:table-cell">Recurso</th>
                <th scope="col">Resultado</th>
                <th scope="col" className="hidden lg:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-4"><SkeletonTable rows={5} cols={6} /></td></tr>
              )}
              {!loading && data.rows.length === 0 && (
                <tr><EmptyState message="No hay registros para los filtros seleccionados." colSpan={6} /></tr>
              )}
              {!loading && data.rows.map(row => (
                <tr key={row.id}>
                  <td className="text-ink-muted whitespace-nowrap">
                    {formatDateTime(row.timestamp)}
                  </td>
                  <td>
                    {row.user ? (
                      <div>
                        <p className="font-semibold text-ink">{row.user.name}</p>
                        <p className="text-ink-muted">{row.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-ink-muted">Sistema</span>
                    )}
                  </td>
                  <td>
                    <span className="text-ink" title={row.action}>{actionLabel(row.action)}</span>
                  </td>
                  <td className="text-ink-muted hidden md:table-cell max-w-[200px] truncate">
                    {row.resource || '—'}
                  </td>
                  <td>
                    <span className={RESULT_CLASS[row.result] || 'text-ink-muted'}>
                      {row.result === 'success' ? 'Exitoso' : row.result === 'failure' ? 'Fallido' : 'Error'}
                    </span>
                  </td>
                  <td className="text-ink-muted hidden lg:table-cell font-mono">
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
