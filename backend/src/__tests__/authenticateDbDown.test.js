'use strict';
// Auditoría 2026-11-05, P2-3: con la base caída, authenticate dejaba pasar cualquier
// token válido sin comprobar si el usuario seguía activo, si la sesión estaba revocada o
// si debía cambiar la contraseña. Ahora falla cerrado: 503 DB_UNAVAILABLE.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { ConnectionRefusedError } = require('sequelize');
const app = require('../app');
const models = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const token = jwt.sign({ sub: 'u-desactivado', jal_id: 'j1', role: 'administrador' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

afterEach(() => vi.restoreAllMocks());

describe('authenticate con la base caída', () => {
  it('responde 503 DB_UNAVAILABLE y no ejecuta la ruta', async () => {
    vi.spyOn(models.User, 'findByPk').mockRejectedValue(new ConnectionRefusedError(new Error('connect ECONNREFUSED')));
    // Si authenticate dejara pasar, la ruta respondería 200 con esta lista
    const lista = vi.spyOn(models.User, 'findAndCountAll').mockResolvedValue({ count: 1, rows: [{ id: 'x', name: 'Dato personal' }] });
    const res = await request(app).get('/v1/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('DB_UNAVAILABLE');
    expect(res.headers['retry-after']).toBe('30');
    expect(lista).not.toHaveBeenCalled();
  });

  it('un error inesperado al consultar el usuario no deja pasar la petición', async () => {
    vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('fallo inesperado'));
    const lista = vi.spyOn(models.User, 'findAndCountAll').mockResolvedValue({ count: 0, rows: [] });
    const res = await request(app).get('/v1/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
    expect(lista).not.toHaveBeenCalled();
  });
});
