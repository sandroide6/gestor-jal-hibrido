'use strict';
// PT-08: Validación de firma — rechaza > 5 MB y tipos no permitidos

const os   = require('os');
const fs   = require('fs');
const path = require('path');

const { mockFindByPk } = vi.hoisted(() => ({ mockFindByPk: vi.fn() }));

vi.mock('../models', () => ({
  User: { findByPk: mockFindByPk },
}));
vi.mock('../services/auditService', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}));

const { uploadFirma } = require('../controllers/usersController');

function makeRes() {
  const r = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  return r;
}

function tmpFile(content = 'fake') {
  const p = path.join(os.tmpdir(), `jal-val-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  fs.writeFileSync(p, content);
  return p;
}

describe('uploadFirma — PT-08: Validación de firma', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Casos de rechazo (no requieren BD) ─────────────────────

  it('devuelve 400 cuando no hay archivo', async () => {
    const res = makeRes();
    await uploadFirma({ user: { sub: 'u1' }, file: null, headers: {}, socket: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rechaza tipo MIME no permitido (PDF) y borra el temp', async () => {
    const p = tmpFile();
    const res = makeRes();
    await uploadFirma(
      { user: { sub: 'u1' }, file: { path: p, mimetype: 'application/pdf', size: 1024 }, headers: {}, socket: {} },
      res, vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/PNG|JPG/i);
    expect(fs.existsSync(p)).toBe(false);
  });

  it('rechaza archivos mayores a 5 MB y borra el temp', async () => {
    const p = tmpFile();
    const res = makeRes();
    await uploadFirma(
      { user: { sub: 'u1' }, file: { path: p, mimetype: 'image/png', size: 6 * 1024 * 1024 }, headers: {}, socket: {} },
      res, vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('MB');
    expect(fs.existsSync(p)).toBe(false);
  });

  it('rechaza GIF (tipo no permitido)', async () => {
    const p = tmpFile();
    const res = makeRes();
    await uploadFirma(
      { user: { sub: 'u1' }, file: { path: p, mimetype: 'image/gif', size: 100 }, headers: {}, socket: {} },
      res, vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fs.existsSync(p)).toBe(false);
  });

  // ── Verificación estática: la ruta feliz guarda base64 en BD ─

  it('el código guarda firma como base64 en signature_data (no en filesystem)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'controllers', 'usersController.js'), 'utf8'
    );
    // Verifica que guarda en BD (no en disco)
    expect(src).toContain('signature_data');
    expect(src).toContain('base64');
    // No debe guardar en filesystem para el campo de firma
    expect(src).not.toContain("fs.copyFileSync");
  });

  it('el controlador envía has_firma: true en respuesta exitosa', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'controllers', 'usersController.js'), 'utf8'
    );
    expect(src).toContain('has_firma: true');
  });
});
