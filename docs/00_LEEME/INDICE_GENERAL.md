# Índice general de la documentación del Gestor JAL

Versión documental: 2026-10-31 · Código base revisado: rama `main`, commit `91a14ac` (29-10-2026) más los cambios de esta entrega.

Esta carpeta es el punto de entrada para quien recibe el aplicativo: la Subsecretaría, la JAL o la persona que lo mantenga. Todos los documentos describen el sistema **tal como está en el código**; lo que no se pudo comprobar está marcado como tal.

## Cómo leer los estados

| Estado | Significado |
|---|---|
| **Verificado** | Existe y se comprobó su funcionamiento con una prueba registrada (ver [Informe de pruebas](../11_CALIDAD/INFORME_DE_PRUEBAS.md)). |
| **Implementado, sin verificar** | Está en el código, pero no se confirmó su comportamiento en esta revisión. |
| **Parcial** | Cubre solo una parte de lo requerido. |
| **Pendiente** | No hay implementación suficiente. |
| **Bloqueado** | No se pudo validar por falta de acceso, información o autorización. |
| **Fuera de alcance** | Solo cuando hay un documento que lo justifica. |

Las fuentes se distinguen así: **[Código]** archivo del repositorio · **[Prueba]** evidencia en `docs/11_CALIDAD/evidencias/` · **[Acta]** acta o informe del contrato (en el Drive del responsable, no en el repositorio) · **[Suministrado]** dicho por el responsable, sin documento · **[Supuesto]** hipótesis de trabajo · **[Propuesta]** recomendación pendiente de aprobación.

## Por dónde empezar

| Si usted es… | Lea primero |
|---|---|
| Directivo o supervisor de la Subsecretaría | [Resumen ejecutivo](RESUMEN_EJECUTIVO.md) y [Pendientes de entrega](../12_ENTREGA/PENDIENTES_DE_ENTREGA.md) |
| Supervisor del contrato | [Matriz contractual](../01_GESTION/MATRIZ_CONTRACTUAL.md) y [Acta de verificación previa](../12_ENTREGA/ACTA_DE_VERIFICACION_PREVIA.md) |
| Persona de la JAL que usa el sistema | [Manual funcional](../04_PRODUCTO/MANUAL_FUNCIONAL.md) y la página **Ayuda** dentro de la aplicación |
| Administrador del sistema en la JAL | [Guía de administración](../04_PRODUCTO/GUIA_DE_ADMINISTRACION.md) |
| Desarrollador o técnico que lo va a mantener | [Estado real](ESTADO_REAL_DEL_PROYECTO.md), [Arquitectura](../03_ARQUITECTURA/ARQUITECTURA_GENERAL.md), [Instalación y despliegue](../06_DESPLIEGUE/INSTALACION_Y_DESPLIEGUE.md) y [Guía de transferencia técnica](../12_ENTREGA/GUIA_DE_TRANSFERENCIA_TECNICA.md) |
| Área jurídica | [Análisis de licencias y propiedad intelectual](../10_LEGAL_Y_LICENCIAS/ANALISIS_DE_LICENCIAS_Y_PI.md), [Matriz normativa](../10_LEGAL_Y_LICENCIAS/MATRIZ_NORMATIVA.md) y [Decisiones pendientes](../10_LEGAL_Y_LICENCIAS/DECISIONES_JURIDICAS_PENDIENTES.md) |

## Contenido

### 00 · Léeme
- [RESUMEN_EJECUTIVO.md](RESUMEN_EJECUTIVO.md): documento para la Subsecretaría, sin tecnicismos.
- [ESTADO_REAL_DEL_PROYECTO.md](ESTADO_REAL_DEL_PROYECTO.md): auditoría técnica y funcional con evidencia, brechas priorizadas.

