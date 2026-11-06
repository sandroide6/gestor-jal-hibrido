#!/usr/bin/env bash
# Respaldo cifrado de la base de datos del Gestor JAL (auditoría 2026-11-05, P0-1).
#
# Uso:   DATABASE_URL=... BACKUP_PASSPHRASE=... deploy/backup/respaldar.sh [carpeta_destino]
#
# Genera en la carpeta destino (por defecto ./respaldos):
#   gestor_jal_<fecha>.dump.gpg   pg_dump en formato custom, cifrado con AES256 (gpg)
#   gestor_jal_<fecha>.conteos    filas por tabla en el momento del respaldo (sin datos)
#   gestor_jal_<fecha>.sha256     huella del archivo cifrado
#
# Solo se respalda el esquema public (el de la aplicación). En Supabase, los esquemas
# internos (auth, storage, …) no los usa la app y no se pueden restaurar en un Postgres
# normal. El cliente pg_dump debe ser de la misma versión mayor que el servidor o más
# nueva (Supabase usa PostgreSQL 17).
#
# Los respaldos llevan datos personales (cédulas, nombres, firmas): por eso se cifran
# siempre. Sin BACKUP_PASSPHRASE el script no corre. Guarda la frase en un lugar
# distinto del respaldo; sin ella el archivo no se puede abrir.
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE (frase para cifrar el respaldo)}"

DEST="${1:-./respaldos}"
mkdir -p "$DEST"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
BASE="$DEST/gestor_jal_${STAMP}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[respaldo] pg_dump $(pg_dump --version | awk '{print $3}') → ${BASE}.dump.gpg"
pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 \
  --schema=public --no-owner --no-privileges --file="$TMP/db.dump"

# Conteo de filas por tabla: permite comprobar después que la restauración está completa
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 <<'SQL' > "${BASE}.conteos"
SELECT format('SELECT %L || ''|'' || count(*) FROM public.%I;', table_name, table_name)
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name
\gexec
SQL
if psql "$DATABASE_URL" -X -A -t -c "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='file_pdf'" | grep -q 1; then
  echo "documents_con_pdf|$(psql "$DATABASE_URL" -X -A -t -c 'SELECT count(*) FROM public.documents WHERE file_pdf IS NOT NULL')" >> "${BASE}.conteos"
fi

gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --output "${BASE}.dump.gpg" "$TMP/db.dump" 3<<<"$BACKUP_PASSPHRASE"

( cd "$DEST" && sha256sum "$(basename "${BASE}.dump.gpg")" > "$(basename "${BASE}.sha256")" )

echo "[respaldo] listo: $(du -h "${BASE}.dump.gpg" | cut -f1) cifrado, $(wc -l < "${BASE}.conteos") tablas contadas"
