# Matriz de trazabilidad

> **Provisional**, por la misma razón que la [Matriz de requisitos](MATRIZ_REQUISITOS.md): no hay línea base de requisitos aprobada. Cada fila une un requisito con el código que lo implementa, la prueba que lo cubre y la evidencia registrada. Las rutas de código son relativas a la raíz del repositorio.

Abreviaturas de prueba: **U** prueba unitaria o de integración automatizada (`backend/tests`, `frontend/src/**/__tests__`) · **H** prueba de humo en modo producción, caso `Sxx` en [prueba-humo-produccion.txt](../11_CALIDAD/evidencias/2026-10-29/prueba-humo-produccion.txt) · **V** validación visual o de accesibilidad del PR #10 ([docs/design/11](../design/11-validacion-visual-y-funcional.md)) · **R** prueba de respaldo y restauración ([respaldo-restauracion.txt](../11_CALIDAD/evidencias/2026-10-29/respaldo-restauracion.txt)).

| Requisito | Módulo | Código principal | Prueba | Evidencia | Estado |
|---|---|---|---|---|---|
| RF-01 Inicio de sesión | Autenticación | `backend/src/routes/auth.js`, `services/authService.js`, `frontend/src/pages/LoginPage.jsx` | U `authRoutes`, `authService`, `LoginPage`; H S05–S06 | humo | Verificado |
| RF-02 Bloqueo por intentos | Autenticación | `services/authService.js` | U `authService` | backend-tests | Verificado |
| RF-03 TOTP | Autenticación | `controllers/twoFAController.js`, `services/totpService.js` | U `twoFAController`, `totpService` | backend-tests | Implementado, sin verificar con app real |
| RF-04 Cerrar sesiones | Autenticación | `controllers/authController.js` (`tokens_invalid_before`) | U `authCookies` | backend-tests | Implementado |
| RF-05 Aceptación de política | Autenticación | `POST /v1/auth/consent`, `frontend/src/pages/HabeasDataPage.jsx` | H S08 | humo | Verificado (solo frontend la exige) |
| RF-06 Usuarios | Usuarios | `routes/users.js`, `services/usersService.js`, `pages/UsersPage.jsx` | U `usersRoutes`, `usersService`; H S09–S10, S18, S26 | humo | Verificado (crear) |
| RF-07 Roles | Permisos | `middleware/authorize.js`, `frontend/src/components/ui/RoleGuard.jsx` | U `authorize`, `RoleGuard`; H S18–S21, S26 | humo | Verificado |
| RF-08 Tipos de documento | Plantillas | `routes/docTypes.js`, `services/docTypesService.js`, `pages/DocTypesPage.jsx` | U `docTypesRoutes`, `docTypesService`; H S12 | humo | Implementado; listar verificado |
| RF-09 Tipos de campo | Plantillas | `services/documentGeneratorService.js` | U `templateVars`, `documentGenerator` | backend-tests | Implementado |
| RF-10 Word y PDF | Documentos | `services/documentGeneratorService.js`, `services/libreOfficeConverter.js`, `services/wordConverter.js` | U `documentGenerator`, `wordConverter`; H S13–S15 | humo + PDF revisado | Verificado |
| RF-11 Firma | Documentos / Perfil | `routes/users.js` (`/me/firma`), generador con módulo de imagen | H S11, S13 | humo | Verificado |
| RF-12 Emitir a nombre de edil | Documentos | `controllers/documentController.js` (`edil_id`), `GET /v1/users/:id/firma` | U `documentController` | backend-tests | Implementado |
| RF-13 Radicado | Documentos | `services/radicadoService.js`, migraciones 23–24 | U `radicadoService`; H S13 | humo | Verificado en una JAL |
| RF-14 Persona ya atendida | Documentos | `GET /v1/documents/person` | H S16, S32 | humo | Verificado |
| RF-15 Mis documentos | Documentos | `GET /v1/documents/my`, `pages/HomePage.jsx` | H S22 | humo | Verificado |
| RF-16 Panel de la JAL | Documentos | `GET /v1/documents`, `pages/EdilPage.jsx` | H S19, S24 | humo | Verificado |
| RF-17 Revisión | Documentos | `PATCH /v1/documents/:id/review` | H S25 | humo | Verificado |
| RF-18 Eliminar | Documentos | `DELETE /v1/documents/:id`, migración 16 (paranoid) | U `documentService`; H S20 | humo | Verificado |
| RF-19 Reportes | Reportes | `routes/reports.js`, `controllers/reportsController.js`, `pages/ReportsPage.jsx` | U `reportsController`; H S37 | humo | Verificado |
| RF-20 Auditoría | Auditoría | `services/auditService.js`, `GET /v1/admin/audit-logs`, `pages/AuditLogsPage.jsx` | U `auditService`; H S21, S33, S35 | humo | Verificado |
| RF-21 Notificaciones | Notificaciones | `routes/notifications.js`, `services/notificationService.js` | U `notificationService`, `notificationsController` | backend-tests | Implementado |
| RF-22 Configuración JAL | Configuración | `controllers/jalConfigController.js`, `pages/JalConfigPage.jsx` | U `jalConfigController` | backend-tests | Implementado |
| RF-23 Sin conexión | Sincronización | `routes/sync.js`, `services/syncService.js`, `frontend/src/hooks/useSyncManager.js`, `services/clientDocumentGenerator.js` | U `syncService`, `syncController`, `syncStore`, `useSyncManager` | backend/frontend-tests | Implementado, sin prueba en navegador sin red |
| RF-24 Ayuda y chat | Ayuda | `pages/HelpPage.jsx`, `routes/chat.js` | U `HelpPage`, `chatContext` | frontend/backend-tests | Ayuda implementada; chat bloqueado |
| RF-25 a RF-27 | — | No existe | — | — | Pendiente |
| RNF-01 Responsive | Interfaz | `frontend/src/**` (rediseño v2) | V 14 pantallas × 3 anchos | design/11 | Verificado en Chromium |
| RNF-04 Mantenibilidad | CI | `.github/workflows/` | Lint, pruebas, build | lint, tests, build | Implementado |
| RS-02/RS-08 Claves | Configuración | `backend/src/config/env.js` (`validateEnv`), `deploy/generar-claves.js` | H arranque en producción | humo | Verificado |
| RS-03 CSRF | Seguridad | `middleware/authenticate.js` | U `authCookies`; H S07 | humo | Verificado |
| RS-05 Encabezados | Seguridad | `backend/src/app.js` (helmet) | U `securityHardening`, `cors` | backend-tests | Implementado |
| RS-06 Validación | Seguridad | `middleware/validate.js`, `backend/src/validations/` | U `fileValidation` | backend-tests | Verificado |
| RS-07 Aislamiento por JAL | Multi-JAL | filtros `jal_id` en controladores y servicios | U `multiJal`; H S27–S34 | humo | Verificado |
| RS-09 API docs y métricas | Seguridad | `backend/src/app.js` | H S02, S04 | humo (nota S04) | Verificado |
| RS-10 Cifrado tokens Drive | Respaldo | `backend/src/utils/crypto.js`, `services/driveBackupService.js` | U `crypto`, `driveBackupService` | backend-tests | Implementado |
| RA-01 Accesibilidad | Interfaz | `frontend/src/**`, `docs/design/07` | V axe-core 14 pantallas | design/07 | Parcial |
| RD-01 Archivos en BD | Datos | migración 25 (`file_docx`, `file_pdf`) | H S14–S15 | humo | Verificado |
| RD-02 Exportación | Respaldo | `GET /v1/admin/backup`, `GET /v1/admin/export` | U `adminController`; H S36 | humo | Verificado |
| RR-01/RR-02 Respaldo y restauración | Operación | `scripts/backup.py`, `scripts/restore.py` | R escenarios A–D | respaldo-restauracion | Verificado tras corrección |
| RR-03 Copia en Drive | Respaldo | `routes/backup.js`, `services/driveBackupService.js` | U `backupRoutes`, `driveBackupService` | backend-tests | Bloqueado en producción |
| Migraciones reversibles | Datos | `backend/migrations/` (26) | Subir, bajar y volver a subir | migraciones | Verificado |

Requisitos sin código ni prueba: RF-25, RF-26, RF-27, RNF-03, RNF-05, RS-11, RS-12, RA-02, RA-04, RD-03, RP-01 a RP-04, RR-04, RM-04, RL-01, RL-02, RL-04, RL-06. Todos figuran en [Pendientes de entrega](../12_ENTREGA/PENDIENTES_DE_ENTREGA.md).