### 01 · Gestión
- [CONTEXTO_Y_ALCANCE.md](../01_GESTION/CONTEXTO_Y_ALCANCE.md): problema, entidad (JAL, no JAC), usuarios, alcance y lo que depende de la Comuna 12.
- [MATRIZ_REQUISITOS.md](../01_GESTION/MATRIZ_REQUISITOS.md): catálogo de requisitos con identificador, fuente, estado y criterio de aceptación.
- [MATRIZ_TRAZABILIDAD.md](../01_GESTION/MATRIZ_TRAZABILIDAD.md): fuente → requisito → módulo → código → prueba → evidencia → estado.
- [MATRIZ_CONTRACTUAL.md](../01_GESTION/MATRIZ_CONTRACTUAL.md): obligaciones del contrato PS 2779 que se pueden verificar y documentos que faltan.
- [RIESGOS_Y_BLOQUEOS.md](../01_GESTION/RIESGOS_Y_BLOQUEOS.md): riesgos del proyecto, bloqueos y registro de decisiones.
- Control de cambios: [CHANGELOG.md](../../CHANGELOG.md) (raíz) y [docs/design/CHANGELOG.md](../design/CHANGELOG.md).

### 02 · Requisitos
- [PROCESOS_HISTORIAS_Y_CASOS_DE_USO.md](../02_REQUISITOS/PROCESOS_HISTORIAS_Y_CASOS_DE_USO.md): procesos, historias de usuario, casos de uso y excepciones, con diagramas.

### 03 · Arquitectura
- [ARQUITECTURA_GENERAL.md](../03_ARQUITECTURA/ARQUITECTURA_GENERAL.md): componentes, despliegue, flujos de autenticación y de documentos, errores y registros.
- [MODELO_DE_DATOS.md](../03_ARQUITECTURA/MODELO_DE_DATOS.md): diagrama entidad-relación y diccionario de datos.
- [API.md](../03_ARQUITECTURA/API.md): catálogo de rutas con permisos.
- [DECISIONES_ARQUITECTONICAS.md](../03_ARQUITECTURA/DECISIONES_ARQUITECTONICAS.md): decisiones tomadas, alternativas y consecuencias.

### 04 · Producto
- [MANUAL_FUNCIONAL.md](../04_PRODUCTO/MANUAL_FUNCIONAL.md): catálogo de funcionalidades y manual por módulo.
- [GUIA_DE_ADMINISTRACION.md](../04_PRODUCTO/GUIA_DE_ADMINISTRACION.md): tareas del administrador dentro de la aplicación.
- [ACCESIBILIDAD_Y_USABILIDAD.md](../04_PRODUCTO/ACCESIBILIDAD_Y_USABILIDAD.md): auditoría de uso para personas con poca experiencia digital.
- Sistema de diseño: [docs/design/](../design/) (00 a 11).

### 05 · Tutoriales
- [INVENTARIO_Y_CAPACITACION.md](../05_TUTORIALES/INVENTARIO_Y_CAPACITACION.md): los 12 videos, su estado, guía de capacitación y pendientes.

### 06 · Despliegue
- [INSTALACION_Y_DESPLIEGUE.md](../06_DESPLIEGUE/INSTALACION_Y_DESPLIEGUE.md): requisitos, instalación desde cero (tres modalidades), variables, verificación, actualización, rollback y diagnóstico.
- Detalle del despliegue en la nube: [DESPLIEGUE_HIBRIDO.md](../DESPLIEGUE_HIBRIDO.md). Actualización Docker: [deploy/ACTUALIZACION.md](../../deploy/ACTUALIZACION.md).

### 07 · Operación
- [OPERACION_Y_MANTENIMIENTO.md](../07_OPERACION/OPERACION_Y_MANTENIMIENTO.md): tareas periódicas, RACI, incidentes y continuidad.
- [RESPALDO_Y_RESTAURACION.md](../07_OPERACION/RESPALDO_Y_RESTAURACION.md): qué se respalda, cómo restaurar y qué está probado.

