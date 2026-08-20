'use strict';
// PT-19: X-Request-ID — correlación de peticiones

const requestId = require('../middleware/requestId');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeReqRes(incomingId) {
  const req = { headers: incomingId ? { 'x-request-id': incomingId } : {} };
  const headers = {};
  const res = { setHeader: (k, v) => { headers[k] = v; }, _headers: headers };
  return { req, res, headers };
}

describe('requestId middleware — PT-19', () => {
  it('genera un UUID cuando no viene X-Request-ID', () => {
    const { req, res, headers } = makeReqRes();
    requestId(req, res, () => {});
    expect(req.id).toMatch(UUID_RE);
    expect(headers['X-Request-ID']).toBe(req.id);
  });

  it('reutiliza el ID entrante si es un UUID válido', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const { req, res, headers } = makeReqRes(id);
    requestId(req, res, () => {});
    expect(req.id).toBe(id);
    expect(headers['X-Request-ID']).toBe(id);
  });

  it('ignora un ID entrante que no es UUID', () => {
    const { req, res } = makeReqRes('not-a-uuid');
    requestId(req, res, () => {});
    expect(req.id).toMatch(UUID_RE);
    expect(req.id).not.toBe('not-a-uuid');
  });

  it('ignora un ID entrante con formato parecido pero inválido', () => {
    const { req, res } = makeReqRes('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    requestId(req, res, () => {});
    expect(req.id).toMatch(UUID_RE);
  });

  it('llama next()', () => {
    const { req, res } = makeReqRes();
    const next = vi.fn();
    requestId(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
