# Auditoría técnica — Gestor JAL (octubre 2026)

Rama: `claude/project-thread-o7xlcd`. Todo lo marcado como **Corregido** se verificó con
tests automáticos y/o una prueba de humo contra un PostgreSQL 16 local con las 25
migraciones aplicadas, el seeder y 300 documentos sintéticos (88 MB de binarios).

Clasificación: **Corregido** (aplicado y verificado) · **Implementado sin verificación
completa** · **Pendiente** · **No reproducido**.

---

## 1. Estado del proyecto

| Pieza | Tecnología real |
|---|---|
| Backend | Node.js ≥20 (probado en 22), Express 4, Sequelize 6, PostgreSQL, Joi, JWT (RS256 en prod, HS256 en dev), cookies httpOnly + CSRF double-submit |
| Frontend | React 18, Vite 5, Tailwind 3, Zustand, React Router 6, PWA (vite-plugin-pwa / Workbox), IndexedDB (`idb`) para modo offline |
| Documentos | docxtemplater + pizzip + docx + pdf-lib; conversión PDF con Word COM (Windows) o LibreOffice (Render) |
| Integraciones | Google Drive (OAuth, backups y copia de cada documento), Ollama (chat IA) vía Tailscale, receptor local de documentos |
| Despliegue | Vercel (frontend, con rewrite `/v1` → Render), Render (backend en Docker), Supabase (Postgres). Modo local con scripts Python/.bat y ngrok |
| Pruebas | Vitest + Supertest (backend), Vitest + Testing Library + jsdom (frontend) |

Puntos de entrada: `backend/src/index.js` (servidor, backups automáticos cada 5 min,
precalentado de Word en Windows) → `backend/src/app.js` (middleware y rutas `/v1/*`);
`frontend/src/main.jsx` → `App.jsx` (rutas con `lazy()`); `gestor.py` para el modo local.

Flujo principal: `GeneratorPage` → `services/documentService.js` (o generación offline
en el navegador y cola de sincronización) → `POST /v1/documents` → `documentService`
(transacción: número de documento con advisory lock + radicado con upsert) →
`documentGeneratorService` (DOCX/PDF) → bytes guardados en `documents.file_docx/file_pdf`
→ subida a Drive y al receptor local en segundo plano.

La base de código ya tenía varias pasadas de seguridad previas (aislamiento por JAL en
todos los servicios, protección de IDOR, CSRF, algoritmo JWT fijado, `state` firmado en
OAuth, cifrado de tokens de Drive). El diagnóstico se centró en lo que quedaba.

## 2. Línea base (antes de cambiar nada)

| Verificación | Resultado |
|---|---|
| `npm ci` backend / frontend | **Falla**: `package-lock.json` desincronizado en ambos (los Dockerfiles usan `npm ci`) |
| Tests backend | **14 de 33 suites no cargaban** (`validateEnv()` hace `process.exit(1)` sin `DATABASE_URL`); 193 tests pasaban |
| Tests frontend | 110/110 |
| Lint backend / frontend | 1 521 y 493 problemas (casi todo globals de vitest sin declarar, más 9 errores reales) |
| Build frontend | OK, con un chunk `docs` de 1 MB (367 KB gzip) |
| `npm audit --omit=dev` | backend 18 vulnerabilidades (2 críticas), frontend 5 |

## 3. Hallazgos y estado

### Críticos

| # | Problema | Estado |
|---|---|---|
| C1 | **La retención de backups en Drive podía borrar la carpeta "Documentos generados".** La subcarpeta vive dentro de la carpeta de backups y la retención listaba *todos* sus hijos ordenados por antigüedad. `files.delete` borra de forma permanente (sin papelera) e incluye todo lo que contiene. | **Corregido**: la consulta solo cuenta zips `backup_jal_*`. Test en `securityHardening.test.js` |
| C2 | **Un `retention_count` negativo borraba todos los backups**, incluido el recién subido. `PUT /backup/drive/config` no validaba nada. | **Corregido**: esquema Joi `validations/backup.js` (rangos iguales a los de `BackupPage`) |

> Revisa la papelera y la carpeta "Gestor JAL Backups" en Drive. Si la carpeta
> "Documentos generados" ya no está, sus archivos no se recuperan desde la papelera.
> Los documentos siguen en Supabase (columnas `file_docx`/`file_pdf`) y se pueden volver a exportar.

### Altos

