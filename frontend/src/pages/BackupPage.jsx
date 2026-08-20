import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/ui/AppLayout';
import { backupService } from '../services/backupService';
import { useAuthStore } from '../stores/authStore';

const SCHEDULE_LABELS = { hourly: 'Cada hora', daily: 'Diario', weekly: 'Semanal' };
const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function fmt(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusBadge({ status }) {
  const map = {
    success: 'bg-green-100 text-green-700',
    failed:  'bg-red-100 text-red-700',
    running: 'bg-blue-100 text-blue-700 animate-pulse',
  };
  const labels = { success: 'Exitoso', failed: 'Fallido', running: 'En curso…' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-100 text-gray-600'}`}>{labels[status] || status}</span>;
}

function Card({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <span className="text-jal-blue-600">{icon}</span>
        <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function BackupPage() {
  const token = useAuthStore(s => s.token);
  const [cfg, setCfg]               = useState(null);
  const [logs, setLogs]             = useState([]);
  const [localFiles, setLocalFiles] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [running, setRunning]       = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState('');
  const [form, setForm]             = useState({});
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const [c, l, lf] = await Promise.all([
        backupService.getConfig(token),
        backupService.getLogs(token),
        backupService.getLocalFiles(token).catch(() => []),
      ]);
      setCfg(c);
      setLogs(l);
      setLocalFiles(lf);
      setForm({
        auto_enabled:    c.auto_enabled,
        schedule:        c.schedule,
        schedule_hour:   c.schedule_hour,
        schedule_day:    c.schedule_day,
        retention_count: c.retention_count,
      });
    } catch { showToast('Error al cargar configuración', 'error'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    load();
    // Leer parámetros de URL (callback de OAuth)
    const p = new URLSearchParams(window.location.search);
    if (p.get('connected')) { showToast('¡Google Drive conectado exitosamente!'); load(); }
    if (p.get('error'))     showToast(`Error al conectar: ${p.get('error')}`, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  }, [load]);

  async function connectDrive() {
    try {
      const { url } = await backupService.getAuthUrl(token);
      window.location.href = url;
    } catch (err) { showToast(err.message || 'Error al obtener URL de autorización', 'error'); }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar Google Drive? Se eliminarán los tokens guardados.')) return;
    try { await backupService.disconnect(token); load(); showToast('Google Drive desconectado'); }
    catch (err) { showToast(err.message, 'error'); }
  }

  async function saveSchedule() {
    setSaving(true);
    try {
      await backupService.saveConfig(form, token);
      load();
      showToast('Configuración guardada');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function runNow() {
    setRunning(true);
    try {
      await backupService.runBackup(token);
      showToast('Backup iniciado. Puede tardar unos segundos…');
      setTimeout(load, 4000);
    } catch (err) { showToast(err.message || 'Error al crear backup', 'error'); }
    finally { setRunning(false); }
  }

  async function handleOpenFolder() {
    setOpeningFolder(true);
    try {
      await backupService.openFolder(token);
    } catch (err) { showToast(err.message || 'No se pudo abrir la carpeta', 'error'); }
    finally { setOpeningFolder(false); }
  }

  async function handleDownloadLocal(filename) {
    setDownloadingFile(filename);
    try {
      await backupService.downloadLocalFile(filename, token);
    } catch (err) { showToast(err.message || 'Error al descargar', 'error'); }
    finally { setDownloadingFile(''); }
  }

  if (loading) return (
    <AppLayout title="Backup · Google Drive">
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin w-8 h-8 border-4 border-jal-blue-200 border-t-jal-blue-600 rounded-full" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout title="Backup · Google Drive">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {toast.type === 'error'
            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
          {toast.msg}
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── Configuración de credenciales ── */}
        {!cfg?.configured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Credenciales no configuradas.</strong> Abre <code className="bg-amber-100 px-1 rounded">backend/.env</code> y llena:
            <pre className="mt-2 text-xs bg-amber-100 rounded p-2 select-all">
{`GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui`}
            </pre>
            <p className="mt-2">Obtén las credenciales en <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline">Google Cloud Console</a> → APIs → Credenciales → OAuth 2.0.</p>
            <p className="mt-1">URI de redirección autorizada: <code className="bg-amber-100 px-1 rounded">http://localhost:3001/v1/backup/drive/callback</code></p>
          </div>
        )}

        {/* ── Conexión con Google Drive ── */}
        <Card title="Conexión con Google Drive" icon={
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.96 11.5L2 19l2.5 4h15l2.5-4-6.96-7.5H6.96zm.88-1.5l4.16-7h0a2 2 0 013.5 0l4.16 7H7.84zm9.32 1.5L22 19l-2.5 4H4.5L2 19l5.84-7.5h9.32z" />
          </svg>
        }>
          {cfg?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Conectado</p>
                    <p className="text-xs text-gray-500">{cfg.email || 'cuenta de Google'}</p>
                  </div>
                </div>
                <button onClick={disconnect} className="text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors">
                  Desconectar
                </button>
              </div>

              {/* Carpeta en Drive */}
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-jal-blue-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700">Carpeta en Google Drive</p>
                  <p className="text-xs text-gray-500 truncate">
                    {cfg.folder_id ? 'Gestor JAL Backups' : 'Se creará al hacer el primer backup'}
                  </p>
                </div>
                {cfg.folder_id ? (
                  <a
                    href={`https://drive.google.com/drive/folders/${cfg.folder_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-jal-blue-600 hover:text-jal-blue-700 bg-white border border-jal-blue-200 hover:border-jal-blue-400 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir carpeta
                  </a>
                ) : (
                  <span className="text-xs text-gray-400 flex-shrink-0">Sin backups aún</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-4">Conecta tu cuenta de Google para guardar los backups en Drive automáticamente.</p>
              <button onClick={connectDrive} disabled={!cfg?.configured}
                className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-jal-blue-400 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 shadow-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.96 11.5L2 19l2.5 4h15l2.5-4-6.96-7.5H6.96zm.88-1.5l4.16-7h0a2 2 0 013.5 0l4.16 7H7.84zm9.32 1.5L22 19l-2.5 4H4.5L2 19l5.84-7.5h9.32z" />
                </svg>
                Conectar con Google Drive
              </button>
            </div>
          )}
        </Card>

        {cfg?.connected && (<>

        {/* ── Backup ahora ── */}
        <Card title="Backup manual" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        }>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-gray-600 space-y-1">
              <p>Incluye: base de datos · documentos · plantillas</p>
              <p>Último backup: <span className="font-medium text-gray-800">{fmtDate(cfg.last_backup_at)}</span></p>
              {cfg.auto_enabled && <p>Próximo automático: <span className="font-medium text-gray-800">{fmtDate(cfg.next_backup_at)}</span></p>}
            </div>
            <button onClick={runNow} disabled={running}
              className="flex items-center gap-2 bg-jal-blue-600 hover:bg-jal-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50">
              {running
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creando…</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Crear backup ahora</>}
            </button>
          </div>
        </Card>

        {/* ── Programación automática ── */}
        <Card title="Backup automático" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-jal-blue-600"
                checked={form.auto_enabled || false}
                onChange={e => setForm(f => ({ ...f, auto_enabled: e.target.checked }))} />
              <span className="text-sm font-medium text-gray-700">Activar backup automático</span>
            </label>

            {form.auto_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Frecuencia</label>
                  <select value={form.schedule || 'daily'} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-jal-blue-400">
                    {Object.entries(SCHEDULE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                {(form.schedule === 'daily' || form.schedule === 'weekly') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Hora de ejecución</label>
                    <select value={form.schedule_hour ?? 2} onChange={e => setForm(f => ({ ...f, schedule_hour: parseInt(e.target.value) }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-jal-blue-400">
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </div>
                )}

                {form.schedule === 'weekly' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Día de la semana</label>
                    <select value={form.schedule_day ?? 1} onChange={e => setForm(f => ({ ...f, schedule_day: parseInt(e.target.value) }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-jal-blue-400">
                      {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Retener últimos N backups</label>
                  <input type="number" min={1} max={50} value={form.retention_count ?? 10}
                    onChange={e => setForm(f => ({ ...f, retention_count: parseInt(e.target.value) }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-jal-blue-400" />
                </div>
              </div>
            )}

            <button onClick={saveSchedule} disabled={saving}
              className="flex items-center gap-2 bg-jal-blue-600 hover:bg-jal-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 mt-2">
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        </Card>

        {/* ── Archivos locales ── */}
        <Card title="Backups en este equipo" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
          </svg>
        }>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs text-gray-500">
              Copias guardadas localmente en <code className="bg-gray-100 px-1 rounded text-gray-600">data/backups/</code>
            </p>
            <button
              onClick={handleOpenFolder}
              disabled={openingFolder}
              className="flex items-center gap-1.5 text-xs font-medium text-jal-blue-600 hover:text-jal-blue-700 bg-jal-blue-50 hover:bg-jal-blue-100 border border-jal-blue-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {openingFolder ? 'Abriendo…' : 'Abrir carpeta'}
            </button>
          </div>

          {localFiles.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No hay backups locales aún.</p>
          ) : (
            <div className="space-y-2">
              {localFiles.map((f) => (
                <div key={f.filename} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{f.filename}</p>
                    <p className="text-xs text-gray-400">{fmt(f.size_bytes)} · {fmtDate(f.created_at)}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadLocal(f.filename)}
                    disabled={downloadingFile === f.filename}
                    className="text-xs text-jal-blue-600 hover:text-jal-blue-700 font-medium flex-shrink-0 disabled:opacity-50"
                  >
                    {downloadingFile === f.filename ? '…' : 'Descargar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Historial de backups ── */}
        <Card title="Historial de backups (Drive)" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No hay backups registrados aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Archivo</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tamaño</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 pr-4 text-gray-700 max-w-[180px] truncate" title={log.filename}>
                        {log.filename || '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{fmt(log.size_bytes)}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${log.type === 'auto' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {log.type === 'auto' ? 'Automático' : 'Manual'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4"><StatusBadge status={log.status} /></td>
                      <td className="py-2.5">
                        {log.drive_file_url && (
                          <a href={log.drive_file_url} target="_blank" rel="noreferrer"
                            className="text-jal-blue-600 hover:text-jal-blue-700 text-xs flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Drive
                          </a>
                        )}
                        {log.status === 'failed' && log.error_message && (
                          <span className="text-xs text-red-500" title={log.error_message}>Ver error</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        </>)}
      </div>
    </AppLayout>
  );
}
