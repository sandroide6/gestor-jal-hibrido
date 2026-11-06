import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect } from 'react';
import RoleGuard from '../components/ui/RoleGuard';
import { useAuthStore } from '../stores/authStore';

// Cuenta cuántas veces se monta la página (cada montaje = una carga de datos)
let mounts = 0;
function Pagina() {
  useEffect(() => { mounts += 1; }, []);
  return <p>contenido</p>;
}

describe('RoleGuard — cambio de contraseña obligatorio', () => {
  beforeEach(() => { mounts = 0; });

  it('vuelve a montar la página al completar el cambio, para que recargue sus datos', () => {
    act(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 'u1', role: 'administrador', must_change_password: true },
      });
    });
    render(<MemoryRouter><RoleGuard requireAuth><Pagina /></RoleGuard></MemoryRouter>);
    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(mounts).toBe(1);

    act(() => { useAuthStore.setState({ user: { id: 'u1', role: 'administrador', must_change_password: false } }); });
    expect(mounts).toBe(2);

    // Otros cambios del usuario no la vuelven a montar
    act(() => { useAuthStore.setState({ user: { id: 'u1', role: 'administrador', must_change_password: false, name: 'X' } }); });
    expect(mounts).toBe(2);
  });
});
