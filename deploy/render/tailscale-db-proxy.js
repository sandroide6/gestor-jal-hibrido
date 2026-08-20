'use strict';
// Reenvía una conexión TCP local (127.0.0.1:PROXY_LOCAL_PORT) hacia un host del
// tailnet, a través del proxy SOCKS5 que expone `tailscaled --tun=userspace-networking`.
//
// Por qué existe: en un contenedor sin privilegios (Render no permite NET_ADMIN ni
// /dev/net/tun), Tailscale solo puede correr en modo userspace-networking — y en ese
// modo el tráfico normal de la app (ej. la conexión TCP de `pg` a Postgres) NO se
// enruta automáticamente por el tailnet, porque no hay una interfaz de red real que
// lo intercepte. Tailscale expone en cambio un proxy SOCKS5 local; este script hace
// de puente para que Postgres/Ollama puedan seguir usando una URL de conexión TCP
// normal (127.0.0.1:PUERTO) sin que su código sepa nada de SOCKS.
const net = require('net');
const { SocksClient } = require('socks');

const LOCAL_PORT  = parseInt(process.env.PROXY_LOCAL_PORT || '5432', 10);
const TARGET_HOST = process.env.PROXY_TARGET_HOST;
const TARGET_PORT = parseInt(process.env.PROXY_TARGET_PORT || '5432', 10);
const SOCKS_HOST   = process.env.PROXY_SOCKS_HOST || '127.0.0.1';
const SOCKS_PORT   = parseInt(process.env.PROXY_SOCKS_PORT || '1055', 10);

if (!TARGET_HOST) {
  console.error('[tailscale-db-proxy] PROXY_TARGET_HOST no configurado — saliendo.');
  process.exit(1);
}

const server = net.createServer((localSocket) => {
  localSocket.pause();

  SocksClient.createConnection({
    proxy: { host: SOCKS_HOST, port: SOCKS_PORT, type: 5 },
    command: 'connect',
    destination: { host: TARGET_HOST, port: TARGET_PORT },
  })
    .then(({ socket: proxiedSocket }) => {
      localSocket.pipe(proxiedSocket);
      proxiedSocket.pipe(localSocket);
      localSocket.resume();

      const cleanup = () => {
        localSocket.destroy();
        proxiedSocket.destroy();
      };
      localSocket.on('error', cleanup);
      proxiedSocket.on('error', cleanup);
      localSocket.on('close', cleanup);
      proxiedSocket.on('close', cleanup);
    })
    .catch((err) => {
      console.error('[tailscale-db-proxy] fallo conectando vía SOCKS5:', err.message);
      localSocket.destroy();
    });
});

server.on('error', (err) => {
  console.error('[tailscale-db-proxy] error del servidor local:', err.message);
  process.exit(1);
});

server.listen(LOCAL_PORT, '127.0.0.1', () => {
  console.log(
    `[tailscale-db-proxy] 127.0.0.1:${LOCAL_PORT} -> SOCKS5(${SOCKS_HOST}:${SOCKS_PORT}) -> ${TARGET_HOST}:${TARGET_PORT}`
  );
});
