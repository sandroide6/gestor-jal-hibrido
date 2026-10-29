import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAuthStore } from '../../stores/authStore';
import { useSyncManager } from '../../hooks/useSyncManager';
import SyncProgressBanner from './SyncProgressBanner';
import ServerStatusBanner from './ServerStatusBanner';
import ChangePasswordModal from './ChangePasswordModal';
import NotificationBell from './NotificationBell';
import ConnectionStatus from './ConnectionStatus';
import PageHeader from './PageHeader';
import ChatWidget from './ChatWidget';
import Icon from './Icon';
import { ROLE_LABEL } from '../../constants';

const JAL_NAME = import.meta.env.VITE_JAL_NOMBRE || 'JAL Comuna 12 · La América';

// ── Mapa de navegación ─────────────────────────────────────
// Dos grupos: el trabajo de todos los días y la administración. Cada elemento declara
// los roles que lo ven; las rutas protegidas siguen validándose en App.jsx (RoleGuard).
const NAV_GROUPS = [
  {
    label: 'Trabajo diario',
    items: [
      { path: '/inicio',    label: 'Inicio',            icon: 'inicio',   roles: ['auxiliar', 'administrador', 'edil'] },
      { path: '/generador', label: 'Crear documento',   icon: 'crear',    roles: ['auxiliar', 'administrador', 'edil'] },
      { path: '/edil',      label: 'Buscar documentos', icon: 'buscar',   roles: ['edil', 'administrador'] },
      { path: '/reportes',  label: 'Reportes',          icon: 'reportes', roles: ['edil', 'administrador'] },
      { path: '/ayuda',     label: 'Ayuda',             icon: 'ayuda',    roles: ['auxiliar', 'administrador', 'edil'] },
    ],
  },
  {
    label: 'Administración',
    items: [
      { path: '/admin',                      label: 'Resumen',             icon: 'resumen',   roles: ['administrador', 'edil'] },
      { path: '/admin/usuarios',             label: 'Usuarios',            icon: 'usuarios',  roles: ['administrador'] },
      { path: '/admin/tipos-documento',      label: 'Tipos de documento',  icon: 'tipos',     roles: ['administrador'] },
      { path: '/admin/auditoria',            label: 'Auditoría',           icon: 'auditoria', roles: ['administrador', 'edil'] },
      { path: '/admin/jal-config',           label: 'Configuración JAL',   icon: 'config',    roles: ['administrador'] },
      { path: '/admin/configuracion/backup', label: 'Copias de seguridad', icon: 'copia',     roles: ['administrador'] },
    ],
  },
];

function isActivePath(pathname, path) {
  return pathname === path || (path !== '/admin' && pathname.startsWith(`${path}/`));
}

// ── Elemento del lomo ──────────────────────────────────────
// El activo es una pestaña de carpeta: toma el color del papel y se une al contenido.
function NavItem({ item, active, collapsed, onClick }) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`group flex min-h-[46px] items-center gap-3 text-base
        focus-visible:outline-bg focus-visible:-outline-offset-4
        ${collapsed ? 'justify-center rounded-tab mx-2 px-2' : 'rounded-l-tab pl-4 pr-3 ml-3'}
        ${active
          ? `bg-bg text-brand font-semibold ${collapsed ? '' : 'mr-0'}`
          : `text-white/85 hover:bg-white/10 hover:text-white ${collapsed ? '' : 'mr-3 rounded-r-tab'}`}`}
      style={{ transition: 'background-color var(--dur-fast) ease, color var(--dur-fast) ease' }}
    >
      <Icon name={item.icon} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

const navItemShape = PropTypes.shape({
  path: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  roles: PropTypes.arrayOf(PropTypes.string).isRequired,
});
NavItem.propTypes = {
  item: navItemShape.isRequired,
  active: PropTypes.bool.isRequired,
  collapsed: PropTypes.bool,
  onClick: PropTypes.func,
};

