# Resumen ejecutivo: Gestor JAL

Para la Subsecretaría. Fecha: 31-10-2026.

## Qué es

El Gestor JAL es una aplicación web para que la Junta Administradora Local de la Comuna 12 – La América (Medellín) elabore sus documentos oficiales (certificados de residencia, constancias, citaciones, comunicados) desde plantillas, con número de radicado consecutivo, firma del edil y registro de quién hizo qué. Funciona en computador y celular, y está pensado para seguir trabajando con conexión irregular. Se desarrolló y se soporta en el marco del contrato de prestación de servicios PS 2779, según las actas de acompañamiento de septiembre de 2026.

## En qué estado está

| Pregunta | Respuesta corta |
|---|---|
| ¿Funciona? | **Sí, en un entorno de prueba.** Se comprobó de punta a punta, con datos ficticios, el flujo principal: entrar, crear un certificado con radicado y firma, descargarlo en PDF y Word, revisarlo, auditar y sacar copia. 539 pruebas automáticas pasan |
| ¿Está publicado para la JAL? | Hay una instalación en la nube, pero **no se pudo verificar** en esta revisión y la versión con la interfaz nueva **no está publicada** por un cambio de cuenta |
| ¿Protege los datos? | Tiene controles importantes (roles, sesiones protegidas, bloqueo por intentos, auditoría, separación entre JAL). Quedan riesgos: copias sin cifrar, cuentas a nombre personal, chat que envía nombres a un equipo personal y contraseña inicial por confirmar |
| ¿Cumple la ley de datos personales? | **Faltan** el responsable del tratamiento, el aviso de privacidad y la autorización de los ciudadanos. Se dejan borradores |
| ¿Es fácil de usar para personas mayores? | La interfaz se rediseñó con buenas prácticas y pasó una verificación automática de accesibilidad, pero **no se ha probado con usuarios** de la JAL |
| ¿Se puede llevar a otras JAL? | **Sí, como instalación independiente por JAL.** Compartir una sola instalación entre varias JAL todavía tiene fallas (por ejemplo, choque de números de radicado) |
| ¿De quién es el software? | **No está definido.** Falta el contrato y parte del desarrollo es anterior a él. Es el principal bloqueo para entregarlo y replicarlo |

## Qué se hizo en esta entrega

1. Auditoría del código y pruebas reales en modo producción, con evidencia guardada.
2. Se encontraron y corrigieron fallas que habrían afectado una recuperación o una instalación nueva: la restauración de copias decía "completada" sin restaurar; la configuración Docker y Render no incluía claves obligatorias.
3. Se reprodujo y documentó el choque de radicados entre JAL que comparten instalación.
4. Paquete documental completo (índice en [INDICE_GENERAL.md](INDICE_GENERAL.md)): requisitos, trazabilidad, arquitectura, manuales, instalación, operación, respaldo, replicación, seguridad, datos personales, licencias, pruebas y entrega.

## Qué necesita decidir la Subsecretaría

1. **Titularidad y licencia** del software (con la I.U. Pascual Bravo y el desarrollador).
2. **Responsable del tratamiento** de los datos de los ciudadanos.
3. **Cuentas institucionales** para recibir el repositorio y los servicios en la nube, y un **responsable técnico**.
4. **Modelo de replicación**: se recomienda una instalación por JAL para las siguientes.
5. Presupuesto y plan de los servicios en la nube (hoy en planes que pueden suspenderse por inactividad).

## Estado de los entregables

| Listos | Parciales | Pendientes o bloqueados |
|---|---|---|
| Código fuente, migraciones y pruebas automáticas | Despliegue en la nube y con Docker (corregidos, sin verificar) | Producción verificada |
| Respaldo y restauración por scripts (corregidos y probados) | Requisitos y trazabilidad (provisionales, sin contrato) | Titularidad y licencia |
| Arquitectura, API y modelo de datos | Matriz contractual (fuente secundaria) | Política y aviso de datos personales adoptados |
| Manual funcional y guía de administración | Accesibilidad (automática sí; usuarios no) | Prueba con usuarios de la JAL |
| Estrategia de replicación y pruebas de aislamiento | Tutoriales (interfaz anterior, sin voz) | Transferencia de cuentas y capacitación con evidencia |
| Revisión de seguridad, análisis de datos y de licencias | Plantillas (escudos sin autorización) | Acta de entrega firmada |
| Informe de pruebas con evidencias | | |

Detalle y criterios de cierre: [Pendientes de entrega](../12_ENTREGA/PENDIENTES_DE_ENTREGA.md).
