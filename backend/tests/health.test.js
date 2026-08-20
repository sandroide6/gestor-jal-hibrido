const request = require('supertest');

// Silenciar logs en tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';

let app;

beforeAll(() => {
  app = require('../src/app');
}, 30000); // cargar toda la app (incluye googleapis, pesado) bajo la suite completa en paralelo puede superar el default de 10s

describe('GET /health', () => {
  it('responde con status ok, timestamp y checks de BD', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.db).toBeDefined();
    expect(res.body.checks.db.status).toBe('ok');
  });
});
