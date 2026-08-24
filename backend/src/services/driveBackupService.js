'use strict';
const { google } = require('googleapis');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { Document, DocType, User, Jal, BackupLog } = require('../models');
const { decryptJSON } = require('../utils/crypto');
const logger = require('../config/logger');

// Los tokens se guardan cifrados (ver routes/backup.js, /callback). Si el valor
// almacenado no descifra como JSON válido, se asume que es un registro previo a la
// migración a cifrado (texto plano) y se usa tal cual — evita romper conexiones ya
// existentes al desplegar este cambio.
function decryptTokens(stored) {
  if (!stored) return null;
  if (typeof stored === 'object') return stored; // ya era un objeto (legado sin cifrar)
  try {
    return decryptJSON(stored);
  } catch {
    try { return JSON.parse(stored); } catch { return null; }
  }
}

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'];
const FOLDER_NAME = 'Gestor JAL Backups';

function getClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/v1/backup/drive/callback'
  );
}

function getAuthUrl(redirectUri, state) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  return client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent', state });
}

async function exchangeCode(code, redirectUri) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function getAuthedClient(tokens) {
  const client = getClient();
  client.setCredentials(tokens);
  // Auto-refresh
  client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) tokens.refresh_token = newTokens.refresh_token;
    tokens.access_token  = newTokens.access_token;
    tokens.expiry_date   = newTokens.expiry_date;
  });
  return client;
}

async function getUserEmail(tokens) {
  try {
    const client = await getAuthedClient(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    return data.email;
  } catch { return null; }
}

async function getOrCreateFolder(drive) {
  const res = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });
  if (res.data.files.length) return res.data.files[0].id;
  const folder = await drive.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  return folder.data.id;
}

const DOCS_FOLDER_NAME = 'Documentos generados';

async function getOrCreateSubfolder(drive, parentId, name) {
  const res = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });
  if (res.data.files.length) return res.data.files[0].id;
  const folder = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return folder.data.id;
}

// Crea (o reutiliza) una cadena de subcarpetas anidadas, una llamada por nivel — mismo
// patrón tipo/fecha/beneficiario que scripts/local_doc_receiver.js usa en el PC local,
// para que ambos destinos queden organizados igual.
async function getOrCreateNestedFolder(drive, rootId, segments) {
  let parentId = rootId;
  for (const segment of segments) {
    parentId = await getOrCreateSubfolder(drive, parentId, segment);
  }
  return parentId;
}

function safeSegment(value, fallback) {
  const s = String(value ?? fallback);
  return s.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || fallback;
}

