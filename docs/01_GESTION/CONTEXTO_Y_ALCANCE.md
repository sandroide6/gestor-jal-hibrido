# Contexto institucional, alcance y objetivos

## 1. Entidad destinataria: JAL, no JAC

El aplicativo está hecho para una **Junta Administradora Local (JAL)**: la corporación pública de elección popular de cada comuna o corregimiento, prevista en el artículo 318 de la Constitución Política, cuyos miembros son los **ediles**. No está hecho para una **Junta de Acción Comunal (JAC)**, que es una organización civil comunitaria de barrio regida por las normas de acción comunal (Ley 2166 de 2021). Las dos figuras no son equivalentes y este proyecto no las mezcla:

- El código usa siempre "Junta Administradora Local" y "edil" (`frontend/src/pages/HabeasDataPage.jsx`, `backend/src/routes/chat.js`, seeders). Una búsqueda de "JAC" y "Acción Comunal" en el repositorio no arrojó resultados.
- Las actas de acompañamiento técnico de septiembre de 2026 identifican al beneficiario como "Junta Administradora Local Comuna 12 (JAL)", barrio La América [Acta].
- La plantilla del Certificado de Residencia que trae el repositorio se expide a nombre de la "Junta Administradora Local de la Comuna 12 La América de Medellín" [Código: `backend/plantillas/`].

**Pendiente de verificación:** la denominación oficial exacta de la entidad que recibe el producto. Las actas mencionan la **Secretaría de Participación Ciudadana – Subsecretaría de Organización Social** del Distrito de Medellín; el encargo menciona la **Subsecretaría de Participación Ciudadana**. Se usa "la Subsecretaría" en esta documentación hasta que se confirme el nombre en el contrato.

## 2. Marco del proyecto (según documentos disponibles)

| Hecho | Fuente | Estado |
|---|---|---|
| El desarrollo y soporte del Gestor JAL se reporta como parte del contrato de prestación de servicios **PS 2779**, suscrito con la Institución Universitaria Pascual Bravo, en el marco del **contrato interadministrativo 4600108028 de 2026** entre esa institución y el Distrito de Medellín | Actas `AcC12_220926_*` e "Informe de Actividades — Obligaciones Contractuales" [Acta] | Corroborado en actas; **no se tuvo el contrato firmado** |
| El acompañamiento lo asigna la Secretaría de Participación Ciudadana – Subsecretaría de Organización Social | Actas de septiembre [Acta] | Corroborado en actas |
| Período del contrato | Inicio 06-08-2026 según un documento; período 10-08 a 20-12-2026 según el informe de obligaciones | **Inconsistente**: confirmar con el contrato |
| Desarrollo previo al contrato | `CHANGELOG.md` registra la versión 2.0.0 el 14-05-2026 y las plantillas `.docx` tienen fecha 11-05-2026; el contrato inició en agosto | **Relevante para la titularidad** (ver legal) |
| Despliegue en la nube | `docs/DESPLIEGUE_HIBRIDO.md`, 21-08-2026 | Documentado; no verificado en esta revisión |

## 3. Problema que resuelve

Antes del sistema, cada documento oficial de la JAL (certificados, constancias, citaciones, comunicados) se elaboraba copiando una plantilla de Word, llenándola a mano y guardándola en alguna carpeta. Eso produce plantillas desactualizadas, documentos sin número de radicado consecutivo, archivos perdidos y ningún registro de quién emitió qué [Fuente: "Gestor JAL – Qué es y cómo funciona", Drive; diagnóstico de requerimientos de septiembre]. No hay mediciones previas de tiempos ni de errores: **los beneficios no están cuantificados**.

## 4. Usuarios y entorno de operación

| Perfil | Rol en el sistema | Qué necesita | Dificultades esperadas |
|---|---|---|---|
| Auxiliar o secretaría de la JAL | `auxiliar` | Emitir documentos rápido, a su nombre o a nombre de un edil, y volver a encontrarlos | Atención al público con poco tiempo; puede no estar familiarizada con computadores |
| Edil | `edil` | Revisar lo que se emite a su nombre, buscar documentos, ver reportes | Uso ocasional; varios ediles pueden ser personas mayores [Supuesto: no hay caracterización de los usuarios] |
| Administrador de la JAL | `administrador` | Crear usuarios, configurar plantillas y la JAL, auditoría y copias | Requiere más formación; hoy lo ejerce el desarrollador |
| Soporte y mantenimiento técnico | Fuera del sistema (acceso a servidores) | Desplegar, actualizar, restaurar | Hoy concentrado en una persona |
| Supervisión (Subsecretaría) | No tiene rol propio | Verificar el cumplimiento y la evidencia | El sistema no ofrece un rol de solo lectura para supervisión |
| Ciudadanos | No usan el sistema | Reciben el documento; sus datos quedan registrados | No se les informa en el sistema cómo se tratan sus datos |

