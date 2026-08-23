'use strict';
const logger = require('../config/logger');

// Envía el DOCX/PDF de un documento recién generado al receptor local en el PC del
// usuario (scripts/local_doc_receiver.js, lanzado con recibir_documentos.bat), a través
// del mismo túnel Tailscale + proxy SOCKS5 que ya se usa para Ollama — ver
// deploy/render/entrypoint.sh. Deliberadamente silencioso si LOCAL_DOC_RECEIVER_URL no
// está configurado (caso normal si el usuario no dejó el receptor corriendo) y nunca
// relanza: no debe tumbar ni retrasar la respuesta de "documento creado".
async function syncToLocalReceiver(jalId, doc, docxBuffer, pdfBuffer) {
  const url = process.env.LOCAL_DOC_RECEIVER_URL;
  const token = process.env.LOCAL_DOC_RECEIVER_TOKEN;
  if (!url || !token) return;

  try {
    const res = await fetch(`${url}/documento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Receiver-Token': token },
      body: JSON.stringify({
        jalId,
        docTypeName: doc.doc_type_name,
        beneficiaryId: doc.beneficiary_id,
        docxBase64: docxBuffer ? docxBuffer.toString('base64') : null,
        pdfBase64: pdfBuffer ? pdfBuffer.toString('base64') : null,
      }),
      signal: AbortSignal.timeout(15_000), // el PC puede estar apagado/receptor no corriendo — no colgar
    });
    if (!res.ok) throw new Error(`receptor local respondió ${res.status}`);
    logger.info('Documento sincronizado al receptor local', { jalId, documentId: doc.id });
  } catch (err) {
    logger.error('syncToLocalReceiver: fallo enviando documento al receptor local', {
      jalId, documentId: doc.id, error: err.message,
    });
  }
}

module.exports = { syncToLocalReceiver };
