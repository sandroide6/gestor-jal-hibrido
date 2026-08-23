'use strict';
const path   = require('path');
const fs     = require('fs');
const jwt    = require('jsonwebtoken');
const { spawn } = require('child_process');
const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const { Jal, BackupLog } = require('../models');
const drive = require('../services/driveBackupService');
const { encryptJSON } = require('../utils/crypto');

const router = Router();

const STATE_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const STATE_TYPE    = 'drive_oauth_state';

// Firma un `state` de un solo uso que ata el callback de OAuth al admin/JAL que lo
// inició (Google llama al callback sin ningún header de auth nuestro, así que no hay
// otra forma de saber qué JAL originó la solicitud) y sirve además como protección
// CSRF: sin este token firmado, nadie puede completar el flujo de conexión en nombre
// de otra JAL ni disparar el callback de forma independiente.
// `origin` viaja dentro del state para que el callback sepa a dónde volver. En modo
// túnel local, backend y frontend comparten origen y una ruta relativa basta — pero en
// modo híbrido (frontend en Vercel, backend en Render) son orígenes distintos, y
// `res.redirect('/admin/...')` en el callback resolvería contra el propio backend (que
// no sirve el frontend), no contra Vercel. Se valida contra ALLOWED_ORIGINS antes de
// firmarlo para no abrir un open-redirect si algún día ese origin llega manipulado.
function signOAuthState(jalId, userId, origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());
  const safeOrigin = allowed.includes(origin) ? origin : null;
  return jwt.sign({ type: STATE_TYPE, jal_id: jalId, sub: userId, origin: safeOrigin }, STATE_SECRET, {
    algorithm: 'HS256', expiresIn: '10m',
  });
}

function verifyOAuthState(state) {
  const payload = jwt.verify(state, STATE_SECRET, { algorithms: ['HS256'] });
  if (payload.type !== STATE_TYPE) throw new Error('state inválido');
  return payload;
}

// Callback OAuth — Google lo llama por redirect de navegador, SIN ningún header de
// autenticación nuestro, así que debe quedar público (montado antes de
// authenticate/authorize, que de otro modo lo bloquearían con 401 y romperían todo
// el flujo de conexión con Drive). El `state` firmado es lo que lo protege.
router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;

  // Intenta recuperar el origin del state incluso en las ramas de error — sigue siendo
  // mejor volver al dominio correcto con un ?error=... que aterrizar en el JSON crudo
  // del backend.
  let origin = null;
  let jalId;
  try {
    ({ jal_id: jalId, origin } = verifyOAuthState(state));
  } catch {
    // state ausente/inválido: origin queda null, se usa ruta relativa como último recurso
  }
  const goto = (qs) => res.redirect(`${origin || ''}/admin/configuracion/backup${qs}`);

  if (error || !code) return goto('?error=auth_denied');
  if (!jalId) return goto('?error=invalid_state');

  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/v1/backup/drive/callback`;
    const tokens = await drive.exchangeCode(code, redirectUri);

    const jal = await Jal.findByPk(jalId);
    if (!jal) return goto('?error=no_jal');
    await Jal.update({
      config: { ...jal.config, drive_backup: { ...(jal.config?.drive_backup || {}), tokens: encryptJSON(tokens) } },
    }, { where: { id: jal.id } });

    goto('?connected=1');
  } catch (err) {
    goto(`?error=${encodeURIComponent(err.message)}`);
  }
});

router.use(authenticate);
router.use(authorize('administrador'));

// ── Estado y configuración ─────────────────────────────────

router.get('/config', async (req, res, next) => {
  try {
    const jal = await Jal.findByPk(req.user.jal_id);
    const cfg = jal.config?.drive_backup || {};
    const tokens = drive.decryptTokens(cfg.tokens);
    const email = tokens ? await drive.getUserEmail(tokens) : null;
    res.json({
      connected:        !!cfg.tokens,
      email,
      folder_id:        cfg.folder_id || null,
      auto_enabled:     cfg.auto_enabled || false,
      schedule:         cfg.schedule || 'daily',
      schedule_hour:    cfg.schedule_hour ?? 2,
      schedule_day:     cfg.schedule_day ?? 1,
      retention_count:  cfg.retention_count || 10,
      last_backup_at:   cfg.last_backup_at || null,
      next_backup_at:   cfg.next_backup_at || null,
      configured:       !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
  } catch (err) { next(err); }
});

router.put('/config', async (req, res, next) => {
  try {
    const { auto_enabled, schedule, schedule_hour, schedule_day, retention_count } = req.body;
    const jal = await Jal.findByPk(req.user.jal_id);
    const cfg = jal.config?.drive_backup || {};

    const next_backup_at = auto_enabled
      ? drive.calcNextBackup(schedule || cfg.schedule || 'daily', schedule_hour ?? cfg.schedule_hour ?? 2, schedule_day ?? cfg.schedule_day ?? 1).toISOString()
      : null;

    await Jal.update({
      config: {
        ...jal.config,
        drive_backup: {
          ...cfg,
          auto_enabled:    !!auto_enabled,
          schedule:        schedule        || cfg.schedule        || 'daily',
          schedule_hour:   schedule_hour   ?? cfg.schedule_hour   ?? 2,
          schedule_day:    schedule_day    ?? cfg.schedule_day    ?? 1,
          retention_count: retention_count ?? cfg.retention_count ?? 10,
          next_backup_at,
        },
      },
    }, { where: { id: req.user.jal_id } });

    res.json({ ok: true, next_backup_at });
  } catch (err) { next(err); }
});

// ── OAuth Google ───────────────────────────────────────────

router.get('/auth-url', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: true, message: 'Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en backend/.env' });
  }
  const redirectUri = `${req.protocol}://${req.get('host')}/v1/backup/drive/callback`;
  const state = signOAuthState(req.user.jal_id, req.user.sub, req.get('origin'));
  res.json({ url: drive.getAuthUrl(redirectUri, state) });
});

