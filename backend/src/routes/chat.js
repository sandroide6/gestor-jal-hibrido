'use strict';
const { Router } = require('express');
const http = require('http');
const { Op } = require('sequelize');
const rateLimit = require('express-rate-limit');
const authenticate = require('../middleware/authenticate');
const logger = require('../config/logger');
const { Document, DocType, User, Jal } = require('../models');

const router = Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: true, message: 'Demasiadas solicitudes al asistente. Espere un minuto.' },
});

const BASE_SYSTEM = `Eres el asistente virtual del sistema Gestor JAL, una aplicación de gestión documental para la Junta Administradora Local (JAL) de Medellín, Colombia.

Tu función es ayudar a los usuarios con:
- Navegar y usar las funciones del sistema
- Consultar información real de documentos, usuarios y estadísticas (ver sección DATOS ACTUALES)
- Responder preguntas sobre procedimientos de la JAL
- Orientar sobre la normativa y funcionamiento de las JAL en Colombia

SECCIONES DEL SISTEMA:
- Generador de documentos: crear oficios, certificados, actas, constancias, memorandos, derechos de petición
- Documentos: ver y gestionar documentos existentes
- Reportes: informes y estadísticas
- Panel de administración: gestión de usuarios y configuración (solo administradores)
- Tipos de documento: configurar plantillas (solo administradores)

ROLES: Administrador (acceso total), Edil (ver todos los documentos), Auxiliar (sus propios documentos)

Responde siempre en español, de forma clara y concisa. Usa los DATOS ACTUALES para responder preguntas específicas sobre el sistema. Mantén un tono profesional pero amigable.`;

async function buildContext(userId, jalId, role) {
  const lines = [];
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    // ── Usuario actual ─────────────────────────────────────
    const user = await User.findByPk(userId, {
      attributes: ['name', 'email', 'role', 'cargo_titulo'],
    });
    if (user) {
      lines.push(`USUARIO ACTUAL: ${user.name} | Rol: ${user.role}${user.cargo_titulo ? ` | Cargo: ${user.cargo_titulo}` : ''}`);
    }

    // ── JAL ────────────────────────────────────────────────
    const jal = await Jal.findByPk(jalId, { attributes: ['name'] });
    if (jal) lines.push(`JAL: ${jal.name}`);

    // ── Tipos de documento activos ─────────────────────────
    const docTypes = await DocType.findAll({
      where: { jal_id: jalId, active: true },
      attributes: ['name'],
      order: [['name', 'ASC']],
    });
    if (docTypes.length) {
      lines.push(`TIPOS DE DOCUMENTO DISPONIBLES (${docTypes.length}): ${docTypes.map(d => d.name).join(', ')}`);
    }

    // ── Documentos: filtro según rol ───────────────────────
    const docWhere = { jal_id: jalId };
    if (role === 'auxiliar') docWhere.user_id = userId;

    const [totalDocs, docsThisMonth, recentDocs] = await Promise.all([
      Document.count({ where: docWhere }),
      Document.count({ where: { ...docWhere, created_at: { [Op.gte]: firstOfMonth } } }),
      Document.findAll({
        where: docWhere,
        attributes: ['document_number', 'doc_type_name', 'beneficiary_name', 'created_at', 'reviewed'],
        order: [['created_at', 'DESC']],
        limit: 8,
      }),
    ]);

    lines.push(`DOCUMENTOS TOTALES: ${totalDocs} | Este mes: ${docsThisMonth}`);

    if (recentDocs.length) {
      lines.push('ÚLTIMOS DOCUMENTOS:');
      recentDocs.forEach(d => {
        const fecha = new Date(d.created_at).toLocaleDateString('es-CO');
        const num   = d.document_number ? `#${d.document_number} ` : '';
        const rev   = d.reviewed ? ' ✓revisado' : '';
        lines.push(`  - ${num}${d.doc_type_name} | ${d.beneficiary_name} | ${fecha}${rev}`);
      });
    }

    // ── Estadísticas por tipo (top 5) ──────────────────────
    const byType = await Document.findAll({
      where: docWhere,
      attributes: ['doc_type_name', [require('sequelize').fn('COUNT', '*'), 'total']],
      group: ['doc_type_name'],
      order: [[require('sequelize').literal('total'), 'DESC']],
      limit: 5,
      raw: true,
    });
    if (byType.length) {
      lines.push(`TOP TIPOS USADOS: ${byType.map(r => `${r.doc_type_name}(${r.total})`).join(', ')}`);
    }

    // ── Usuarios (solo admin/edil) ─────────────────────────
    if (role === 'administrador' || role === 'edil') {
      const [totalUsers, activeUsers] = await Promise.all([
        User.count({ where: { jal_id: jalId } }),
        User.count({ where: { jal_id: jalId, active: true } }),
      ]);
      lines.push(`USUARIOS: ${activeUsers} activos de ${totalUsers} total`);

      if (role === 'administrador') {
        const users = await User.findAll({
          where: { jal_id: jalId, active: true },
          attributes: ['name', 'role', 'cargo_titulo'],
          order: [['role', 'ASC'], ['name', 'ASC']],
        });
        lines.push('LISTA DE USUARIOS ACTIVOS:');
        users.forEach(u => {
          lines.push(`  - ${u.name} | ${u.role}${u.cargo_titulo ? ` | ${u.cargo_titulo}` : ''}`);
        });
      }
    }
  } catch (err) {
    // No incluir err.message en el prompt: el LLM podría repetirlo en su respuesta,
    // filtrando detalles internos (mensajes de BD, fragmentos de query) a un usuario
    // con cualquier rol, incluido auxiliar.
    logger.error('chat.buildContext: error cargando contexto de BD', { jalId, userId, error: err.message });
    lines.push('(No se pudo cargar el contexto actual del sistema — responde solo con conocimiento general.)');
  }

  return lines.length ? `\n\nDATOS ACTUALES DEL SISTEMA:\n${lines.join('\n')}` : '';
}

router.post('/', authenticate, chatLimiter, async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: true, message: 'El campo messages es requerido' });
  }

  const { sub: userId, jal_id: jalId, role } = req.user;
  const ollamaUrl   = process.env.OLLAMA_URL   || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';

  // Construir contexto con datos reales de la BD
  const context = await buildContext(userId, jalId, role);
  const systemPrompt = BASE_SYSTEM + context;

  const payload = JSON.stringify({
    model: ollamaModel,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 4000),
      })),
    ],
  });

  const urlObj = new URL(`${ollamaUrl}/api/chat`);
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 11434,
    path: urlObj.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const ollamaReq = http.request(options, (ollamaRes) => {
    let buf = '';
    ollamaRes.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const text = parsed?.message?.content;
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
          if (parsed.done) { res.write('data: [DONE]\n\n'); res.end(); }
        } catch {}
      }
    });
    ollamaRes.on('end', () => { res.write('data: [DONE]\n\n'); res.end(); });
  });

  ollamaReq.on('error', () => {
    res.write(`data: ${JSON.stringify({ error: 'El servicio de IA local no está disponible. Verifica que Ollama esté corriendo.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  ollamaReq.write(payload);
  ollamaReq.end();
  req.on('close', () => ollamaReq.destroy());
});

module.exports = router;
module.exports.buildContext = buildContext; // expuesto solo para tests unitarios
