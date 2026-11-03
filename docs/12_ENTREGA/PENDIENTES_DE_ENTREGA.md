# Pendientes de entrega

Ordenados por prioridad. Cada uno tiene un criterio de cierre verificable.

| # | Pendiente | Tipo | Responsable sugerido | Criterio de cierre | Referencia |
|---|---|---|---|---|---|
| P-01 | Obtener el contrato PS 2779, el interadministrativo y sus anexos | Institucional | Supervisión | Copias en poder del equipo; matriz contractual actualizada con el texto real | [Matriz contractual](../01_GESTION/MATRIZ_CONTRACTUAL.md#3-documentos-que-faltan) |
| P-02 | Resolver titularidad y licencia | Jurídico | Jurídica, I.U. Pascual Bravo, desarrollador | Acuerdo escrito; archivo `LICENSE` y aviso del README actualizados con autorización | DJ-01 a DJ-04 |
| P-03 | Designar responsable del tratamiento y adoptar política, aviso y autorización | Jurídico | Distrito / JAL | Documento de designación; aviso en uso en la sede | [Protección de datos](../09_SEGURIDAD_Y_PRIVACIDAD/PROTECCION_DE_DATOS.md) |
| P-04 | Transferir las cuentas de servicio a cuentas institucionales | Operativo | Subsecretaría y desarrollador | Cuentas institucionales como propietarias, con 2FA; acceso personal retirado si así se acuerda | [Transferencia](GUIA_DE_TRANSFERENCIA_TECNICA.md) |
| P-05 | Confirmar que la contraseña inicial del administrador en producción se cambió y activar 2FA | Seguridad | Administrador | Inicio de sesión con la contraseña de ejemplo rechazado | SEG-02 |
| P-06 | Desplegar la versión actual y ejecutar la prueba de humo contra producción | Técnico | Desarrollador | Humo sin fallas no explicadas contra la URL pública; commit desplegado registrado | B-02 |
| P-07 | Verificar `TRUST_PROXY_HOPS` en producción | Técnico | Desarrollador | Registro muestra IP distintas para equipos distintos | SEG-06 |
| P-08 | Activar copia externa automática y cifrada; aprobar RPO/RTO | Técnico e institucional | Desarrollador y Subsecretaría | Copia diaria visible en el destino; ensayo de restauración registrado | [Respaldo](../07_OPERACION/RESPALDO_Y_RESTAURACION.md) |
| P-09 | Quitar datos personales del contexto del chat IA o desactivarlo | Técnico | Desarrollador | El contexto enviado no contiene nombres de beneficiarios | SEG-05 |
| P-10 | Prueba de usabilidad con personas de la JAL | Calidad | JAL y desarrollador | Informe con resultados por tarea | [Accesibilidad](../04_PRODUCTO/ACCESIBILIDAD_Y_USABILIDAD.md) |
| P-11 | Revisión manual de accesibilidad (NVDA, TalkBack, zoom 400 %) | Calidad | Desarrollador | Hallazgos registrados y corregidos | RA-01 |
| P-12 | Regrabar tutoriales con la interfaz actual, voz y subtítulos; actualizar imágenes de Ayuda | Capacitación | Desarrollador | 12 videos nuevos con `.vtt` y transcripción | [Tutoriales](../05_TUTORIALES/INVENTARIO_Y_CAPACITACION.md) |
| P-13 | Capacitación con evidencia | Capacitación | Desarrollador y JAL | Listas de asistencia en formato institucional | Obligación 3 |
| P-14 | Autorizar o retirar escudos y gráfica de los ODS en las plantillas | Jurídico | JAL / Distrito | Autorización escrita o plantillas sin esos elementos | DJ-08 |
| P-15 | Probar la instalación Docker desde cero | Técnico | Desarrollador | `/health` y documento de prueba en contenedores | DEF-02 |
| P-16 | Corregir el choque de radicados entre JAL (si se elige el Modelo B) | Técnico | Desarrollador | Migración reversible, prueba CP-17 pasa | MJ-02 |
| P-17 | Restauración de los zip del panel o retirar esa opción | Técnico | Desarrollador | Procedimiento probado o la opción documentada como solo exportación | RF-26 |
| P-18 | Cifrar el secreto TOTP | Técnico | Desarrollador | Columna cifrada; pruebas de 2FA pasan | SEG-04 |
| P-19 | Exigir la aceptación de la política también en el backend | Técnico | Desarrollador | API responde 403 sin aceptación; prueba automatizada | SEG-10 |
| P-20 | Probar el modo sin conexión en un navegador real | Calidad | Desarrollador | Documento creado sin red y sincronizado con radicado | CP-26 |
| P-21 | Definir retención documental | Institucional | Archivo y JAL | Plazos aprobados | RD-03 |
| P-22 | Corregir en el próximo informe de actividades las inconsistencias D2 a D5 | Contractual | Desarrollador | Informe sin afirmaciones no verificables | [Estado real](../00_LEEME/ESTADO_REAL_DEL_PROYECTO.md#5-inconsistencias-documentales-encontradas) |
| P-23 | Integrar a `main` los cambios de esta entrega | Técnico | Responsable del repositorio | PR revisado e integrado | — |
