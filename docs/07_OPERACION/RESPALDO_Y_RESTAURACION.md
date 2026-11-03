# Respaldo y restauración

## 1. Mecanismos de respaldo

| Mecanismo | Qué contiene | Cómo se restaura | Estado |
|---|---|---|---|
| **Scripts** `python gestor.py backup` (`scripts/backup.py`) | Volcado SQL completo (`database.sql`) y carpeta de documentos en disco, en un zip | `python gestor.py restore <zip>` (`scripts/restore.py`) | **Verificado tras corrección** (29-10-2026) |
| **Copia completa desde el panel** (Copias de seguridad › descargar; `GET /v1/admin/backup`) | Zip por JAL con usuarios, plantillas, tipos, documentos y archivos | **No hay** procedimiento ni herramienta de restauración | Respaldo verificado (S36); restauración pendiente |
| **Google Drive automático** | El mismo zip del panel, programado, y copia de cada documento emitido | Igual que el anterior | **Bloqueado**: Drive no conectado en producción |
| **Copias propias de Supabase** | Dependen del plan contratado | Panel de Supabase | No verificado; el plan gratuito puede no incluir copias restaurables [Supuesto: confirmar el plan] |

**Ninguno de los zip está cifrado.** Contienen datos personales de ciudadanos y deben guardarse en medios cifrados con acceso restringido. Solo los tokens OAuth de Drive se cifran (con `ENCRYPTION_KEY`).

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
| Frecuencia | Diaria automática (Drive o tarea programada con `gestor.py backup`) y una mensual guardada fuera de línea | |
| Retención | 30 diarias, 12 mensuales | Ajustar a la tabla de retención documental cuando exista |
| Ensayo de restauración | Trimestral, en una base de prueba, con registro | Una copia que no se ha restaurado no está probada |
| Cifrado | Guardar los zip en un destino cifrado o cifrarlos antes de moverlos (p. ej. 7-Zip con AES-256) | Ley 1581, principio de seguridad |
| Responsable | Responsable técnico designado por la Subsecretaría | |

## 5. Mejoras pendientes [Propuesta]

1. Herramienta de restauración para los zip del panel y de Drive, o eliminar esa vía y dejar solo `pg_dump`.
2. Cifrado de los zip en origen.
3. Código de salida distinto de 0 en `gestor.py` cuando la restauración falla, para poder automatizar alertas.
4. Probar el respaldo y la restauración contra la base de Supabase.
