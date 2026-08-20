'use strict';
// PT-04: Permisos por rol — auxiliar no puede acceder a endpoints de edil o admin

const authorize = require('../middleware/authorize');

function makeRes() {
  const r = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  return r;
}

describe('authorize — PT-04: Permisos por rol', () => {
  it('permite al rol exacto', () => {
    const fn = authorize('auxiliar');
    const req = { user: { role: 'auxiliar' } };
    const next = vi.fn();
    fn(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('permite cuando el rol está en la lista', () => {
    const fn = authorize('edil', 'administrador');
    const req = { user: { role: 'edil' } };
    const next = vi.fn();
    fn(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('bloquea auxiliar en ruta de edil → 403', () => {
    const fn = authorize('edil', 'administrador');
    const res = makeRes();
    fn({ user: { role: 'auxiliar' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: true }));
  });

  it('bloquea auxiliar en ruta de admin → 403', () => {
    const fn = authorize('administrador');
    const res = makeRes();
    fn({ user: { role: 'auxiliar' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('bloquea edil en ruta de solo admin → 403', () => {
    const fn = authorize('administrador');
    const res = makeRes();
    fn({ user: { role: 'edil' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('devuelve 401 cuando req.user no está definido', () => {
    const fn = authorize('administrador');
    const res = makeRes();
    fn({}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('administrador accede a ruta que lo incluye explícitamente', () => {
    const routes = [
      authorize('administrador'),
      authorize('auxiliar', 'edil', 'administrador'),
    ];
    routes.forEach((fn) => {
      const next = vi.fn();
      fn({ user: { role: 'administrador' } }, makeRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  it('administrador NO accede a ruta que solo permite auxiliar (no es super-admin implícito)', () => {
    const fn = authorize('auxiliar');
    const res = makeRes();
    fn({ user: { role: 'administrador' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
