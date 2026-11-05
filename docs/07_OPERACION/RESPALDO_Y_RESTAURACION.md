# Respaldo y restauración

## 1. Respaldo diario cifrado (recomendado)

Desde las correcciones de la auditoría del 05-11-2026 hay un respaldo automático de la base de Supabase que **se restaura y se verifica cada vez que se genera**:

| Pieza | Qué hace |
|---|---|
| `deploy/backup/respaldar.sh` | `pg_dump` (formato custom, esquema `public`) cifrado con gpg AES256, más `.conteos` (filas por tabla) y `.sha256`. Sin `BACKUP_PASSPHRASE` no corre |
| `deploy/backup/restaurar.sh` | Comprueba la huella, descifra, `pg_restore --clean --single-transaction` y compara los conteos. Sale con código distinto de 0 si algo no cuadra. Exige `--confirmar`, y además `--permitir-produccion` si el destino parece Supabase |
| `.github/workflows/respaldo-diario.yml` | Cada día a las 07:30 UTC (02:30 en Colombia): respalda, restaura en un PostgreSQL 17 vacío, compara, mide el tamaño de la base y guarda el respaldo cifrado 30 días como artefacto. Si falla, avisa por correo de GitHub y por `ALERT_WEBHOOK_URL` |
| Job `respaldo` de la CI | Ensaya los dos scripts en cada PR con una base migrada y sembrada |

**Configuración (la hace el dueño del repositorio, una vez):** en GitHub › *Settings › Secrets and variables › Actions* crear los secretos `SUPABASE_DB_URL` (cadena del *session pooler*) y `BACKUP_PASSPHRASE` (frase larga, guardada también fuera de GitHub), y opcionalmente `ALERT_WEBHOOK_URL` y la variable `DB_SIZE_ALERT_MB`. Luego lanzar el workflow a mano con *Run workflow* y comprobar que termina en verde.

El repositorio es público: cualquiera con cuenta de GitHub puede descargar los artefactos. Por eso el respaldo **siempre** va cifrado y la frase nunca se escribe en el repositorio ni en los registros.

**Restaurar:** ver la sección 4 del [Runbook de incidentes](RUNBOOK_INCIDENTES.md#4-restaurar-un-respaldo). Evidencia de los ensayos (base vacía con PDF idéntico byte a byte, archivo alterado rechazado, frase incorrecta rechazada, protección de producción): `auditoria/correcciones-2026-11/evidencias/05-respaldo-restauracion.txt` en la carpeta de entrega.

## 1.1 Otros mecanismos de respaldo

| Mecanismo | Qué contiene | Cómo se restaura | Estado |
|---|---|---|---|
| **Scripts** `python gestor.py backup` (`scripts/backup.py`) | Volcado SQL completo (`database.sql`) y carpeta de documentos en disco, en un zip | `python gestor.py restore <zip>` (`scripts/restore.py`) | **Verificado tras corrección** (29-10-2026) |
| **Copia completa desde el panel** (Copias de seguridad › descargar; `GET /v1/admin/backup`) | Zip por JAL con usuarios, plantillas, tipos, documentos y archivos | **No hay** procedimiento ni herramienta de restauración | Respaldo verificado (S36); restauración pendiente |
| **Google Drive automático** | El mismo zip del panel, programado, y copia de cada documento emitido | Igual que el anterior | **Bloqueado**: Drive no conectado en producción |
| **Respaldo diario cifrado** (sección 1) | Base completa (esquema `public`, incluye PDF, DOCX y firmas) | `deploy/backup/restaurar.sh` | **Verificado** en cada ejecución y en la CI (05-11-2026) |
| **Copias propias de Supabase** | Dependen del plan contratado | Panel de Supabase | No verificado; el plan gratuito puede no incluir copias restaurables [Supuesto: confirmar el plan] |

**Ninguno de los zip está cifrado** (el respaldo diario de la sección 1 sí). Contienen datos personales de ciudadanos y deben guardarse en medios cifrados con acceso restringido. Solo los tokens OAuth de Drive se cifran (con `ENCRYPTION_KEY`).

## 2. Qué se probó

Detalle en [respaldo-restauracion.txt](../11_CALIDAD/evidencias/2026-10-29/respaldo-restauracion.txt). Con una base de prueba con datos ficticios:

- **Antes de la corrección:** al restaurar sobre la misma base con un dato modificado, el script mostró "Restauración completada" con 83 errores y **el dato no volvió**. Restaurar en una base vacía sí funcionaba.
- **Después de la corrección** (`pg_dump --clean --if-exists --no-owner --no-privileges`; `psql -v ON_ERROR_STOP=1 --single-transaction`):

| Escenario | Resultado |
|---|---|
| A. Base alterada (dato modificado, auditoría borrada, usuario agregado), restaurar sobre la misma base | Estado idéntico al original, 0 errores |
| B. Respaldo antiguo (sin `--clean`) sobre una base con datos | Se detiene, informa "no se aplicó ningún cambio" y la base queda intacta |
| C. Respaldo nuevo en base vacía | Correcto |
| D. Falla `pg_dump` | Informa y no deja un zip incompleto |

**Límites de la prueba:** solo Linux; no se probó contra Supabase; `gestor.py` termina con código 0 aunque la restauración falle (leer los mensajes `[OK]`/`[ER]`).

## 3. Procedimiento de restauración (scripts)

1. Detener el backend para que nadie escriba durante la restauración.
2. Hacer un respaldo del estado actual, aunque esté dañado.
3. `python gestor.py restore ruta/backup_AAAAMMDD_HHMMSS.zip`.
4. Si el respaldo es **anterior al 31-10-2026** (sin `--clean`), restaurarlo en una base **vacía** y luego apuntar `DATABASE_URL` a ella.
5. Arrancar el backend, revisar `/health`, contar documentos y usuarios, abrir un PDF.
6. Registrar la restauración (fecha, motivo, respaldo usado, resultado) en el registro de incidentes.

## 4. Política propuesta [Propuesta, pendiente de aprobación]

| Parámetro | Propuesta | Justificación |
|---|---|---|
| RPO (pérdida máxima aceptable) | 24 horas | Volumen bajo de documentos diarios; los documentos también se entregan impresos |
| RTO (tiempo máximo para volver a operar) | 1 día hábil | Hay alternativa manual temporal (Word) |
| Frecuencia | Diaria automática (workflow «Respaldo diario», ya implementado) y una mensual descargada y guardada fuera de línea | |
| Retención | 30 diarias (los artefactos del workflow caducan a los 30 días), 12 mensuales fuera de línea | Ajustar a la tabla de retención documental cuando exista |
| Ensayo de restauración | Trimestral, en una base de prueba, con registro | Una copia que no se ha restaurado no está probada |
| Cifrado | El respaldo diario ya sale cifrado (gpg AES256). Los zip del panel y de Drive: guardarlos en un destino cifrado o cifrarlos antes de moverlos | Ley 1581, principio de seguridad |
| Responsable | Responsable técnico designado por la Subsecretaría | |

## 5. Mejoras pendientes [Propuesta]

1. Herramienta de restauración para los zip del panel y de Drive, o eliminar esa vía y dejar solo el respaldo diario (`pg_dump`).
2. Cifrado de los zip del panel y de Drive en origen.
3. Código de salida distinto de 0 en `gestor.py` cuando la restauración falla (los scripts nuevos de `deploy/backup/` ya lo hacen).
4. ~~Probar el respaldo contra Supabase~~: lo hace el workflow diario en cuanto se configuren los secretos. La primera ejecución real queda pendiente de esa configuración.
