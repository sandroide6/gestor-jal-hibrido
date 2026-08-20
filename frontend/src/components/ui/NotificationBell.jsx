import { useState, useEffect, useRef, useCallback } from 'react';
import EmptyState from './EmptyState';
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

const TYPE_STYLES = {
  'document.reviewed':       { icon: '✓', bg: 'bg-green-100', text: 'text-green-700' },
  'document.synced':         { icon: '↑', bg: 'bg-blue-100',  text: 'text-blue-600'  },
  'document.pending_review': { icon: '!', bg: 'bg-amber-100', text: 'text-amber-700' },
};

function getTypeStyle(type) {
  return TYPE_STYLES[type] || { icon: '·', bg: 'bg-gray-100', text: 'text-gray-400' };
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

  return (
    <div className="relative" ref={panelRef}>
      {/* Botón campana */}
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        aria-label={`Notificaciones${unread > 0 ? `, ${unread} sin leer` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold
            w-4 h-4 flex items-center justify-center rounded-full leading-none pointer-events-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Cabecera */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
              {loading && (
                <svg className="animate-spin w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-xs text-jal-blue-500 hover:underline">
                  Marcar todas leídas
                </button>
              )}
              <button
                onClick={() => load()}
                title="Actualizar notificaciones"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Actualizar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {/* Error state */}
            {fetchError && !loading && (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-red-500 mb-2">No se pudieron cargar las notificaciones.</p>
                <button
                  onClick={() => load()}
                  className="text-xs text-jal-blue-500 hover:underline font-medium"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !fetchError && notifications.length === 0 && (
              <EmptyState message="Sin notificaciones" compact />
            )}

            {/* Notification items */}
            {!fetchError && notifications.map(n => {
              const style = getTypeStyle(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && handleMarkRead(n.id)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors
                    ${!n.read ? 'bg-blue-50/60' : ''}`}
                >
                  {/* Ícono */}
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${!n.read ? style.bg + ' ' + style.text : 'bg-gray-100 text-gray-400'}`}>
                    {style.icon}
                  </span>

                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${!n.read ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>

                  {/* Eliminar */}
                  <button
                    onClick={e => handleDelete(e, n.id)}
                    className="flex-shrink-0 text-gray-300 hover:text-red-400 text-base leading-none mt-0.5 transition-colors"
                    aria-label="Eliminar notificación"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
