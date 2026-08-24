'use strict';
require('dotenv').config();
require('./config/env').validateEnv();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const healthRouter       = require('./routes/health');
const authRouter         = require('./routes/auth');
const documentsRouter    = require('./routes/documents');
const docTypesRouter     = require('./routes/docTypes');
const syncRouter         = require('./routes/sync');
const usersRouter        = require('./routes/users');
const reportsRouter      = require('./routes/reports');
const adminRouter        = require('./routes/admin');
const notificationsRouter = require('./routes/notifications');
const chatRouter          = require('./routes/chat');
const backupRouter        = require('./routes/backup');
const sanitize           = require('./middleware/sanitize');
const errorHandler       = require('./middleware/errorHandler');
const requestId          = require('./middleware/requestId');
const { register, metricsMiddleware } = require('./config/metrics');

const app = express();

app.set('trust proxy', 1);
app.use(requestId);
app.use(metricsMiddleware);

const isDev = process.env.NODE_ENV !== 'production';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"],
      upgradeInsecureRequests: isDev ? null : [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true },
}));
app.disable('x-powered-by');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',').map((o) => o.trim());

// Anclados con ^ (inicio) y $ (fin), sin comodines abiertos: el patrón de ngrok
// anterior (/\.ngrok[-.].*$/, sin ancla de inicio y terminando en `.*$`) hacía match
// con CUALQUIER origen que contuviera la subcadena ".ngrok-" o ".ngrok." en cualquier
// posición — ej. "https://x.ngrok-evil.com" (un dominio atacante) pasaba la validación.
const allowedPatterns = [
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,
  /^https:\/\/[a-z0-9-]+\.serveousercontent\.com$/,
  /^https:\/\/[a-z0-9-]+\.serveo\.net$/,
  /^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.(app|dev|io)$/,
  /^https:\/\/[a-z0-9-]+\.loca\.lt$/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (allowedPatterns.some((re) => re.test(origin))) return cb(null, true);
    cb(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Demasiadas solicitudes, intente de nuevo en un minuto.' },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitize);

if (process.env.NODE_ENV !== 'test') {
  morgan.token('req-id', (req) => req.id);
  const morganFmt = process.env.NODE_ENV === 'production'
    ? ':req-id :method :url :status :res[content-length] - :response-time ms'
    : ':req-id :method :url :status :response-time ms';
  app.use(morgan(morganFmt));
}

const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '..', 'data', 'output');
fs.mkdirSync(storagePath, { recursive: true });

// ── Métricas Prometheus (solo acceso interno) ──────────────
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── Rutas ─────────────────────────────────────────────────
app.use('/health',           healthRouter);
app.use('/v1/health',        healthRouter);
app.use('/v1/auth',          authRouter);
app.use('/v1/documents',     documentsRouter);
app.use('/v1/doc-types',     docTypesRouter);
app.use('/v1/sync',          syncRouter);
app.use('/v1/users',         usersRouter);
app.use('/v1/reports',       reportsRouter);
app.use('/v1/admin',         adminRouter);
app.use('/v1/notifications', notificationsRouter);
app.use('/v1/chat',          chatRouter);
app.use('/v1/backup/drive', backupRouter);

if (process.env.NODE_ENV !== 'production') {
  // require() adentro del if, no arriba del archivo: en producción (Render) esto nunca
  // se usa, así que no tiene sentido pagar el costo de cargar swagger-ui-express (trae
  // sus propios assets estáticos embebidos) en cada arranque del proceso.
  const swaggerUi   = require('swagger-ui-express');
  const swaggerSpec = require('./swagger');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'JAL API Docs' }));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
}

// Servir frontend estático cuando exista el build (modo túnel / producción)
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/v1/') || req.path === '/health' || req.path.startsWith('/metrics')) {
      return res.status(404).json({ error: true, message: 'Ruta no encontrada' });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.use((_req, res) => res.status(404).json({ error: true, message: 'Ruta no encontrada' }));
}

app.use(errorHandler);

module.exports = app;
