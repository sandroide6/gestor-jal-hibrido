'use strict';
// PT-21: usersService — jal_id isolation, CRUD, password hashing

process.env.NODE_ENV = 'test';

const models = require('../models');
const bcrypt = require('bcryptjs');
const usersService = require('../services/usersService');

beforeEach(() => {
  vi.spyOn(models.User, 'findAndCountAll');
  vi.spyOn(models.User, 'findOne');
  vi.spyOn(models.User, 'findByPk');
  vi.spyOn(models.User, 'create');
  vi.spyOn(bcrypt, 'hash');
});
afterEach(() => vi.restoreAllMocks());

// ── listUsers() ───────────────────────────────────────────────────────────────

describe('listUsers()', () => {

  it('filtra siempre por jal_id', async () => {
    models.User.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await usersService.listUsers('jal-1');
    expect(models.User.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jal_id: 'jal-1' } }),
    );
  });

  it('devuelve estructura con data, total, page, pages', async () => {
    models.User.findAndCountAll.mockResolvedValue({ count: 3, rows: ['a', 'b', 'c'] });
    const result = await usersService.listUsers('jal-1', { page: 1, limit: 50 });
    expect(result).toMatchObject({ data: ['a', 'b', 'c'], total: 3, page: 1, pages: 1, limit: 50 });
  });

  it('calcula pages correctamente con paginación', async () => {
    models.User.findAndCountAll.mockResolvedValue({ count: 10, rows: [] });
    const result = await usersService.listUsers('jal-1', { page: 2, limit: 3 });
    expect(result.pages).toBe(4); // ceil(10/3)
    expect(result.page).toBe(2);
  });

  it('aplica offset correcto según la página', async () => {
    models.User.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await usersService.listUsers('jal-1', { page: 3, limit: 10 });
    expect(models.User.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 20, limit: 10 }),
    );
  });

});

// ── findUserInJal() ───────────────────────────────────────────────────────────

describe('findUserInJal()', () => {

  it('busca por id y jal_id combinados', async () => {
    models.User.findOne.mockResolvedValue(null);
    await usersService.findUserInJal('u-1', 'jal-1');
    expect(models.User.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1', jal_id: 'jal-1' } }),
    );
  });

  it('devuelve null si el usuario no existe en esa JAL', async () => {
    models.User.findOne.mockResolvedValue(null);
    const result = await usersService.findUserInJal('u-x', 'jal-1');
    expect(result).toBeNull();
  });

});

// ── createUser() ──────────────────────────────────────────────────────────────

describe('createUser()', () => {

  it('hashea la contraseña antes de crear el usuario', async () => {
    bcrypt.hash.mockResolvedValue('$2b$12$hasheado');
    models.User.create.mockResolvedValue({ id: 'u-new' });
    await usersService.createUser({ jalId: 'jal-1', name: 'Ana', email: 'ana@j.co', role: 'auxiliar', password: 'Pass123!' });
    const [args] = models.User.create.mock.calls[0];
    expect(args.password_hash).toBe('$2b$12$hasheado');
    expect(args).not.toHaveProperty('password');
  });

  it('crea con jal_id, name, email y role', async () => {
    bcrypt.hash.mockResolvedValue('$2b$12$hasheado');
    models.User.create.mockResolvedValue({ id: 'u-new' });
    await usersService.createUser({ jalId: 'jal-1', name: 'Ana', email: 'ana@j.co', role: 'auxiliar', password: 'Pass123!' });
    const [args] = models.User.create.mock.calls[0];
    expect(args).toMatchObject({ jal_id: 'jal-1', name: 'Ana', email: 'ana@j.co', role: 'auxiliar' });
  });

  it('genera un UUID en el campo id', async () => {
    bcrypt.hash.mockResolvedValue('hash');
    models.User.create.mockResolvedValue({});
    await usersService.createUser({ jalId: 'jal-1', name: 'X', email: 'x@j.co', role: 'edil', password: 'P' });
    const [args] = models.User.create.mock.calls[0];
    expect(args.id).toMatch(/^[0-9a-f-]{36}$/);
  });

});

// ── deactivateUser() ──────────────────────────────────────────────────────────

describe('deactivateUser()', () => {

  it('pone active=false e invalida tokens al desactivar', async () => {
    const user = { update: vi.fn().mockResolvedValue(undefined) };
    await usersService.deactivateUser(user);
    const [args] = user.update.mock.calls[0];
    expect(args.active).toBe(false);
    expect(args.tokens_invalid_before).toBeInstanceOf(Date);
  });

});

// ── reactivateUser() ─────────────────────────────────────────────────────────

describe('reactivateUser()', () => {

  it('pone active=true', async () => {
    const user = { update: vi.fn().mockResolvedValue(undefined) };
    await usersService.reactivateUser(user);
    expect(user.update).toHaveBeenCalledWith({ active: true });
  });

});