| # | Problema | Estado |
|---|---|---|
| A1 | **El token temporal `2fa_pending` servía como sesión.** Se emite después de la contraseña y *antes* del TOTP; `authenticate` no miraba `type`, así que con él se podía cambiar la contraseña, cerrar todas las sesiones, leer el perfil y la firma, usar el chat, etc. sin el segundo factor. El refresh token tenía el mismo problema. | **Corregido**: `authenticate` rechaza cualquier token con `type` |
| A2 | **Backups locales compartidos entre JAL.** El nombre no incluía la JAL: un administrador listaba y descargaba los backups completos de otras JAL, y la retención de una JAL borraba los zips de las demás. | **Corregido**: nombre `backup_jal_<jal_id>_<fecha>.zip`; listado, descarga y retención filtran por JAL. Los zips antiguos sin prefijo **no se borran**, solo dejan de aparecer en el panel |
| A3 | **`POST /open-folder` tumbaba el proceso en Linux** (`spawn('explorer.exe')` sin manejar `error`). Un clic de un admin en Render reiniciaba el backend. | **Corregido**: 501 fuera de Windows y `.on('error')` |
| A4 | **Tests rotos y `npm ci` roto.** La CI que menciona el CHANGELOG 2.0.0 no existe en el repo. | **Corregido**: `DATABASE_URL` de prueba en `vitest.config.js`, lockfiles sincronizados, `.github/workflows/ci.yml` nuevo |
| A5 | Dependencias con avisos altos/críticos (`proxy-addr`, `body-parser`, `qs`, `joi`, `@xmldom/xmldom`, `js-yaml`, `nanoid`, `@remix-run/router`…) | **Corregido** dentro de rango semver (`npm update` dirigido; sin cambios en `package.json`) |

### Medios

| # | Problema | Estado |
|---|---|---|
| M1 | `/metrics` (Prometheus) público en Render (nginx solo lo restringe en el modo Docker local) | **Corregido**: 404 en producción salvo `Authorization: Bearer $METRICS_TOKEN` |
| M2 | Los 5xx devolvían `err.message` en producción (mensajes de Sequelize/pg con tablas y SQL) | **Corregido**: mensaje genérico en producción; el detalle queda en el log |
| M3 | El callback OAuth ponía el mensaje de error crudo en la URL | **Corregido**: `?error=exchange_failed` y log |
| M4 | **Backups y exportaciones sin archivos en Render.** Solo leían `file_path_*` del disco (efímero en Render); además metían los bytes BYTEA en `documentos.json` como arreglos de números | **Corregido**: `addDocumentsToZip()` usa disco o la copia en BD y saca los bytes del JSON. Prueba de humo: el zip de `/admin/backup` pasó de 0 a 600 archivos |
| M5 | **Exportación Excel cargaba todos los binarios** | **Corregido** (ver §4) |
| M6 | El chunk `docs` (~368 KB gzip) se descargaba al abrir `EdilPage` y `GeneratorPage` aunque solo se usa sin conexión | **Corregido**: `import()` dinámico; sigue precacheado por el service worker para el modo offline |
| M7 | `.env.example` decía que `JWT_PRIVATE_KEY` podía quedar vacío y no mencionaba `ENCRYPTION_KEY`, pero con `NODE_ENV=production` (el valor por defecto del ejemplo) el servidor no arranca sin ambas | **Corregido** en `backend/.env.example` y `deploy/render/.env.example` |
| M8 | El seeder crea el admin con la contraseña documentada `Admin1234!` | **Implementado sin verificación completa**: `ADMIN_INITIAL_PASSWORD` opcional (mismo valor por defecto). No se verificó la BD de Supabase |
| M9 | `@xmldom/xmldom`/`xmldom` (crítico, sin parche) vía `docxtemplater-image-module-free` | **Pendiente**: requiere cambiar de módulo de imágenes. El riesgo se limita a plantillas .docx subidas por administradores |
| M10 | `uuid@10` (moderado, backend) y React Router 6 (moderado, frontend) solo se corrigen con versión mayor | **Pendiente** (cambio mayor, fuera de alcance sin plan de migración) |
| M11 | `app.set('trust proxy', 1)` con dos saltos en producción (Vercel → proxy de Render): es probable que `req.ip` sea la IP de Vercel y todos los usuarios compartan el contador de rate limit, incluido el de login | **No reproducido**: depende de las cabeceras reales de Render/Vercel. Verificar registrando `req.ip` y `X-Forwarded-For` en producción antes de cambiarlo |

### Bajos

| # | Problema | Estado |
|---|---|---|
| B1 | Bloques `catch {}` vacíos, imports y variables muertos, escape inútil en regex, funciones declaradas dentro de bloques | **Corregido** (lint sin errores) |
| B2 | Si la BD no responde, `authenticate` confía en el JWT ("offline tolerance"): un usuario desactivado sigue entrando mientras dure la caída | **Pendiente** (decisión de diseño; el resto de rutas falla igual sin BD) |
| B3 | `GET /documents/:id/download` carga ambos binarios aunque sirva el archivo desde disco | **Pendiente** (impacto bajo, un documento por petición) |
| B4 | `.eslintrc.json` en la raíz no se usa (ambos subproyectos tienen `root: true`) | **Pendiente**: no se borró sin autorización |
| B5 | 14 avisos de lint en el frontend (`react-hooks/exhaustive-deps`, variables sin uso) | **Pendiente**: tocar dependencias de efectos sin pruebas de UI puede cambiar el comportamiento |
| B6 | Chunk `ReportsPage` de 408 KB (Recharts) | **Pendiente**: ya es lazy por ruta |
| B7 | Scripts Python (`gestor.py`, `scripts/`) sin tests | **Pendiente** |

