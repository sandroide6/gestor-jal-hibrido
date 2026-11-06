#!/usr/bin/env bash
# Restaura (y verifica) un respaldo hecho con respaldar.sh (auditoría 2026-11-05, P0-1).
#
# Uso:   TARGET_DATABASE_URL=... BACKUP_PASSPHRASE=... \
#          deploy/backup/restaurar.sh respaldos/gestor_jal_<fecha>.dump.gpg --confirmar [--permitir-produccion]
#
# Pasos: comprueba la huella sha256, descifra, restaura con pg_restore --clean (reemplaza
# las tablas de la app en la base destino) y compara las filas por tabla con el archivo
# .conteos que se guardó al respaldar. Termina con código distinto de 0 si algo no cuadra,
# para que una restauración incompleta nunca se reporte como correcta.
#
# Protecciones:
#   --confirmar             obligatorio: la restauración reemplaza datos en el destino.
#   --permitir-produccion   obligatorio si el destino parece Supabase (supabase.co/.com).
#                           Para un ensayo usa siempre una base vacía o de prueba.
# Antes de restaurar sobre la base real, detén el backend (en Render: Suspend) para que
# nadie escriba durante la restauración, y saca un respaldo del estado actual.
set -euo pipefail

FILE="${1:-}"; shift || true
CONFIRM=0; ALLOW_PROD=0
for a in "$@"; do
  case "$a" in
    --confirmar) CONFIRM=1 ;;
    --permitir-produccion) ALLOW_PROD=1 ;;
    *) echo "Opción desconocida: $a" >&2; exit 2 ;;
  esac
done

[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "Uso: $0 <archivo.dump.gpg> --confirmar" >&2; exit 2; }
: "${TARGET_DATABASE_URL:?Falta TARGET_DATABASE_URL (base donde restaurar)}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"
[ "$CONFIRM" = 1 ] || { echo "Falta --confirmar: la restauración reemplaza las tablas del destino." >&2; exit 2; }
if echo "$TARGET_DATABASE_URL" | grep -Eq 'supabase\.(co|com)' && [ "$ALLOW_PROD" != 1 ]; then
  echo "El destino parece la base de producción (Supabase). Añade --permitir-produccion si de verdad quieres restaurar ahí." >&2
  exit 2
fi

BASE="${FILE%.dump.gpg}"
DIR="$(dirname "$FILE")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -f "${BASE}.sha256" ]; then
  ( cd "$DIR" && sha256sum --check --quiet "$(basename "${BASE}.sha256")" ) \
    || { echo "[restaurar] la huella sha256 no coincide: archivo dañado o alterado" >&2; exit 1; }
  echo "[restaurar] huella sha256 correcta"
else
  echo "[restaurar] aviso: no hay archivo .sha256 junto al respaldo" >&2
fi

gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt --output "$TMP/db.dump" "$FILE" 3<<<"$BACKUP_PASSPHRASE"
echo "[restaurar] descifrado correcto"

pg_restore --dbname="$TARGET_DATABASE_URL" --clean --if-exists --no-owner --no-privileges \
  --single-transaction --exit-on-error "$TMP/db.dump"
echo "[restaurar] pg_restore terminó sin errores"

if [ ! -f "${BASE}.conteos" ]; then
  echo "[restaurar] aviso: no hay .conteos; no se puede comprobar que esté completa" >&2
  exit 0
fi

FAIL=0
while IFS='|' read -r table expected; do
  [ -z "$table" ] && continue
  if [ "$table" = "documents_con_pdf" ]; then
    got="$(psql "$TARGET_DATABASE_URL" -X -A -t -c 'SELECT count(*) FROM public.documents WHERE file_pdf IS NOT NULL')"
  else
    got="$(psql "$TARGET_DATABASE_URL" -X -A -t -c "SELECT count(*) FROM public.\"$table\"")"
  fi
  if [ "$got" = "$expected" ]; then
    printf '  OK    %-28s %s\n' "$table" "$got"
  else
    printf '  FALLA %-28s esperado %s, restaurado %s\n' "$table" "$expected" "$got"; FAIL=1
  fi
done < "${BASE}.conteos"

if [ "$FAIL" = 1 ]; then
  echo "[restaurar] RESTAURACIÓN INCOMPLETA: los conteos no coinciden" >&2
  exit 1
fi
echo "[restaurar] restauración verificada: todos los conteos coinciden"
