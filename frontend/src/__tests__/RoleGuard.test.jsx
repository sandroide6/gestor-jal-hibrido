// PT-14: RoleGuard — protección de rutas por autenticación y rol
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import RoleGuard from '../components/ui/RoleGuard';

// Helpers
function renderGuard(children, props, storeOverride = {}) {
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    loading: false,
    ...storeOverride,
  });
  return render(
    <MemoryRouter>
      <RoleGuard {...props}>{children}</RoleGuard>
    </MemoryRouter>
  );
}

const PROTECTED_CONTENT = <div>Contenido protegido</div>;

describe('RoleGuard', () => {
  it('redirige al login si requireAuth y no está autenticado', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: true, roles: [] });
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('muestra el contenido si está autenticado y no se requiere rol específico', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: true, roles: [] }, {
      isAuthenticated: true,
      user: { role: 'auxiliar' },
    });
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });

  it('muestra error de acceso si el rol no coincide', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: true, roles: ['administrador'] }, {
      isAuthenticated: true,
      user: { role: 'auxiliar' },
    });
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
  });

  it('permite acceso si el rol está en la lista', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: true, roles: ['edil', 'administrador'] }, {
      isAuthenticated: true,
      user: { role: 'edil' },
    });
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });

  it('renderiza sin requireAuth aunque no esté autenticado', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: false, roles: [] });
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });

  it('permite acceso a administrador en rutas de múltiples roles', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: true, roles: ['auxiliar', 'administrador'] }, {
      isAuthenticated: true,
      user: { role: 'administrador' },
    });
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });

  // ── Casos límite ─────────────────────────────────────────

  it('deniega acceso si el rol del usuario no está reconocido en la lista permitida', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: true, roles: ['administrador', 'edil'] }, {
      isAuthenticated: true,
      user: { role: 'rol-inexistente' },
    });
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
  });

  it('deniega acceso si el usuario autenticado no tiene rol definido (role undefined)', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: true, roles: ['administrador'] }, {
      isAuthenticated: true,
      user: { id: 1 }, // sin campo "role"
    });
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
  });

  it('sin requireAuth pero con roles definidos, deniega acceso si no hay usuario autenticado', () => {
    // requireAuth=false evita el redirect a /login, pero la verificación de rol
    // sigue aplicando: hasRole() con user=null siempre devuelve false.
    renderGuard(PROTECTED_CONTENT, { requireAuth: false, roles: ['administrador'] });
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
  });

  it('renderiza múltiples children cuando el acceso está permitido', () => {
    renderGuard(
      <>
        <div>Primero</div>
        <div>Segundo</div>
      </>,
      { requireAuth: true, roles: [] },
      { isAuthenticated: true, user: { role: 'auxiliar' } }
    );
    expect(screen.getByText('Primero')).toBeInTheDocument();
    expect(screen.getByText('Segundo')).toBeInTheDocument();
  });

  it('sin roles requeridos y sin requireAuth, muestra el contenido incluso sin usuario', () => {
    renderGuard(PROTECTED_CONTENT, { requireAuth: false, roles: [] });
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });
});
