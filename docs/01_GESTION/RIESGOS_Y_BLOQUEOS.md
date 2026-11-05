# Riesgos, bloqueos y registro de decisiones

Probabilidad (P) e impacto (I): A alto · M medio · B bajo. Los riesgos técnicos de seguridad con más detalle están en la [Revisión de seguridad](../09_SEGURIDAD_Y_PRIVACIDAD/REVISION_DE_SEGURIDAD.md).

## 1. Riesgos del proyecto

| ID | Riesgo | P | I | Mitigación propuesta | Responsable sugerido |
|---|---|---|---|---|---|
| R-01 | Titularidad del software sin resolver: no se puede licenciar, replicar ni transferir con seguridad jurídica | A | A | Obtener el contrato; acordar por escrito la titularidad o una licencia, considerando el desarrollo previo al contrato | Jurídica de la Subsecretaría, I.U. Pascual Bravo, desarrollador |
| R-02 | Cuentas (GitHub, Vercel, Render, Supabase, Google, ngrok, Tailscale) a nombre personal | A | A | Plan de transferencia a cuentas institucionales (ver [Transferencia técnica](../12_ENTREGA/GUIA_DE_TRANSFERENCIA_TECNICA.md)) | Subsecretaría y desarrollador |
| R-03 | Conocimiento operativo concentrado en una persona | A | A | Esta documentación; sesión de transferencia; designar responsable técnico | Subsecretaría |
| R-04 | Tratamiento de datos de ciudadanos sin aviso, autorización ni responsable designado | A | A | Designar responsable; adoptar aviso y autorización (borradores en [Protección de datos](../09_SEGURIDAD_Y_PRIVACIDAD/PROTECCION_DE_DATOS.md)) | Distrito o JAL |
| R-05 | Lo publicado en producción no es la versión revisada (rediseño sin desplegar; producción no verificada) | A | M | Desplegar desde la rama principal y repetir la prueba de humo contra producción | Desarrollador |
| R-06 | Pérdida de datos: copias sin destino externo activo y sin RPO/RTO aprobados | M | A | Activar copia externa; aprobar RPO/RTO; ensayo de restauración trimestral | Desarrollador y Subsecretaría |
| R-07 | Planes gratuitos de servicios en la nube cambian condiciones o suspenden el servicio | M | A | Confirmar plan contratado y presupuesto; tener la instalación Docker como alternativa | Subsecretaría |
| R-08 | Usuarios de la JAL no logran usar el sistema sin ayuda | M | A | Prueba con usuarios; tutoriales actualizados con voz y subtítulos | JAL y desarrollador |
| R-09 | Plantillas con escudos oficiales y gráfica de los ODS sin autorización documentada | M | M | Confirmar autorización o retirar los elementos | JAL / jurídica |
| R-10 | Colisión de radicados entre JAL si comparten código de dependencia (ver MJ-02) | M (solo Modelo B) | A | Código de dependencia único por JAL antes de crear la segunda; corrección del índice [Propuesta] | Desarrollador |
| R-11 | Dependencias sin mantenimiento (`docxtemplater-image-module-free`) | M | M | Seguimiento semestral; evaluar reemplazo | Mantenedor |
| R-12 | Chat IA envía nombres de beneficiarios a un modelo en un PC personal | M | M | Desactivar o quitar los nombres del contexto | Desarrollador / responsable del tratamiento |
| R-13 | Contraseña inicial de ejemplo del administrador si no se definió `ADMIN_INITIAL_PASSWORD` | M | A | Verificar en producción que se cambió; obligar cambio en el primer ingreso [Propuesta] | Administrador del sistema |

## 2. Bloqueos actuales

| ID | Bloqueo | Qué se necesita para desbloquear | Afecta |
|---|---|---|---|
| B-01 | Sin contrato ni anexos | Copia del contrato PS 2779 y del interadministrativo | Matriz contractual, titularidad, licencia |
| B-02 | Sin acceso a producción desde el entorno de revisión (red bloqueada) y despliegue de Vercel detenido por cambio de cuenta | Acceso del responsable a las cuentas; desplegar y correr la prueba de humo contra la URL pública | Verificación de producción, `trust proxy` |
| B-03 | Google Drive no conectado en producción | Cuenta de Google institucional y credenciales OAuth | Copia externa automática |
| B-04 | Chat IA depende de un PC personal | Decisión de mantenerlo, moverlo a un servidor o retirarlo | RF-24 |
| B-05 | Sin usuarios disponibles para prueba de usabilidad | Sesión acordada con la JAL | RA-02 |
| B-06 | Docker no disponible en el entorno de revisión | Probar `deploy/` en un equipo con Docker | RM-01 |

## 3. Registro de decisiones

Solo se registran decisiones con soporte. Las propuestas sin aprobar están marcadas.

| Fecha | Decisión | Soporte | Estado |
|---|---|---|---|
| 09-09-2026 | El sistema debe funcionar con conexión irregular (modo sin conexión) | Contexto del proyecto y actas de septiembre [Acta] | Tomada |
| 21-08-2026 | Despliegue híbrido Vercel + Render + Supabase | `docs/DESPLIEGUE_HIBRIDO.md` | Tomada por el desarrollador; sin aprobación institucional documentada |
| 29-10-2026 | Rediseño de la interfaz v2 (PR #10) | PR #10 integrado en `main` | Tomada; sin desplegar |
| 31-10-2026 | Corregir la restauración para que se detenga ante errores y se aplique en una sola transacción | Prueba de restauración fallida y corregida (evidencia) | Hecha en esta entrega, sin integrar a `main` |
| — | Modelo de replicación (A o B) | [Estrategia multi-JAL](../08_REPLICACION/ESTRATEGIA_MULTIJAL.md) | **Pendiente** [Propuesta: Modelo A ahora] |
| — | Licencia del software | [Análisis de licencias](../10_LEGAL_Y_LICENCIAS/ANALISIS_DE_LICENCIAS_Y_PI.md) | **Pendiente** |