### 08 · Replicación
- [ESTRATEGIA_MULTIJAL.md](../08_REPLICACION/ESTRATEGIA_MULTIJAL.md): modelos A y B, procedimiento para una segunda JAL y pruebas de aislamiento.

### 09 · Seguridad y privacidad
- [REVISION_DE_SEGURIDAD.md](../09_SEGURIDAD_Y_PRIVACIDAD/REVISION_DE_SEGURIDAD.md): modelo de amenazas, controles y matriz de riesgos.
- [PROTECCION_DE_DATOS.md](../09_SEGURIDAD_Y_PRIVACIDAD/PROTECCION_DE_DATOS.md): datos personales tratados, roles, retención y borradores.

### 10 · Legal y licencias
- [ANALISIS_DE_LICENCIAS_Y_PI.md](../10_LEGAL_Y_LICENCIAS/ANALISIS_DE_LICENCIAS_Y_PI.md): titularidad, inventario de propiedad intelectual y comparación de licencias.
- [COMPONENTES_DE_TERCEROS.md](../10_LEGAL_Y_LICENCIAS/COMPONENTES_DE_TERCEROS.md) y [dependencias-npm-produccion.csv](../10_LEGAL_Y_LICENCIAS/dependencias-npm-produccion.csv).
- [MATRIZ_NORMATIVA.md](../10_LEGAL_Y_LICENCIAS/MATRIZ_NORMATIVA.md): normas, fuentes oficiales y relación con el producto.
- [DECISIONES_JURIDICAS_PENDIENTES.md](../10_LEGAL_Y_LICENCIAS/DECISIONES_JURIDICAS_PENDIENTES.md).

### 11 · Calidad
- [ESTRATEGIA_Y_CASOS_DE_PRUEBA.md](../11_CALIDAD/ESTRATEGIA_Y_CASOS_DE_PRUEBA.md): niveles de prueba y casos ligados a requisitos.
- [INFORME_DE_PRUEBAS.md](../11_CALIDAD/INFORME_DE_PRUEBAS.md): qué se ejecutó, con qué resultado y qué no se pudo ejecutar.
- Evidencias: [evidencias/2026-10-29/](../11_CALIDAD/evidencias/2026-10-29/) y [evidencias/2026-10-31/](../11_CALIDAD/evidencias/2026-10-31/).

### 12 · Entrega
- [INVENTARIO_ENTREGABLES.md](../12_ENTREGA/INVENTARIO_ENTREGABLES.md)
- [ACTA_DE_VERIFICACION_PREVIA.md](../12_ENTREGA/ACTA_DE_VERIFICACION_PREVIA.md) (lista de chequeo, sin firmas)
- [PENDIENTES_DE_ENTREGA.md](../12_ENTREGA/PENDIENTES_DE_ENTREGA.md)
- [GUIA_DE_TRANSFERENCIA_TECNICA.md](../12_ENTREGA/GUIA_DE_TRANSFERENCIA_TECNICA.md)

### Documentos anteriores que se conservan
- [AUDITORIA_2026-10.md](../AUDITORIA_2026-10.md): auditoría técnica del 26-10-2026 (sus hallazgos se retoman en el estado real).
- [DESPLIEGUE_HIBRIDO.md](../DESPLIEGUE_HIBRIDO.md): cómo se montó Vercel + Render + Supabase.
- [docs/design/](../design/): sistema de diseño y validación visual del rediseño (PR #10).

## Material que no está en el repositorio

| Material | Dónde está | Motivo |
|---|---|---|
| 12 videos tutoriales, 35 capturas y `TUTORIALES.md` | Carpeta compartida del proyecto, `tutoriales/` | Peso (≈9 MB) |
| Capturas del rediseño en tres anchos | Carpeta compartida del proyecto, `rediseno-v2/` | Peso |
| Actas de acompañamiento técnico (septiembre 2026) e informe de obligaciones | Google Drive del responsable | Contienen datos personales del contratista |
