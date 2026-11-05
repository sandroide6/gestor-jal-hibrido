'use strict';
// Regresión de la auditoría de producción (2026-11-05), hallazgo P0-2:
//   (a) los documentos sincronizados desde el modo sin conexión no guardaban los
//       binarios en la base (solo en el disco efímero de Render);
//   (b) reenviar el mismo lote creaba otro documento con otro radicado;
//   (c) los tipos con plantilla oficial fallaban siempre al sincronizar.
process.env.NODE_ENV = 'test';
const request = require('supertest');
const h = require('./helpers');

let app;
let Document;
let session;

beforeAll(async () => {
  app = require('../../src/app');
  ({ Document } = require('../../src/models'));
  session = await h.login(app);
  await h.ensureSignature(app, session);
}, 60000);

function syncBatch(ops) {
  return request(app)
    .post('/v1/sync/batch')
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrf)
    .send({ operations: ops });
}

function createOp(localId, docTypeId, beneficiaryId, fields) {
  return {
    operation: 'create',
    payload: {
      resource: 'documents',
      localId,
      data: { doc_type_id: docTypeId, beneficiary_name: `Prueba ${beneficiaryId}`, beneficiary_id: beneficiaryId, ...fields },
    },
  };
}

describe('Sincronización sin conexión (integración, base real)', () => {
  it('guarda DOCX y PDF en la base: el documento sobrevive a la pérdida del disco', async () => {
    const ced = h.uniq();
    const res = await syncBatch([createOp(`loc-${ced}`, h.DOC_TYPE_SIMPLE, ced, h.simpleFields(ced))]);
    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe('success');

    const doc = await Document.findByPk(res.body.results[0].serverId);
    expect(doc.file_docx).toBeTruthy();
    expect(doc.file_pdf).toBeTruthy();
    expect(doc.file_pdf.length).toBeGreaterThan(500);
  }, 60000);

  it('es idempotente: el mismo localId enviado dos veces deja un solo documento y un solo radicado', async () => {
    const ced = h.uniq();
    const op = createOp(`loc-${ced}`, h.DOC_TYPE_SIMPLE, ced, h.simpleFields(ced));
    const r1 = await syncBatch([op]);
    const r2 = await syncBatch([op]);
    expect(r1.body.results[0].status).toBe('success');
    expect(r2.body.results[0].status).toBe('success');
    expect(r2.body.results[0].serverId).toBe(r1.body.results[0].serverId);
    expect(r2.body.results[0].numero_radicado).toBe(r1.body.results[0].numero_radicado);

    const count = await Document.count({ where: { beneficiary_id: ced } });
    expect(count).toBe(1);
  }, 60000);

  it('sincroniza un tipo con plantilla oficial (firma, encargado y cargo los pone el servidor)', async () => {
    const ced = h.uniq();
    const res = await syncBatch([createOp(`loc-${ced}`, h.DOC_TYPE_TEMPLATE, ced, h.templateFields(ced))]);
    expect(res.body.results[0]).toMatchObject({ status: 'success' });
    const doc = await Document.findByPk(res.body.results[0].serverId);
    expect(doc.file_pdf).toBeTruthy();
    expect(doc.numero_radicado).toMatch(/^\d{4}-/);
  }, 60000);

  it('un documento creado en línea con client_local_id no se duplica si luego llega por sincronización', async () => {
    const ced = h.uniq();
    const localId = `loc-${ced}`;
    const online = await request(app)
      .post('/v1/documents')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrf)
      .send({ doc_type_id: h.DOC_TYPE_SIMPLE, beneficiary_name: `Prueba ${ced}`, beneficiary_id: ced, client_local_id: localId, ...h.simpleFields(ced) });
    expect(online.status).toBe(201);

    // El cliente no recibió la respuesta (corte de red) y reenvía por la cola sin conexión
    const res = await syncBatch([createOp(localId, h.DOC_TYPE_SIMPLE, ced, h.simpleFields(ced))]);
    expect(res.body.results[0].status).toBe('success');
    expect(res.body.results[0].serverId).toBe(online.body.id);
    expect(await Document.count({ where: { beneficiary_id: ced } })).toBe(1);
  }, 60000);

  it('reintentar POST /documents con el mismo client_local_id devuelve el mismo documento', async () => {
    const ced = h.uniq();
    const body = { doc_type_id: h.DOC_TYPE_SIMPLE, beneficiary_name: `Prueba ${ced}`, beneficiary_id: ced, client_local_id: `loc-${ced}`, ...h.simpleFields(ced) };
    const send = () => request(app).post('/v1/documents').set('Cookie', session.cookie).set('X-CSRF-Token', session.csrf).send(body);
    const a = await send();
    const b = await send();
    expect(a.status).toBe(201);
    expect([200, 201]).toContain(b.status);
    expect(b.body.id).toBe(a.body.id);
    expect(b.body.numero_radicado).toBe(a.body.numero_radicado);
  }, 60000);
});

describe('Idempotencia bajo concurrencia', () => {
  it('dos envíos simultáneos con el mismo localId crean un solo documento', async () => {
    const ced = h.uniq();
    const body = { doc_type_id: h.DOC_TYPE_SIMPLE, beneficiary_name: `Prueba ${ced}`, beneficiary_id: ced, client_local_id: `loc-${ced}`, ...h.simpleFields(ced) };
    const send = () => request(app).post('/v1/documents').set('Cookie', session.cookie).set('X-CSRF-Token', session.csrf).send(body);
    const [a, b] = await Promise.all([send(), send()]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.id).toBe(b.body.id);
    expect(await Document.count({ where: { beneficiary_id: ced } })).toBe(1);
  }, 60000);
});