Entorno: sede de la JAL Comuna 12 y trabajo remoto. Conectividad irregular en la sede [Fuente: contexto del proyecto, decisión del 09-09-2026], por eso el sistema tiene modo sin conexión. Equipo de la sede: **sin caracterizar** (sistema operativo, navegador, memoria).

## 5. Proceso inicial de la Comuna 12 y qué se puede generalizar

| Elemento | Específico de la Comuna 12 | Generalizable a otras JAL |
|---|---|---|
| Plantillas `.docx` (Certificado de Residencia, Liderazgo, Carta Labor Social, Citación, Comunicado) | Sí: textos, direcciones, teléfonos, correo y logos de la Comuna 12 | El mecanismo de plantillas con variables `{campo}` sí; cada JAL debe cargar las suyas |
| Tipos de documento y campos | Sembrados para la Comuna 12 | Configurables desde la pantalla Tipos de documento |
| Formato del radicado `AAAA-CÓDIGO-ENT/SAL/INT-000001` | El código de dependencia se configura | Sí |
| Roles auxiliar / edil / administrador | Reflejan la organización de la JAL C12 | Probablemente sí; confirmar con otra JAL |
| Fundamentos legales citados en el texto de las plantillas | Redactados por la JAL C12 | Cada JAL debe revisarlos |
| Firma escaneada del edil insertada en el documento | Práctica de la JAL C12 | Validar en cada JAL si la firma escaneada es aceptable para sus actos |

## 6. Objetivos

1. Generar documentos oficiales de la JAL en Word y PDF desde plantillas, con radicado consecutivo y firma. **Cumplido y verificado.**
2. Controlar quién puede hacer qué (roles) y dejar trazabilidad (auditoría). **Cumplido y verificado.**
3. Funcionar sin depender de un computador específico y con conexión irregular. **Implementado** (nube + modo sin conexión); producción y modo sin conexión **sin verificar** en esta revisión.
4. Ser fácil de usar para personas con poca experiencia digital. **Parcial**: rediseño con buenas prácticas verificadas automáticamente; **sin prueba con usuarios**.
5. Poder replicarse en otras JAL. **Parcial**: datos separados por JAL; falta la incorporación de nuevas JAL y resolver la titularidad.

## 7. Alcance

**Dentro del alcance (implementado):** generación de documentos, tipos y plantillas, radicación, usuarios y roles, firma, revisión por edil, búsqueda, reportes, auditoría, notificaciones internas, copias de seguridad, modo sin conexión, ayuda en la aplicación, aceptación de política por los usuarios.

**Implementado pero opcional y dependiente de terceros:** chat IA (Ollama en un PC), copia a Google Drive, receptor local de documentos, túnel ngrok.

**No implementado:** alta de nuevas JAL desde la aplicación; restauración de copias desde el panel; rol de supervisión; firma digital certificada (la firma es una imagen); gestión de archivo con tablas de retención documental; notificaciones push; registro de bienes o inventario y memoria institucional (son de otro proyecto).

**Fuera de alcance:** no hay un documento que excluya formalmente ninguna funcionalidad. Las exclusiones anteriores son "no implementado", no "fuera de alcance", hasta que exista un documento que lo diga.

## 8. Documentos que hacen falta para cerrar el alcance

Ver la lista completa en la [Matriz contractual](MATRIZ_CONTRACTUAL.md#3-documentos-que-faltan). Los indispensables son: contrato PS 2779 firmado con sus obligaciones y su cláusula de propiedad intelectual, el contrato interadministrativo 4600108028 de 2026 (al menos su cláusula de propiedad intelectual y datos), los estudios previos o el plan de trabajo aprobado, y el formato institucional de entrega.
