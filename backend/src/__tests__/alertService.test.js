'use strict';
// Avisos a webhook (auditoría 2026-11-05, P1-4)
process.env.NODE_ENV = 'test';
const express = require('express');
const request = require('supertest');
const alerts = require('../services/alertService');

let fetchSpy;
beforeEach(() => {
  alerts._reset();
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 });
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ALERT_WEBHOOK_URL;
  delete process.env.ALERT_THROTTLE_MIN;
});

describe('sendAlert', () => {
  it('sin ALERT_WEBHOOK_URL no envía nada', async () => {
    expect(await alerts.sendAlert('x', { summary: 'y' })).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ntfy.sh recibe texto plano; la ruta va sin parámetros de consulta', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ntfy.sh/tema-secreto-123';
    await alerts.sendAlert('k', { summary: 'la base no responde', path: '/v1/documents/person?cedula=1036', requestId: 'r-1' });
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://ntfy.sh/tema-secreto-123');
    expect(opts.headers['Content-Type']).toMatch(/text\/plain/);
    expect(opts.body).toContain('la base no responde');
    expect(opts.body).toContain('/v1/documents/person');
    expect(opts.body).not.toContain('1036');
    expect(opts.body).toContain('r-1');
  });

  it('Slack o Discord reciben JSON con text y content', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/x';
    await alerts.sendAlert('k', { summary: 's' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.text).toContain('s');
    expect(body.content).toBe(body.text);
  });

  it('limita a un aviso por tipo dentro de la ventana', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ntfy.sh/t';
    expect(await alerts.sendAlert('a', {})).toBe(true);
    expect(await alerts.sendAlert('a', {})).toBe(false);
    expect(await alerts.sendAlert('b', {})).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('si el webhook falla no lanza', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ntfy.sh/t';
    fetchSpy.mockRejectedValue(new Error('red caída'));
    await expect(alerts.sendAlert('c', {})).resolves.toBe(false);
  });
});

describe('errorHandler avisa en los 5xx y no en los 4xx', () => {
  const errorHandler = require('../middleware/errorHandler');
  const appWith = (err) => {
    const a = express();
    a.get('/x', (_q, _s, next) => next(err));
    a.use(errorHandler);
    return a;
  };

  it('500 → aviso sin el mensaje interno del error', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ntfy.sh/t';
    await request(appWith(Object.assign(new Error('clave duplicada: cedula=1036'), { name: 'SequelizeUniqueConstraintError' }))).get('/x');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1].body).toContain('SequelizeUniqueConstraintError');
    expect(fetchSpy.mock.calls[0][1].body).not.toContain('1036');
  });

  it('400 → sin aviso', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ntfy.sh/t';
    await request(appWith(Object.assign(new Error('mal'), { status: 400 }))).get('/x');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