function NavGroups({ groups, pathname, collapsed, onNavigate }) {
  return (
    <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto py-2 space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          {collapsed
            ? <div className="mx-4 mb-2 border-t border-white/15" />
            : <p className="px-7 pb-1.5 text-eyebrow uppercase text-white/65">{group.label}</p>}
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.path}>
                <NavItem item={item} active={isActivePath(pathname, item.path)} collapsed={collapsed} onClick={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
NavGroups.propTypes = {
  groups: PropTypes.array.isRequired,
  pathname: PropTypes.string.isRequired,
  collapsed: PropTypes.bool,
  onNavigate: PropTypes.func,
};

function Wordmark({ compact }) {
  return (
    <Link to="/inicio" className="block rounded-md px-1 text-white">
      <span className={`block font-serif font-semibold leading-tight ${compact ? 'text-lg' : 'text-xl'}`}>Gestor documental</span>
      {!compact && <span className="block text-[0.875rem] text-white/80">{JAL_NAME}</span>}
    </Link>
  );
}
Wordmark.propTypes = { compact: PropTypes.bool };

// ── Menú de la cuenta (escritorio) ─────────────────────────
function AccountMenu({ user, collapsed, onProfile, onPassword, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const item = 'flex w-full items-center gap-3 px-4 py-3 text-left text-ink hover:bg-gray-50';
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={collapsed ? `Cuenta de ${user?.name}` : undefined}
        className={`flex w-full items-center gap-3 rounded-md py-2 text-left text-white hover:bg-white/10 ${collapsed ? 'justify-center px-2' : 'px-3'}`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 font-semibold">
          {user?.name?.charAt(0)?.toUpperCase() || '?'}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold leading-tight">{user?.name}</span>
            <span className="block text-[0.875rem] text-white/80">{ROLE_LABEL[user?.role] || user?.role} · Mi cuenta</span>
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="anim-pop absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-float">
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); onProfile(); }}>
            <Icon name="firma" className="text-ink-muted" /> Mi perfil y firma
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); onPassword(); }}>
            <Icon name="llave" className="text-ink-muted" /> Cambiar contraseña
          </button>
          <div className="my-1 border-t border-line" />
          <button role="menuitem" type="button" className={`${item} text-danger-fg hover:bg-danger-bg`} onClick={() => { setOpen(false); onLogout(); }}>
            <Icon name="salir" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
AccountMenu.propTypes = {
  user: PropTypes.shape({ name: PropTypes.string, role: PropTypes.string }),
  collapsed: PropTypes.bool,
  onProfile: PropTypes.func.isRequired,
  onPassword: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};

// ── Menú completo en pantallas pequeñas ─────────────────────
function MobileDrawer({ user, groups, pathname, onClose, onProfile, onPassword, onLogout }) {
  const ref = useRef(null);
  useFocusTrap(ref, { onEscape: onClose });
  const row = 'flex w-full min-h-[46px] items-center gap-3 rounded-md px-4 text-left text-white/90 hover:bg-white/10';

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="anim-backdrop absolute inset-0 bg-brand-900/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        className="anim-drawer relative flex h-full w-80 max-w-[86vw] flex-col overflow-y-auto bg-brand pt-5 shadow-float [&>nav]:shrink-0 [&>nav]:overflow-visible"
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-5">
          <Wordmark />
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="grid h-11 w-11 place-items-center rounded-md text-white hover:bg-white/10">
            <Icon name="cerrar" />
          </button>
        </div>
        <NavGroups groups={groups} pathname={pathname} onNavigate={onClose} />
        <div className="border-t border-white/15 p-3">
          <p className="px-4 pb-2 text-white">
            <span className="block font-semibold">{user?.name}</span>
            <span className="text-[0.875rem] text-white/80">{ROLE_LABEL[user?.role] || user?.role}</span>
          </p>
          <button type="button" className={row} onClick={() => { onClose(); onProfile(); }}><Icon name="firma" /> Mi perfil y firma</button>
          <button type="button" className={row} onClick={() => { onClose(); onPassword(); }}><Icon name="llave" /> Cambiar contraseña</button>
          <button type="button" className={row} onClick={() => { onClose(); onLogout(); }}><Icon name="salir" /> Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}
MobileDrawer.propTypes = {
  user: PropTypes.shape({ name: PropTypes.string, role: PropTypes.string }),
  groups: PropTypes.array.isRequired,
  pathname: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onProfile: PropTypes.func.isRequired,
  onPassword: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};

// ── Barra inferior en móvil y tablet: las tareas frecuentes a un toque ──
function BottomNav({ pathname, canSearch, onMenu }) {
  const items = [
    { path: '/inicio', label: 'Inicio', icon: 'inicio' },
    { path: '/generador', label: 'Crear', icon: 'crear' },
    canSearch ? { path: '/edil', label: 'Buscar', icon: 'buscar' } : { path: '/ayuda', label: 'Ayuda', icon: 'ayuda' },
  ];
  const cls = (active) => `relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[0.8125rem]
    ${active ? 'font-semibold text-brand' : 'text-ink-muted'}`;
  return (
    <nav aria-label="Accesos rápidos" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((it) => {
        const active = isActivePath(pathname, it.path);
        return (
          <Link key={it.path} to={it.path} aria-current={active ? 'page' : undefined} className={cls(active)}>
            {active && <span aria-hidden="true" className="absolute top-0 h-[3px] w-8 rounded-b-sm bg-accent" />}
            <Icon name={it.icon} size={22} />
            {it.label}
          </Link>
        );
      })}
      <button type="button" onClick={onMenu} className={cls(false)} aria-haspopup="dialog">
        <Icon name="menu" size={22} />
        Menú
      </button>
    </nav>
  );
}
BottomNav.propTypes = {
  pathname: PropTypes.string.isRequired,
  canSearch: PropTypes.bool,
  onMenu: PropTypes.func.isRequired,
};

