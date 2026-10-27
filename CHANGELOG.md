# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Sin publicar] — 2026-10-27

### Seguridad
- Backend sin vulnerabilidades en producción (`npm audit --omit=dev`): `xmldom` del módulo de imágenes reemplazado por `@xmldom/xmldom` 0.8 vía `overrides` y `uuid` 11 (también para sequelize y exceljs)
- Frontend: React Router 7 (`react-router-dom@7.18`), sin vulnerabilidades en producción

### Corregido
- Los backups (descarga del admin y Drive) incluyen las plantillas subidas desde el panel, que solo están en la BD. El armado de tipos y plantillas queda en un único `addDocTypesToZip`

### Agregado
- **Buscar a la persona por cédula**: al escribir un número ya atendido en la JAL, el formulario ofrece «Usar sus datos» y llena nombre, tipo y lugar de expedición del documento (solo campos vacíos). `GET /v1/documents/person?cedula=`, limitado a la JAL del usuario, solo datos de identidad y con registro en auditoría (`document.person_lookup`)

### Cambiado
- Las fechas del formulario salen en formato largo en el documento («26 de octubre de 2026»), también en la generación sin conexión. En la BD se siguen guardando como AAAA-MM-DD
- `trust proxy` configurable con `TRUST_PROXY_HOPS` (por defecto 1) y el log de peticiones en producción incluye la IP del cliente, para verificar el límite de intentos de login detrás de Vercel → Render

## [Sin publicar] — 2026-10-26

### Seguridad
- `authenticate` solo acepta access tokens: el token temporal `2fa_pending` y el refresh token ya no sirven como sesión (permitían operar sin el segundo factor)
- Backups locales aislados por JAL (nombre `backup_jal_<jal_id>_...`): un admin ya no puede listar ni descargar los de otra JAL
- `GET /metrics` responde 404 en producción salvo `Authorization: Bearer $METRICS_TOKEN`
- Los 5xx en producción ya no devuelven el mensaje interno del error
- Dependencias vulnerables actualizadas dentro de su rango semver (proxy-addr, body-parser, qs, joi, @xmldom/xmldom, nanoid, react-router…)

### Agregado
- **Pantalla de Inicio por tareas** (`/inicio`, destino tras iniciar sesión para todos los roles): un botón por tipo de documento, aviso si falta registrar la firma, acceso a revisión para edil/administrador y **Mis documentos recientes** con descarga PDF/Word (la auxiliar no tenía forma de volver a encontrar lo que creó; usa `GET /documents/my`, que ya existía)
- **Revisión antes de emitir**: resumen de los datos con «Sí, crear el documento» / «Corregir datos» antes de asignar el radicado
- Workflow de CI (`.github/workflows/ci.yml`): lint, migraciones, tests y build
- `ADMIN_INITIAL_PASSWORD` para el seeder del administrador

### Cambiado
- Generador: un clic en el tipo abre el formulario (sin «Continuar»), la fecha de expedición se precarga con hoy, la selección de edil pasa al formulario, foco al primer campo con error, mensajes que dicen qué pasó y que los datos siguen ahí, y al terminar se indica dónde quedó guardado
- Legibilidad: botones y campos de 44 px y texto de 16 px, etiquetas de menú comprensibles («Crear documento», «Buscar documentos», «Copias de seguridad»), barra lateral sin textos cortados
- La subida de firma en Mi perfil se puede usar con teclado

