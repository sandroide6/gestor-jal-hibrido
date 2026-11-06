import { describe, it, expect, vi, beforeEach } from 'vitest';

const init = vi.fn();
const captureException = vi.fn();
const setTag = vi.fn();
vi.mock('@sentry/browser', () => ({
  init: (...a) => init(...a),
  captureException: (...a) => captureException(...a),
  withScope: (fn) => fn({ setTag }),
}));

describe('errorTracking del navegador (Sentry)', () => {
  beforeEach(() => { vi.resetModules(); init.mockReset(); captureException.mockReset(); setTag.mockReset(); });

  it('sin VITE_SENTRY_DSN no inicia el SDK', async () => {
    const et = await import('../services/errorTracking');
    expect(await et.initErrorTracking({})).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it('con DSN inicia sin datos personales y envía los errores pendientes', async () => {
    const et = await import('../services/errorTracking');
    et.captureError(new Error('antes de cargar'), { origen: 'ErrorBoundary' });
    expect(await et.initErrorTracking({ VITE_SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/2', MODE: 'production' })).toBe(true);
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ sendDefaultPii: false, tracesSampleRate: 0 }));
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(setTag).toHaveBeenCalledWith('origen', 'ErrorBoundary');
  });

  it('scrubEvent tapa cédulas y correos y quita usuario, consulta y consola', async () => {
    const { scrubEvent } = await import('../services/errorTracking');
    const ev = scrubEvent({
      exception: { values: [{ value: 'No existe 1000000001 de ana@correo.co' }] },
      request: { url: 'https://app/v1/documents/person?cedula=1000000001', headers: { Cookie: 'x' } },
      user: { id: 'u1' },
      breadcrumbs: [{ category: 'console', message: 'x' }, { category: 'fetch', data: { url: '/v1/a?q=1' } }],
    });
    expect(ev.exception.values[0].value).toBe('No existe [número] de [correo]');
    expect(ev.request).toEqual({ url: 'https://app/v1/documents/person' });
    expect(ev.user).toBeUndefined();
    expect(ev.breadcrumbs).toEqual([{ category: 'fetch', data: { url: '/v1/a' } }]);
  });
});
