# Matriz de requisitos

> **Carácter provisional.** No se tuvo un documento de requisitos aprobado (estudios previos, anexo técnico o plan de trabajo firmado). Este catálogo se **reconstruyó** a partir del código, de las actas de acompañamiento de septiembre de 2026 y del encargo de esta entrega. Debe validarse con la JAL y con la supervisión antes de usarse como línea base contractual.

Fuentes: **[Código]** requisito inferido de lo implementado · **[Acta]** actas `AcC12_220926_*` (diagnóstico, diseño, mejoras, soporte) · **[Encargo]** solicitud de auditoría y entrega de octubre de 2026 · **[Norma]** obligación legal (ver [Matriz normativa](../10_LEGAL_Y_LICENCIAS/MATRIZ_NORMATIVA.md)).

Prioridad (MoSCoW): **M** debe · **S** debería · **C** podría · **W** no en esta fase.

Estados: ver la leyenda del [Índice](../00_LEEME/INDICE_GENERAL.md). La relación con código, pruebas y evidencias está en la [Matriz de trazabilidad](MATRIZ_TRAZABILIDAD.md).

## 1. Requisitos funcionales (RF)

| ID | Requisito | Fuente | Prio. | Criterio de aceptación | Estado |
|---|---|---|---|---|---|
| RF-01 | Iniciar sesión con correo y contraseña | [Código] [Acta] | M | Credenciales válidas abren sesión; inválidas responden error sin revelar cuál dato falló | Verificado |
| RF-02 | Bloquear la cuenta tras intentos fallidos | [Código] | M | 10 intentos fallidos bloquean 15 minutos | Verificado (unitarias y humo S05) |
| RF-03 | Verificación en dos pasos opcional (TOTP) | [Código] | S | Activar, validar y desactivar con código de 6 dígitos | Implementado, sin verificar con app real |
| RF-04 | Cerrar sesión y cerrar todas las sesiones | [Código] | M | Tras cerrar, el token deja de ser válido | Implementado, verificado con unitarias |
| RF-05 | Aceptación de la política de tratamiento por cada usuario interno | [Código] [Norma] | M | El usuario no entra a las pantallas hasta aceptar; queda la fecha | Verificado (S08). La exigencia está solo en el frontend |
| RF-06 | Gestionar usuarios: crear, editar, desactivar, borrar | [Código] | M | Solo el administrador; los demás reciben 403 | Verificado (crear, S09–S10, S18, S26); demás con unitarias |
| RF-07 | Tres roles: administrador, edil, auxiliar | [Código] [Acta] | M | Cada ruta aplica la matriz de permisos de [API](../03_ARQUITECTURA/API.md) | Verificado |
| RF-08 | Configurar tipos de documento con campos y plantilla Word | [Código] | M | El administrador crea un tipo con campos y plantilla `.docx`; aparece en Crear documento | Implementado; listar verificado (S12) |
| RF-09 | Diez tipos de campo (texto, área, fecha, hora, número, lista, casilla, lista de chequeo, duración, período) | [Código] | S | Cada tipo se valida y se reemplaza en la plantilla | Implementado, verificado con unitarias (`templateVars`) |
| RF-10 | Generar el documento en Word y PDF desde la plantilla | [Acta] [Código] | M | Se obtiene `.docx` y `.pdf` descargables con los datos digitados | Verificado (S13–S15) |
| RF-11 | Insertar la firma escaneada del edil o del usuario | [Acta] [Código] | M | La imagen de la firma aparece en el documento | Verificado (S11, revisión visual del PDF) |
| RF-12 | Emitir a nombre de un edil | [Código] | S | El auxiliar elige el edil; el documento queda asociado a él | Implementado, verificado con unitarias |
| RF-13 | Número de radicado consecutivo por JAL, año y tipo de trámite | [Acta] [Código] | M | Formato `AAAA-CÓDIGO-ENT/SAL/INT-000001`, sin huecos ni duplicados | Verificado en una JAL (S13). Ver brecha MJ-02 en [Estrategia multi-JAL](../08_REPLICACION/ESTRATEGIA_MULTIJAL.md) |
| RF-14 | Recuperar los datos de una persona ya atendida por su número de documento | [Código] | S | Al digitar la cédula se proponen nombre y tipo de documento | Verificado (S16) |
| RF-15 | Listar los documentos propios (auxiliar) | [Código] | M | El auxiliar ve solo los suyos | Verificado (S22) |
| RF-16 | Panel de documentos de la JAL con filtros (edil, administrador) | [Código] | M | Filtrar por fecha, tipo, persona; el auxiliar recibe 403 | Verificado (S19, S24) |
| RF-17 | Marcar un documento como revisado por el edil | [Código] | S | Queda la fecha y quién revisó | Verificado (S25) |
| RF-18 | Eliminar documentos (borrado lógico) solo el administrador | [Código] | M | El auxiliar recibe 403; el registro queda con `deleted_at` | Verificado (S20); borrado lógico con unitarias |
| RF-19 | Reportes con cifras y exportación a Excel | [Código] | S | Descarga de un `.xlsx` filtrado | Verificado (S37) |
| RF-20 | Registro de auditoría consultable | [Código] [Acta] | M | Cada acción relevante queda con usuario, fecha, IP y resultado | Verificado (S33, S35) |
| RF-21 | Notificaciones internas | [Código] | C | Contador de no leídas, marcar leídas, borrar | Implementado, verificado con unitarias |
| RF-22 | Configuración de la JAL (nombre, logo, código de dependencia, funciones) | [Código] | M | El administrador cambia los datos y se reflejan en los documentos | Implementado, verificado con unitarias |
| RF-23 | Trabajo sin conexión con sincronización posterior | [Acta] (decisión del 09-09-2026) [Código] | S | Sin red se genera el documento y se envía al volver la conexión | Implementado, verificado solo con unitarias |
| RF-24 | Ayuda dentro de la aplicación y asistente de chat | [Código] | C | Página Ayuda accesible para todos; chat opcional | Ayuda implementada; chat **bloqueado** (depende de un PC personal) |
| RF-25 | Alta de una nueva JAL desde la aplicación | [Encargo] | S | Un superadministrador crea una JAL con su administrador inicial | **Pendiente** |
| RF-26 | Restaurar una copia desde el panel | [Encargo] | S | El administrador carga un zip y recupera los datos | **Pendiente** |
| RF-27 | Rol de consulta para supervisión | [Encargo] | C | Ve reportes y auditoría sin modificar nada | **Pendiente** |