// Sube el DOCX/PDF de un documento recién generado a Drive, en una subcarpeta separada
// de los backups periódicos. Deliberadamente silencioso si Drive no está conectado (es
// el caso normal para JALs que no configuraron esta función) y no relanza errores — no
// debe tumbar ni retrasar la respuesta de "documento creado" al usuario; se llama
// fire-and-forget desde documentService.js después de que la transacción ya confirmó.
async function uploadGeneratedDocument(jalId, doc, docxBuffer, pdfBuffer) {
  const jal = await Jal.findByPk(jalId);
  const cfg = jal?.config?.drive_backup || {};
  const tokens = decryptTokens(cfg.tokens);
  if (!tokens) return;

  try {
    const client = await getAuthedClient(tokens);
    const drive  = google.drive({ version: 'v3', auth: client });

    const rootFolderId = cfg.folder_id || await getOrCreateFolder(drive);
    const docsFolderId = cfg.docs_folder_id || await getOrCreateSubfolder(drive, rootFolderId, DOCS_FOLDER_NAME);

    if (!cfg.folder_id || !cfg.docs_folder_id) {
      const fresh = await Jal.findByPk(jalId);
      await Jal.update({
        config: {
          ...fresh.config,
          drive_backup: { ...(fresh.config?.drive_backup || {}), folder_id: rootFolderId, docs_folder_id: docsFolderId },
        },
      }, { where: { id: jalId } });
    }

    // Misma estructura tipo/fecha/beneficiario que scripts/local_doc_receiver.js —
    // decisión explícita del usuario para que Drive y el PC local queden organizados
    // igual.
    const dateFolder = new Date().toISOString().slice(0, 10);
    const targetFolderId = await getOrCreateNestedFolder(drive, docsFolderId, [
      safeSegment(doc.doc_type_name, 'documento'),
      dateFolder,
      safeSegment(doc.beneficiary_id, 'sin_id'),
    ]);

    const baseName = doc.numero_radicado || doc.id;
    const uploads = {};

    if (docxBuffer) {
      const stream = new Readable(); stream.push(docxBuffer); stream.push(null);
      uploads.docx = drive.files.create({
        requestBody: { name: `${baseName}.docx`, parents: [targetFolderId] },
        media: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: stream },
        fields: 'id',
      });
    }
    if (pdfBuffer) {
      const stream = new Readable(); stream.push(pdfBuffer); stream.push(null);
      uploads.pdf = drive.files.create({
        requestBody: { name: `${baseName}.pdf`, parents: [targetFolderId] },
        media: { mimeType: 'application/pdf', body: stream },
        fields: 'id',
      });
    }

    const [docxRes, pdfRes] = await Promise.all([uploads.docx, uploads.pdf]);
    logger.info('Documento subido a Google Drive', { jalId, documentId: doc.id });
    return { docxFileId: docxRes?.data?.id || null, pdfFileId: pdfRes?.data?.id || null };
  } catch (err) {
    logger.error('uploadGeneratedDocument: fallo subiendo documento a Drive', {
      jalId, documentId: doc.id, error: err.message,
    });
    return null;
  }
}

// Borra (best-effort) los archivos de Drive asociados a un documento — llamado desde
// documentService.deleteDocument() cuando el usuario borra un documento en la app, para
// que el borrado se propague a la copia en Drive. Si Drive no está conectado, el archivo
// ya no existe ahí, o falla la llamada, no relanza — el borrado del documento en la app
// no debe fallar por un problema de Drive.
async function deleteDriveFiles(jalId, driveFileIds = []) {
  const ids = driveFileIds.filter(Boolean);
  if (!ids.length) return;

  const jal = await Jal.findByPk(jalId);
  const tokens = decryptTokens(jal?.config?.drive_backup?.tokens);
  if (!tokens) return;

  try {
    const client = await getAuthedClient(tokens);
    const drive  = google.drive({ version: 'v3', auth: client });
    await Promise.all(ids.map((id) => drive.files.delete({ fileId: id }).catch(() => {})));
  } catch (err) {
    logger.error('deleteDriveFiles: fallo borrando archivos de Drive', { jalId, error: err.message });
  }
}

