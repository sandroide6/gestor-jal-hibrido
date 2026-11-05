# Runbook de incidentes (producción en la nube)

Pasos concretos para los incidentes más probables de la modalidad nube (Vercel → Render → Supabase). Complementa la sección 4 de [Operación y mantenimiento](OPERACION_Y_MANTENIMIENTO.md), que define severidades y cómo registrar cada incidente. Creado en las correcciones de la auditoría del 05-11-2026.

**Antes de cualquier paso que cambie datos:** descargar el último respaldo del workflow «Respaldo diario» (GitHub › Actions › Respaldo diario › último run verde › artefacto) o lanzarlo a mano con *Run workflow*.

## Cómo me entero

| Señal | Dónde llega | Qué significa |
|---|---|---|
| «Monitor y keepalive» en rojo (3 fallos seguidos de `/v1/health`) | Correo de GitHub y, si está configurado, `ALERT_WEBHOOK_URL` | El sistema no responde desde fuera |
| Aviso `server_error` o `db_unavailable` | `ALERT_WEBHOOK_URL` (máx. uno cada `ALERT_THROTTLE_MIN` minutos por tipo) | El backend devolvió 5xx o perdió la base |
| Aviso `fatal` | `ALERT_WEBHOOK_URL` | El proceso se cayó por un error no controlado; Render lo reinicia solo |
| «Respaldo diario» en rojo | Correo de GitHub y webhook | No hay respaldo de hoy, o la restauración de prueba no cuadró |
| Aviso de tamaño de la base | Webhook y advertencia en el run del respaldo | La base pasó `DB_SIZE_ALERT_MB` (350 MB por defecto; el plan gratuito tiene 500 MB) |
| Banner «La base de datos no responde» en la app | Usuarios | El backend responde pero la base no (503 `DB_UNAVAILABLE`) |

Los avisos nunca llevan datos personales: solo tipo, resumen, ruta sin parámetros y `requestId`.

## 1. Supabase pausado o base caída

**Síntoma:** `/health/live` responde 200 pero `/health` y la app devuelven 503 `DB_UNAVAILABLE`; el banner rojo aparece en la app. En el plan gratuito, Supabase pausa el proyecto tras 7 días sin actividad.

1. Entrar al panel de Supabase › proyecto. Si dice *Paused*, pulsar **Restore project** (tarda unos minutos).
2. Si no está pausado: *Project Settings › Infrastructure* y la página de estado de Supabase. Revisar si se cambió la contraseña de la base (en ese caso, actualizar `DATABASE_URL` en Render).
3. No hace falta reiniciar Render: el backend reintenta la conexión y vuelve solo. Comprobar `https://<frontend>/v1/health` → 200.
4. Para que no se repita: el monitor cada 10 minutos y el respaldo diario mantienen actividad en la base. Si los workflows se desactivaron (GitHub lo hace tras 60 días sin actividad en el repositorio), reactivarlos en *Actions*.

## 2. Render caído o lento

**Síntoma:** monitor en rojo; la app muestra «El servidor se está despertando…» por más de dos minutos.

1. Panel de Render › servicio › **Events** y **Logs**. Buscar `level":"error"` y la última línea de arranque.
2. Si el despliegue falló en las migraciones (`RUN_MIGRATIONS=true`), el log dice qué migración falló y el servicio anterior sigue sirviendo. Corregir y volver a desplegar; no desactivar `RUN_MIGRATIONS` para «saltarla».
3. Si el proceso se reinicia en bucle: revisar el aviso `fatal` y el mensaje de `validateEnv` (variable obligatoria ausente o con valor de ejemplo).
4. Si está suspendido por horas del plan gratuito (750 h/mes), esperar al ciclo siguiente o pasar a un plan de pago. El monitor ya reduce el ritmo de 02:00 a 10:00 UTC para no agotarlas.
5. **Reinicio manual:** *Manual Deploy › Restart service* (no borra datos: los documentos y las firmas están en la base).

## 3. La base se acerca a 500 MB

