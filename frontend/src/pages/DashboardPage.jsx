import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { downloadBackup, downloadExportData } from '../services/adminService';
import { useAdminStats } from '../hooks/useAdminStats';
import { SYNC_LABEL, SYNC_CLASS } from '../constants';
import { formatDate } from '../utils/format';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Notice from '../components/ui/Notice';
import Spinner from '../components/ui/Spinner';
import Icon from '../components/ui/Icon';

// Resumen como renglón de libro: cifras grandes en serif, separadas por filetes, sin colores por tarjeta.
function Figure({ label, value, sub, to }) {
  const body = (
    <>
      <dt className="text-eyebrow uppercase text-ink-muted">{label}</dt>
      <dd className="mt-1 font-serif text-4xl font-semibold leading-none text-brand">{value ?? '—'}</dd>
      {sub && <dd className="mt-1.5 text-sm text-ink-muted">{sub}</dd>}
    </>
  );
  return (
    <div className="bg-surface px-5 py-4">
      {to ? <Link to={to} className="block rounded-sm decoration-brand-300 underline-offset-4 hover:underline">{body}</Link> : body}
    </div>
  );
}
Figure.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sub: PropTypes.string,
  to: PropTypes.string,
};

const SHORTCUTS = [
  { to: '/admin/usuarios', icon: 'usuarios', label: 'Usuarios', sub: 'Crear cuentas y cambiar roles' },
  { to: '/admin/tipos-documento', icon: 'tipos', label: 'Tipos de documento', sub: 'Plantillas y campos' },
  { to: '/reportes', icon: 'reportes', label: 'Reportes', sub: 'Cifras y descarga en Excel' },
  { to: '/edil', icon: 'buscar', label: 'Buscar documentos', sub: 'Todo el archivo' },
  { to: '/admin/auditoria', icon: 'auditoria', label: 'Auditoría', sub: 'Quién hizo qué y cuándo' },
];

export default function DashboardPage() {
  const { token } = useAuthStore();
  const { data: stats, loading, error } = useAdminStats(token);
  const [backing, setBacking]       = useState(false);
  const [backupMsg, setBackupMsg]   = useState('');
  const [exporting, setExporting]   = useState(false);
  const [exportMsg, setExportMsg]   = useState('');

  async function handleBackup() {
    setBacking(true);
    setBackupMsg('');
    try {
      await downloadBackup(token);
      setBackupMsg('Copia de seguridad descargada.');
    } catch (err) {
      setBackupMsg(`Error: ${err.message}`);
    } finally {
      setBacking(false);
    }
  }

  async function handleExportData() {
    setExporting(true);
    setExportMsg('');
    try {
      await downloadExportData(token);
      setExportMsg('Exportación descargada.');
    } catch (err) {
      setExportMsg(`Error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  const isError = (m) => m.startsWith('Error');

  return (
    <AppLayout title="Resumen" eyebrow="Administración" description="Cómo va el archivo de la JAL y los accesos a las tareas de administración." width="page">
      <section aria-labelledby="titulo-cifras" className="mb-10">
        <h2 id="titulo-cifras" className="sr-only">Cifras del archivo</h2>
        {loading ? (
          <div className="h-28 animate-pulse rounded-lg bg-sunken" role="status" aria-label="Cargando cifras" />
        ) : error ? (
          <Notice tone="danger" title="No se pudieron cargar las cifras">{error}</Notice>
        ) : (
          <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Documentos" value={stats?.totalDocuments} sub={`${stats?.documentsThisMonth ?? 0} este mes`} />
            <Figure label="Por revisar" value={stats?.pendingReview} sub="Esperan revisión de un edil" to="/edil?pendientes=1" />
            <Figure label="Tipos activos" value={stats?.activeDocTypes} sub="Documentos que se pueden crear" />
            <Figure label="Usuarios activos" value={stats?.activeUsers} sub="Auxiliares y ediles" />
          </dl>
        )}
      </section>

      <div className="grid gap-10 xl:grid-cols-3">
        <section aria-labelledby="titulo-recientes" className="xl:col-span-2">
          <h2 id="titulo-recientes" className="title-section mb-3">Documentos recientes</h2>
          {loading ? (
            <SkeletonTable rows={4} cols={4} />
          ) : !stats?.recentDocuments?.length ? (
            <EmptyState message="Todavía no se ha creado ningún documento." />
          ) : (
            <div className="table-wrap overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col" className="hidden md:table-cell">Hecho por</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentDocuments.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <span className="block font-semibold">{doc.doc_type_name}</span>
                        <span className="block text-ink-muted">{doc.beneficiary_name}</span>
                      </td>
                      <td className="hidden md:table-cell text-ink-muted">{doc.author}</td>
                      <td className="whitespace-nowrap text-ink-muted">{formatDate(doc.created_at)}</td>
                      <td><span className={SYNC_CLASS[doc.sync_status]}>{SYNC_LABEL[doc.sync_status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-8">
          <nav aria-labelledby="titulo-accesos">
            <h2 id="titulo-accesos" className="title-section mb-3">Accesos</h2>
            <ul className="overflow-hidden rounded-lg border border-line bg-surface">
              {SHORTCUTS.map((s) => (
                <li key={s.to} className="border-t border-line first:border-t-0">
                  <Link to={s.to} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-tint">
                    <Icon name={s.icon} className="text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{s.label}</span>
                      <span className="block text-sm text-ink-muted">{s.sub}</span>
                    </span>
                    <Icon name="chevron" size={18} className="text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="titulo-copias" className="card space-y-5">
            <h2 id="titulo-copias" className="title-card">Copias y exportación</h2>
            <div>
              <h3 className="font-semibold">Copia de seguridad</h3>
              <p className="mb-3 text-ink-muted">Un archivo ZIP con todos los documentos, plantillas y datos.</p>
              <button type="button" onClick={handleBackup} disabled={backing} className="btn-primary btn-block" aria-busy={backing || undefined}>
                {backing && <Spinner />}
                {backing ? 'Preparando la copia…' : 'Descargar copia de seguridad'}
              </button>
              {backupMsg && <Notice tone={isError(backupMsg) ? 'danger' : 'success'} className="mt-3">{backupMsg}</Notice>}
            </div>
            <div className="border-t border-line pt-5">
              <h3 className="font-semibold">Exportar datos</h3>
              <p className="mb-3 text-ink-muted">Un ZIP con el listado en Excel y el PDF de cada documento.</p>
              <button type="button" onClick={handleExportData} disabled={exporting} className="btn-secondary btn-block" aria-busy={exporting || undefined}>
                {exporting && <Spinner />}
                {exporting ? 'Preparando…' : 'Exportar datos (ZIP)'}
              </button>
              {exportMsg && <Notice tone={isError(exportMsg) ? 'danger' : 'success'} className="mt-3">{exportMsg}</Notice>}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