## 4. Rendimiento medido

Consulta de la exportación Excel (`Document.findAll` de la JAL, 300 documentos con 88 MB
de binarios, PostgreSQL 16 local, 3 repeticiones):

| Variante | Tiempo | RSS adicional |
|---|---|---|
| Antes (todas las columnas) | 698–947 ms | hasta +142 MB |
| Después (sin `file_docx`/`file_pdf`) | 16–29 ms | ~0 MB |

Endpoint completo `GET /v1/reports/documents` después del cambio: 0,13 s para 300 documentos.

Frontend: `EdilPage` y `GeneratorPage` ya no importan el chunk `docs` (1 053 KB, 368 KB
gzip) cuando hay conexión; se comprobó en las importaciones del build
(`documentService-*.js` ya no referencia `docs-*.js`). No se midió el tiempo de carga en
un navegador real.

## 5. Pruebas y verificaciones ejecutadas (resultado final)

| Verificación | Resultado |
|---|---|
| `npm ci` backend y frontend | OK |
| `npm ci --omit=dev --ignore-scripts` (igual que el Dockerfile de Render) | OK, y carga de módulos de producción OK |
| Migraciones: `db:migrate` → `db:migrate:undo:all` → `db:migrate` + `db:seed:all` | OK (las 25 son reversibles) |
| Tests backend | **34/34 suites, 404/404 tests** (antes 19 suites, 193 tests). 16 tests nuevos en `securityHardening.test.js`: sin las correcciones fallaban 11 de los 14 primeros; los 2 últimos prueban la función nueva `addDocumentsToZip` |
| Tests frontend | 11/11 suites, 110/110 tests |
| Lint backend / frontend | 0 errores (frontend: 14 avisos, ver B5) |
| Build de producción del frontend | OK |
| Prueba de humo, servidor en `NODE_ENV=production` con claves RSA | `/health` 200; `/metrics` 404; login con cookies y CSRF; listado de documentos; Excel 200; backup admin 200 con 600 archivos; config inválida → 400; `open-folder` → 501 y el proceso sigue vivo |

No verificado: el flujo real con Google Drive (sin credenciales), Ollama, el receptor
local, Word COM, LibreOffice dentro del contenedor de Render, ni el despliegue en
Vercel/Render/Supabase. No se desplegó nada.

## 6. Archivos

- **Nuevos**: `backend/src/validations/backup.js`, `backend/src/__tests__/securityHardening.test.js`, `.github/workflows/ci.yml`, este informe.
- **Modificados (código)**: `backend/src/middleware/{authenticate,errorHandler,sanitize}.js`, `backend/src/app.js`, `backend/src/routes/{backup,chat}.js`, `backend/src/services/{driveBackupService,documentGeneratorService,documentService,syncService,wordConverter}.js`, `backend/src/controllers/{adminController,reportsController,notificationsController,twoFAController}.js`, `backend/seeders/20260101000001-admin-user.js`, `frontend/src/services/documentService.js`, `frontend/src/pages/GeneratorPage.jsx`, `frontend/src/components/forms/DynamicForm.jsx`, `frontend/src/components/ui/ChatWidget.jsx`, `frontend/src/hooks/useAsync.js`.
- **Modificados (config/docs)**: ambos `package-lock.json`, `.eslintrc.cjs` de backend y frontend, `backend/vitest.config.js`, `package.json` (raíz), `backend/.env.example`, `deploy/render/.env.example`, `README.md`, `CHANGELOG.md`, dos tests existentes (solo variables sin uso).
- **Movidos o eliminados**: ninguno.

## 7. Al desplegar este cambio

1. Nada obligatorio en las variables de entorno. Opcional: `METRICS_TOKEN` si se raspa `/metrics`.
2. Los backups locales antiguos (`backup_jal_<fecha>.zip`, sin JAL) dejan de verse en el panel; siguen en `data/backups/`.
3. Las sesiones 2FA en curso no cambian: el `tempToken` sigue funcionando en `/auth/2fa/validate`.
4. Revisar Drive (C1).

## 8. Recomendaciones para la siguiente iteración

1. Verificar M11 (`trust proxy`) con las cabeceras reales de producción; si se confirma, el límite de login es compartido por todos los usuarios.
2. Sustituir `docxtemplater-image-module-free` para eliminar `xmldom` (M9).
3. Plan de migración a `uuid` 11+ y React Router 7 (M10).
4. Un único constructor de zip de backup: `adminController.backup` y `driveBackupService.buildBackupBuffer` todavía duplican la parte de plantillas.
5. Activar el job de CI como check obligatorio en `main`.
