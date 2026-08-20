import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStore } from '../../stores/syncStore';
import { useSyncManager } from '../../hooks/useSyncManager';
import SyncProgressBanner from './SyncProgressBanner';
import ChangePasswordModal from './ChangePasswordModal';
import NotificationBell from './NotificationBell';
import ChatWidget from './ChatWidget';
import { ROLE_LABEL } from '../../constants';

// ── Iconos SVG ────────────────────────────────────────────
function Icon({ d, d2 }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  );
}

const ICONS = {
  generar:    'd="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"',
  documentos: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  panel:      'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  usuarios:   'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  tipos:      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  reportes:   'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  auditoria:  'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  config:     'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  backup:     'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
};

// ── Definición de rutas ────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { path: '/generador', label: 'Generar documento', icon: ICONS.generar,    roles: ['auxiliar', 'administrador', 'edil'] },
      { path: '/edil',      label: 'Documentos',        icon: ICONS.documentos, roles: ['edil', 'administrador'] },
      { path: '/reportes',  label: 'Reportes',          icon: ICONS.reportes,   roles: ['edil', 'administrador'] },
    ],
  },
  {
    label: 'Administración',
    items: [
      { path: '/admin',                 label: 'Panel',            icon: ICONS.panel,    roles: ['administrador', 'edil'] },
      { path: '/admin/usuarios',        label: 'Usuarios',         icon: ICONS.usuarios, roles: ['administrador'] },
      { path: '/admin/tipos-documento', label: 'Tipos de documento', icon: ICONS.tipos,  roles: ['administrador'] },
      { path: '/admin/auditoria',       label: 'Auditoría',        icon: ICONS.auditoria,roles: ['administrador', 'edil'] },
      { path: '/admin/jal-config',      label: 'Configuración JAL', icon: ICONS.config,  roles: ['administrador'] },
      { path: '/admin/configuracion/backup', label: 'Backup Drive',  icon: ICONS.backup,  roles: ['administrador'] },
    ],
  },
];

// Lista plana para el drawer móvil
const NAV_FLAT = NAV_GROUPS.flatMap(g => g.items);