async function buildBackupBuffer(jalId) {
  const [docs, docTypes] = await Promise.all([
    Document.findAll({ where: { jal_id: jalId } }),
    DocType.findAll({ where: { jal_id: jalId } }),
  ]);

  const zip = new PizZip();
  const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../data/output');
  const templatesPath = process.env.TEMPLATES_PATH || path.join(__dirname, '../../plantillas');

  zip.file('manifest.json', JSON.stringify({
    exportedAt: new Date().toISOString(),
    jal_id: jalId,
    counts: { documents: docs.length, docTypes: docTypes.length },
  }, null, 2));

  zip.file('data/documentos.json', JSON.stringify(docs.map(d => d.toJSON()), null, 2));
  zip.file('data/tipos_documento.json', JSON.stringify(docTypes.map(d => {
    const t = d.toJSON(); delete t.template_data; return t;
  }), null, 2));

  // Archivos de documentos
  for (const doc of docs) {
    const id = doc.id;
    if (doc.file_path_docx && fs.existsSync(doc.file_path_docx))
      zip.file(`archivos/${id}.docx`, fs.readFileSync(doc.file_path_docx));
    if (doc.file_path_pdf && fs.existsSync(doc.file_path_pdf))
      zip.file(`archivos/${id}.pdf`, fs.readFileSync(doc.file_path_pdf));
  }

  // Plantillas
  for (const dt of docTypes) {
    if (dt.template_path && fs.existsSync(dt.template_path)) {
      const ext  = path.extname(dt.template_path);
      const safe = dt.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      zip.file(`plantillas/${safe}${ext}`, fs.readFileSync(dt.template_path));
    }
  }

  // Plantillas globales (carpeta plantillas/)
  if (fs.existsSync(templatesPath)) {
    for (const f of fs.readdirSync(templatesPath)) {
      const fp = path.join(templatesPath, f);
      if (fs.statSync(fp).isFile())
        zip.file(`plantillas_globales/${f}`, fs.readFileSync(fp));
    }
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const BACKUPS_LOCAL_PATH = path.resolve(
  process.env.BACKUPS_LOCAL_PATH ||
  path.join(process.env.STORAGE_PATH || path.join(__dirname, '../../data/output'), '../backups')
);

function getLocalBackupsPath() {
  fs.mkdirSync(BACKUPS_LOCAL_PATH, { recursive: true });
  return BACKUPS_LOCAL_PATH;
}

function listLocalBackups() {
  const dir = getLocalBackupsPath();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      return { filename: f, size_bytes: stat.size, created_at: stat.birthtime };
    })
    .sort((a, b) => b.created_at - a.created_at);
}

function cleanLocalBackups(retention) {
  const dir   = getLocalBackupsPath();
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
  const toDelete = files.slice(0, Math.max(0, files.length - retention));
  for (const { f } of toDelete) {
    try { fs.unlinkSync(path.join(dir, f)); } catch {}
  }
}

async function runBackup(jalId, userId, type = 'manual') {
  const log = await BackupLog.create({ jal_id: jalId, status: 'running', type, created_by: userId });

  try {
    const jal = await Jal.findByPk(jalId);
    const cfg = jal.config?.drive_backup || {};
    const tokens = decryptTokens(cfg.tokens);
    if (!tokens) throw new Error('Google Drive no está conectado');

    const client = await getAuthedClient(tokens);
    const drive  = google.drive({ version: 'v3', auth: client });

    const folderId = cfg.folder_id || await getOrCreateFolder(drive);

    // Guardar folder_id si es nuevo — se relee la JAL justo antes de escribir (no se
    // reutiliza el snapshot `jal` de arriba) para no pisar cambios concurrentes en
    // Jal.config hechos por otro proceso (otro backup, un admin editando la config)
    // mientras este backup estaba en curso.
    if (!cfg.folder_id) {
      const fresh = await Jal.findByPk(jalId);
      await Jal.update(
        { config: { ...fresh.config, drive_backup: { ...(fresh.config?.drive_backup || {}), folder_id: folderId } } },
        { where: { id: jalId } }
      );
    }

    const buffer   = await buildBackupBuffer(jalId);
    const filename = `backup_jal_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`;

    // Guardar copia local
    const localDir  = getLocalBackupsPath();
    const localPath = path.join(localDir, filename);
    fs.writeFileSync(localPath, buffer);
    cleanLocalBackups(cfg.retention_count || 10);

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const uploaded = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: 'application/zip', body: stream },
      fields: 'id, webViewLink, size',
    });

    // Respetar retención: eliminar backups viejos
    const retention = cfg.retention_count || 10;
    const existing  = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      orderBy: 'createdTime asc',
      fields: 'files(id)',
    });
    const toDelete = existing.data.files.slice(0, Math.max(0, existing.data.files.length - retention));
    for (const f of toDelete) {
      await drive.files.delete({ fileId: f.id }).catch(() => {});
    }

    await log.update({
      status: 'success',
      filename,
      drive_file_id:  uploaded.data.id,
      drive_file_url: uploaded.data.webViewLink,
      size_bytes: buffer.length,
    });

    // Actualizar last_backup_at y calcular next_backup_at — de nuevo, se relee la JAL
    // justo antes de escribir por la misma razón que arriba.
    const now  = new Date();
    const next = calcNextBackup(cfg.schedule || 'daily', cfg.schedule_hour ?? 2, cfg.schedule_day ?? 1);
    const freshEnd = await Jal.findByPk(jalId);
    await Jal.update(
      {
        config: {
          ...freshEnd.config,
          drive_backup: {
            ...(freshEnd.config?.drive_backup || {}),
            folder_id: folderId,
            last_backup_at: now.toISOString(),
            next_backup_at: next.toISOString(),
          },
        },
      },
      { where: { id: jalId } }
    );

    return log;
  } catch (err) {
    await log.update({ status: 'failed', error_message: err.message });
    throw err;
  }
}

