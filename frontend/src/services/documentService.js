import { v4 as uuidv4 } from 'uuid';
import { api } from './api';
import {
  saveDocument, addToSyncQueue, getPendingSyncCount, getDB,
  cacheTemplate, getCachedTemplate, cacheUserData, getCachedUserData,
} from '../db/index';
import { useSyncStore } from '../stores/syncStore';
import { generateDocxBlob, generatePdfBlob, generateDocxBlobFromTemplate } from './clientDocumentGenerator';

// true cuando el error es de red (sin respuesta HTTP del servidor)
function isNetworkError(err) {
  return !err.status;
}

// Convierte un data URL (data:mime;base64,...) a { data: ArrayBuffer, mime }
function dataUrlToBuffer(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const mime  = dataUrl.slice(5, comma).replace(';base64', '');
  const b64   = dataUrl.slice(comma + 1);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { data: bytes.buffer, mime };
}

// ── Caché offline: plantillas + firma + perfil ────────────

async function cacheOfflineResources(types, token) {
  // Plantillas DOCX de cada tipo de documento
  await Promise.allSettled(
    types.filter((t) => t.has_template).map(async (type) => {
      try {
        const blob = await api.blob(`/doc-types/${type.id}/template`, { token });
        const buf  = await blob.arrayBuffer();
        await cacheTemplate(type.id, buf);
      } catch (err) {
        console.warn(`[JAL] No se pudo cachear plantilla "${type.name}":`, err.message);
      }
    })
  );

  // Firma del usuario (imagen)
  try {
    const { data_url } = await api.get('/users/me/firma', { token });
    await cacheUserData('signature', dataUrlToBuffer(data_url));
  } catch (err) {
    if (err?.status !== 404) console.warn('[JAL] No se pudo cachear firma:', err.message);
  }

  // Perfil del usuario (nombre, cargo)
  try {
    const profile = await api.get('/users/me', { token });
    await cacheUserData('profile', { name: profile.name, cargo: profile.cargo_titulo || '' });
  } catch (err) {
    console.warn('[JAL] No se pudo cachear perfil:', err.message);
  }
}

// ── Tipos de documento ────────────────────────────────────

// Carga tipos de documento (online primero, IndexedDB como fallback)
export async function fetchDocTypes(token) {
  try {
    const types = await api.get('/doc-types', { token });

    // Actualizar caché principal
    const db = await getDB();
    const tx = db.transaction('doc_types', 'readwrite');
    await Promise.all([...types.map((t) => tx.store.put(t)), tx.done]);

    // Cachear plantillas + firma + perfil en segundo plano (sin bloquear)
    cacheOfflineResources(types, token).catch(() => {});

    return types;
  } catch (err) {
    // Fallback a IndexedDB para cualquier error de red
    if (isNetworkError(err)) {
      const db = await getDB();
      return db.getAll('doc_types');
    }
    throw err;
  }
}

// ── Generación de documentos ──────────────────────────────

