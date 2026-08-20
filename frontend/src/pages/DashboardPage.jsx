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

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-jal-blue-50  border-jal-blue-200  text-jal-blue-600',
    amber:  'bg-amber-50     border-amber-200     text-amber-600',
    green:  'bg-green-50     border-green-200     text-green-600',
    purple: 'bg-purple-50   border-purple-200    text-purple-600',
  };
  return (
    <div className={`card border ${colors[color]} flex flex-col gap-1`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-3xl font-bold ${colors[color].split(' ')[2]}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sub: PropTypes.string,
  color: PropTypes.string,
};

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
      setBackupMsg('Backup descargado correctamente.');
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
      setExportMsg('Exportación descargada correctamente.');
    } catch (err) {
      setExportMsg(`Error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppLayout title="Panel de Administración">
      {/* ── Tarjetas de estadísticas ─────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100" />
          ))
        ) : error ? (
          <p className="col-span-4 text-sm text-red-600">{error}</p>
        ) : (
          <>
            <StatCard
              label="Documentos totales"
              value={stats?.totalDocuments}
              sub={`${stats?.documentsThisMonth ?? 0} este mes`}
              color="blue"
            />
            <StatCard
              label="Pendientes de revisión"
              value={stats?.pendingReview}
              sub="sin revisar por edil"
              color="amber"
            />
            <StatCard
              label="Tipos de documento"
              value={stats?.activeDocTypes}
              sub="activos"
              color="green"
            />
            <StatCard
              label="Usuarios activos"
              value={stats?.activeUsers}
              sub="auxiliares y ediles"
              color="purple"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* ── Documentos recientes ──────────────────────── */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Documentos recientes</h2>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 hidden sm:table-cell">Beneficiario</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 hidden lg:table-cell">Auxiliar</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr><td colSpan={5} className="px-4 py-4"><SkeletonTable rows={4} cols={5} /></td></tr>
                )}
                {!loading && !stats?.recentDocuments?.length && (
                  <tr><EmptyState message="Sin documentos aún." colSpan={5} /></tr>
                )}
                {stats?.recentDocuments?.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-700">{doc.doc_type_name}</td>
                    <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{doc.beneficiary_name}</td>
                    <td className="px-4 py-2.5 text-gray-500 hidden lg:table-cell">{doc.author}</td>
                    <td className="px-4 py-2.5 text-gray-400">{formatDate(doc.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={SYNC_CLASS[doc.sync_status]}>
                        {SYNC_LABEL[doc.sync_status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Accesos rápidos + Backup ──────────────────── */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Accesos rápidos</h2>

          <div className="card p-4 space-y-2">
            <Link to="/admin/usuarios"        className="flex items-center gap-3 text-sm text-gray-700 hover:text-jal-blue-500 py-1">
              <span className="w-7 h-7 bg-jal-blue-50 rounded-lg flex items-center justify-center text-jal-blue-500 text-xs font-bold">U</span>
              Gestión de usuarios
            </Link>
            <Link to="/admin/tipos-documento" className="flex items-center gap-3 text-sm text-gray-700 hover:text-jal-blue-500 py-1">
              <span className="w-7 h-7 bg-jal-blue-50 rounded-lg flex items-center justify-center text-jal-blue-500 text-xs font-bold">T</span>
              Tipos de documento
            </Link>
            <Link to="/reportes"              className="flex items-center gap-3 text-sm text-gray-700 hover:text-jal-blue-500 py-1">
              <span className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center text-green-600 text-xs font-bold">R</span>
              Reportes Excel
            </Link>
            <Link to="/edil"                  className="flex items-center gap-3 text-sm text-gray-700 hover:text-jal-blue-500 py-1">
              <span className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 text-xs font-bold">E</span>
              Panel del edil
            </Link>
            <Link to="/admin/auditoria"       className="flex items-center gap-3 text-sm text-gray-700 hover:text-jal-blue-500 py-1">
              <span className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-xs font-bold">A</span>
              Registros de auditoría
            </Link>
          </div>

          {/* Backup */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-1">Copia de seguridad</h3>
            <p className="text-xs text-gray-400 mb-3">
              Descarga un ZIP con todos los documentos, plantillas y datos en JSON.
            </p>
            <button
              onClick={handleBackup}
              disabled={backing}
              className="btn-primary w-full text-xs"
            >
              {backing ? 'Generando backup…' : 'Descargar backup'}
            </button>
            {backupMsg && (
              <p className={`text-xs mt-2 ${backupMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                {backupMsg}
              </p>
            )}
          </div>

          {/* Exportar datos */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-1">Exportar datos</h3>
            <p className="text-xs text-gray-400 mb-3">
              ZIP con Excel de metadatos + PDFs de todos los documentos generados.
            </p>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="btn-secondary w-full text-xs"
            >
              {exporting ? 'Generando…' : 'Exportar datos (ZIP)'}
            </button>
            {exportMsg && (
              <p className={`text-xs mt-2 ${exportMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                {exportMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
