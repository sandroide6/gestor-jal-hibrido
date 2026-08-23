#!/bin/sh
set -e

# Arranca Tailscale antes que Node. Desde que la base de datos vive en Supabase (no en
# el PC local), esto ya solo hace falta para Ollama/chat IA y para el receptor local de
# documentos (recibir_documentos.bat) — DATABASE_URL se conecta directo a Supabase, sin
# pasar por el tailnet. Si no usas ninguna de las dos cosas, TS_AUTHKEY puede quedar
# vacío y este bloque entero se salta sin afectar la BD.
TAILSCALE_SOCKET=/tmp/tailscaled.sock
SOCKS_PORT=1055

if [ -z "$TS_AUTHKEY" ]; then
  echo "[entrypoint] TS_AUTHKEY no configurado — arrancando sin Tailscale (solo afecta al chat IA/Ollama)." >&2
else
  mkdir -p /var/lib/tailscale
  # --socks5-server expone un proxy SOCKS5 local: en modo userspace-networking (sin
  # /dev/net/tun, que Render no permite) es la única forma de que el tráfico TCP normal
  # de la app llegue al tailnet — ver deploy/render/tailscale-db-proxy.js.
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

  # Forwarder local para Ollama: 127.0.0.1:11434 -> SOCKS5 -> PROXY_TARGET_HOST:11434.
  # OLLAMA_URL debe apuntar a http://127.0.0.1:11434.
  if [ -n "$PROXY_TARGET_HOST" ] && [ -n "$OLLAMA_URL" ]; then
    PROXY_LOCAL_PORT=11434 PROXY_TARGET_PORT=11434 PROXY_SOCKS_PORT="$SOCKS_PORT" \
      node /app/tailscale-db-proxy.js &
  fi

  # Forwarder local para el receptor de documentos (recibir_documentos.bat, puerto 4001
  # por defecto). LOCAL_DOC_RECEIVER_URL debe apuntar a http://127.0.0.1:4001.
  if [ -n "$PROXY_TARGET_HOST" ] && [ -n "$LOCAL_DOC_RECEIVER_URL" ]; then
    PROXY_LOCAL_PORT=4001 PROXY_TARGET_PORT=4001 PROXY_SOCKS_PORT="$SOCKS_PORT" \
      node /app/tailscale-db-proxy.js &
  fi
fi

exec node src/index.js
