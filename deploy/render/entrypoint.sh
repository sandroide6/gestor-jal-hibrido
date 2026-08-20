#!/bin/sh
set -e

# Arranca Tailscale antes que Node, para que DATABASE_URL/OLLAMA_URL (que apuntan a la
# IP o MagicDNS del PC local dentro del tailnet) ya sean alcanzables cuando el backend
# intente conectar. Modo userspace-networking: no requiere /dev/net/tun ni privilegios
# especiales, que Render (y la mayoría de PaaS) no exponen a los contenedores.
TAILSCALE_SOCKET=/tmp/tailscaled.sock
SOCKS_PORT=1055

if [ -z "$TS_AUTHKEY" ]; then
  echo "[entrypoint] TS_AUTHKEY no configurado — arrancando sin Tailscale." >&2
  echo "[entrypoint] La conexión a la base de datos/Ollama local fallará hasta configurarlo." >&2
else
  mkdir -p /var/lib/tailscale
  # --socks5-server expone un proxy SOCKS5 local: en modo userspace-networking (sin
  # /dev/net/tun, que Render no permite) es la única forma de que el tráfico TCP normal
  # de la app (la conexión de `pg` a Postgres) llegue al tailnet — ver
  # deploy/render/tailscale-db-proxy.js para el porqué completo.
  tailscaled \
    --state=/var/lib/tailscale/tailscaled.state \
    --socket="$TAILSCALE_SOCKET" \
    --tun=userspace-networking \
    --socks5-server="localhost:${SOCKS_PORT}" &

  # Esperar a que el socket de tailscaled esté listo antes de autenticar
  i=0
  while [ ! -S "$TAILSCALE_SOCKET" ] && [ "$i" -lt 30 ]; do
    sleep 1
    i=$((i + 1))
  done

  tailscale --socket="$TAILSCALE_SOCKET" up \
    --authkey="$TS_AUTHKEY" \
    --hostname="${TS_HOSTNAME:-gestor-jal-backend}" \
    --accept-routes

  # Forwarder local: 127.0.0.1:5432 -> SOCKS5 -> Postgres del PC local.
  # DATABASE_URL debe apuntar a 127.0.0.1:5432 (no a la IP de Tailscale directamente);
  # PROXY_TARGET_HOST es la IP/MagicDNS real del PC dentro del tailnet.
  if [ -n "$PROXY_TARGET_HOST" ]; then
    PROXY_SOCKS_PORT="$SOCKS_PORT" node /app/tailscale-db-proxy.js &
  else
    echo "[entrypoint] PROXY_TARGET_HOST no configurado — no se levanta el forwarder de BD." >&2
  fi

  # Mismo forwarder, segunda instancia para Ollama (11434 -> 11434). Mismo PC, mismo
  # PROXY_TARGET_HOST — solo cambia el puerto. OLLAMA_URL debe apuntar a
  # http://127.0.0.1:11434, igual que DATABASE_URL apunta a 127.0.0.1:5432.
  if [ -n "$PROXY_TARGET_HOST" ] && [ -n "$OLLAMA_URL" ]; then
    PROXY_LOCAL_PORT=11434 PROXY_TARGET_PORT=11434 PROXY_SOCKS_PORT="$SOCKS_PORT" \
      node /app/tailscale-db-proxy.js &
  fi
fi

exec node src/index.js