// ── NavItem ───────────────────────────────────────────────
function NavItem({ item, active, onClick, collapsed }) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`flex items-center py-2 rounded-lg text-sm transition-all ${
        collapsed ? 'justify-center px-2' : 'gap-3 px-3'
      } ${
        active
          ? 'bg-white/15 text-white font-medium'
          : 'text-jal-blue-100 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon d={item.icon} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />}
    </Link>
  );
}

// ── Mobile drawer ─────────────────────────────────────────
function MobileDrawer({ user, isOnline, visibleGroups, isActive, onClose, onNavigate, onChangePassword, onLogout }) {
  const drawerRef = useRef(null);
  useFocusTrap(drawerRef, { onEscape: onClose });

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className="relative w-72 max-w-[85vw] bg-jal-blue-600 flex flex-col h-full shadow-2xl"
      >
        {/* Cabecera */}
        <div className="px-4 py-5 flex items-start justify-between border-b border-white/10">
          <div>
            <p className="text-white font-semibold">{user?.name}</p>
            <p className="text-jal-blue-200 text-xs mt-0.5">{ROLE_LABEL[user?.role] || user?.role}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-amber-400'}`} />
              <span className="text-jal-blue-200 text-xs">{isOnline ? 'En línea' : 'Sin conexión'}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar menú" className="text-white/70 hover:text-white text-2xl leading-none mt-0.5">×</button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {visibleGroups.map(group => (
            <div key={group.label}>
              <p className="text-jal-blue-300 text-xs font-semibold uppercase tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.path} item={item} active={isActive(item)} onClick={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Acciones */}
        <div className="border-t border-white/10 p-3 space-y-0.5">
          <button onClick={() => { onNavigate('/perfil'); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-jal-blue-100 hover:bg-white/10 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Mi perfil y firma
          </button>
          <button onClick={() => { onChangePassword(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-jal-blue-100 hover:bg-white/10 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Cambiar contraseña
          </button>
          <button onClick={() => { onLogout(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-300 hover:bg-white/10 rounded-lg font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

Icon.propTypes = { d: PropTypes.string.isRequired, d2: PropTypes.string };

const navItemShape = PropTypes.shape({
  path: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  roles: PropTypes.arrayOf(PropTypes.string).isRequired,
});
NavItem.propTypes = {
  item: navItemShape.isRequired,
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func,
  collapsed: PropTypes.bool,
};

const userShape = PropTypes.shape({ name: PropTypes.string, role: PropTypes.string });
MobileDrawer.propTypes = {
  user: userShape,
  isOnline: PropTypes.bool.isRequired,
  visibleGroups: PropTypes.array.isRequired,
  isActive: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onChangePassword: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};

// ── Componente principal ──────────────────────────────────
export default function AppLayout({ children, title }) {
  const { user, logout, hasRole } = useAuthStore();
  const { isOnline, pendingCount, isSyncing } = useSyncStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showUserMenu, setShowUserMenu]   = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('sidebar') !== 'closed');

  function toggleSidebar() {
    setSidebarOpen(v => {
      const next = !v;
      localStorage.setItem('sidebar', next ? 'open' : 'closed');
      return next;
    });
  }

  useSyncManager();

  function isActive(item) {
    return location.pathname === item.path ||
      (item.path !== '/admin' && location.pathname.startsWith(item.path));
  }

  function closeMobile() { setShowMobileMenu(false); }

  const visibleGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(i => hasRole(...i.roles)),
  })).filter(g => g.items.length > 0);

  const visibleFlat = NAV_FLAT.filter(i => hasRole(...i.roles));

  return (
    <div className="min-h-screen bg-gray-50">
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      <SyncProgressBanner />

      {/* ══════════════════════════════════════════════════════
          SIDEBAR DESKTOP (md+)
      ══════════════════════════════════════════════════════ */}
      <aside className={`hidden md:flex fixed left-0 top-0 h-full bg-jal-blue-600 flex-col z-30 shadow-xl transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'}`}>

        {/* Logo */}
        <div className={`py-5 flex items-center border-b border-white/10 ${sidebarOpen ? 'px-4 gap-3' : 'px-2 justify-center'}`}>
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold select-none">
              {(import.meta.env.VITE_JAL_SHORT || 'JAL').slice(0, 3)}
            </span>
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">
                {import.meta.env.VITE_JAL_NOMBRE || 'Gestor JAL'}
              </p>
              <p className="text-jal-blue-200 text-xs">Junta Administradora Local</p>
            </div>
          )}
        </div>

        {/* Navegación agrupada */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {visibleGroups.map(group => (
            <div key={group.label}>
              {sidebarOpen && (
                <p className="text-jal-blue-300 text-xs font-semibold uppercase tracking-widest px-3 mb-1.5">
                  {group.label}
                </p>
              )}
              {!sidebarOpen && <div className="border-t border-white/10 mb-1.5" />}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.path} item={item} active={isActive(item)} collapsed={!sidebarOpen} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer de usuario */}
        <div className="border-t border-white/10 p-2">
          {/* Estado online — solo visible cuando está abierto */}
          {sidebarOpen && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-2">
              {isSyncing ? (
                <svg className="animate-spin h-3 w-3 text-jal-blue-300" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-400' : 'bg-amber-400'}`} />
              )}
              <span className="text-jal-blue-200 text-xs">
                {isSyncing ? 'Sincronizando…' : isOnline ? 'En línea' : 'Sin conexión'}
              </span>
              {pendingCount > 0 && !isSyncing && (
                <span className="ml-auto bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </div>
          )}

          {/* Datos de usuario + menú */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              title={!sidebarOpen ? user?.name : undefined}
              aria-label="Menú de usuario"
              aria-expanded={showUserMenu}
              aria-haspopup="true"
              className={`w-full flex items-center py-2 rounded-lg hover:bg-white/10 transition-colors text-left ${sidebarOpen ? 'gap-2.5 px-3' : 'justify-center px-2'}`}
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 relative">
                <span className="text-white text-xs font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
                {!sidebarOpen && (
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-jal-blue-600 ${isOnline ? 'bg-green-400' : 'bg-amber-400'}`} />
                )}
              </div>
              {sidebarOpen && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-medium leading-tight truncate">{user?.name}</p>
                    <p className="text-jal-blue-300 text-xs leading-tight">{ROLE_LABEL[user?.role] || user?.role}</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-jal-blue-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>

            {showUserMenu && (
              <div className={`absolute bottom-full mb-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 ${sidebarOpen ? 'left-0 right-0' : 'left-0 w-44'}`}>
                <button
                  className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => { navigate('/perfil'); setShowUserMenu(false); }}
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Mi perfil y firma
                </button>
                <button
                  className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => { setShowChangePassword(true); setShowUserMenu(false); }}
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Cambiar contraseña
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={() => { logout(); setShowUserMenu(false); }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          ÁREA DE CONTENIDO (con margen para el sidebar en md+)
      ══════════════════════════════════════════════════════ */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'md:ml-56' : 'md:ml-14'}`}>

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

            {/* Izquierda: hamburger (móvil) + toggle sidebar (desktop) + título */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Hamburger — solo móvil */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 flex-shrink-0"
                aria-label="Abrir menú"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Toggle sidebar — solo desktop */}
              <button
                onClick={toggleSidebar}
                className="hidden md:inline-flex p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0"
                aria-label={sidebarOpen ? 'Colapsar menú lateral' : 'Expandir menú lateral'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  {sidebarOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>

              {/* Nombre de la app en móvil */}
              <span className="md:hidden font-semibold text-jal-blue-600 text-sm truncate">
                {import.meta.env.VITE_JAL_SHORT || 'JAL'}
              </span>

              {/* Título de la página en desktop */}
              {title && (
                <h1 className="hidden md:block text-base font-semibold text-gray-800 truncate">{title}</h1>
              )}
            </div>

            {/* Derecha: notificaciones + info usuario desktop */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <NotificationBell />

              {/* Nombre usuario solo desktop (ya está en sidebar) */}
              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-gray-200">
                <div className="w-7 h-7 rounded-full bg-jal-blue-100 flex items-center justify-center">
                  <span className="text-jal-blue-600 text-xs font-semibold">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <span className="text-xs text-gray-600 font-medium max-w-[120px] truncate">{user?.name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Título en móvil (bajo el top bar) */}
        {title && (
          <div className="md:hidden px-4 pt-4 pb-1">
            <h1 className="text-lg font-bold text-jal-blue-600">{title}</h1>
          </div>
        )}

        {/* Contenido principal */}
        <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
          {title && (
            <h1 className="hidden md:block text-xl font-bold text-jal-blue-500 mb-6 sr-only">{title}</h1>
          )}
          {children}
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════
          DRAWER MÓVIL
      ══════════════════════════════════════════════════════ */}
      <ChatWidget />

      {showMobileMenu && (
        <MobileDrawer
          user={user}
          isOnline={isOnline}
          visibleGroups={visibleGroups}
          isActive={isActive}
          onClose={closeMobile}
          onNavigate={navigate}
          onChangePassword={() => setShowChangePassword(true)}
          onLogout={logout}
        />
      )}
    </div>
  );
}
AppLayout.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
};
