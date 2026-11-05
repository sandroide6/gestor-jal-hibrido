# API del backend

Base: `/v1`. Formato JSON salvo descargas. Autenticación por cookies httpOnly; toda petición que modifica datos requiere la cabecera `X-CSRF-Token` con el valor de la cookie `csrf_token`. Fuente: `backend/src/app.js` y `backend/src/routes/*.js`. En desarrollo la especificación interactiva está en `/api-docs` (Swagger, no se sirve en producción).

**Roles:** Ad = administrador · Ed = edil · Au = auxiliar · Todos = cualquier usuario autenticado · Público = sin sesión. Todas las consultas se limitan a la JAL del usuario.

## Salud y métricas
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/health`, `/v1/health` | Público | Estado del servicio y la base de datos |
| GET | `/metrics` | `METRICS_TOKEN` en producción | Métricas Prometheus (404 sin token) |

## Autenticación `/v1/auth`
| Método | Ruta | Acceso | Límite | Descripción |
|---|---|---|---|---|
| POST | `/login` | Público | 10 / 15 min | Inicia sesión |
| POST | `/refresh` | Cookie de refresco | 30 / 15 min | Renueva el token |
| POST | `/2fa/validate` | Público (paso de login) | 5 / 5 min | Valida el código TOTP |
| POST | `/logout` | Todos | | Cierra la sesión |
| POST | `/logout-all` | Todos | | Invalida todas las sesiones del usuario |
| POST | `/consent` | Todos | | Registra aceptación de la política |
| PATCH | `/change-password` | Todos | | Cambia la contraseña e invalida sesiones |
| POST | `/2fa/setup` | Todos | | Genera el secreto y el QR |
| POST | `/2fa/enable`, `/2fa/disable` | Todos | 5 / 5 min | Activa o desactiva TOTP |

## Documentos `/v1/documents`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/my` | Todos | Documentos creados por el usuario |
| GET | `/person?…` | Todos | Datos de una persona ya atendida en la JAL |
| POST | `/` | Todos | Genera un documento (multipart, firma opcional) |
| GET | `/` | Ed, Ad | Todos los documentos de la JAL con filtros |
| GET | `/pending-review-count` | Ed, Ad | Pendientes de revisión |
| GET | `/:id` | Ed, Ad | Detalle |
| GET | `/:id/download` | Todos (el controlador limita al dueño o a Ed/Ad; humo S23 respondió 404 a un auxiliar ajeno) | Descarga Word o PDF |
| PATCH | `/:id/review` | Ed, Ad | Marca revisado |
| DELETE | `/:id` | Ad | Borrado lógico |

## Tipos de documento `/v1/doc-types`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/`, `/:id`, `/:id/template` | Todos | Lista, detalle y plantilla |
| POST | `/` | Ad | Crea (multipart con plantilla) |
| PATCH | `/:id` | Ad | Edita |

## Usuarios `/v1/users`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET, PATCH | `/me` | Todos | Perfil propio |
| POST, GET, DELETE | `/me/firma` | Todos | Firma propia |
| GET | `/ediles` | Todos | Ediles activos de la JAL |
| GET | `/:id/firma` | Au, Ad | Firma de un edil de la misma JAL |
| GET | `/` | Ad | Lista de usuarios |
| POST | `/` | Ad | Crea usuario |
| PATCH | `/:id` | Ad | Edita |
| DELETE | `/:id` | Ad | Desactiva |
| DELETE | `/:id/permanent` | Ad | Borra definitivamente |

## Reportes, administración y sincronización
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/v1/reports/stats` | Ed, Ad | Cifras |
| GET | `/v1/reports/documents` | Ed, Ad | Exportación Excel |
| GET | `/v1/admin/stats` | Ed, Ad | Resumen del tablero |
| GET | `/v1/admin/audit-logs` | Ed, Ad | Auditoría con filtros |
| GET | `/v1/admin/backup` | Ad | Zip con la copia completa de la JAL |
| GET | `/v1/admin/export` | Ad | Exportación de datos |
| GET | `/v1/admin/jal-config` | Ed, Ad | Configuración de la JAL |
| PATCH | `/v1/admin/jal-config` | Ad | Cambia la configuración |
| POST | `/v1/sync/batch` | Todos | Recibe operaciones hechas sin conexión |
| GET | `/v1/sync/status` | Todos | Estado de sincronización |
| GET | `/v1/notifications` | Todos | Notificaciones propias |
| GET | `/v1/notifications/unread-count` | Todos | No leídas |
| PATCH | `/v1/notifications/read-all`, `/:id/read` | Todos | Marcar leídas |
| DELETE | `/v1/notifications/:id` | Todos | Borrar |
| POST | `/v1/chat` | Todos, 30 / min | Chat con Ollama (opcional) |

## Copias en Google Drive `/v1/backup/drive`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/callback` | Público (retorno OAuth de Google, con `state`) | Guarda los tokens cifrados |
| GET, PUT | `/config` | Ad | Configuración de la copia automática |
| GET | `/auth-url` | Ad | Enlace de autorización de Google |
| DELETE | `/disconnect` | Ad | Desconecta Drive |
| POST | `/run` | Ad | Ejecuta una copia ahora |
| GET | `/logs` | Ad | Historial |
| GET | `/local-files`, `/local-files/:filename` | Ad | Copias guardadas en el servidor |
| POST | `/open-folder` | Ad | Abre la carpeta (solo Windows; en otros sistemas 501) |

## Códigos de respuesta habituales
`200/201` éxito · `400` validación · `401` sin sesión o token inválido · `403` sin permiso o CSRF ausente · `404` no existe o pertenece a otra JAL · `409` conflicto · `429` límite de peticiones · `500` error interno (sin detalle en producción).
