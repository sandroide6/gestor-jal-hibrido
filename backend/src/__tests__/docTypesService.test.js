'use strict';
// PT-21: docTypesService — jal_id isolation, CRUD

process.env.NODE_ENV = 'test';

const models = require('../models');
const docTypesService = require('../services/docTypesService');

beforeEach(() => {
  vi.spyOn(models.DocType, 'findAll');
  vi.spyOn(models.DocType, 'findOne');
  vi.spyOn(models.DocType, 'create');
});
afterEach(() => vi.restoreAllMocks());

describe('listDocTypes()', () => {

  it('filtra siempre por jal_id', async () => {
    models.DocType.findAll.mockResolvedValue([]);
    await docTypesService.listDocTypes('jal-1');
    expect(models.DocType.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jal_id: 'jal-1' } }),
    );
  });

  it('ordena por nombre ASC', async () => {
    models.DocType.findAll.mockResolvedValue([]);
    await docTypesService.listDocTypes('jal-1');
    expect(models.DocType.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ order: [['name', 'ASC']] }),
    );
  });

  it('excluye template_data de los atributos', async () => {
    models.DocType.findAll.mockResolvedValue([]);
    await docTypesService.listDocTypes('jal-1');
    const [{ attributes }] = models.DocType.findAll.mock.calls[0];
    expect(attributes.exclude).toContain('template_data');
  });

});

describe('findDocType()', () => {

  it('busca por id y jal_id combinados', async () => {
    models.DocType.findOne.mockResolvedValue(null);
    await docTypesService.findDocType('dt-1', 'jal-1');
    expect(models.DocType.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dt-1', jal_id: 'jal-1' } }),
    );
  });

  it('devuelve null si no existe', async () => {
    models.DocType.findOne.mockResolvedValue(null);
    const result = await docTypesService.findDocType('dt-x', 'jal-1');
    expect(result).toBeNull();
  });

});

describe('createDocType()', () => {

  it('crea con jal_id, name, fields y templateData', async () => {
    const created = { id: 'dt-new' };
    models.DocType.create.mockResolvedValue(created);
    const result = await docTypesService.createDocType({
      jalId: 'jal-1', name: 'Acta', fields: [{ name: 'tema' }], templateData: 'data:...',
    });
    const [args] = models.DocType.create.mock.calls[0];
    expect(args).toMatchObject({
      jal_id:        'jal-1',
      name:          'Acta',
      fields:        [{ name: 'tema' }],
      template_data: 'data:...',
      template_path: null,
    });
    expect(args.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result).toBe(created);
  });

  it('usa template_data null por defecto', async () => {
    models.DocType.create.mockResolvedValue({});
    await docTypesService.createDocType({ jalId: 'jal-1', name: 'X', fields: [] });
    const [args] = models.DocType.create.mock.calls[0];
    expect(args.template_data).toBeNull();
  });

  it('genera UUIDs distintos en cada llamada', async () => {
    models.DocType.create.mockResolvedValue({});
    await docTypesService.createDocType({ jalId: 'jal-1', name: 'A', fields: [] });
    await docTypesService.createDocType({ jalId: 'jal-1', name: 'B', fields: [] });
    const id1 = models.DocType.create.mock.calls[0][0].id;
    const id2 = models.DocType.create.mock.calls[1][0].id;
    expect(id1).not.toBe(id2);
  });

});

describe('updateDocType()', () => {

  it('delega en docType.update con los cambios dados', async () => {
    const docType = { update: vi.fn().mockResolvedValue(undefined) };
    await docTypesService.updateDocType(docType, { name: 'Nuevo' });
    expect(docType.update).toHaveBeenCalledWith({ name: 'Nuevo' });
  });

});
