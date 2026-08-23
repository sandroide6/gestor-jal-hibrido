'use strict';
// Servicio local minúsculo: recibe cada documento generado por el backend en la nube
// (Render) y lo guarda en disco en este PC, en tiempo real. Llega a través del mismo
// túnel Tailscale + proxy SOCKS5 que ya se usa para Ollama (ver
// deploy/render/entrypoint.sh y deploy/render/tailscale-db-proxy.js) — no expone nada
// directo a internet, solo es alcanzable desde dispositivos del mismo tailnet, y además
// exige un token compartido (LOCAL_DOC_RECEIVER_TOKEN) como segunda capa.
//
// Uso: node scripts/local_doc_receiver.js  (o doble clic en recibir_documentos.bat)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.LOCAL_DOC_RECEIVER_PORT || '4001', 10);
const TOKEN = process.env.LOCAL_DOC_RECEIVER_TOKEN || '';
const OUTPUT_ROOT = path.resolve(
  process.env.LOCAL_DOC_OUTPUT_PATH || path.join(__dirname, '..', 'documentos_locales')
);
const MAX_BODY_BYTES = 30 * 1024 * 1024; // 30 MB — margen amplio sobre MAX_FILE_SIZE_MB

if (!TOKEN) {
  console.error('[local-doc-receiver] LOCAL_DOC_RECEIVER_TOKEN no configurado en el entorno — saliendo.');
  process.exit(1);
}

function safeSegment(value, fallback) {
  const s = String(value ?? fallback);
  return s.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || fallback;
}

function tokenMatches(candidate) {
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/documento') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: true, message: 'Ruta no encontrada' }));
  }

  if (!tokenMatches(req.headers['x-receiver-token'])) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: true, message: 'Token inválido' }));
  }

  let body = '';
  let tooLarge = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) {
      tooLarge = true;
      req.destroy();
    }
  });

  req.on('end', () => {
    if (tooLarge) return; // conexión ya destruida, no hay res que escribir

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: true, message: 'JSON inválido' }));
    }

    const { jalId, docTypeName, beneficiaryId, docxBase64, pdfBase64 } = payload;
    const dateFolder = new Date().toISOString().slice(0, 10);
    const dir = path.join(
      OUTPUT_ROOT,
      safeSegment(jalId, 'jal'),
      safeSegment(docTypeName, 'documento'),
      dateFolder,
      safeSegment(beneficiaryId, 'sin_id')
    );

    try {
      fs.mkdirSync(dir, { recursive: true });
      const stamp = Date.now();
      if (docxBase64) fs.writeFileSync(path.join(dir, `${stamp}.docx`), Buffer.from(docxBase64, 'base64'));
      if (pdfBase64) fs.writeFileSync(path.join(dir, `${stamp}.pdf`), Buffer.from(pdfBase64, 'base64'));

      console.log(`[local-doc-receiver] Guardado: ${dir}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: dir }));
    } catch (err) {
      console.error('[local-doc-receiver] Error guardando documento:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: true, message: err.message }));
    }
  });
});

// 0.0.0.0, no 127.0.0.1: tiene que ser alcanzable desde la interfaz de Tailscale, no
// solo desde este mismo PC — mismo motivo por el que Ollama necesita
// OLLAMA_HOST=0.0.0.0. La regla de firewall de Windows (ver
// docs/DESPLIEGUE_HIBRIDO.md) es la que evita que quede expuesto a toda la red local.
server.listen(PORT, '0.0.0.0', () => {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  console.log(`[local-doc-receiver] Escuchando en 0.0.0.0:${PORT} — guardando en ${OUTPUT_ROOT}`);
});
