# Imagen de STAGING (auditoría 2026-11-05, plan 4.2): el mismo backend que producción más
# el frontend compilado, servidos por un único servicio de Render en el mismo origen.
# Así el staging no necesita un proyecto de Vercel aparte, y las pruebas no pasan por el
# reenvío de Vercel a producción (frontend/vercel.json apunta SIEMPRE al backend de
# producción, también en las vistas previas de cada PR).
#
# Mantener alineado con deploy/render/Dockerfile.backend (misma base, mismo LibreOffice,
# mismo entrypoint con migraciones). No lleva Tailscale: el staging no usa chat ni
# receptor local.

FROM node:24-slim AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
ARG VITE_JAL_NOMBRE="JAL · STAGING"
ARG VITE_SENTRY_DSN=""
ENV VITE_API_URL=/v1 VITE_JAL_NOMBRE=$VITE_JAL_NOMBRE VITE_SENTRY_DSN=$VITE_SENTRY_DSN VITE_SENTRY_ENVIRONMENT=staging
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY backend/src          ./src
COPY backend/config       ./config
COPY backend/migrations   ./migrations
COPY backend/seeders      ./seeders
COPY backend/plantillas   ./plantillas
COPY backend/package.json ./package.json
COPY backend/.sequelizerc ./.sequelizerc
COPY deploy/render/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && mkdir -p /app/data/output /app/data/backups
# backend/src/app.js sirve ../../frontend/dist desde /app/src, es decir /frontend/dist
COPY --from=frontend /frontend/dist /frontend/dist

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=10s --start-period=45s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3001/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["./entrypoint.sh"]
