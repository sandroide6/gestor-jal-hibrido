# Revisión de seguridad

Revisión de código y pruebas en un entorno local en modo producción, 29 a 31 de octubre de 2026. **No** es una prueba de penetración ni cubre la infraestructura de producción (sin acceso). No se usaron datos reales. Esta revisión no permite afirmar que el sistema sea seguro en todos los casos; muestra qué controles existen, cuáles se comprobaron y qué riesgos quedan.

## 1. Activos y amenazas

| Activo | Amenaza principal | Quién podría |
|---|---|---|
| Datos de ciudadanos (nombre, cédula, dirección, teléfono, correo, campos de las plantillas) | Exposición o fuga | Usuario interno con exceso de permisos, atacante externo, pérdida de una copia o un Excel |
| Firmas escaneadas de ediles | Uso indebido de la imagen de la firma | Cualquiera que reciba un Word generado |
| Cuentas de usuario | Robo de contraseña, fuerza bruta | Atacante externo |
| Claves del servidor (JWT, cifrado, base de datos) | Filtración | Error al compartir `.env`, cuentas personales comprometidas |
| Integridad de los documentos y del radicado | Alteración, duplicados | Usuario interno, error de software |
| Disponibilidad | Caída de servicios gratuitos, pérdida de datos | Proveedor, error humano |

## 2. Controles existentes

| Control | Estado | Evidencia |
|---|---|---|
| Contraseñas con bcrypt (costo 12); bloqueo de 15 min tras 10 intentos | Verificado | `authService.js`, pruebas, humo S05 |
| JWT RS256 en producción; arranque bloqueado sin claves o con las de ejemplo | Verificado | `config/env.js`, humo |
| Cookies httpOnly, `Secure` en HTTPS, CSRF por doble envío | Verificado | S06–S07 |
| Invalidación de sesiones al cambiar contraseña, desactivar o "cerrar todas" | Implementado | `tokens_invalid_before` |
| Verificación en dos pasos opcional | Implementado | TOTP |
| Autorización por rol en cada ruta y filtro por JAL | Verificado | S18–S34 |
| Protección contra acceso a documentos ajenos por identificador (IDOR) | Verificado | S23, S29–S30 |
| Validación de entradas (Joi) y de archivos subidos (tipo y tamaño) | Verificado con unitarias | `fileValidation.test.js` |
| helmet (CSP, HSTS), CORS con lista de orígenes, límites de peticiones | Implementado | `app.js`, `securityHardening.test.js`, `cors.test.js` |
| Errores 5xx sin detalle interno en producción | Implementado | `errorHandler.js` |
| Swagger y métricas ocultos en producción | Verificado | S02, S04 |
| Tokens de Drive cifrados; `state` OAuth firmado | Implementado | `utils/crypto.js`, `routes/backup.js` |
| RLS que cierra la API pública de Supabase | Implementado | Migración 26 |
| Auditoría de acciones | Verificado | S35 |
| Dependencias de producción sin vulnerabilidades conocidas | Verificado el 29-10-2026 | [npm-audit.txt](../11_CALIDAD/evidencias/2026-10-29/npm-audit.txt) |

## 3. Hallazgos

Severidad: **A** alta · **M** media · **B** baja.

| ID | Hallazgo | Sev. | Recomendación | Estado |
|---|---|---|---|---|
| SEG-01 | Los zip de copia (panel, Drive y scripts) **no se cifran** y contienen todos los datos personales | A | Cifrar en origen o guardar solo en destino cifrado; restringir quién descarga | Pendiente. Documentación corregida (antes decía "cifradas") |
| SEG-02 | Si no se define `ADMIN_INITIAL_PASSWORD`, el seeder crea el administrador con una contraseña de ejemplo que está en el código público. La validación de arranque no lo detecta | A | Verificar que en producción se cambió; exigir la variable en producción o forzar cambio en el primer ingreso | Pendiente de verificar en producción. Variable agregada a Docker y documentada |
| SEG-03 | Cuentas de GitHub, Vercel, Render, Supabase, Google, ngrok y Tailscale a nombre personal | A | Transferir a cuentas institucionales con dos factores | Pendiente |
| SEG-04 | Secreto TOTP guardado sin cifrar (`users.totp_secret`) | M | Cifrarlo con `ENCRYPTION_KEY` como los tokens de Drive (migración de datos) | Pendiente |
| SEG-05 | El chat IA envía nombres de beneficiarios recientes a un modelo en un PC personal por Tailscale | M | Quitar datos personales del contexto o desactivar el chat | Pendiente |
| SEG-06 | Detrás de Vercel y Render, si `TRUST_PROXY_HOPS` no coincide con los saltos reales, el límite de intentos puede aplicarse a todos a la vez o ser evadible | M | Verificar con el procedimiento de `PASOS_PENDIENTES` (IP en los registros) | Bloqueado (sin acceso) |
| SEG-07 | Aislamiento entre JAL solo en la aplicación; RLS sin políticas | M | Ver MJ-04 en [Estrategia multi-JAL](../08_REPLICACION/ESTRATEGIA_MULTIJAL.md) | Aceptable en Modelo A |
| SEG-08 | La firma del edil queda como imagen dentro del Word descargable; puede copiarse | M | Entregar al ciudadano solo el PDF; evaluar firma digital si el acto lo exige | Decisión de la JAL |
| SEG-09 | Exportaciones Excel y zip con datos personales sin marca ni control posterior | M | Registrar y limitar quién exporta (ya se audita `report.export_documents` y `backup.export`); instruir a usuarios | Parcial |
| SEG-10 | La aceptación de la política solo se exige en el frontend; la API funciona sin ella | B | Validar `consent_accepted_at` en el backend | Pendiente |
| SEG-11 | Al borrar definitivamente un usuario, la auditoría registra `user.delete` como éxito **antes** de borrar; si el borrado falla por tener documentos, queda un registro engañoso | B | Registrar después del borrado o registrar el fallo | Pendiente |
| SEG-12 | Cookies con `SameSite=None` en producción | B | Aceptable con el token CSRF; considerar `Lax` si frontend y API quedan en el mismo dominio (rewrite de Vercel) | Informativo |
| SEG-13 | Dependencias de **desarrollo** con avisos (vite, vitest, postcss, entre otras) | B | Actualizar en una rama con pruebas; no afectan producción | Pendiente |
| SEG-14 | Sin retención ni centralización de registros del servidor | B | Definir retención y acceso a los registros de Render o Docker | Pendiente |
| SEG-15 | La única regla de contraseña al crear usuarios es un mínimo de 8 caracteres (`validations/users.js`); no se revisan contraseñas comunes | B | Exigir longitud mayor (12) o frases de paso y rechazar contraseñas comunes | Pendiente |

## 4. Matriz de riesgo residual

| | Impacto bajo | Impacto medio | Impacto alto |
|---|---|---|---|
| **Probabilidad alta** | | | SEG-03 |
| **Probabilidad media** | SEG-13 | SEG-05, SEG-06, SEG-08, SEG-09 | SEG-01, SEG-02 |
| **Probabilidad baja** | SEG-10, SEG-11, SEG-12, SEG-14 | SEG-04, SEG-07 | |

## 5. Recomendaciones antes de operar con datos reales en una nueva instalación

1. Contraseña propia del administrador y 2FA activo para administradores.
2. Cuentas de servicio institucionales con dos factores.
3. Copias cifradas y con responsable.
4. Chat IA desactivado o sin datos personales.
5. Aviso de privacidad y responsable del tratamiento definidos ([Protección de datos](PROTECCION_DE_DATOS.md)).
6. Prueba de humo contra la URL real después de cada despliegue.
