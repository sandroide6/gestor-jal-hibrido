#!/usr/bin/env bash
# Prueba de humo de la imagen de Render (auditoría 2026-11-05, P2-5). La usa la CI y se
# puede correr en local con Docker. Arranca la imagen contra un PostgreSQL vacío con
# RUN_MIGRATIONS=true, siembra la base y recorre el flujo principal: cambio obligatorio
# de la contraseña inicial, firma, documento con plantilla oficial, PDF hecho por
# LibreOffice DENTRO de la imagen y descarga.
#
# Uso: DATABASE_URL=postgresql://...  deploy/render/prueba-imagen.sh <imagen>
# Requiere que el contenedor alcance DATABASE_URL con --network host.
set -euo pipefail
IMAGE="${1:?Uso: $0 <imagen>}"
: "${DATABASE_URL:?Falta DATABASE_URL}"
PORT="${PORT:-3001}"
BASE="http://localhost:${PORT}"
WORK="$(mktemp -d)"
NAME="gestor-prueba-$$"
trap 'docker logs "$NAME" > "$WORK/contenedor.log" 2>&1 || true; docker rm -f "$NAME" >/dev/null 2>&1 || true; [ "${OK:-0}" = 1 ] || { echo "--- log del contenedor"; tail -n 60 "$WORK/contenedor.log"; }; rm -rf "$WORK"' EXIT

ADMIN_PASS="Inicial-$(openssl rand -hex 6)"
NEW_PASS="Propia-$(openssl rand -hex 6)!"
node "$(dirname "$0")/../generar-claves.js" > "$WORK/claves.env"

docker run -d --name "$NAME" --network host --env-file "$WORK/claves.env" \
  -e NODE_ENV=production -e PORT="$PORT" -e DATABASE_URL="$DATABASE_URL" -e DB_SSL=false \
  -e RUN_MIGRATIONS=true -e ADMIN_INITIAL_PASSWORD="$ADMIN_PASS" \
  -e ALLOWED_ORIGINS=https://ejemplo.vercel.app "$IMAGE" > /dev/null

echo "[prueba] esperando /health/live…"
for i in $(seq 1 60); do curl -sf "$BASE/health/live" > /dev/null && break; sleep 2; done
curl -sf "$BASE/health/live" > /dev/null || { echo "[prueba] FALLA: el contenedor no respondió"; exit 1; }
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")" = 200 ] || { echo "[prueba] FALLA: /health sin base"; exit 1; }
echo "[prueba] OK  arranque, migraciones aplicadas y /health 200"

docker exec -e ADMIN_INITIAL_PASSWORD="$ADMIN_PASS" "$NAME" npx --no-install sequelize-cli db:seed:all > /dev/null
echo "[prueba] OK  seeder en producción con ADMIN_INITIAL_PASSWORD"

J="$WORK/cookies"
code=$(curl -s -c "$J" -o "$WORK/login.json" -w '%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@jal.gov.co\",\"password\":\"$ADMIN_PASS\"}" "$BASE/v1/auth/login")
[ "$code" = 200 ] && grep -q '"must_change_password":true' "$WORK/login.json" || { echo "[prueba] FALLA: login inicial ($code)"; exit 1; }
csrf() { awk '$6=="csrf_token"{print $7}' "$J"; }
[ "$(curl -s -b "$J" -o /dev/null -w '%{http_code}' "$BASE/v1/users")" = 403 ] || { echo "[prueba] FALLA: no exige cambiar la contraseña"; exit 1; }
curl -sf -b "$J" -c "$J" -X PATCH -H "X-CSRF-Token: $(csrf)" -H 'Content-Type: application/json' \
  -d "{\"currentPassword\":\"$ADMIN_PASS\",\"newPassword\":\"$NEW_PASS\"}" "$BASE/v1/auth/change-password" > /dev/null
[ "$(curl -s -b "$J" -o /dev/null -w '%{http_code}' "$BASE/v1/users")" = 200 ] || { echo "[prueba] FALLA: tras cambiar la contraseña"; exit 1; }
echo "[prueba] OK  contraseña inicial obligatoria de cambiar"

FIRMA="$(dirname "$0")/../../frontend/public/icons/icon-192x192.png"
curl -sf -b "$J" -H "X-CSRF-Token: $(csrf)" -F "firma=@$FIRMA;type=image/png" "$BASE/v1/users/me/firma" > /dev/null
code=$(curl -s -b "$J" -o "$WORK/doc.json" -w '%{http_code}' -H "X-CSRF-Token: $(csrf)" -H 'Content-Type: application/json' \
  -d '{"client_local_id":"prueba-imagen-1","doc_type_id":"00000000-0000-0000-0000-000000000023","beneficiary_name":"Prueba Imagen","beneficiary_id":"9990001","fecha":"2026-11-05","nombre":"Prueba Imagen","tipodeidentificacion":"CC","numerodocumento":"9990001","lugardedocumento":"Medellín","direccion":"Calle 1","tiemporesidencia":"1 año"}' \
  "$BASE/v1/documents")
[ "$code" = 201 ] || { echo "[prueba] FALLA: crear documento ($code) $(cat "$WORK/doc.json")"; exit 1; }
ID=$(sed -E 's/.*"id":"([^"]+)".*/\1/' "$WORK/doc.json")
curl -sf -b "$J" -o "$WORK/doc.pdf" "$BASE/v1/documents/$ID/download?format=pdf"
head -c 5 "$WORK/doc.pdf" | grep -q '%PDF' || { echo "[prueba] FALLA: la descarga no es un PDF"; exit 1; }
if strings "$WORK/doc.pdf" | grep -q 'Producer<FEFF004C0069006200720065004F006600660069006300650'; then
  echo "[prueba] OK  documento con plantilla oficial y PDF generado por LibreOffice dentro de la imagen ($(wc -c < "$WORK/doc.pdf") bytes)"
else
  echo "[prueba] FALLA: el PDF no lo generó LibreOffice (se usó el respaldo sin estilos)"; exit 1
fi

OK=1
echo "[prueba] imagen verificada"
