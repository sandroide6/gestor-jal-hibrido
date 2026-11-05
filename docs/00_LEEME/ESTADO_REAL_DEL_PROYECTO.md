# Estado real del proyecto (auditoría del 29 al 31 de octubre de 2026)

Revisión hecha sobre el repositorio `sandroide6/gestor-jal-hibrido`, rama `main` en el commit `91a14ac` (fusión de la PR #10, rediseño), más los documentos del contrato que están en el Google Drive del responsable. Las pruebas se ejecutaron el 29-10-2026 en un contenedor Linux con Node 22.22.0, PostgreSQL 16.15 y LibreOffice. Las evidencias están en [`docs/11_CALIDAD/evidencias/2026-10-29/`](../11_CALIDAD/evidencias/2026-10-29/).

**No se tuvo acceso a la instalación de producción** (Vercel, Render, Supabase): la red del entorno de revisión bloquea esos dominios (`CONNECT tunnel failed, response 403`). Todo lo que se dice sobre producción viene de documentos, no de una comprobación.

## 1. Evaluación general

| Pregunta | Respuesta corta |
|---|---|
| ¿El aplicativo funciona? | Sí, en un entorno controlado. El flujo principal (iniciar sesión, crear un Certificado de Residencia con radicado, descargar PDF y Word, revisar, auditar, respaldar) se comprobó de punta a punta en modo producción con datos ficticios: 38 de 39 comprobaciones pasaron y la restante era un error del criterio de la prueba, no del sistema. |
| ¿Está desplegado en producción? | Según `docs/DESPLIEGUE_HIBRIDO.md` se desplegó el 21-08-2026 en Vercel + Render + Supabase. **No se pudo verificar en esta revisión.** El rediseño de la PR #10 (29-10-2026) **no está publicado**: el despliegue en Vercel está detenido por un cambio de cuenta en el equipo del responsable [Suministrado]. |
| ¿Está listo para entregar a la Subsecretaría? | **Técnicamente es defendible como versión funcional**, con pruebas automáticas en verde. **No está listo para declararlo terminado**: faltan decisiones de titularidad y licencia, el tratamiento de datos de los ciudadanos, el traspaso de cuentas, una prueba con usuarios reales y el despliegue del rediseño. |
| ¿Sirve para otras JAL? | La base de datos separa todo por JAL y la prueba de aislamiento pasó (8 de 8 comprobaciones), pero **no existe una forma de dar de alta otra JAL desde la aplicación**. Hoy la vía realista es una instalación independiente por JAL (Modelo A). Ver [Estrategia multi-JAL](../08_REPLICACION/ESTRATEGIA_MULTIJAL.md). |

## 2. Lo que realmente está construido

| Capa | Tecnología verificada en el código | Fuente |
|---|---|---|
| Frontend | React 18.3, Vite 5.4, Tailwind 3.4, React Router 7.18, Zustand 4.5, react-hook-form, Recharts 3, PWA con `vite-plugin-pwa` (Workbox) e IndexedDB (`idb`) | `frontend/package.json` |
| Generación en el navegador (sin conexión) | docxtemplater + pizzip + docx + pdf-lib, cargados solo cuando hace falta | `frontend/src/services/clientDocumentGenerator.js` |
| Backend | Node.js ≥ 20 (probado en 22), Express 4.22, Sequelize 6.37, Joi, helmet, express-rate-limit, multer, JWT (RS256 en producción) | `backend/package.json`, `backend/src/app.js` |
| Generación de documentos en el servidor | docxtemplater + módulo de imágenes (firma), conversión a PDF con LibreOffice (Linux) o Word COM (Windows) | `backend/src/services/documentGeneratorService.js`, `libreOfficeConverter.js`, `wordConverter.js` |
| Base de datos | PostgreSQL (16 en pruebas, 18 en Docker, Supabase en la nube), 26 migraciones reversibles, RLS activado | `backend/migrations/` |
| Integraciones opcionales | Google Drive (OAuth, copias y copia de cada documento), Ollama (chat IA) a través de Tailscale, receptor local de documentos, ngrok | `driveBackupService.js`, `routes/chat.js`, `localDocSyncService.js`, `scripts/` |
| Scripts de operación | Python 3.10+ (`gestor.py`, `scripts/*.py`) y `.bat` para Windows | raíz y `scripts/` |
| Despliegues previstos | (1) Nube: Vercel + Render (Docker) + Supabase; (2) Docker Compose con nginx; (3) Windows local con `.bat` y ngrok | `render.yaml`, `frontend/vercel.json`, `deploy/` |
| Pruebas | Vitest + Supertest (backend, 35 archivos), Vitest + Testing Library (frontend, 13 archivos) | `backend/src/__tests__`, `frontend/src/__tests__` |
| Integración continua | GitHub Actions: lint, migraciones, pruebas y build en cada PR | `.github/workflows/ci.yml` |

La arquitectura que describe la propuesta de "Memoria institucional con IA" (SQLite, Windows 7, asistente sobre actas) **no corresponde a este repositorio**: es otro proyecto, en otra fase, con otro repositorio. El Gestor JAL usa PostgreSQL e IndexedDB, no SQLite.

## 3. Estado por área

| Área | Estado | Evidencia y comentario |
|---|---|---|
| Inicio de sesión, bloqueo por intentos, sesión con cookies httpOnly y CSRF | **Verificado** | Humo S05–S08; pruebas `authRoutes`, `authService`, `authCookies`, `securityHardening`. Bloqueo de 15 min tras 10 intentos fallidos (`authService.js`) |
| Verificación en dos pasos (TOTP) | Implementado, verificado solo con pruebas unitarias | `twoFAController.test.js`, `totpService.test.js`. No se probó con una app de autenticación real |
| Roles y permisos (administrador, edil, auxiliar) | **Verificado** | Humo S18–S21 y S26 (403 correctos); `authorize.test.js`, `RoleGuard.test.jsx` |
| Gestión de usuarios | **Verificado** (crear) / Implementado (editar, desactivar, borrar) | Humo S09–S10; `usersRoutes.test.js` |
| Tipos de documento y plantillas | **Verificado** (listar); Implementado (crear/editar/subir plantilla) | Humo S12; `docTypesRoutes.test.js`, `templateVars.test.js` |
| Generación DOCX + PDF con firma y radicado | **Verificado** | Humo S11–S15: radicado `2026-JAL-SAL-000001`, PDF de 180 KB generado con LibreOffice y revisado visualmente |
| Radicado consecutivo sin duplicados | Implementado y probado con unitarias | `radicadoService.test.js`, índice único `idx_documents_numero_radicado_unique`. Ese índice es global: dos JAL con el mismo código de dependencia chocan (ver fila de aislamiento) |
| Búsqueda de persona por cédula | **Verificado** | Humo S16 y aislamiento S32 |
| Revisión por edil | **Verificado** | Humo S24–S25 |
| Reportes y Excel | **Verificado** (Excel) | Humo S37; `reportsController.test.js` |
| Auditoría | **Verificado** | Humo S21, S33, S35; `auditService.test.js` |
| Notificaciones internas | Implementado, sin verificar en humo | `notificationService.test.js` |
| Copia completa descargable (zip) | **Verificado** | Humo S36: zip con plantillas, usuarios, documentos y archivos |
| Copias automáticas a Google Drive | Implementado, **bloqueado** | Requiere credenciales de Google; según `PASOS_PENDIENTES_CON_TUS_CUENTAS.md` todavía no se conectó en producción |
| Respaldo y restauración por línea de comandos | **Verificado tras corrección** | La restauración decía "completada" sin restaurar los datos modificados. Corregido y probado en esta entrega. Ver [Respaldo y restauración](../07_OPERACION/RESPALDO_Y_RESTAURACION.md) |
| Restauración de los zip del panel o de Drive | **Pendiente** | No existe procedimiento ni herramienta para volver a cargar esos zip |
| Operación sin conexión (PWA) | Implementado, verificado solo con pruebas unitarias | `useSyncManager.test.js`, `syncStore.test.js`, `syncService.test.js`. No se probó en un navegador real sin red |
| Chat IA | Implementado, **bloqueado** | Depende de Ollama en un PC del responsable vía Tailscale. Envía al modelo nombres de beneficiarios recientes (ver seguridad) |
| Aislamiento entre JAL | **Verificado** en datos; **falla** el radicado con código repetido | Humo S27–S34 con una segunda JAL creada por SQL. El 31-10-2026 se reprodujo que dos JAL con el código de dependencia por defecto no pueden generar documentos: la segunda recibe un error 500 ([evidencia](../11_CALIDAD/evidencias/2026-10-31/colision-radicado-multijal.txt), MJ-02) |
| Alta de una nueva JAL | **Pendiente** | No hay pantalla ni endpoint; solo por SQL o seeder |
| Accesibilidad | Parcial | axe-core sin violaciones en 14 pantallas (PR #10). No hay prueba con lectores de pantalla ni con personas mayores |
| Tutoriales | Parcial | 12 videos sin voz ni subtítulos; muestran la interfaz **anterior** al rediseño |
| Instalación con Docker | **Corregido, sin verificar** | El `docker-compose.yml` no pasaba `ENCRYPTION_KEY` ni el par RSA y el backend no habría arrancado. Corregido; Docker no estaba disponible para probarlo |
| Despliegue en Render desde cero | **Corregido, sin verificar** | `render.yaml` no declaraba `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` (obligatorias). Corregido |
| Producción (Vercel/Render/Supabase) | **Bloqueado** | Sin acceso desde el entorno de revisión |
| CI | Implementado | El workflow existe; no se revisó su historial de ejecuciones |

## 4. Pruebas ejecutadas (resumen)

| Comprobación | Resultado |
|---|---|
| `npm ci` backend y frontend | OK |
| Lint backend / frontend | 0 errores (frontend: 10 avisos) |
| Migraciones: aplicar, revertir todas, aplicar, sembrar | OK (26 migraciones reversibles, 2 seeders) |
| Pruebas backend | **35/35 archivos, 418/418 pruebas** |
| Pruebas frontend | **13/13 archivos, 121/121 pruebas** |
| Build de producción del frontend | OK (aviso: bloque `docs` de 1 053 KB, solo para modo sin conexión) |
| `npm audit --omit=dev` | 0 vulnerabilidades en backend y frontend |
| `npm audit` con dependencias de desarrollo | backend 7 (4 altas), frontend 20 (8 altas): todas en herramientas de desarrollo (vite, vitest, esbuild, postcss…), no llegan al usuario |
| Prueba de humo en modo producción | 38/39 + 1 criterio corregido (ver informe) |
| Respaldo y restauración | Falla detectada y corregida; 4/4 escenarios pasan con la corrección |
| Colisión de radicados entre dos JAL (31-10-2026) | Falla con el código por defecto; pasa con códigos distintos |
| Arranque en producción sin claves (31-10-2026) | Se detiene, como se espera |
| Producción real, Google Drive, Ollama, Word COM, Docker, Windows, navegadores reales | **No ejecutado** (sin acceso o sin herramienta) |

Detalle: [Informe de pruebas](../11_CALIDAD/INFORME_DE_PRUEBAS.md).

## 5. Inconsistencias documentales encontradas

| # | Dónde | Qué dice | Qué muestra el código | Acción |
|---|---|---|---|---|
| D1 | `README.md` | "copias de seguridad cifradas en Google Drive" | Los zip no se cifran; solo se cifran los tokens OAuth de Drive (`ENCRYPTION_KEY`) | Corregido en esta entrega |
| D2 | Informe de obligaciones (Drive) | "respaldo remoto cifrado en Google Drive" | Igual que D1, y Drive no está conectado en producción según los pasos pendientes | Corregir en el próximo informe [Propuesta] |
| D3 | Informe de obligaciones | Evidencias en "carpeta `evidencia_informe/` del repositorio", "AUDIT.md", "`logs/backend.log` (registro de sesiones y consultas de soporte)" | No existe `evidencia_informe/` ni `AUDIT.md` en el repositorio (el informe se llama `docs/AUDITORIA_2026-10.md`); `logs/` es local y no se versiona | Corregir referencias antes de radicar [Propuesta] |
| D4 | Informe de obligaciones | "automatización de formulario para la liquidación y pago de honorarios de los ediles" | No está en este repositorio | Ubicar el artefacto o retirarlo de la evidencia del Gestor JAL |
| D5 | "Gestor JAL – Qué es y cómo funciona" (Drive) | "cada documento queda copiado en Google Drive automáticamente" | La copia a Drive solo ocurre si se conectó Drive; está pendiente | Matizar |
| D6 | `backend/.env.example` | Variables `VAPID_*` para notificaciones push | No hay código que use web push | Documentado como no implementado |
| D7 | `.env.example` (varios) | `JAL_NOMBRE`, `JAL_NOMBRE_CORTO` | El backend no las lee; el nombre sale de la tabla `jals` (pantalla Configuración JAL). El frontend usa `VITE_JAL_NOMBRE` | Documentado en [Instalación](../06_DESPLIEGUE/INSTALACION_Y_DESPLIEGUE.md) |
| D8 | `CHANGELOG.md` 2.0.0 | "CI/CD con GitHub Actions" | La auditoría de octubre encontró que el workflow no existía; se creó el 26-10-2026 | Histórico, sin acción |
| D9 | Contexto del contrato | Inicio el 06-08-2026 (contexto maestro) vs. período 10-08 al 20-12-2026 (informe de obligaciones) | — | Confirmar con el contrato firmado |
| D10 | `README.md` y política en pantalla | Copyright a nombre de una persona y "Decreto Reglamentario 1377 de 2013" | La titularidad no está resuelta (ver legal). El Decreto 1377 está compilado en el Decreto 1074 de 2015 | No se modificó el aviso de copyright (requiere decisión jurídica) |

## 6. Brechas priorizadas

| Prioridad | Brecha | Por qué importa | Responsable sugerido |
|---|---|---|---|
| 1 | Titularidad del software y licencia sin resolver | Sin esto no se puede entregar ni replicar en otras JAL con seguridad jurídica | Área jurídica de la Subsecretaría / I.U. Pascual Bravo y el desarrollador |
| 1 | Datos de ciudadanos sin aviso ni autorización documentada en el sistema; sin política institucional de tratamiento | Ley 1581 de 2012 | Responsable del tratamiento (por definir: Distrito o JAL) |
| 1 | Cuentas de servicio (GitHub, Vercel, Render, Supabase, Google) a nombre personal | Riesgo de pérdida de control al cambiar de contratista | Subsecretaría + desarrollador |
| 1 | Contraseña inicial del administrador en producción | Si no se cambió, es pública en el código | Administrador del sistema |
| 2 | Rediseño no desplegado; producción no verificada | Lo que se entrega no es lo que está publicado | Desarrollador |
| 2 | Sin restauración para los zip del panel/Drive; RPO/RTO sin aprobar | Una copia que no se puede restaurar no protege | Desarrollador + Subsecretaría |
| 2 | Prueba con usuarios reales de la JAL (incluidas personas mayores) no realizada | La facilidad de uso es el objetivo central | JAL + desarrollador |
| 2 | Tutoriales con la interfaz anterior, sin voz ni subtítulos | Capacitación desactualizada | Desarrollador |
| 3 | Alta de nuevas JAL solo por SQL; radicado único global que choca entre JAL con el mismo código | Bloquea el Modelo B | Desarrollador (si se aprueba) |
| 3 | `trust proxy` sin verificar en producción | El límite de intentos de login podría ser compartido por todos | Desarrollador |
| 3 | Plantillas con escudos oficiales y gráfica de los ODS | Uso de símbolos e imagen de terceros sin autorización documentada | JAL / jurídica |

La lista completa con criterios de cierre está en [Pendientes de entrega](../12_ENTREGA/PENDIENTES_DE_ENTREGA.md).

## 7. Mantenimiento y deuda técnica

- Código ordenado por capas (rutas → controladores → servicios → modelos) y con comentarios que explican el porqué; un desarrollador con experiencia en Node/React puede retomarlo.
- Deuda conocida: módulo de imágenes `docxtemplater-image-module-free` sin mantenimiento (se forzó `@xmldom/xmldom` 0.8 con `overrides`); bloque `docs` de 1 MB en el frontend; 10 avisos de lint; scripts Python sin pruebas; dos modos de despliegue (local y nube) con bases de datos que no se sincronizan entre sí; dependencia de un PC personal para el chat IA y el receptor local.
- Dependencia de una sola persona: todo el conocimiento operativo y las cuentas están con el desarrollador. Ver [Guía de transferencia técnica](../12_ENTREGA/GUIA_DE_TRANSFERENCIA_TECNICA.md).
