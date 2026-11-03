# Operación y mantenimiento

## 1. Roles de operación

Los nombres de las personas se asignan en el acta de entrega; aquí solo se definen los roles.

| Rol | Quién (por designar) | Funciones |
|---|---|---|
| Dueño del servicio | Subsecretaría | Decide prioridades, aprueba cambios y presupuesto |
| Administrador funcional | Persona de la JAL con rol administrador | Usuarios, tipos de documento, configuración, auditoría |
| Responsable técnico | Persona o contratista designado | Despliegue, actualizaciones, respaldos, incidentes |
| Responsable del tratamiento de datos | Por definir (Distrito o JAL) | Política, aviso, atención a titulares, incidentes de datos |
| Usuarios | Auxiliares y ediles | Uso diario; reportar fallas |

## 2. Matriz RACI [Propuesta]

R = ejecuta · A = aprueba y responde · C = consultado · I = informado.

| Actividad | Dueño del servicio | Admin. funcional | Resp. técnico | Resp. tratamiento | Usuarios |
|---|---|---|---|---|---|
| Crear y desactivar usuarios | I | R/A | C | I | |
| Cambiar plantillas o tipos de documento | A | R | C | C | I |
| Respaldo diario y verificación | I | I | R/A | I | |
| Ensayo trimestral de restauración | I | I | R | A | |
| Actualizar dependencias y versión | A | I | R | | I |
| Desplegar a producción | A | I | R | | I |
| Atender incidente técnico | I | C | R/A | I | C |
| Atender incidente de datos personales | I | C | R | A | |
| Atender consultas y reclamos de titulares | I | C | C | R/A | |
| Renovar cuentas y planes de servicios | A | | R | | |
| Revisión de auditoría | I | R | C | A | |

## 3. Tareas periódicas

| Frecuencia | Tarea | Responsable |
|---|---|---|
| Diaria | Comprobar que el respaldo se generó | Resp. técnico |
| Semanal | Revisar errores en el registro de la plataforma; revisar pendientes de revisión | Resp. técnico; ediles |
| Mensual | `npm audit` en backend y frontend; revisar usuarios activos y auditoría; copia fuera de línea | Resp. técnico; admin. funcional |
| Trimestral | Ensayo de restauración; revisar espacio de la base (los archivos crecen dentro de ella) | Resp. técnico |
| Semestral | Actualizar dependencias menores; revisar `docxtemplater-image-module-free`; revisar plantillas y textos legales | Resp. técnico; JAL |
| Anual | Rotar `JWT_PRIVATE_KEY`/`JWT_SECRET` (cierra todas las sesiones); revisar planes y costos; revisar esta documentación | Resp. técnico; dueño del servicio |

## 4. Incidentes

| Severidad | Ejemplo | Respuesta meta [Propuesta] |
|---|---|---|
| Crítica | Sistema caído en horario de atención; pérdida o exposición de datos | Atención el mismo día; aviso al dueño del servicio y, si hay datos personales, al responsable del tratamiento |
| Alta | No se generan PDF; un rol no puede trabajar | 1 día hábil |
| Media | Error en una plantilla; lentitud | 3 días hábiles |
| Baja | Mejora o texto | Siguiente versión |

**Pasos:** registrar (fecha, quién reporta, síntoma, `requestId` si aparece en el error) → contener (desactivar usuario, detener servicio, cambiar claves) → diagnosticar ([Diagnóstico](../06_DESPLIEGUE/INSTALACION_Y_DESPLIEGUE.md#8-diagnóstico)) → resolver → verificar → cerrar con lección aprendida.

**Incidente de seguridad de datos personales:** además, evaluar si debe reportarse a la Superintendencia de Industria y Comercio según el régimen de la Ley 1581 de 2012 y el registro de bases de datos; lo decide el responsable del tratamiento.

**Continuidad:** si el sistema no está disponible, la JAL puede emitir temporalmente en Word con las mismas plantillas y registrar después el documento para conservar el consecutivo [Propuesta: acordar con la JAL cómo se numeran esos documentos].

## 5. Cambio de claves ante sospecha de filtración

| Clave | Efecto de cambiarla |
|---|---|
| `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`/`JWT_SECRET` | Todas las sesiones se cierran |
| `ENCRYPTION_KEY` | Hay que reconectar Google Drive (los tokens cifrados dejan de leerse) |
| Contraseña de la base de datos | Actualizar `DATABASE_URL` en el servidor |
| Contraseñas de usuarios | El administrador las restablece; el usuario cierra sesiones en todos los equipos |
| Tokens de Google, ngrok, Tailscale | Revocar en el servicio correspondiente |

## 6. Mantenimiento del código

- Pruebas: `npm test` en `backend/` (necesita PostgreSQL de pruebas) y `frontend/`; `npm run lint`; CI en GitHub Actions corre lo mismo en cada PR.
- Antes de cada versión: pruebas, lint, build, migraciones en una copia de la base, prueba de humo.
- Registrar cambios en `CHANGELOG.md`.
- Deuda técnica conocida: ver la sección 7 del [Estado real](../00_LEEME/ESTADO_REAL_DEL_PROYECTO.md#7-mantenimiento-y-deuda-técnica).
