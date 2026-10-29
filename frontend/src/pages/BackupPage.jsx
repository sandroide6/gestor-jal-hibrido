import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/ui/AppLayout';
import { backupService } from '../services/backupService';
import { useAuthStore } from '../stores/authStore';
import PropTypes from 'prop-types';
import { toast } from '../stores/toastStore';
import { ConfirmDialog } from '../components/ui/Dialog';
import Notice from '../components/ui/Notice';
import Spinner from '../components/ui/Spinner';
import Icon from '../components/ui/Icon';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';

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

const LOG_STATUS = {
  success: { tone: 'success', label: 'Completada' },
  failed:  { tone: 'danger',  label: 'Falló' },
  running: { tone: 'info',    label: 'En curso' },
};

function Section({ title, icon, children, id }) {
  return (
    <section className="card p-0" aria-labelledby={id}>
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <Icon name={icon} className="text-brand" />
        <h2 id={id} className="title-card">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
Section.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  children: PropTypes.node,
  id: PropTypes.string.isRequired,
};

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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Avisos con el sistema común de toasts (antes había uno propio fijo arriba a la derecha)
  const showToast = (msg, type = 'success') => (type === 'error' ? toast.error(msg) : toast.success(msg));

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
    } catch { showToast('No se pudo cargar la configuración de copias.', 'error'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    load();
    // Leer parámetros de URL (callback de OAuth)
    const p = new URLSearchParams(window.location.search);
    if (p.get('connected')) { showToast('Google Drive quedó conectado.'); load(); }
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
    setConfirmDisconnect(false);
    try { await backupService.disconnect(token); load(); showToast('Google Drive desconectado.'); }
    catch (err) { showToast(err.message, 'error'); }
  }

  async function saveSchedule() {
    setSaving(true);
    try {
      await backupService.saveConfig(form, token);
      load();
      showToast('Programación guardada.');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function runNow() {
    setRunning(true);
    try {
      await backupService.runBackup(token);
      showToast('La copia empezó. El historial se actualizará cuando termine.');
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

  const layout = { title: 'Copias de seguridad', eyebrow: 'Administración', description: 'Copias automáticas en Google Drive y copias guardadas en el equipo del servidor.' };

  if (loading) return (
    <AppLayout {...layout}>
      <p role="status" className="flex h-40 items-center justify-center gap-2 text-ink-muted"><Spinner />Cargando…</p>
    </AppLayout>
  );

  const selectField = (id, label, value, onChange, options) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={onChange}>{options}</select>
    </div>
  );

  return (
    <AppLayout {...layout}>
      {confirmDisconnect && (
        <ConfirmDialog
          danger
          title="¿Desconectar Google Drive?"
          message="Las copias automáticas dejarán de subirse a Drive. Las que ya están allí no se borran."
          confirmLabel="Desconectar"
          onConfirm={disconnect}
          onCancel={() => setConfirmDisconnect(false)}
        />
      )}

      <div className="space-y-6">
        {!cfg?.configured && (
          <Notice tone="warning" title="Falta configurar las credenciales de Google en el servidor">
            <p>Quien administra el servidor debe llenar en <code className="rounded bg-surface px-1">backend/.env</code>:</p>
            <pre className="mt-2 select-all overflow-x-auto rounded-sm bg-surface p-2 font-mono text-sm">
{`GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui`}
            </pre>
            <p className="mt-2">Se obtienen en <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="link">Google Cloud Console</a> → APIs → Credenciales → OAuth 2.0.</p>
            <p className="mt-1">Dirección de redirección autorizada: <code className="break-all rounded bg-surface px-1">http://localhost:3001/v1/backup/drive/callback</code></p>
          </Notice>
        )}

        <Section id="s-drive" title="Conexión con Google Drive" icon="nube">
          {cfg?.connected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-success-bg text-success-fg"><Icon name="check" /></span>
                  <div>
                    <p className="font-semibold">Conectado</p>
                    <p className="text-ink-muted">{cfg.email || 'Cuenta de Google'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setConfirmDisconnect(true)} className="btn-danger-outline btn-sm">Desconectar</button>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-sunken px-4 py-3">
                <Icon name="carpeta" className="text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Carpeta en Google Drive</p>
                  <p className="truncate text-ink-muted">{cfg.folder_id ? 'Gestor JAL Backups' : 'Se creará con la primera copia'}</p>
                </div>
                {cfg.folder_id && (
                  <a href={`https://drive.google.com/drive/folders/${cfg.folder_id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                    Abrir carpeta<span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="py-2">
              <p className="mb-4 max-w-prose text-ink-muted">Conecta una cuenta de Google para que las copias se guarden también en Drive.</p>
              <button type="button" onClick={connectDrive} disabled={!cfg?.configured} className="btn-primary">
                <Icon name="nube" />Conectar con Google Drive
              </button>
            </div>
          )}
        </Section>

        {cfg?.connected && (<>
          <Section id="s-manual" title="Copia manual" icon="copia">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <dl className="space-y-1 text-ink-muted">
                <div><dt className="inline">Incluye: </dt><dd className="inline">base de datos, documentos y plantillas</dd></div>
                <div><dt className="inline">Última copia: </dt><dd className="inline font-semibold text-ink">{fmtDate(cfg.last_backup_at)}</dd></div>
                {cfg.auto_enabled && <div><dt className="inline">Próxima automática: </dt><dd className="inline font-semibold text-ink">{fmtDate(cfg.next_backup_at)}</dd></div>}
              </dl>
              <button type="button" onClick={runNow} disabled={running} className="btn-primary" aria-busy={running || undefined}>
                {running ? <Spinner /> : <Icon name="copia" />}
                {running ? 'Iniciando…' : 'Hacer una copia ahora'}
              </button>
            </div>
          </Section>

          <Section id="s-auto" title="Copia automática" icon="config">
            <div className="space-y-4">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input type="checkbox" className="h-5 w-5 rounded accent-brand"
                  checked={form.auto_enabled || false}
                  onChange={e => setForm(f => ({ ...f, auto_enabled: e.target.checked }))} />
                <span className="font-semibold">Hacer copias automáticas</span>
              </label>

              {form.auto_enabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectField('b-freq', 'Frecuencia', form.schedule || 'daily',
                    e => setForm(f => ({ ...f, schedule: e.target.value })),
                    Object.entries(SCHEDULE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>))}

                  {(form.schedule === 'daily' || form.schedule === 'weekly') && selectField('b-hora', 'Hora', form.schedule_hour ?? 2,
                    e => setForm(f => ({ ...f, schedule_hour: parseInt(e.target.value) })),
                    Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>))}

                  {form.schedule === 'weekly' && selectField('b-dia', 'Día de la semana', form.schedule_day ?? 1,
                    e => setForm(f => ({ ...f, schedule_day: parseInt(e.target.value) })),
                    DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>))}

                  <div>
                    <label className="label" htmlFor="b-ret">Cuántas copias guardar</label>
                    <p className="hint" id="b-ret-hint">Las más antiguas se borran al pasar de este número.</p>
                    <input id="b-ret" type="number" min={1} max={50} className="input" aria-describedby="b-ret-hint"
                      value={form.retention_count ?? 10}
                      onChange={e => setForm(f => ({ ...f, retention_count: parseInt(e.target.value) }))} />
                  </div>
                </div>
              )}

              <button type="button" onClick={saveSchedule} disabled={saving} className="btn-primary" aria-busy={saving || undefined}>
                {saving && <Spinner />}
                {saving ? 'Guardando…' : 'Guardar programación'}
              </button>
            </div>
          </Section>

          <Section id="s-local" title="Copias en el equipo del servidor" icon="carpeta">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink-muted">Guardadas en <code className="rounded bg-sunken px-1">data/backups/</code></p>
              <button type="button" onClick={handleOpenFolder} disabled={openingFolder} className="btn-secondary btn-sm" aria-busy={openingFolder || undefined}>
                {openingFolder && <Spinner />}
                {openingFolder ? 'Abriendo…' : 'Abrir carpeta'}
              </button>
            </div>

            {localFiles.length === 0 ? (
              <EmptyState compact message="Todavía no hay copias en este equipo." />
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {localFiles.map((f) => (
                  <li key={f.filename} className="flex items-center gap-3 px-3 py-2.5">
                    <Icon name="documento" className="text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{f.filename}</p>
                      <p className="text-sm text-ink-muted">{fmt(f.size_bytes)} · {fmtDate(f.created_at)}</p>
                    </div>
                    <button type="button" onClick={() => handleDownloadLocal(f.filename)} disabled={downloadingFile === f.filename}
                      className="btn-ghost btn-sm" aria-label={`Descargar ${f.filename}`}>
                      {downloadingFile === f.filename ? <Spinner /> : <Icon name="descargar" size={18} />}
                      Descargar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="s-hist" title="Historial de copias en Drive" icon="auditoria">
            {logs.length === 0 ? (
              <EmptyState compact message="Todavía no hay copias registradas." />
            ) : (
              <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Historial de copias">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Archivo</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Tamaño</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Estado</th>
                      <th scope="col"><span className="sr-only">Enlace</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const st = LOG_STATUS[log.status] || { tone: 'neutral', label: log.status };
                      return (
                        <tr key={log.id}>
                          <td className="max-w-[14rem] truncate" title={log.filename}>{log.filename || '—'}</td>
                          <td className="whitespace-nowrap text-ink-muted">{fmtDate(log.created_at)}</td>
                          <td className="text-ink-muted">{fmt(log.size_bytes)}</td>
                          <td>{log.type === 'auto' ? 'Automática' : 'Manual'}</td>
                          <td><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                          <td>
                            {log.drive_file_url && (
                              <a href={log.drive_file_url} target="_blank" rel="noreferrer" className="link">
                                Ver en Drive<span className="sr-only"> (se abre en otra pestaña)</span>
                              </a>
                            )}
                            {log.status === 'failed' && log.error_message && (
                              <span className="text-danger-fg">{log.error_message}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>)}
      </div>
    </AppLayout>
  );
}
