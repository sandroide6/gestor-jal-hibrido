// Tests del cliente HTTP base — headers, errores 4xx/5xx, refresh de token, download
vi.mock('../stores/authStore', () => ({
  useAuthStore: { getState: vi.fn() },
}));

import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob([JSON.stringify(body)])),
  };
}

beforeEach(() => {
  global.fetch = vi.fn();
  useAuthStore.getState.mockReturnValue({ refreshToken: vi.fn() });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('api — headers', () => {
  // Fix: el access token ya no se envía como header Authorization — vive en una
  // cookie httpOnly que el navegador adjunta solo (credentials:'include'). El param
  // `token` se sigue aceptando en la firma (no romper call sites existentes) pero ya
  // no se usa para nada.
  it('nunca adjunta el header Authorization, aunque se pase `token`', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.get('/foo', { token: 'abc123' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('siempre manda credentials:"include" para que la cookie httpOnly viaje', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.get('/foo');
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.credentials).toBe('include');
  });

  it('adjunta X-CSRF-Token en mutaciones cuando existe la cookie csrf_token', async () => {
    document.cookie = 'csrf_token=mi-csrf-valor';
    global.fetch.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.post('/foo', { a: 1 });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['X-CSRF-Token']).toBe('mi-csrf-valor');
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
  });

  it('no adjunta X-CSRF-Token en un GET (no es mutación)', async () => {
    document.cookie = 'csrf_token=mi-csrf-valor';
    global.fetch.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.get('/foo');
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['X-CSRF-Token']).toBeUndefined();
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
  });

  it('no adjunta X-CSRF-Token si no existe la cookie', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.post('/foo', { a: 1 });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['X-CSRF-Token']).toBeUndefined();
  });

  it('agrega Content-Type json salvo que sea FormData', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, {}));
    await api.post('/foo', { a: 1 });
    let opts = global.fetch.mock.calls[0][1];
    expect(opts.headers['Content-Type']).toBe('application/json');

    global.fetch.mockClear();
    global.fetch.mockResolvedValue(jsonResponse(200, {}));
    await api.post('/foo', new FormData(), { isFormData: true });
    opts = global.fetch.mock.calls[0][1];
    expect(opts.headers['Content-Type']).toBeUndefined();
  });

  it('serializa params como query string', async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, {}));
    await api.get('/foo', { params: { page: 1, limit: 10 } });
    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('/foo?page=1&limit=10');
  });
});

describe('api — manejo de errores HTTP', () => {
  it('lanza un error con status y data en respuesta 4xx', async () => {
    global.fetch.mockResolvedValue(jsonResponse(404, { message: 'No encontrado' }));
    await expect(api.get('/foo')).rejects.toMatchObject({
      message: 'No encontrado',
      status: 404,
      data: { message: 'No encontrado' },
    });
  });

  it('lanza un error con status en respuesta 5xx', async () => {
    global.fetch.mockResolvedValue(jsonResponse(500, {}));
    await expect(api.get('/foo')).rejects.toMatchObject({
      message: 'HTTP 500',
      status: 500,
    });
  });

  it('propaga el error cuando fetch lanza (error de red)', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.get('/foo')).rejects.toThrow('Failed to fetch');
  });
});

describe('api — refresh de token en 401', () => {
  // Fix: refreshToken() ahora devuelve true/false (el access token renovado llega
  // solo en la cookie httpOnly, no hay un valor de token que reenviar) — el reintento
  // simplemente repite la MISMA petición, el navegador manda la cookie nueva solo.
  it('reintenta la petición (misma request) tras un refresh exitoso', async () => {
    const refreshToken = vi.fn().mockResolvedValue(true);
    useAuthStore.getState.mockReturnValue({ refreshToken });

    global.fetch
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await api.get('/protegido');

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });
  });

  it('no reintenta infinitamente si el refresh también falla', async () => {
    const refreshToken = vi.fn().mockResolvedValue(false);
    useAuthStore.getState.mockReturnValue({ refreshToken });

    global.fetch.mockResolvedValue(jsonResponse(401, { message: 'No autorizado' }));

    await expect(api.get('/protegido')).rejects.toMatchObject({
      status: 401,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('no intenta refresh en rutas de autenticación', async () => {
    const refreshToken = vi.fn();
    useAuthStore.getState.mockReturnValue({ refreshToken });

    global.fetch.mockResolvedValue(jsonResponse(401, { message: 'Credenciales inválidas' }));

    await expect(api.post('/auth/login', { email: 'a@a.com', password: 'x' })).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshToken).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('api.download', () => {
  it('descarga el blob y dispara el diálogo de guardado', async () => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    global.fetch.mockResolvedValue(jsonResponse(200, {}));

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    await api.download('/documents/1/download', { token: 't' }, 'archivo.pdf');

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
  });

  it('lanza error si la descarga responde con error HTTP', async () => {
    global.fetch.mockResolvedValue(jsonResponse(404, { message: 'Archivo no encontrado' }));
    await expect(api.download('/documents/1/download', {}, 'archivo.pdf')).rejects.toMatchObject({
      message: 'Archivo no encontrado',
    });
  });
});