1. Ver el tamaño en el run del respaldo diario (paso «Comprobar el tamaño de la base») o en el panel de Supabase › *Database › Usage*.
2. Los PDF y DOCX se guardan dentro de la base: es lo que más crece. Opciones, de menor a mayor esfuerzo: pasar a Supabase Pro; archivar documentos antiguos tras un respaldo verificado; mover los archivos a almacenamiento de objetos (cambio de código, no hecho).
3. No borrar documentos sin un respaldo restaurado y verificado del mismo día.

## 4. Restaurar un respaldo

Procedimiento completo en [Respaldo y restauración](RESPALDO_Y_RESTAURACION.md#1-respaldo-diario-cifrado-recomendado). Resumen:

1. Descargar el artefacto (`.dump.gpg`, `.conteos`, `.sha256`) del run del respaldo.
2. **Ensayar primero en una base vacía** (local o de prueba):
   `TARGET_DATABASE_URL=postgresql://…/prueba BACKUP_PASSPHRASE=… deploy/backup/restaurar.sh gestor_jal_<fecha>.dump.gpg --confirmar`
   Debe terminar con código 0 y «restauración verificada: todos los conteos coinciden».
3. Para restaurar en producción: suspender el servicio en Render, sacar un respaldo del estado actual, repetir el comando con la URL de Supabase y `--permitir-produccion`, reanudar Render, verificar `/health`, entrar y abrir un PDF.

## 5. Rotar secretos

| Secreto | Dónde se cambia | Efecto |
|---|---|---|
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | Render (generar con `node deploy/generar-claves.js`) | Se cierran todas las sesiones |
| `ENCRYPTION_KEY` | Render | Hay que volver a conectar Google Drive |
| Contraseña de la base | Supabase › *Database › Reset password*, luego `DATABASE_URL` en Render **y** el secreto `SUPABASE_DB_URL` de GitHub | Si se olvida GitHub, el respaldo diario falla (y avisa) |
| `BACKUP_PASSPHRASE` | Secreto de GitHub | Los respaldos anteriores **siguen necesitando la frase anterior**: guardarla hasta que caduquen (30 días) |
| `ALERT_WEBHOOK_URL` | Render y secreto de GitHub | Si el tema de ntfy.sh es público, cualquiera que lo adivine lee los avisos: usar un nombre largo y aleatorio |
| Contraseña de un usuario | Panel › Usuarios › restablecer | El usuario deberá cambiarla al entrar (`must_change_password`) |

Después de rotar: comprobar `/health`, iniciar sesión, y lanzar a mano «Respaldo diario».

## 6. Volver a una versión anterior

1. **Vercel (frontend):** *Deployments* › despliegue anterior › **Promote to Production** (instantáneo). El service worker de los usuarios se actualiza en la siguiente visita.
2. **Render (backend):** *Events* › despliegue anterior › **Rollback**.
3. **Si la versión nueva tenía migraciones:** el código anterior suele funcionar con columnas nuevas de más (las migraciones de esta entrega, 0027 y 0028, solo agregan columnas e índices). Si no, restaurar el respaldo previo al despliegue (sección 4) en vez de `db:migrate:undo`, que puede borrar columnas con datos.
4. Registrar el incidente y abrir un PR con la corrección; no editar en caliente.

## 7. Un usuario no puede entrar

| Mensaje | Causa | Qué hacer |
|---|---|---|
| «Cuenta bloqueada. Intente de nuevo en N minuto(s).» | 10 intentos fallidos | Esperar 15 minutos o que el administrador restablezca la contraseña |
| «Cuenta desactivada» | Usuario inactivo | Panel › Usuarios › activar |
| Ventana «Elige tu propia contraseña» que no se cierra | Contraseña inicial o restablecida | Es lo esperado: cambiarla |
| 403 «Origen no permitido» en todo | `ALLOWED_ORIGINS` no incluye el dominio del frontend | Corregir en Render |
| Muchos usuarios bloqueados a la vez o 429 en masa | `TRUST_PROXY_HOPS` mal ajustado | Ver la línea «Diagnóstico de proxy» del log de arranque |
