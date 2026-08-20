#!/bin/sh
set -e

# Arranca Tailscale antes que Node, para que DATABASE_URL/OLLAMA_URL (que apuntan a la
# IP o MagicDNS del PC local dentro del tailnet) ya sean alcanzables cuando el backend
# intente conectar. Modo userspace-networking: no requiere /dev/net/tun ni privilegios
# especiales, que Render (y la mayoría de PaaS) no exponen a los contenedores.
TAILSCALE_SOCKET=/tmp/tailscaled.sock

if [ -z "$TS_AUTHKEY" ]; then
  echo "[entrypoint] TS_AUTHKEY no configurado — arrancando sin Tailscale." >&2
  echo "[entrypoint] La conexión a la base de datos/Ollama local fallará hasta configurarlo." >&2
else
  mkdir -p /var/lib/tailscale
  tailscaled \
    --state=/var/lib/tailscale/tailscaled.state \
    --socket="$TAILSCALE_SOCKET" \
    --tun=userspace-networking &

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
fi

exec node src/index.js
