# Matriz contractual

> **Fuente secundaria.** No se tuvo acceso al contrato PS 2779 firmado ni al contrato interadministrativo 4600108028 de 2026. Las obligaciones de la sección 1 se tomaron del "Informe de Actividades — Obligaciones Contractuales" elaborado por el contratista. El texto exacto, el número y el alcance de cada obligación **deben contrastarse con el contrato**. Esta matriz no reemplaza el informe de supervisión ni certifica cumplimiento: solo muestra qué evidencia verificable aporta el repositorio.

## 1. Obligaciones y evidencia disponible

| N.º | Obligación (resumen, según el informe) | Evidencia verificable en el repositorio o en esta entrega | Evidencia que falta | Estado de la evidencia |
|---|---|---|---|---|
| 1 | Acompañar el diseño de herramientas tecnológicas para la JAL | Código del Gestor JAL; historial de commits y PR; sistema de diseño `docs/design/`; [Arquitectura](../03_ARQUITECTURA/ARQUITECTURA_GENERAL.md) | Acta de aprobación del diseño por la JAL | Parcial |
| 2 | Diagnóstico y levantamiento de requerimientos | Acta de diagnóstico de septiembre [Acta]; [Matriz de requisitos](MATRIZ_REQUISITOS.md) reconstruida | Documento de requisitos aprobado | Parcial |
| 3 | Acompañar, capacitar y prestar soporte técnico | Página Ayuda; 12 videos (interfaz anterior); acta de soporte [Acta]; [Inventario de tutoriales](../05_TUTORIALES/INVENTARIO_Y_CAPACITACION.md) | Listas de asistencia a capacitaciones; registro de solicitudes de soporte | Parcial |
| 4 | Apoyar la implementación | Guías de despliegue; despliegue en la nube documentado en `docs/DESPLIEGUE_HIBRIDO.md` | Constancia de puesta en operación en la JAL; verificación de producción (hoy **bloqueada**) | Parcial |
| 5 | Demás actividades requeridas por la supervisión | — | Solicitudes de la supervisión | No verificable desde el repositorio |
| 6 | Participar en eventos | — | Registros de los eventos | No verificable desde el repositorio |
| 7 | Atender PQRS | — | Registro de PQRS | No verificable desde el repositorio |
| 8 | Custodiar y entregar evidencias en los formatos del Distrito | Esta carpeta `docs/`; evidencias técnicas en `docs/11_CALIDAD/evidencias/` | Formatos institucionales (p. ej. FO-FOCI-104 usado en las actas) diligenciados | Parcial |
| 9 | Apoyar a la supervisión | [Acta de verificación previa](../12_ENTREGA/ACTA_DE_VERIFICACION_PREVIA.md) como lista de chequeo | — | Parcial |
| 10 | Cargar documentos en SECOP II | — | Constancias de cargue | No verificable desde el repositorio |

## 2. Hallazgos sobre la evidencia reportada

Los detalles están en la sección 5 del [Estado real](../00_LEEME/ESTADO_REAL_DEL_PROYECTO.md#5-inconsistencias-documentales-encontradas). En resumen:

- El informe menciona carpetas y archivos (`evidencia_informe/`, `AUDIT.md`, `logs/backend.log`) que **no están** en el repositorio (D3).
- El informe describe "respaldo remoto cifrado en Google Drive": los zip **no se cifran** y Drive **no está conectado** en producción (D2).
- El informe atribuye al Gestor JAL una "automatización de formulario para la liquidación y pago de honorarios de los ediles" que **no está** en este repositorio (D4).
- El período del contrato aparece con dos fechas de inicio distintas (D9).
- Parte del desarrollo es **anterior** al contrato (versión 2.0.0 del 14-05-2026; contrato desde agosto). Esto afecta la titularidad: ver [Análisis de PI](../10_LEGAL_Y_LICENCIAS/ANALISIS_DE_LICENCIAS_Y_PI.md).

Recomendación [Propuesta]: corregir esos puntos en el próximo informe de actividades para que la evidencia reportada coincida con la verificable.

## 3. Documentos que faltan

| Documento | Para qué se necesita | Quién lo tiene (supuesto) | Prioridad |
|---|---|---|---|
| Contrato PS 2779 firmado, con obligaciones específicas y cláusula de propiedad intelectual | Línea base de obligaciones; titularidad | I.U. Pascual Bravo | Indispensable |
| Contrato interadministrativo 4600108028 de 2026 (al menos cláusulas de PI, confidencialidad y datos) | Saber quién es titular final y quién es responsable del tratamiento | Distrito de Medellín / I.U. Pascual Bravo | Indispensable |
| Estudios previos, anexo técnico o plan de trabajo aprobado | Requisitos formales y alcance | I.U. Pascual Bravo | Indispensable |
| Formato institucional de entrega de productos o de transferencia | Presentar esta entrega en el formato exigido | Subsecretaría | Indispensable |
| Designación de la supervisión | Saber a quién se entrega y quién aprueba | I.U. Pascual Bravo | Alta |
| Política de tratamiento de datos personales del Distrito o de la JAL | Aviso de privacidad y autorización para ciudadanos | Distrito / JAL | Alta |
| Lineamientos de seguridad de la información y de desarrollo del Distrito (si existen) | Ajustar controles y despliegue | Secretaría de Innovación Digital u oficina TIC del Distrito [Supuesto] | Media |
| Tabla de retención documental aplicable a la JAL | Plazos de conservación de documentos emitidos | Archivo del Distrito / JAL | Media |
| Autorización de uso de escudos y de la gráfica de los ODS en las plantillas | Uso de símbolos e imagen de terceros | JAL / Distrito | Media |
| Informes de supervisión y aprobaciones previas | Saber qué ya se dio por recibido | Supervisión | Media |
