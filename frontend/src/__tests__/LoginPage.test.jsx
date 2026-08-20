// Tests de integración de LoginPage — envío de credenciales, errores, flujo 2FA
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';

const { loginMock, completeLoginMock, navigateMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  completeLoginMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../stores/authStore', () => {
  const useAuthStore = vi.fn(() => ({ login: loginMock }));
  useAuthStore.getState = () => ({ completeLogin: completeLoginMock });
  return { useAuthStore };
});

vi.mock('../services/api', () => ({
  api: { post: vi.fn() },
}));

import { api } from '../services/api';

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { writable: true, configurable: true, value });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

async function fillAndSubmit(user, { email = 'auxiliar@jal.gov.co', password = 'secreto123' } = {}) {
  if (email !== null) await user.type(screen.getByLabelText('Correo electrónico'), email);
  if (password !== null) await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
});

describe('LoginPage — envío de credenciales', () => {
  it('envía email y contraseña al hacer login y redirige según el rol', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ role: 'auxiliar', consent_accepted_at: '2026-01-01' });

    renderPage();
    await fillAndSubmit(user);

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('auxiliar@jal.gov.co', 'secreto123', false));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/generador', { replace: true }));
  });

  it('redirige a habeas-data si el usuario no ha aceptado el consentimiento', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ role: 'administrador', consent_accepted_at: null });

    renderPage();
    await fillAndSubmit(user);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/habeas-data', { replace: true }));
  });

  it('marca los campos requeridos como inválidos si se envía el formulario vacío', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Ingresa tu correo electrónico')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });
});

describe('LoginPage — manejo de errores', () => {
  it('muestra "Correo o contraseña incorrectos" en un error 401', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));

    renderPage();
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
  });

  it('muestra el mensaje del servidor cuando la cuenta está bloqueada (423)', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(Object.assign(new Error('Cuenta bloqueada temporalmente'), { status: 423 }));

    renderPage();
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Cuenta bloqueada temporalmente');
  });

  it('muestra error de conexión offline cuando navigator.onLine es false', async () => {
    const user = userEvent.setup();
    setOnline(false);
    loginMock.mockRejectedValue(new Error('Failed to fetch'));

    renderPage();
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sin conexión. No es posible iniciar sesión en modo offline.'
    );
  });

  it('muestra un error genérico de servidor para otros códigos de error', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

    renderPage();
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error al conectar con el servidor. Intente de nuevo.');
  });
});

describe('LoginPage — flujo 2FA', () => {
  it('cambia al paso de verificación en dos pasos cuando el login lo requiere', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ requires2fa: true, tempToken: 'temp-abc' });

    renderPage();
    await fillAndSubmit(user);

    expect(await screen.findByText('Verificación en dos pasos')).toBeInTheDocument();
  });

  it('completa el login con el código TOTP correcto y redirige', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ requires2fa: true, tempToken: 'temp-abc' });
    // El backend ya no devuelve `token` en el body (va en cookie httpOnly)
    api.post.mockResolvedValue({ user: { role: 'administrador' } });

    renderPage();
    await fillAndSubmit(user);
    await screen.findByText('Verificación en dos pasos');

    await user.type(screen.getByLabelText('Código de verificación'), '123456');
    await user.click(screen.getByRole('button', { name: /^verificar$/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/2fa/validate', {
      tempToken: 'temp-abc', token: '123456',
    }));
    expect(completeLoginMock).toHaveBeenCalledWith({ role: 'administrador' });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin', { replace: true }));
  });

  it('muestra error si el código TOTP es incorrecto', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ requires2fa: true, tempToken: 'temp-abc' });
    api.post.mockRejectedValue(Object.assign(new Error('bad code'), { status: 401 }));

    renderPage();
    await fillAndSubmit(user);
    await screen.findByText('Verificación en dos pasos');

    await user.type(screen.getByLabelText('Código de verificación'), '000000');
    await user.click(screen.getByRole('button', { name: /^verificar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorrecto. Intenta de nuevo.');
    expect(completeLoginMock).not.toHaveBeenCalled();
  });

  it('permite volver al paso de contraseña desde el paso 2FA', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ requires2fa: true, tempToken: 'temp-abc' });

    renderPage();
    await fillAndSubmit(user);
    await screen.findByText('Verificación en dos pasos');

    await user.click(screen.getByRole('button', { name: /volver al inicio de sesión/i }));

    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
  });
});
