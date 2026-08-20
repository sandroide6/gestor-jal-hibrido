'use strict';
// PT-09: createDocument — validaciones, resolución de firma y persistencia
//
// Estrategia: vi.spyOn sobre los objetos del módulo cacheado.
// Node.js devuelve el MISMO objeto desde require() en todas partes,
// así que parchear DocType.findOne en el test afecta también a la copia
// que documentService.js tiene en su closure.

process.env.NODE_ENV = 'test';

const models           = require('../models');
const docGenerator     = require('../services/documentGeneratorService');
const audit            = require('../services/auditService');
const radicadoService  = require('../services/radicadoService');
const { createDocument } = require('../services/documentService');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  jalId: 'jal-1',
  userId: 'user-1',
  role: 'administrador',
  docTypeId: 'dt-1',
  beneficiaryName: 'Juan Pérez',
  beneficiaryId: '1234567890',
  formFields: { fecha: '2026-01-01' },
  uploadedSignature: null,
  ip: '127.0.0.1',
};

const MOCK_DOC_TYPE = {
  id: 'dt-1',
  name: 'Certificado de Convivencia',
  fields: [{ name: 'fecha', label: 'Fecha', required: true }],
  template_path: '/tmp/template.docx',
  template_data: {},
  tipo_tramite: 'salida',
};

const MOCK_JAL  = { id: 'jal-1', name: 'JAL Comuna 12' };
// Firma por defecto para la ruta feliz — los tests de resolución de firma
// (líneas más abajo) la sobreescriben explícitamente a null para probar cada rama.
const MOCK_USER = { name: 'María Gómez', cargo_titulo: null, signature_path: '/data/sigs/default.png', signature_data: null };
const MOCK_GEN  = { docxPath: '/tmp/out.docx', pdfPath: '/tmp/out.pdf' };
const MOCK_DOC  = { id: 'doc-uuid-1', jal_id: 'jal-1' };

// Referencia a los mocks de User.unscoped().findByPk / .findOne (firmante / edil)
const mockUserFindByPk = vi.fn();
const mockEdilFindOne  = vi.fn();

function setupHappyPath(overrides = {}) {
  models.DocType.findOne.mockResolvedValue({ ...MOCK_DOC_TYPE, ...overrides.docType });
  models.Jal.findByPk.mockResolvedValue({ ...MOCK_JAL, ...overrides.jal });
  mockUserFindByPk.mockResolvedValue({ ...MOCK_USER, ...overrides.user });
  docGenerator.generateDocuments.mockResolvedValue({ ...MOCK_GEN, ...overrides.gen });
  models.Document.create.mockResolvedValue({ ...MOCK_DOC, ...overrides.doc });
  radicadoService.assignNumeroRadicado.mockResolvedValue('2026-JAL-SAL-000001');
  audit.log.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.spyOn(models.DocType,  'findOne');
  vi.spyOn(models.Document, 'create');
  vi.spyOn(models.Jal,      'findByPk');
  vi.spyOn(models.User,     'unscoped').mockReturnValue({ findByPk: mockUserFindByPk, findOne: mockEdilFindOne });
  vi.spyOn(docGenerator,    'generateDocuments');
  vi.spyOn(audit,           'log');
  // assignNumeroRadicado hace un INSERT real (ON CONFLICT) contra `radicado_counters` —
  // se mockea para que este test siga siendo un test unitario de createDocument y no
  // dependa de una BD real ni de que 'jal-1' exista como fila válida (violaría la FK).
  vi.spyOn(radicadoService, 'assignNumeroRadicado');
  // El bloqueo advisory + cálculo de document_number (lógica preexistente) usa
  // Document.sequelize.query/.transaction directamente contra la BD real — con
  // jal_id='jal-1' (no es un UUID válido) eso rompe. Se mockea para mantener este
  // archivo como test unitario puro, igual que el resto de las dependencias.
  vi.spyOn(models.Document.sequelize, 'transaction').mockImplementation(async (cb) => cb({}));
  vi.spyOn(models.Document.sequelize, 'query').mockResolvedValue([{ next_n: 1 }]);
  mockUserFindByPk.mockReset();
  mockEdilFindOne.mockReset();
});

