'use strict';
// Correcciones de la auditoría de octubre 2026:
// - authenticate acepta solo access tokens (no refresh ni '2fa_pending')
// - errorHandler no expone mensajes internos de 5xx en producción
// - /metrics no es público en producción
// - backups: validación de config, aislamiento por JAL, retención que no borra
//   la carpeta "Documentos generados", open-folder no tumba el proceso fuera de Windows
process.env.NODE_ENV = 'test';

const fs      = require('fs');
const os      = require('os');
const path    = require('path');
const Module  = require('module');

// BACKUPS_LOCAL_PATH se lee al cargar driveBackupService — fijarlo antes del require.
const TMP_BACKUPS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'jal-hardening-test-'));
process.env.BACKUPS_LOCAL_PATH = TMP_BACKUPS_DIR;

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../app');
const models  = require('../models');
const drive   = require('../services/driveBackupService');
const errorHandler = require('../middleware/errorHandler');
const { encryptJSON } = require('../utils/crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const sign = (payload) => jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const adminToken = (jalId) => sign({ sub: 'admin-1', jal_id: jalId, role: 'administrador' });

// authenticate confía en el JWT si la BD no responde (offline tolerance)
const mockOfflineDb = () => vi.spyOn(models.User, 'findByPk').mockRejectedValue(new Error('test-db-offline'));

afterEach(() => vi.restoreAllMocks());
afterAll(() => fs.rmSync(TMP_BACKUPS_DIR, { recursive: true, force: true }));

describe('authenticate — solo access tokens', () => {
  it('rechaza el token temporal 2fa_pending (no permite saltarse el TOTP)', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/auth/logout-all')
      .set('Authorization', `Bearer ${sign({ sub: 'u1', type: '2fa_pending' })}`);
    expect(res.status).toBe(401);
  });

  it('rechaza un refresh token usado como access token', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${sign({ sub: 'u1', type: 'refresh' })}`);
    expect(res.status).toBe(401);
  });
});

describe('errorHandler — mensajes de 5xx', () => {
  function run(err, env) {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = env;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    try {
      errorHandler(err, { id: 'r1', method: 'GET', originalUrl: '/x' }, res, () => {});
    } finally {
      process.env.NODE_ENV = prev;
    }
    return res.json.mock.calls[0][0];
  }

  it('oculta el mensaje interno de un 500 en producción', () => {
    const body = run(new Error('relation "users" does not exist'), 'production');
    expect(body.message).toBe('Error interno del servidor');
    expect(body.stack).toBeUndefined();
  });

  it('conserva el mensaje de un 4xx en producción', () => {
    const body = run(Object.assign(new Error('Documento no encontrado'), { status: 404 }), 'production');
    expect(body.message).toBe('Documento no encontrado');
  });
});

describe('GET /metrics', () => {
  const prevEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    delete process.env.METRICS_TOKEN;
  });

  it('404 en producción sin METRICS_TOKEN', async () => {
    process.env.NODE_ENV = 'production';
    expect((await request(app).get('/metrics')).status).toBe(404);
  });

  it('exige el bearer cuando METRICS_TOKEN está configurado', async () => {
    process.env.METRICS_TOKEN = 'm-secret';
    expect((await request(app).get('/metrics')).status).toBe(404);
    const ok = await request(app).get('/metrics').set('Authorization', 'Bearer m-secret');
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('jal_');
  });
});

describe('PUT /v1/backup/drive/config — validación', () => {
  it('400 con retention_count negativo (borraría todos los backups)', async () => {
    mockOfflineDb();
    const update = vi.spyOn(models.Jal, 'update');
    const res = await request(app)
      .put('/v1/backup/drive/config')
      .set('Authorization', `Bearer ${adminToken('jal-1')}`)
      .send({ retention_count: -5 });
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('400 con schedule desconocido', async () => {
    mockOfflineDb();
    const res = await request(app)
      .put('/v1/backup/drive/config')
      .set('Authorization', `Bearer ${adminToken('jal-1')}`)
      .send({ schedule: 'monthly' });
    expect(res.status).toBe(400);
  });

  it('acepta el payload que envía BackupPage', async () => {
    mockOfflineDb();
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue({ id: 'jal-1', config: {} });
    vi.spyOn(models.Jal, 'update').mockResolvedValue([1]);
    const res = await request(app)
      .put('/v1/backup/drive/config')
      .set('Authorization', `Bearer ${adminToken('jal-1')}`)
      .send({ auto_enabled: true, schedule: 'weekly', schedule_hour: 2, schedule_day: 1, retention_count: 10 });
    expect(res.status).toBe(200);
  });
});

describe('Backups locales — aislamiento por JAL', () => {
  beforeEach(() => {
    for (const f of fs.readdirSync(TMP_BACKUPS_DIR)) fs.unlinkSync(path.join(TMP_BACKUPS_DIR, f));
    fs.writeFileSync(path.join(TMP_BACKUPS_DIR, 'backup_jal_jal-a_2026-01-01T00-00-00.zip'), 'a');
    fs.writeFileSync(path.join(TMP_BACKUPS_DIR, 'backup_jal_jal-b_2026-01-01T00-00-00.zip'), 'b');
  });

  it('cada admin solo ve los backups de su JAL', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/backup/drive/local-files')
      .set('Authorization', `Bearer ${adminToken('jal-a')}`);
    expect(res.status).toBe(200);
    expect(res.body.map((f) => f.filename)).toEqual(['backup_jal_jal-a_2026-01-01T00-00-00.zip']);
  });

  it('no permite descargar el backup de otra JAL', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/backup/drive/local-files/backup_jal_jal-b_2026-01-01T00-00-00.zip')
      .set('Authorization', `Bearer ${adminToken('jal-a')}`);
    expect(res.status).toBe(400);
  });

  it('sí permite descargar el propio', async () => {
    mockOfflineDb();
    const res = await request(app)
      .get('/v1/backup/drive/local-files/backup_jal_jal-a_2026-01-01T00-00-00.zip')
      .set('Authorization', `Bearer ${adminToken('jal-a')}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /v1/backup/drive/open-folder fuera de Windows', () => {
  it.skipIf(process.platform === 'win32')('responde 501 en vez de tumbar el proceso', async () => {
    mockOfflineDb();
    const res = await request(app)
      .post('/v1/backup/drive/open-folder')
      .set('Authorization', `Bearer ${adminToken('jal-1')}`);
    expect(res.status).toBe(501);
  });
});

describe('runBackup() — retención en Drive', () => {
  const googlePath = require.resolve('googleapis');
  let realGoogle;
  const files = {
    create: vi.fn().mockResolvedValue({ data: { id: 'new-zip', webViewLink: 'l', size: '1' } }),
    list:   vi.fn().mockResolvedValue({ data: { files: [] } }),
    delete: vi.fn().mockResolvedValue({}),
  };

  beforeAll(() => {
    realGoogle = require.cache[googlePath];
    // driveBackupService carga googleapis con require() perezoso — se sustituye en caché.
    const fake = new Module(googlePath);
    fake.loaded = true;
    fake.exports = {
      google: {
        auth: { OAuth2: class { setCredentials() {} on() {} } },
        drive: () => ({ files }),
      },
    };
    require.cache[googlePath] = fake;
  });
  afterAll(() => {
    if (realGoogle) require.cache[googlePath] = realGoogle;
    else delete require.cache[googlePath];
  });

  it('solo considera los zips de backup, no la carpeta "Documentos generados"', async () => {
    const cfg = { drive_backup: { tokens: encryptJSON({ access_token: 'x' }), folder_id: 'root', retention_count: 1 } };
    vi.spyOn(models.Jal, 'findByPk').mockResolvedValue({ id: 'jal-a', config: cfg });
    vi.spyOn(models.Jal, 'update').mockResolvedValue([1]);
    vi.spyOn(models.BackupLog, 'create').mockResolvedValue({ update: vi.fn() });
    vi.spyOn(models.Document, 'findAll').mockResolvedValue([]);
    vi.spyOn(models.DocType, 'findAll').mockResolvedValue([]);

    await drive.runBackup('jal-a', 'admin-1', 'manual');

    const { q } = files.list.mock.calls[0][0];
    expect(q).toContain("mimeType='application/zip'");
    expect(q).toContain("name contains 'backup_jal_'");
    // El zip local lleva el prefijo de la JAL
    expect(fs.readdirSync(TMP_BACKUPS_DIR).some((f) => f.startsWith('backup_jal_jal-a_'))).toBe(true);
  });
});

describe('addDocumentsToZip() — backups con la copia en BD', () => {
  const PizZip = require('pizzip');
  const fakeDoc = (over) => ({
    id: 'd1', file_path_docx: '/no/existe.docx', file_path_pdf: null,
    file_docx: Buffer.from('DOCX-BD'), file_pdf: Buffer.from('PDF-BD'),
    ...over,
    toJSON() { return { id: this.id, file_docx: this.file_docx, file_pdf: this.file_pdf, beneficiary_name: 'Ana' }; },
  });

  it('usa los bytes de BD cuando el archivo no está en disco y no los mete en el JSON', () => {
    const zip = new PizZip();
    expect(drive.addDocumentsToZip(zip, [fakeDoc()])).toBe(2);
    expect(zip.file('archivos/d1.docx').asText()).toBe('DOCX-BD');
    expect(zip.file('archivos/d1.pdf').asText()).toBe('PDF-BD');
    const json = JSON.parse(zip.file('data/documentos.json').asText());
    expect(json[0]).toEqual({ id: 'd1', beneficiary_name: 'Ana' });
  });

  it('prefiere el archivo en disco si existe', () => {
    const p = path.join(TMP_BACKUPS_DIR, 'd2.pdf');
    fs.writeFileSync(p, 'PDF-DISCO');
    const zip = new PizZip();
    drive.addDocumentsToZip(zip, [fakeDoc({ id: 'd2', file_path_pdf: p, file_docx: null })]);
    expect(zip.file('archivos/d2.pdf').asText()).toBe('PDF-DISCO');
    expect(zip.file('archivos/d2.docx')).toBeNull();
  });
});
