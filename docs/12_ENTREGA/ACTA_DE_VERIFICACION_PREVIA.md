# Lista de verificación previa a la entrega

> **Esto no es un acta.** Es una lista de chequeo para que la supervisión y quien recibe verifiquen la entrega por sí mismos. No contiene firmas, fechas de aprobación ni constancias: esas deben diligenciarse en el formato institucional que indique la Subsecretaría, solo cuando la verificación se haya hecho. La columna "Resultado de esta revisión" refleja lo comprobado del 29 al 31-10-2026 en un entorno de prueba.

| # | Punto a verificar | Cómo verificarlo | Resultado de esta revisión | Verificación de quien recibe |
|---|---|---|---|---|
| 1 | El código fuente completo está en un repositorio al que la entidad tiene acceso | Abrir el repositorio con una cuenta institucional | Repositorio en cuenta personal | ☐ |
| 2 | Las pruebas automáticas pasan | Ver CI del último commit o correr `npm test` | 539 de 539 en local | ☐ |
| 3 | Se puede instalar desde cero siguiendo la guía | Instalar en un equipo limpio con la [guía](../06_DESPLIEGUE/INSTALACION_Y_DESPLIEGUE.md) | Hecho en Linux; Docker y Windows sin probar | ☐ |
| 4 | La versión publicada coincide con la entregada | Comparar el commit desplegado con el entregado | No verificable (sin acceso) | ☐ |
| 5 | Se puede generar un documento con radicado, firma, Word y PDF | Prueba con datos ficticios | Sí (local) | ☐ |
| 6 | Los roles impiden acciones no permitidas | Probar como auxiliar y edil | Sí (local) | ☐ |
| 7 | Los datos de una JAL no se ven desde otra | Casos S27–S34 | Sí (local); radicado con código repetido falla | ☐ |
| 8 | Hay un respaldo reciente y se restauró con éxito | Restaurar en una base de prueba | Sí con scripts (local); sin probar en producción | ☐ |
| 9 | La contraseña inicial del administrador se cambió y tiene 2FA | Revisar en producción | No verificable | ☐ |
| 10 | Las claves de producción no son las de ejemplo y no están en el repositorio | Revisar variables del servidor y `git log` | El código impide arrancar con las de ejemplo; el repositorio no contiene `.env` | ☐ |
| 11 | Las cuentas de servicio están a nombre de la entidad | Revisar propietarios en GitHub, Vercel, Render, Supabase, Google | No | ☐ |
| 12 | Hay responsable del tratamiento, política y aviso de privacidad | Documento de designación y aviso publicado | No | ☐ |
| 13 | La titularidad y la licencia están definidas por escrito | Contrato o acuerdo | No | ☐ |
| 14 | Las plantillas tienen autorización para usar escudos y gráficas | Documento de autorización | No | ☐ |
| 15 | Los usuarios fueron capacitados | Listas de asistencia | No hay evidencia | ☐ |
| 16 | El material de capacitación muestra la versión entregada | Comparar videos con la aplicación | No (interfaz anterior) | ☐ |
| 17 | Existe un responsable técnico designado y recibió la transferencia | Acta de transferencia | No | ☐ |
| 18 | La documentación está completa y enlazada | Abrir el [índice](../00_LEEME/INDICE_GENERAL.md) | Sí | ☐ |

Observaciones de quien verifica:

______________________________________________________________________

______________________________________________________________________