// ── Componente principal ──────────────────────────────────
/**
 * Marco de todas las pantallas internas.
 * - `title`: nombre corto del módulo (pestaña del navegador y h1 si no hay `heading`).
 * - `heading`, `eyebrow`, `description`, `actions`: encabezado de la página.
 * - `header={false}` cuando la página dibuja su propio encabezado.
 */
export default function AppLayout({ children, title, heading, eyebrow, description, actions, header = true, width = 'page' }) {
  const { user, logout, hasRole } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('sidebar') !== 'closed'; } catch { return true; }
  });

  useSyncManager();

  useEffect(() => {
    if (title) document.title = `${title} · Gestor JAL`;
  }, [title]);

  function toggleSidebar() {
    setSidebarOpen((v) => {
      try { localStorage.setItem('sidebar', v ? 'closed' : 'open'); } catch { /* sin almacenamiento */ }
      return !v;
    });
  }

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => hasRole(...i.roles)) }))
    .filter((g) => g.items.length > 0);

  const goProfile = () => navigate('/perfil');
  const openPassword = () => setShowChangePassword(true);
  const maxW = width === 'narrow' ? 'max-w-3xl' : width === 'wide' ? 'max-w-none' : 'max-w-page';

  return (
    <div className="min-h-screen bg-bg">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-brand focus:shadow-float">
        Saltar al contenido
      </a>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      {/* Lomo verde (escritorio) */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-brand pt-6 pb-4 lg:flex ${sidebarOpen ? 'w-64' : 'w-[4.5rem]'}`}>
        <div className={`mb-6 flex items-start gap-2 ${sidebarOpen ? 'px-6' : 'px-2 justify-center'}`}>
          {sidebarOpen && <div className="min-w-0 flex-1"><Wordmark /></div>}
          <button
            type="button"
            onClick={toggleSidebar}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
            aria-label={sidebarOpen ? 'Contraer menú lateral' : 'Expandir menú lateral'}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Contraer menú' : 'Expandir menú'}
          >
            <Icon name="colapsar" />
          </button>
        </div>
        <NavGroups groups={groups} pathname={location.pathname} collapsed={!sidebarOpen} />
        <div className={`mt-2 space-y-2 border-t border-white/15 pt-3 ${sidebarOpen ? 'px-3' : 'px-1'}`}>
          <AccountMenu user={user} collapsed={!sidebarOpen} onProfile={goProfile} onPassword={openPassword} onLogout={logout} />
        </div>
      </aside>

      <div className={`flex min-h-screen flex-col ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-[4.5rem]'}`}>
        {/* Barra superior: estado de conexión y avisos; en móvil, también la marca */}
        <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur-sm lg:bg-bg">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
            <Link to="/inicio" className="font-serif text-lg font-semibold text-brand lg:hidden">Gestor documental</Link>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ConnectionStatus />
              <NotificationBell />
            </div>
          </div>
          <ServerStatusBanner />
          <SyncProgressBanner />
        </header>

        <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-28 focus:outline-none">
          <div className={`mx-auto w-full ${maxW}`}>
            {header && (heading || title) && (
              <PageHeader eyebrow={eyebrow} title={heading || title} description={description} actions={actions} />
            )}
            {children}
          </div>
        </main>
      </div>

      <ChatWidget />
      <BottomNav pathname={location.pathname} canSearch={hasRole('edil', 'administrador')} onMenu={() => setShowMobileMenu(true)} />

      {showMobileMenu && (
        <MobileDrawer
          user={user}
          groups={groups}
          pathname={location.pathname}
          onClose={() => setShowMobileMenu(false)}
          onProfile={goProfile}
          onPassword={openPassword}
          onLogout={logout}
        />
      )}
    </div>
  );
}

AppLayout.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  heading: PropTypes.node,
  eyebrow: PropTypes.node,
  description: PropTypes.node,
  actions: PropTypes.node,
  header: PropTypes.bool,
  width: PropTypes.oneOf(['narrow', 'page', 'wide']),
};