router.delete('/disconnect', async (req, res, next) => {
  try {
    const jal = await Jal.findByPk(req.user.jal_id);
    const cfg = { ...(jal.config?.drive_backup || {}) };
    delete cfg.tokens;
    delete cfg.folder_id;
    cfg.auto_enabled  = false;
    cfg.next_backup_at = null;
    await Jal.update({ config: { ...jal.config, drive_backup: cfg } }, { where: { id: req.user.jal_id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Backup manual ──────────────────────────────────────────

router.post('/run', async (req, res, next) => {
  try {
    const log = await drive.runBackup(req.user.jal_id, req.user.sub, 'manual');
    res.json(log);
  } catch (err) { next(err); }
});

// ── Historial ──────────────────────────────────────────────

router.get('/logs', async (req, res, next) => {
  try {
    const logs = await BackupLog.findAll({
      where: { jal_id: req.user.jal_id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json(logs);
  } catch (err) { next(err); }
});

// ── Backups locales ────────────────────────────────────────

// Listar archivos locales
router.get('/local-files', (req, res, next) => {
  try {
    res.json(drive.listLocalBackups());
  } catch (err) { next(err); }
});

// Descargar un archivo local
router.get('/local-files/:filename', (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename); // evitar path traversal
    if (!filename.endsWith('.zip')) return res.status(400).json({ error: true, message: 'Archivo no válido' });
    const filePath = path.join(drive.getLocalBackupsPath(), filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: true, message: 'Archivo no encontrado' });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/zip');
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

// Abrir carpeta en el explorador de Windows
router.post('/open-folder', (req, res, next) => {
  try {
    const folderPath = drive.getLocalBackupsPath();
    // Validar que la ruta es absoluta y no contiene caracteres peligrosos
    // antes de pasarla a spawn (defensa en profundidad)
    if (!path.isAbsolute(folderPath) || /[;&|`$<>]/.test(folderPath)) {
      return res.status(400).json({ error: true, message: 'Ruta de carpeta no válida' });
    }
    spawn('explorer.exe', [folderPath], { detached: true, stdio: 'ignore' }).unref();
    res.json({ ok: true, path: folderPath });
  } catch (err) { next(err); }
});

module.exports = router;