afterEach(() => vi.restoreAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createDocument — PT-09', () => {

  // ── Ruta feliz ─────────────────────────────────────────────────────────────

  it('crea el documento y retorna { doc, docType }', async () => {
    setupHappyPath();

    const result = await createDocument(BASE_INPUT);

    expect(result.doc).toMatchObject({ id: 'doc-uuid-1' });
    expect(result.docType.name).toBe('Certificado de Convivencia');
    expect(models.Document.create).toHaveBeenCalledOnce();
    expect(audit.log).toHaveBeenCalledOnce();
  });

  it('llama a generateDocuments con los datos de plantilla correctos', async () => {
    setupHappyPath();

    await createDocument(BASE_INPUT);

    const callArg = docGenerator.generateDocuments.mock.calls[0][0];
    expect(callArg.jalId).toBe('jal-1');
    expect(callArg.data.beneficiary_name).toBe('Juan Pérez');
    expect(callArg.data.beneficiary_id).toBe('1234567890');
    expect(callArg.data.jal_name).toBe('JAL Comuna 12');
  });

  // ── Tipo de documento no encontrado ────────────────────────────────────────

  it('lanza 404 cuando el tipo de documento no existe o está inactivo', async () => {
    models.DocType.findOne.mockResolvedValue(null);

    await expect(createDocument(BASE_INPUT)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('no encontrado'),
    });

    expect(models.Document.create).not.toHaveBeenCalled();
  });

  // ── Fix: IDOR en edilId ─────────────────────────────────────────────────────
  // edilId venía del body del cliente y se usaba con User.unscoped().findByPk sin
  // exigir jal_id + role:'edil' — cualquier usuario podía pasar el id de un edil de
  // OTRA JAL y el sistema generaba el documento con la firma real de ese edil ajeno.

  it('lanza 404 cuando edilId no pertenece a la JAL del solicitante (IDOR)', async () => {
    setupHappyPath();
    mockEdilFindOne.mockResolvedValue(null); // ningún edil cumple id+jal_id+role

    await expect(
      createDocument({ ...BASE_INPUT, edilId: 'edil-de-otra-jal' })
    ).rejects.toMatchObject({ status: 404, message: expect.stringContaining('no existe') });

    // La búsqueda del edil debe exigir jal_id + role:'edil', no solo el id
    expect(mockEdilFindOne).toHaveBeenCalledWith({
      where: { id: 'edil-de-otra-jal', jal_id: 'jal-1', role: 'edil', active: true },
      attributes: expect.any(Array),
    });
    expect(models.Document.create).not.toHaveBeenCalled();
  });

  it('genera el documento con los datos del edil cuando sí pertenece a la JAL', async () => {
    setupHappyPath();
    mockEdilFindOne.mockResolvedValue({
      name: 'Edil Legítimo', cargo_titulo: 'Edil de la Comuna',
      signature_path: '/data/sigs/edil.png', signature_data: null,
    });

    await createDocument({ ...BASE_INPUT, edilId: 'edil-1' });

    const callArg = docGenerator.generateDocuments.mock.calls[0][0];
    expect(callArg.data.nombre_encargado).toBe('Edil Legítimo');
    expect(callArg.signaturePath).toBe('/data/sigs/edil.png');
  });

  it('no consulta al edil cuando no se pasa edilId', async () => {
    setupHappyPath();
    await createDocument(BASE_INPUT);
    expect(mockEdilFindOne).not.toHaveBeenCalled();
  });

  // ── Fix: solo auxiliar/administrador pueden generar a nombre de un edil ───────
  // edilId habilita usar la firma de OTRO usuario. Sin este chequeo, un edil podía
  // pasar el id de otro edil de su misma JAL y generar el documento con su firma,
  // aunque no tuviera ninguna relación de delegación con él.

  it('lanza 403 cuando role=edil intenta generar a nombre de otro edil (edilId)', async () => {
    setupHappyPath();

    await expect(
      createDocument({ ...BASE_INPUT, role: 'edil', edilId: 'otro-edil' })
    ).rejects.toMatchObject({ status: 403 });

    expect(mockEdilFindOne).not.toHaveBeenCalled();
    expect(models.Document.create).not.toHaveBeenCalled();
  });

  it('permite a role=auxiliar generar a nombre de un edil (edilId)', async () => {
    setupHappyPath();
    mockEdilFindOne.mockResolvedValue({
      name: 'Edil Legítimo', cargo_titulo: 'Edil de la Comuna',
      signature_path: '/data/sigs/edil.png', signature_data: null,
    });

    await expect(
      createDocument({ ...BASE_INPUT, role: 'auxiliar', edilId: 'edil-1' })
    ).resolves.toBeDefined();
  });

  // ── Campos requeridos faltantes ────────────────────────────────────────────

  it('lanza 400 cuando falta un campo requerido', async () => {
    models.DocType.findOne.mockResolvedValue({
      ...MOCK_DOC_TYPE,
      fields: [
        { name: 'fecha',  label: 'Fecha',  required: true },
        { name: 'motivo', label: 'Motivo', required: true },
      ],
    });

    await expect(
      createDocument({ ...BASE_INPUT, formFields: { fecha: '2026-01-01' } })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Motivo'),
    });
  });

  it('acepta 0 como valor válido en un campo numérico requerido', async () => {
    setupHappyPath({
      docType: { fields: [{ name: 'cantidad', label: 'Cantidad', required: true }] },
    });

    await expect(
      createDocument({ ...BASE_INPUT, formFields: { cantidad: 0 } })
    ).resolves.toBeDefined();
  });

  // ── Validación de firma subida ─────────────────────────────────────────────

  it('lanza 400 cuando la firma subida tiene MIME no permitido', async () => {
    models.DocType.findOne.mockResolvedValue(MOCK_DOC_TYPE);

    await expect(
      createDocument({
        ...BASE_INPUT,
        uploadedSignature: { path: '/tmp/sig.pdf', mimetype: 'application/pdf', size: 1024 },
      })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('PNG') });
  });

  it('lanza 400 cuando la firma supera el límite de tamaño', async () => {
    models.DocType.findOne.mockResolvedValue(MOCK_DOC_TYPE);
    // Calcular el tamaño excedido igual que el servicio (respeta MAX_FILE_SIZE_MB del .env)
    const maxMb = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
    const oversizedBytes = (maxMb + 1) * 1024 * 1024;

    await expect(
      createDocument({
        ...BASE_INPUT,
        uploadedSignature: { path: '/tmp/sig.png', mimetype: 'image/png', size: oversizedBytes },
      })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('MB') });
  });

  // ── Resolución de firma: archivo subido ────────────────────────────────────

  it('usa uploadedSignature.path cuando se sube un archivo', async () => {
    setupHappyPath();

    await createDocument({
      ...BASE_INPUT,
      uploadedSignature: { path: '/tmp/upload.png', mimetype: 'image/png', size: 5000 },
    });

    const callArg = docGenerator.generateDocuments.mock.calls[0][0];
    expect(callArg.signaturePath).toBe('/tmp/upload.png');
    expect(callArg.signatureBuffer).toBeNull();
  });

  // ── Resolución de firma: base64 en BD ──────────────────────────────────────

  it('decodifica signature_data en buffer cuando no hay archivo subido', async () => {
    const b64 = Buffer.from('fake-image-bytes').toString('base64');
    setupHappyPath({
      user: { ...MOCK_USER, signature_data: `data:image/png;base64,${b64}`, signature_path: null },
    });

    await createDocument(BASE_INPUT);

    const callArg = docGenerator.generateDocuments.mock.calls[0][0];
    expect(callArg.signatureBuffer).toBeInstanceOf(Buffer);
    expect(callArg.signatureMime).toBe('image/png');
    expect(callArg.signaturePath).toBeNull();
  });

  // ── Resolución de firma: ruta en filesystem ────────────────────────────────

  it('usa signature_path cuando no hay archivo subido ni base64', async () => {
    setupHappyPath({
      user: { ...MOCK_USER, signature_path: '/data/sigs/u1.png', signature_data: null },
    });

    await createDocument(BASE_INPUT);

    const callArg = docGenerator.generateDocuments.mock.calls[0][0];
    expect(callArg.signaturePath).toBe('/data/sigs/u1.png');
    expect(callArg.signatureBuffer).toBeNull();
  });

  // ── Cargo del firmante ─────────────────────────────────────────────────────

  it('usa cargo_titulo del usuario cuando está definido', async () => {
    setupHappyPath({ user: { ...MOCK_USER, cargo_titulo: 'Secretario Ejecutivo' } });

    await createDocument(BASE_INPUT);

    const callArg = docGenerator.generateDocuments.mock.calls[0][0];
    expect(callArg.data.cargo).toBe('Secretario Ejecutivo');
  });

  it('usa CARGO_MAP según el rol cuando cargo_titulo es null', async () => {
    setupHappyPath({ user: { ...MOCK_USER, cargo_titulo: null } });

    await createDocument({ ...BASE_INPUT, role: 'edil' });

    const callArg = docGenerator.generateDocuments.mock.calls[0][0];
    expect(callArg.data.cargo).toBe('Edil(a)');
  });

  // ── Fallo en generación no persiste en BD ─────────────────────────────────

  it('no llama a Document.create si generateDocuments falla', async () => {
    models.DocType.findOne.mockResolvedValue(MOCK_DOC_TYPE);
    models.Jal.findByPk.mockResolvedValue(MOCK_JAL);
    mockUserFindByPk.mockResolvedValue(MOCK_USER);
    radicadoService.assignNumeroRadicado.mockResolvedValue('2026-JAL-SAL-000001');
    docGenerator.generateDocuments.mockRejectedValue(new Error('LibreOffice falló'));

    await expect(createDocument(BASE_INPUT)).rejects.toThrow('LibreOffice falló');
    expect(models.Document.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
