'use strict';
// Fix: routes/chat.js — buildContext() insertaba el mensaje de error crudo de una
// falla de BD directamente en el system prompt enviado al LLM (`err.message`, puede
// incluir detalles de conexión/query). El modelo podía repetir ese detalle interno en
// su respuesta a un usuario con cualquier rol, incluido auxiliar.
process.env.NODE_ENV = 'test';

const models = require('../models');
const logger = require('../config/logger');
const { buildContext } = require('../routes/chat');

beforeEach(() => {
  vi.spyOn(models.User, 'findByPk');
  vi.spyOn(models.Jal, 'findByPk');
  vi.spyOn(models.DocType, 'findAll');
  vi.spyOn(models.Document, 'count');
  vi.spyOn(models.Document, 'findAll');
  vi.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('buildContext() — manejo de errores de BD', () => {
  it('no incluye el mensaje de error crudo de la BD en el contexto devuelto', async () => {
    const secretDbError = new Error('connection to server at "10.0.0.5" failed: password authentication failed for user "gestor_jal"');
    models.User.findByPk.mockRejectedValue(secretDbError);

    const context = await buildContext('user-1', 'jal-1', 'auxiliar');

    expect(context).not.toContain('10.0.0.5');
    expect(context).not.toContain('password authentication failed');
    expect(context).not.toContain('gestor_jal');
  });

  it('devuelve un mensaje genérico cuando falla la carga del contexto', async () => {
    models.User.findByPk.mockRejectedValue(new Error('DB down'));
    const context = await buildContext('user-1', 'jal-1', 'auxiliar');
    expect(context).toContain('No se pudo cargar el contexto actual del sistema');
  });

  it('registra el error real con logger.error (server-side) en vez de ocultarlo del todo', async () => {
    const dbError = new Error('DB down');
    models.User.findByPk.mockRejectedValue(dbError);

    await buildContext('user-1', 'jal-1', 'auxiliar');

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('buildContext'),
      expect.objectContaining({ error: 'DB down', jalId: 'jal-1', userId: 'user-1' }),
    );
  });

  it('construye el contexto normalmente cuando no hay errores', async () => {
    models.User.findByPk.mockResolvedValue({ name: 'Ana', role: 'auxiliar', cargo_titulo: null });
    models.Jal.findByPk.mockResolvedValue({ name: 'JAL Test' });
    models.DocType.findAll.mockResolvedValue([]);
    models.Document.count.mockResolvedValue(0);
    models.Document.findAll.mockResolvedValue([]);

    const context = await buildContext('user-1', 'jal-1', 'auxiliar');

    expect(context).toContain('JAL Test');
    expect(context).not.toContain('No se pudo cargar');
  });
});
