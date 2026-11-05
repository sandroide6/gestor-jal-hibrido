// Cambio obligatorio de contraseña (auditoría 2026-11-05, P1-6)
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ api: { patch: vi.fn() } }));
import { api } from '../services/api';
import ChangePasswordModal from '../components/ui/ChangePasswordModal';

function fill() {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'Inicial-123' } });
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'Propia-2026!' } });
  fireEvent.change(screen.getByLabelText('Escríbela otra vez'), { target: { value: 'Propia-2026!' } });
}

describe('ChangePasswordModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('en modo obligatorio no se puede cerrar ni cancelar', () => {
    const onClose = vi.fn();
    render(<ChangePasswordModal forced onClose={onClose} />);
    expect(screen.getByText('Elige tu propia contraseña')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('avisa con onChanged cuando el cambio sale bien', async () => {
    api.patch.mockResolvedValue({ message: 'ok' });
    const onChanged = vi.fn();
    render(<ChangePasswordModal forced onClose={() => {}} onChanged={onChanged} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(api.patch).toHaveBeenCalledWith('/auth/change-password', { currentPassword: 'Inicial-123', newPassword: 'Propia-2026!' });
  });

  it('en modo normal conserva el botón Cancelar', () => {
    render(<ChangePasswordModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });
});