function calcNextBackup(schedule, hour = 2, day = 1) {
  const now  = new Date();
  const next = new Date(now);
  if (schedule === 'hourly') {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else if (schedule === 'daily') {
    next.setDate(next.getDate() + 1);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (schedule === 'weekly') {
    const daysUntil = (day - now.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntil);
    next.setHours(hour, 0, 0, 0);
  }
  return next;
}

// Limpia el flag `auto_running` de una JAL al terminar el backup automático
// (éxito o fallo), releyendo la config fresca para no pisar cambios concurrentes.
async function clearAutoRunning(jalId) {
  try {
    const fresh = await Jal.findByPk(jalId);
    const cfg = { ...(fresh?.config?.drive_backup || {}) };
    if (!('auto_running' in cfg)) return;
    delete cfg.auto_running;
    await Jal.update({ config: { ...fresh.config, drive_backup: cfg } }, { where: { id: jalId } });
  } catch (err) {
    logger.error('checkAutoBackups: no se pudo limpiar auto_running', { jalId, error: err.message });
  }
}

// Llamado periódicamente desde index.js
async function checkAutoBackups() {
  try {
    const jals = await Jal.findAll();
    const now  = new Date();
    for (const jal of jals) {
      const cfg = jal.config?.drive_backup;
      if (!cfg?.auto_enabled || !cfg?.tokens || !cfg?.next_backup_at) continue;
      // Evita que un ciclo del scheduler más corto que la duración de un backup
      // dispare el mismo backup dos veces en paralelo para la misma JAL (next_backup_at
      // solo se recalcula al terminar, así que sin este flag varios ticks sucesivos
      // seguían viéndolo vencido mientras el primero aún corría).
      if (cfg.auto_running) continue;
      if (new Date(cfg.next_backup_at) <= now) {
        await Jal.update(
          { config: { ...jal.config, drive_backup: { ...cfg, auto_running: true } } },
          { where: { id: jal.id } },
        );

        // Falla silenciada a propósito para no tumbar el ciclo del scheduler por un
        // fallo de UNA JAL, pero antes no quedaba ningún rastro visible del error —
        // aquí sí se registra (runBackup ya deja su propio registro en BackupLog,
        // esto es adicional para monitoreo de infraestructura vía logs).
        runBackup(jal.id, null, 'auto')
          .catch((err) => {
            logger.error('checkAutoBackups: fallo en backup automático', { jalId: jal.id, error: err.message });
          })
          .finally(() => clearAutoRunning(jal.id));
      }
    }
  } catch (err) {
    logger.error('checkAutoBackups: fallo listando JALs para backup automático', { error: err.message });
  }
}

module.exports = { getAuthUrl, exchangeCode, getUserEmail, runBackup, checkAutoBackups, calcNextBackup, listLocalBackups, getLocalBackupsPath, decryptTokens, uploadGeneratedDocument, deleteDriveFiles };
