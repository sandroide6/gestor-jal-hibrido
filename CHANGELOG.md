# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Sin publicar] — 2026-10-26

### Agregado
- **Pantalla de Inicio por tareas** (`/inicio`, destino tras iniciar sesión para todos los roles): un botón por tipo de documento, aviso si falta registrar la firma, acceso a revisión para edil/administrador y **Mis documentos recientes** con descarga PDF/Word (la auxiliar no tenía forma de volver a encontrar lo que creó; usa `GET /documents/my`, que ya existía)
- **Revisión antes de emitir**: resumen de los datos con «Sí, crear el documento» / «Corregir datos» antes de asignar el radicado

### Cambiado
- Generador: un clic en el tipo abre el formulario (sin «Continuar»), la fecha de expedición se precarga con hoy, la selección de edil pasa al formulario, foco al primer campo con error, mensajes que dicen qué pasó y que los datos siguen ahí, y al terminar se indica dónde quedó guardado
- Legibilidad: botones y campos de 44 px y texto de 16 px, etiquetas de menú comprensibles («Crear documento», «Buscar documentos», «Copias de seguridad»), barra lateral sin textos cortados
- La subida de firma en Mi perfil se puede usar con teclado

### Corregido
- **El Certificado de Residencia salía con «La ciudadana undefined, identificada con undefined»**: la plantilla usa `{Nombre}` y `{tipodeidentificacion}` y el tipo sembrado no los pedía. Ahora las etiquetas se emparejan sin distinguir mayúsculas ni tildes, y si una plantilla pide un dato que ningún campo llena, el documento no se emite (422) y el mensaje dice qué campo agregar
- Icono roto de «Generar documento» en el menú

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