## 2. Requisitos no funcionales (RNF)

| ID | Requisito | Fuente | Prio. | Criterio de aceptación | Estado |
|---|---|---|---|---|---|
| RNF-01 | Funcionar en navegador de escritorio y celular | [Acta] [Código] | M | Sin desplazamiento horizontal a 390 px; flujo Crear completo en celular | Verificado en Chromium (PR #10); Safari y Firefox sin verificar |
| RNF-02 | Instalable como aplicación (PWA) | [Código] | C | El navegador ofrece instalar | Implementado, sin verificar en dispositivo real |
| RNF-03 | Tiempo de respuesta razonable con conexión de la sede | [Acta] (acta de mejoras de rendimiento) | S | Meta por definir (p. ej. generar un documento en menos de 10 s) | **Pendiente**: no hay meta aprobada ni medición en la sede |
| RNF-04 | Mantenibilidad: código por capas, pruebas automáticas, integración continua | [Código] | S | CI ejecuta lint, migraciones, pruebas y build | Implementado (539 pruebas pasan localmente) |
| RNF-05 | Disponibilidad del servicio en la nube | [Encargo] | S | Meta de disponibilidad acordada | **Pendiente**: sin meta; los planes gratuitos de Render se suspenden por inactividad [Supuesto: según el plan contratado] |

## 3. Seguridad (RS)

| ID | Requisito | Criterio de aceptación | Estado |
|---|---|---|---|
| RS-01 | Contraseñas con hash robusto | bcrypt con costo 12 | Verificado con unitarias |
| RS-02 | Tokens firmados con clave asimétrica en producción | RS256; el arranque falla sin las claves | Verificado (humo en producción y arranque sin claves, 31-10-2026) |
| RS-03 | Sesión en cookies httpOnly con protección CSRF | Petición sin `X-CSRF-Token` → 403 | Verificado (S06–S07) |
| RS-04 | Límite de peticiones por IP | Global, login, refresh, 2FA y chat | Implementado; detrás de proxy depende de `TRUST_PROXY_HOPS` (sin verificar en producción) |
| RS-05 | Encabezados de seguridad (CSP, HSTS) | helmet configurado | Implementado, verificado con `securityHardening.test.js` |
| RS-06 | Validación de entradas | Joi en todas las rutas que reciben datos; validación de tipo de archivo | Verificado con unitarias (`fileValidation`) |
| RS-07 | Separación de datos por JAL | Ningún usuario ve datos de otra JAL | Verificado (S27–S34, `multiJal.test.js`) |
| RS-08 | Secretos fuera del repositorio | `.env` ignorado; producción exige claves distintas a las de ejemplo | Verificado (`validateEnv`) |
| RS-09 | Ocultar documentación de API y métricas en producción | `/api-docs` no se sirve; `/metrics` → 404 sin token | Verificado (S02, S04 explicado) |
| RS-10 | Cifrado de credenciales de terceros | Tokens de Google Drive cifrados con `ENCRYPTION_KEY` | Implementado, verificado con unitarias (`crypto`) |
| RS-11 | Cifrado de las copias de seguridad | Zip cifrado o almacenado en destino cifrado | **Pendiente**: los zip no se cifran |
| RS-12 | Secreto TOTP protegido en reposo | Cifrado como los tokens de Drive | **Pendiente**: hoy se guarda en claro en `users.totp_secret` |

## 4. Accesibilidad y usabilidad (RA)

| ID | Requisito | Criterio de aceptación | Estado |
|---|---|---|---|
| RA-01 | Conformidad WCAG 2.2 nivel AA como meta | 0 violaciones automáticas y revisión manual | Parcial: axe-core 0 violaciones en 14 pantallas; sin revisión con lector de pantalla ni zoom 400 % |
| RA-02 | Uso por personas con poca experiencia digital y personas mayores | Prueba con al menos 5 usuarios reales de la JAL | **Pendiente**: no se ha hecho |
| RA-03 | Lenguaje claro en pantallas y mensajes | Revisión de textos | Parcial (rediseño v2) |
| RA-04 | Material de capacitación vigente y accesible | Videos con la interfaz actual, con voz o subtítulos | **Pendiente**: muestran la interfaz anterior, sin voz ni subtítulos |

## 5. Datos y protección de datos personales (RD, RP)

| ID | Requisito | Criterio de aceptación | Estado |
|---|---|---|---|
| RD-01 | Conservar Word y PDF de cada documento emitido | Archivos en la base de datos (BYTEA) y descargables | Verificado (S14–S15) |
| RD-02 | Exportar todos los datos de la JAL | Zip con usuarios, plantillas, documentos y archivos | Verificado (S36) |
| RD-03 | Tabla de retención documental | Plazos por tipo de documento aplicados | **Pendiente**: no hay TRD ni borrado por plazo |
| RP-01 | Informar a los ciudadanos sobre el tratamiento de sus datos | Aviso de privacidad entregado al recoger los datos | **Pendiente** (borrador en [Protección de datos](../09_SEGURIDAD_Y_PRIVACIDAD/PROTECCION_DE_DATOS.md)) |
| RP-02 | Responsable del tratamiento definido | Documento que lo designe | **Bloqueado**: decisión institucional |
| RP-03 | Atender consultas y reclamos de titulares | Procedimiento y canal publicados | **Pendiente** |
| RP-04 | Minimizar datos enviados a terceros | El chat IA no envía datos personales | **Pendiente**: el chat envía nombres de beneficiarios recientes |

## 6. Respaldo, mantenimiento y replicación (RR, RM)

| ID | Requisito | Criterio de aceptación | Estado |
|---|---|---|---|
| RR-01 | Copia de seguridad de la base de datos | Script genera un respaldo completo | Verificado (`scripts/backup.py`, ver evidencia) |
| RR-02 | Restauración probada | Datos vuelven al estado del respaldo; error visible si falla | Verificado tras corrección |
| RR-03 | Copia automática fuera del servidor | Copia programada en Google Drive u otro destino | Implementado, **bloqueado** (sin conectar en producción) |
| RR-04 | RPO y RTO aprobados | Valores acordados y probados | **Pendiente** (propuesta en [Respaldo](../07_OPERACION/RESPALDO_Y_RESTAURACION.md)) |
| RM-01 | Instalación reproducible | Guía permite instalar desde cero | Parcial: probada en local; Docker y Render sin probar desde cero |
| RM-02 | Actualización con vuelta atrás | Procedimiento documentado | Documentado; sin ensayo |
| RM-03 | Replicable en otra JAL | Procedimiento y prueba de aislamiento | Parcial: aislamiento verificado; alta de JAL solo por SQL |
| RM-04 | Cuentas de servicio institucionales | Repositorio y servicios a nombre de la entidad | **Pendiente** |

## 7. Requisitos legales (RL)

| ID | Requisito | Estado |
|---|---|---|
| RL-01 | Titularidad del software definida por escrito | **Bloqueado**: falta el contrato y la cláusula de propiedad intelectual |
| RL-02 | Licencia de uso o distribución definida | **Bloqueado** por RL-01 |
| RL-03 | Licencias de componentes de terceros compatibles con la licencia elegida | Inventario hecho; ver [Componentes de terceros](../10_LEGAL_Y_LICENCIAS/COMPONENTES_DE_TERCEROS.md) |
| RL-04 | Uso autorizado de escudos y gráficas institucionales en las plantillas | **Pendiente** |
| RL-05 | Cumplimiento de Ley 1581 de 2012 y Decreto 1074 de 2015 en el tratamiento | Parcial (ver RP) |
| RL-06 | Accesibilidad web según Resolución 1519 de 2020 si la entidad es sujeto obligado | **Pendiente de confirmar** si aplica y con qué nivel |