export async function generateDocument({ docType, formData, beneficiaryName, beneficiaryId, token, edilId, edilName, edilCargo }) {
  const payload = {
    doc_type_id: docType.id,
    beneficiary_name: beneficiaryName,
    beneficiary_id: beneficiaryId,
    ...(edilId ? { edil_id: edilId } : {}),
    ...formData,
  };

  if (navigator.onLine) {
    try {
      const result = await api.post('/documents', payload, { token });

      await saveDocument({
        id: result.id,
        docTypeName: docType.name,
        beneficiaryName,
        beneficiaryId,
        metadata: formData,
        syncStatus: 'synced',
        createdAt: result.created_at || new Date().toISOString(),
        download: result.download,
      });

      return { ...result, offline: false };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Error de red → caer al modo offline automáticamente
      console.warn('[JAL] Sin acceso al servidor, cambiando a modo offline:', err.message);
      useSyncStore.getState().setOnline(false);
    }
  }

  // ── Modo offline ────────────────────────────────────────
  const localId = uuidv4();
  const localDoc = {
    id: localId,
    docTypeName: docType.name,
    beneficiaryName,
    beneficiaryId,
    metadata: formData,
    syncStatus: 'pending',
    createdAt: new Date().toISOString(),
    download: null,
  };

  await saveDocument(localDoc);
  await addToSyncQueue('create', { resource: 'documents', localId, data: payload });

  const count = await getPendingSyncCount();
  useSyncStore.getState().setPendingCount(count);

  // Cargar recursos cacheados para generación local
  const [cachedTpl, cachedSig, cachedProfile] = await Promise.all([
    getCachedTemplate(docType.id),
    edilId
      ? getCachedUserData(`signature_edil_${edilId}`).then((s) => s || null)
      : getCachedUserData('signature'),
    getCachedUserData('profile'),
  ]);

  if (!cachedSig) {
    const quien = edilId ? 'El edil seleccionado' : 'El firmante';
    throw new Error(`${quien} no tiene firma registrada. Registra una firma en el perfil antes de generar documentos.`);
  }

  const jalName = import.meta.env.VITE_JAL_NOMBRE || 'JAL';
  const today   = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  const templateData = {
    beneficiary_name: beneficiaryName,
    beneficiary_id: beneficiaryId,
    ...formData,
    jal_name: jalName,
    doc_type_name: docType.name,
    fecha_expedicion: today,
    nombre_encargado: edilName || cachedProfile?.name || '',
    cargo: edilId ? (edilCargo || 'Edil(a)') : (cachedProfile?.cargo || ''),
    firma_img: '',   // placeholder de imagen — se omite en modo offline
  };

  const generatorArgs = {
    jalName,
    docTypeName: docType.name,
    fields: docType.fields || [],
    data: templateData,
    templateBuffer:  cachedTpl?.data  || null,
    signatureBuffer: cachedSig?.data  || null,
    signatureMime:   cachedSig?.mime  || 'image/png',
  };

  let offlineBlobs = null;
  let offlineBlobError = null;

  try {
    const [docxBlob, pdfBlob] = await Promise.all([
      cachedTpl?.data
        ? generateDocxBlobFromTemplate(generatorArgs)
        : generateDocxBlob(generatorArgs),
      generatePdfBlob(generatorArgs),
    ]);
    offlineBlobs = { docx: docxBlob, pdf: pdfBlob };
  } catch (err) {
    console.error('[JAL] Error generando archivos offline:', err);
    try {
      const pdfBlob = await generatePdfBlob(generatorArgs);
      offlineBlobs = { pdf: pdfBlob };
    } catch (pdfErr) {
      console.error('[JAL] Error generando PDF offline:', pdfErr);
      offlineBlobError = pdfErr?.message || 'Error al generar archivos localmente';
    }
  }

  return { ...localDoc, offline: true, offlineBlobs, offlineBlobError };
}

// ── Descarga ──────────────────────────────────────────────

export function getDownloadUrls(docId) {
  const base = import.meta.env.VITE_API_URL || '';
  return {
    docx: `${base}/documents/${docId}/download?format=docx`,
    pdf:  `${base}/documents/${docId}/download?format=pdf`,
  };
}

export async function downloadDocument(docId, format, token, filename) {
  await api.download(
    `/documents/${docId}/download?format=${format}`,
    { token },
    filename || `documento.${format}`
  );
}

export async function deleteDocument(docId, token) {
  return api.delete(`/documents/${docId}`, { token });
}

// Cachea la firma de un edil para usarla en documentos offline
export async function cacheEdilSignature(edilId, token) {
  try {
    const { data_url } = await api.get(`/users/${edilId}/firma`, { token });
    await cacheUserData(`signature_edil_${edilId}`, dataUrlToBuffer(data_url));
  } catch (err) {
    if (err?.status !== 404) console.warn('[JAL] No se pudo cachear firma del edil:', err.message);
  }
}
