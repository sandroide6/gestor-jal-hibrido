import { useState, useEffect, useRef, useCallback } from 'react';
import EmptyState from './EmptyState';
import Icon from './Icon';
import Spinner from './Spinner';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationsStore } from '../../stores/notificationsStore';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../../services/notificationsService';

function timeAgo(date) {
  if (!date) return '';
  const ms = Date.now() - new Date(date).getTime();
  if (isNaN(ms) || ms < 0) return '';
  const secs = Math.floor(ms / 1000);
  if (secs < 60)    return 'ahora mismo';
  if (secs < 3600)  return `hace ${Math.floor(secs / 60)} min`;
  if (secs < 86400) return `hace ${Math.floor(secs / 3600)} h`;
  return `hace ${Math.floor(ms / 86400000)} d`;
}

// Cada tipo con su icono y tono; el color nunca es la única pista (el texto lo dice).
const TYPE_STYLES = {
  'document.reviewed':       { icon: 'check',  tone: 'text-success-fg bg-success-bg' },
  'document.synced':         { icon: 'nube',   tone: 'text-info-fg bg-info-bg' },
  'document.pending_review': { icon: 'alerta', tone: 'text-warning-fg bg-warning-bg' },
};

function getTypeStyle(type) {
  return TYPE_STYLES[type] || { icon: 'campana', tone: 'text-ink-muted bg-sunken' };
}

export default function NotificationBell() {
  // Fix: antes gateaba en `token` truthy — desde que el access token vive en una
  // cookie httpOnly (ya no en el store), esa condición siempre era falsa y las
  // notificaciones nunca cargaban.
  const { isAuthenticated } = useAuthStore();
  const { notifications, unread, setAll, markOneRead, markAllRead, removeOne, loading, setLoading } =
    useNotificationsStore();
  const [open, setOpen]   = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const panelRef  = useRef(null);
  const buttonRef = useRef(null);
  const intervalRef = useRef(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setFetchError(false);
    try {
      const data = await fetchNotifications();
      setAll(data?.notifications ?? [], data?.unread ?? 0);
    } catch (err) {
      console.error('[Notificaciones] Error al cargar:', err?.message || err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setAll, setLoading]);

  // Carga inmediata + polling cada 30 s
  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  // Cierra el panel al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // Carga al abrir el panel (datos frescos)
  async function handleOpen() {
    setOpen(v => !v);
    if (!open) load();
  }

  async function handleMarkRead(id) {
    markOneRead(id);
    await markNotificationRead(id).catch(() => {});
  }

  async function handleMarkAll() {
    markAllRead();
    await markAllNotificationsRead().catch(() => {});
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    removeOne(id);
    await deleteNotification(id).catch(() => {});
  }

  // Escape cierra el panel y devuelve el foco a la campana
  function onPanelKey(e) {
    if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
  }

  return (
    <div className="relative" ref={panelRef} onKeyDown={onPanelKey}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="relative flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-brand-tint hover:text-brand"
        aria-label={`Notificaciones${unread > 0 ? `, ${unread} sin leer` : ''}`}
        aria-expanded={open}
        aria-controls="panel-notificaciones"
      >
        <Icon name="campana" size={22} />
        {unread > 0 && (
          <span aria-hidden="true" className="pointer-events-none absolute right-1 top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 text-[0.75rem] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <section
          id="panel-notificaciones"
          aria-label="Notificaciones"
          className="anim-pop origin-top-right fixed inset-x-3 top-16 z-50 overflow-hidden rounded-lg border border-line bg-surface shadow-float sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              Notificaciones
              {loading && <Spinner />}
            </h2>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" onClick={handleMarkAll} className="btn-ghost btn-sm">
                  Marcar todas como leídas
                </button>
              )}
              <button type="button" onClick={() => load()} className="btn-ghost btn-sm" disabled={loading}>
                Actualizar
              </button>
            </div>
          </div>

          <div className="max-h-[min(24rem,60dvh)] overflow-y-auto">
            {fetchError && !loading && (
              <div className="px-4 py-5 text-center" role="alert">
                <p className="mb-2 text-danger-fg">No se pudieron cargar las notificaciones.</p>
                <button type="button" onClick={() => load()} className="btn-secondary btn-sm">Intentar de nuevo</button>
              </div>
            )}

            {!loading && !fetchError && notifications.length === 0 && (
              <EmptyState message="No tienes notificaciones." compact />
            )}

            {!fetchError && notifications.length > 0 && (
              <ul>
                {notifications.map(n => {
                  const style = getTypeStyle(n.type);
                  return (
                    <li key={n.id} className={`flex items-start gap-1 border-t border-line first:border-t-0 ${!n.read ? 'bg-brand-tint/60' : ''}`}>
                      {/* Botón real: se puede marcar como leída con teclado */}
                      <button
                        type="button"
                        onClick={() => !n.read && handleMarkRead(n.id)}
                        className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-gray-50"
                        aria-label={`${n.read ? '' : 'Sin leer. '}${n.message}. ${timeAgo(n.created_at)}${n.read ? '' : '. Marcar como leída'}`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${n.read ? 'bg-sunken text-ink-muted' : style.tone}`}>
                          <Icon name={style.icon} size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block leading-snug ${n.read ? 'text-ink-muted' : 'font-semibold text-ink'}`}>{n.message}</span>
                          <span className="mt-0.5 block text-sm text-ink-muted">{timeAgo(n.created_at)}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={e => handleDelete(e, n.id)}
                        className="m-1.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-danger-bg hover:text-danger-fg"
                        aria-label="Eliminar notificación"
                      >
                        <Icon name="cerrar" size={18} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