### Corregido
- **El Certificado de Residencia salía con «La ciudadana undefined, identificada con undefined»**: la plantilla usa `{Nombre}` y `{tipodeidentificacion}` y el tipo sembrado no los pedía. Ahora las etiquetas se emparejan sin distinguir mayúsculas ni tildes, y si una plantilla pide un dato que ningún campo llena, el documento no se emite (422) y el mensaje dice qué campo agregar
- Icono roto de «Generar documento» en el menú
- El aviso al administrador de «variables en la plantilla sin campo definido» nunca salía: buscaba `{{variable}}` y las plantillas usan `{variable}`. Ahora detecta las reales y empareja igual que al generar (sin distinguir mayúsculas ni tildes)
- La retención de backups en Drive podía borrar permanentemente la carpeta "Documentos generados" (ahora solo cuenta los zips de backup)
- `PUT /v1/backup/drive/config` valida sus campos; un `retention_count` negativo borraba todos los backups
- `POST /v1/backup/drive/open-folder` responde 501 fuera de Windows en vez de tumbar el proceso
- Backups y exportación incluyen los archivos desde la copia en BD cuando no están en disco (Render)
- 14 suites de tests del backend no cargaban por falta de `DATABASE_URL`; lockfiles desincronizados hacían fallar `npm ci`
- Lint de backend y frontend sin errores

### Rendimiento
- Exportación Excel de documentos sin cargar las columnas BYTEA (300 documentos: ~700 ms → ~25 ms)

---

## [2.0.0] — 2026-05-14

### Agregado
- **API v2 con prefijo `/v1/`** — todas las rutas REST bajo `/api/v1/`
- **Autenticación JWT RS256** — claves asimétricas en producción, fallback HS256 en desarrollo
- **Refresh token rotation** — nuevo refresh token emitido en cada renovación de sesión
- **Rate limiting específico** — `/auth/login` 10 req/15 min; `/auth/refresh` 30 req/15 min; `/2fa/validate` 5 req/5 min
- **Error codes estructurados** — campo `code` en todas las respuestas de error (`AUTH_INVALID_CREDENTIALS`, `FORBIDDEN`, etc.)
- **Paginación** en `GET /v1/users` y `GET /v1/documents` — parámetros `page`/`limit`, respuesta `{ data, total, page, pages }`
- **Swagger/OpenAPI 3.0** — anotaciones en rutas `auth`, `users`, `documents`, `docTypes`; UI disponible en `/docs`
- **Sistema de toasts** — `toastStore` (Zustand) + `ToastContainer`; eliminados `useState` de success/error en páginas
- **Skeletons de carga** — componentes `SkeletonCard`, `SkeletonTable`, `SkeletonText` en todas las vistas con estado loading
- **`formatDateTime` / `formatDateLong`** — nuevas utilidades de formato de fecha en `utils/format.js`
- **Tests de integración de rutas** — `authRoutes.test.js` (PT-11) y `docTypesRoutes.test.js` (PT-12)
- **Tests de hooks frontend** — `useAsync` (PT-13), `RoleGuard` (PT-14), `useDocTypes/useUsers/useAdminStats` (PT-15)
- **CI/CD con GitHub Actions** — pipeline `.github/workflows/ci.yml` con PostgreSQL de servicio, migraciones y cobertura
- **`ecosystem.config.js`** — arranque reproducible con PM2 para producción y desarrollo
- **`src/app.js`** separado de `src/index.js` — Express app configurable sin arrancar servidor (necesario para tests)
- **`utils/request.js`** — helper `getIp` centralizado (eliminada duplicación en 9 controladores)

### Cambiado
- **`GET /v1/users`** — ahora requiere rol `administrador` (seguridad corregida)
- **`errorHandler`** usa `logger.error` para 5xx y `logger.warn` para 4xx
- **`useUsers` hook** extrae automáticamente `.data` del shape paginado; acepta `params` opcionales
- **`api.js` cliente** soporta parámetro `params` (query string) en todas las peticiones GET
- **`JalConfigPage`, `ReportsPage`, `UsersPage`** migrados de `useState` error/success a toasts

### Seguridad
- Tokens expirados y revocados devuelven `code: AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_REVOKED`
- Credenciales incorrectas devuelven `code: AUTH_INVALID_CREDENTIALS` (misma respuesta para usuario no encontrado y contraseña incorrecta — evita enumeración de usuarios)
- `GET /v1/users` protegido con `authorize('administrador')`

---

## [1.x.x] — Historia previa

Sistema inicial con rutas sin versión, autenticación básica y generación de documentos DOCX.
