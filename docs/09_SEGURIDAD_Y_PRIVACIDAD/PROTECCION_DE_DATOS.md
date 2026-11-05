# Protección de datos personales

> Este documento es un análisis técnico para apoyar al área jurídica. **No es un concepto jurídico** ni una política aprobada. Los textos de la sección 6 son **borradores** sin validez hasta que el responsable del tratamiento los revise y adopte.

Marco principal: Ley 1581 de 2012 y Decreto 1074 de 2015 (Libro 2, Parte 2, Título 2, Capítulo 25, que compila el antiguo Decreto 1377 de 2013). Fuentes en la [Matriz normativa](../10_LEGAL_Y_LICENCIAS/MATRIZ_NORMATIVA.md).

## 1. Qué datos trata el sistema

| Titulares | Datos | Dónde quedan | Finalidad aparente |
|---|---|---|---|
| Ciudadanos que piden un documento | Nombre, tipo y número de documento, lugar de expedición, dirección, tiempo de residencia, teléfono, correo y los demás campos de cada plantilla | `documents.beneficiary_*`, `documents.metadata`, Word y PDF dentro de la base, notificaciones, cola sin conexión del navegador, copias zip, Excel exportados, Google Drive y receptor local si se activan | Expedir el documento solicitado y llevar su registro |
| Usuarios internos (auxiliares, ediles, administradores) | Nombre, correo, cargo, firma escaneada, IP y acciones en la auditoría, hash de contraseña | `users`, `audit_logs` | Control de acceso, autoría y firma de los documentos |

**Datos sensibles:** el sistema no tiene campos diseñados para datos sensibles (art. 5, Ley 1581), pero las plantillas son configurables y podrían pedirlos (por ejemplo, condición de víctima, discapacidad o pertenencia étnica en una constancia). La JAL debe revisar cada plantilla. **Niños, niñas y adolescentes:** no hay restricción técnica para registrar menores.

## 2. Roles en el tratamiento

| Rol (Ley 1581, art. 3) | Quién podría ser | Estado |
|---|---|---|
| Responsable | La JAL, el Distrito de Medellín (Secretaría de Participación Ciudadana) u otro | **Sin definir**: decisión institucional y jurídica |
| Encargado | Quien opere la infraestructura por cuenta del responsable (contratista, I.U. Pascual Bravo, proveedor) | Sin definir |
| Subencargados o proveedores | Supabase (base de datos), Render (servidor), Vercel (frontend), Google (Drive, si se activa), Tailscale (red del chat), Ollama en un PC (chat) | Sin contratos de transmisión ni evaluación de ubicación de los datos documentados |

Hasta que se defina el responsable, no se puede adoptar la política de tratamiento, el aviso ni el registro de la base de datos donde aplique.

## 3. Estado frente a los principios (art. 4, Ley 1581)

| Principio | Situación en el sistema | Brecha |
|---|---|---|
| Legalidad y finalidad | La finalidad es expedir documentos de la JAL | No está escrita ni comunicada al ciudadano |
| Libertad (autorización) | Los usuarios internos aceptan una política en pantalla | **No hay autorización de los ciudadanos** ni registro de ella |
| Veracidad | Se reutilizan datos de una persona ya atendida | Pedir confirmación de vigencia (la pantalla lo sugiere) |
| Transparencia | — | No hay canal para que el titular consulte sus datos |
| Acceso y circulación restringida | Roles, filtro por JAL, auditoría | Exportaciones y zip sin cifrar; chat IA con nombres |
| Seguridad | Controles de la [Revisión de seguridad](REVISION_DE_SEGURIDAD.md) | SEG-01, SEG-04, SEG-05 |
| Confidencialidad | — | Compromisos de confidencialidad de usuarios y operadores no documentados |

## 4. Retención y supresión

- El sistema **no borra** datos por plazo. El borrado de documentos es lógico (`deleted_at`) y el registro permanece.
- No hay tabla de retención documental aplicada.
- Propuesta: definir con el archivo de la entidad el plazo de conservación por tipo de documento; luego implementar depuración programada y supresión a solicitud del titular cuando proceda.

## 5. Derechos de los titulares (art. 8)

El sistema permite, a través del administrador, **consultar** los documentos de una persona (búsqueda por cédula) y exportarlos. No tiene función para **corregir** un documento emitido ni para **suprimir** definitivamente los datos de un titular. Falta el procedimiento de atención (canal, plazos de la ley: 10 días hábiles para consultas y 15 para reclamos, prorrogables) y su responsable.

## 6. Borradores [BORRADOR, sin validez hasta su adopción]

### 6.1 Aviso de privacidad para ciudadanos (texto corto para la sede o para el documento)

> **BORRADOR — no usar sin aprobación del responsable del tratamiento.**
>
> [NOMBRE DEL RESPONSABLE], con domicilio en [DIRECCIÓN] y contacto [CORREO / TELÉFONO], tratará los datos personales que usted suministra (nombre, identificación, dirección, datos de contacto y los demás que requiera el documento solicitado) con la finalidad de expedir el documento que solicita, llevar el registro y consecutivo de los documentos emitidos y atender verificaciones posteriores sobre su autenticidad. Usted tiene derecho a conocer, actualizar, rectificar y solicitar la supresión de sus datos, y a revocar la autorización cuando proceda, a través de [CANAL]. La política de tratamiento está disponible en [ENLACE O LUGAR]. Los datos se almacenan en servicios tecnológicos que pueden estar ubicados fuera de Colombia: [PROVEEDORES Y PAÍSES, POR CONFIRMAR].

### 6.2 Autorización del titular

> **BORRADOR.** Autorizo a [NOMBRE DEL RESPONSABLE] para tratar mis datos personales con las finalidades indicadas en el aviso de privacidad. Nombre: ____ Identificación: ____ Fecha: ____ Firma: ____

Decisión pendiente: si la autorización se recoge en papel en la sede, en el mismo documento, o con una casilla en el formulario del sistema (requiere desarrollo y registro de la evidencia).

### 6.3 Ajustes a la política que ven los usuarios internos (`HabeasDataPage.jsx`)

- Citar el Decreto 1074 de 2015 (que compila el 1377 de 2013).
- Nombrar al responsable del tratamiento cuando esté definido.
- Incluir el compromiso de confidencialidad del usuario interno.

No se modificó el texto en pantalla en esta entrega: depende de la decisión sobre el responsable.

## 7. Acciones priorizadas

| # | Acción | Responsable sugerido |
|---|---|---|
| 1 | Definir responsable y encargado del tratamiento | Subsecretaría y jurídica |
| 2 | Adoptar política, aviso y forma de autorización | Responsable del tratamiento |
| 3 | Revisar las plantillas para no pedir datos innecesarios o sensibles | JAL |
| 4 | Quitar los nombres de beneficiarios del chat IA o desactivarlo | Desarrollador |
| 5 | Cifrar copias y restringir exportaciones | Desarrollador y administrador |
| 6 | Acuerdos con proveedores (transmisión o transferencia internacional) y revisar la ubicación de los datos | Jurídica |
| 7 | Procedimiento de atención a titulares y de incidentes | Responsable del tratamiento |
| 8 | Definir retención | Archivo y JAL |
