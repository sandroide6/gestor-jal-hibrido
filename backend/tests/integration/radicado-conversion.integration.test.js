'use strict';
// Auditoría 2026-11-05, P2-2: el radicado se reclamaba y el PDF se generaba dentro de la
// MISMA transacción, así que el contador de radicados quedaba bloqueado mientras
// LibreOffice convertía (segundos). Otro documento del mismo tipo de trámite esperaba
// todo ese tiempo, y la conexión a la base quedaba ocupada. Ahora la transacción solo
// reclama el radicado, arma el DOCX y guarda el documento; el PDF se genera después.
process.env.NODE_ENV = 'test';
const request = require('supertest');
const h = require('./helpers');

const RETARDO_MS = 1500; // conversión de LibreOffice simulada, lenta a propósito

let app;
let session;
let converter;
let Document;

beforeAll(async () => {
  app = require('../../src/app');
  ({ Document } = require('../../src/models'));
  converter = require('../../src/services/libreOfficeConverter');
  const admin = await h.createTestUser('administrador');
  session = await h.login(app, admin.email);
  await h.ensureSignature(app, session);
}, 60000);

afterEach(() => vi.restoreAllMocks());

function crear(cedula) {
  return request(app)
    .post('/v1/documents')
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrf)
    .send({
      doc_type_id: h.DOC_TYPE_TEMPLATE,
      beneficiary_name: `Prueba ${cedula}`,
      beneficiary_id: cedula,
      ...h.templateFields(cedula),
    });
}

// PDF mínimo válido, devuelto tras el retardo
const PDF_FALSO = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('Radicado y conversión a PDF (integración, base real)', () => {
  it('la transacción del radicado no espera a la conversión a PDF', async () => {
    vi.spyOn(converter, 'convert').mockImplementation(
      () => new Promise((r) => setTimeout(() => r(PDF_FALSO), RETARDO_MS))
    );
    const duraciones = [];
    const original = Document.sequelize.transaction.bind(Document.sequelize);
    vi.spyOn(Document.sequelize, 'transaction').mockImplementation(async (...args) => {
      const t0 = Date.now();
      try { return await original(...args); } finally { duraciones.push(Date.now() - t0); }
    });

    const res = await crear(h.uniq());
    expect(res.status).toBe(201);
    expect(converter.convert).toHaveBeenCalled();
    // La transacción que reclama el radicado dura mucho menos que la conversión
    expect(Math.max(...duraciones)).toBeLessThan(RETARDO_MS);
  }, 30000);

  it('dos documentos simultáneos del mismo trámite: el segundo obtiene su radicado sin esperar el PDF del primero', async () => {
    vi.spyOn(converter, 'convert').mockImplementation(
      () => new Promise((r) => setTimeout(() => r(PDF_FALSO), RETARDO_MS))
    );
    const insertados = [];
    const create = Document.create.bind(Document);
    vi.spyOn(Document, 'create').mockImplementation(async (...args) => {
      const d = await create(...args);
      insertados.push(Date.now());
      return d;
    });

    const t0 = Date.now();
    const [a, b] = await Promise.all([crear(h.uniq()), crear(h.uniq())]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.numero_radicado ?? a.body.document?.numero_radicado).not.toBe(b.body.numero_radicado ?? b.body.document?.numero_radicado);
    // Ambos documentos quedan guardados (con radicado) antes de que termine la primera conversión
    expect(insertados).toHaveLength(2);
    expect(Math.max(...insertados) - t0).toBeLessThan(RETARDO_MS);
  }, 30000);

  it('el documento queda con su PDF guardado en la base al responder', async () => {
    const res = await crear(h.uniq());
    expect(res.status).toBe(201);
    const id = res.body.id ?? res.body.document?.id;
    const doc = await Document.findByPk(id);
    expect(doc.file_docx.length).toBeGreaterThan(1000);
    expect(doc.file_pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(doc.file_path_pdf).toMatch(/\.pdf$/);
  }, 60000);

  it('si el PDF falta (conversión fallida), la descarga lo genera desde el DOCX', async () => {
    const res = await crear(h.uniq());
    const id = res.body.id ?? res.body.document?.id;
    await Document.update({ file_pdf: null, file_path_pdf: null }, { where: { id } });

    const dl = await request(app).get(`/v1/documents/${id}/download?format=pdf`).set('Cookie', session.cookie);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toContain('application/pdf');
    const doc = await Document.findByPk(id);
    expect(doc.file_pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 60000);
});
