# Despliegue híbrido — Gestor JAL

Documenta cómo quedó desplegado **frontend + backend en la nube**, manteniendo
**Postgres en el PC local**, eliminando el punto único de falla del modo
100% local original sin mover los datos de sitio.

> Este documento ya no es solo una guía prospectiva — refleja el despliegue
> real hecho el 2026-08-20. Las URLs/IDs de esta sección son los de esa
> instalación; si vuelves a montar esto desde cero (otro PC, otra cuenta),
> los tuyos van a ser distintos, pero los pasos son los mismos.

---

## Estado actual (referencia rápida)

| Pieza | Valor |
|---|---|
| Repo | https://github.com/sandroide6/gestor-jal-hibrido |
| Frontend (Vercel) | https://gestor-jal-frontend.vercel.app |
| Backend (Render) | https://gestor-jal-backend.onrender.com |
| IP Tailscale del PC | `100.127.254.17` (hostname `pc-jal-local`) |
| Postgres | Local, puerto 5432, DB `gestor_jal` |

---

## Arquitectura

```
┌─────────────┐        HTTPS         ┌──────────────────────────────┐
│   Vercel    │ ───────────────────▶ │           Render              │
│  (frontend, │   VITE_API_URL       │  backend Node + LibreOffice   │
│  React/Vite)│ ◀─────────────────── │  + tailscaled (userspace-net) │
└─────────────┘        JSON/API      └───────────────┬────────────────┘
                                                       │ SOCKS5 (localhost:1055)
                                          tailscale-db-proxy.js
                                          127.0.0.1:5432 → SOCKS5 → PROXY_TARGET_HOST
                                                       │
                                                  Tailscale
                                             (WireGuard, privado)
                                                       │
                                                       ▼
                                          ┌─────────────────────┐
                                          │        Tu PC         │
                                          │  Postgres :5432       │
                                          │  Ollama   :11434 (opc) │
                                          └─────────────────────┘
```

**Por qué hay un proxy SOCKS5 de por medio** (esto no estaba en el diseño
original, se descubrió al desplegar): Render no permite `/dev/net/tun` ni
`NET_ADMIN` en sus contenedores, así que Tailscale solo puede correr en modo
`--tun=userspace-networking`. En ese modo, el tráfico TCP normal de la app
(la conexión de `pg` a Postgres) **no** se enruta automáticamente por el
tailnet — no hay una interfaz de red real que lo intercepte. Lo único que
Tailscale expone es un proxy SOCKS5 local. `deploy/render/tailscale-db-proxy.js`
es un forwarder TCP minúsculo que escucha en `127.0.0.1:5432` dentro del
contenedor y reenvía por ese SOCKS5 hacia `PROXY_TARGET_HOST` (la IP de
Tailscale del PC) — así `DATABASE_URL` sigue siendo una URL de Postgres
normal y `backend/config/database.js` no necesita saber nada de SOCKS.

- El **frontend** (Vercel) solo habla HTTP/JSON con el backend.
- El **backend** (Render) es el único que se une al tailnet.
- **Postgres nunca se mueve ni se expone directamente a internet** — solo es
  alcanzable desde dispositivos del mismo tailnet privado, y encima
  `pg_hba.conf` acota el acceso al rango CGNAT de Tailscale (no `0.0.0.0/0`).
- Si la nube completa (Vercel + Render) falla, el modo 100% local de siempre
  (`iniciar.bat` + `tunel.bat`, con ngrok) sigue funcionando sin cambios.

---

## 1. Tailscale

### 1.1. PC local
Instalado con `winget install Tailscale.Tailscale`, autenticado con
`tailscale up --hostname=pc-jal-local`. IP asignada: `100.127.254.17`.

### 1.2. Postgres — permitir conexiones desde el tailnet
`listen_addresses = '*'` en `postgresql.conf` (ya lo estaba por defecto en
esta instalación — revísalo en la tuya).

`pg_hba.conf` — línea agregada, acotada al rango de Tailscale
(`100.64.0.0/10`, el CGNAT que usa toda la red de Tailscale), **no**
`0.0.0.0/0`:
```
host    gestor_jal    postgres    100.64.0.0/10    scram-sha-256
```
Después de editar, reiniciar el servicio (requiere PowerShell **como
administrador** — no se puede hacer con permisos normales):
```powershell
Restart-Service postgresql-x64-18
```

### 1.3. Auth key para el contenedor de Render
En https://login.tailscale.com/admin/settings/keys → "Generate auth key".

**Dos errores reales que costaron tiempo, para no repetirlos:**
- Si generas la llave **sin marcar "Reusable"**, funciona la primera vez que
  el contenedor arranca y falla con `invalid key` en cualquier reinicio
  posterior — Render reinicia contenedores todo el tiempo (deploys, sleep del
  free tier), así que una llave de un solo uso rompe el despliegue tarde o
  temprano. Siempre reusable.
- La página de Tailscale tiene **dos pestañas parecidas**: "Auth keys"
  (`tskey-auth-...`, sirve para `tailscale up --authkey`) y "API access
  tokens" (`tskey-api-...`, sirve para llamar a la API REST de Tailscale, NO
  para `tailscale up`). Si por error generas y usas un `tskey-api-...` como
  `TS_AUTHKEY`, falla con el mismo `invalid key`. Si eso pasa, ese mismo
  token de API sirve para generar la llave correcta por API:
  ```bash
  curl -X POST "https://api.tailscale.com/api/v2/tailnet/-/keys" \
    -u "tskey-api-XXXX:" -H "Content-Type: application/json" \
    -d '{"capabilities":{"devices":{"create":{"reusable":true,"ephemeral":false,"preauthorized":true}}},"expirySeconds":7776000}'
  ```

### 1.4. (Opcional) ACL restringiendo el acceso
En https://login.tailscale.com/admin/acls:
```json
{
  "tagOwners": {
    "tag:jal-backend": ["autogroup:admin"],
    "tag:jal-db":      ["autogroup:admin"]
  },
  "acls": [
    { "action": "accept", "src": ["tag:jal-backend"], "dst": ["tag:jal-db:5432", "tag:jal-db:11434"] }
  ]
}
```

---

## 2. Render — backend

1. Cuenta gratis en https://render.com, "Sign in with GitHub".
2. Dashboard → **New** → **Blueprint** → conectar el repo. `render.yaml`
   tiene que estar en la **raíz** del repo (no en una subcarpeta) para que
   Render lo detecte solo — hay un campo "Blueprint Path" para rutas
   personalizadas, pero la raíz es lo confiable.
3. **Ojo con "existing services that match this Blueprint"**: si ya tenías
   un servicio con el mismo nombre en Render (de un intento anterior, otro
   repo, etc.), el asistente ofrece "Associate existing services" — revisa
   a qué repo está conectado ANTES de aceptar (`render services --output
   json` con la CLI, campo `repo`). Asociar por error un servicio viejo
   apuntado a otro repo hace que el build use código equivocado sin ningún
   error visible al conectar.
4. Variables (`sync: false` en `render.yaml`, se piden en el dashboard):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | `postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/gestor_jal` — **127.0.0.1, no la IP de Tailscale** (ver arquitectura arriba) |
   | `DB_SSL` | `false` |
   | `PROXY_TARGET_HOST` | IP/MagicDNS de Tailscale del PC real (ej. `100.127.254.17`) |
   | `TS_AUTHKEY` | del paso 1.3 |
   | `JWT_SECRET` / `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` — no reuses los de `backend/.env` local |
   | `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | par RSA para RS256 (obligatorio en producción, `validateEnv()` no arranca sin esto): `crypto.generateKeyPairSync('rsa', {modulusLength: 2048, ...})`, con los saltos de línea reales convertidos a `\n` literal en el valor de la env var |
   | `ALLOWED_ORIGINS` | el dominio de Vercel del paso 3 |

   **Errores reales que costaron tiempo:**
   - Un typo en el *nombre* de la variable (`JWT_SECRET` escrito
     `JWT_SECREt`) o dejar `ENCRYPTION_KEY`/`JWT_PRIVATE_KEY` sin poner hace
     que `validateEnv()` mate el proceso al arrancar en producción — el log
     de Render solo dice "Application exited early", hay que mirar los logs
     de arranque para ver el mensaje real.
   - **Cambiar una env var no siempre alcanza con reiniciar el servicio**:
     `restart` no siempre releyó el valor nuevo en las pruebas hechas acá —
     lo que funcionó de forma confiable fue disparar un deploy nuevo
     (`render deploys create`, o simplemente hacer push).
5. Deploy. La primera build tarda varios minutos (instala LibreOffice).
6. Verificar: `https://TU_BACKEND.onrender.com/health` → `{"status":"ok",
   "checks":{"db":{"status":"ok"}}}`.

> **Free tier de Render**: el servicio duerme tras ~15 min sin tráfico — la
> primera petición después tarda ~30-50s. El banner "No se pudo contactar al
> servidor — reintentando…" en el frontend (`ServerStatusBanner.jsx`) cubre
> ese caso.

---

## 3. Vercel — frontend

Hecho con la CLI (`npm install -g vercel`, `vercel login`, `vercel link`,
`vercel env add VITE_API_URL production`, `vercel --prod`) — el resultado es
el mismo que hacerlo por el dashboard web:

1. Cuenta gratis en https://vercel.com.
2. Importar el repo, **Root Directory** = `frontend` (`frontend/vercel.json`
   ya trae la config de framework/rewrites para SPA).
3. Variable de entorno **Production**: `VITE_API_URL` = URL de Render del
   paso 2 (sin barra final).
4. Deploy → dominio `https://TU_PROYECTO.vercel.app`.
5. Volver a Render y actualizar `ALLOWED_ORIGINS` con ese dominio exacto
   (recordar: hace falta un deploy nuevo en Render, no solo guardar la
   variable, para que el backend la relea — ver sección 2).

---

## 4. Verificación end-to-end (ya hecha, referencia de cómo repetirla)

```bash
# Login real
curl -X POST https://TU_BACKEND.onrender.com/v1/auth/login \
  -H "Origin: https://TU_FRONTEND.vercel.app" -H "Content-Type: application/json" \
  -c cookies.txt -d '{"email":"admin@jal.gov.co","password":"Admin1234!"}'

# Generar un documento real (requiere que el usuario tenga firma registrada
# primero, POST /v1/users/me/firma) y confirma que LibreOffice + el guardado
# dual en Postgres funcionan — probado 2026-08-20, PDF de 143 KB con
# formato completo (no el fallback plano de mammoth), columnas file_docx/
# file_pdf pobladas en la fila de `documents`.
```

---

## 5. Ajustes opcionales (no configurados en este despliegue)

- **Google Drive backup**: agregar en Google Cloud Console el redirect URI
  `https://TU_BACKEND.onrender.com/v1/backup/drive/callback`, actualizar
  `GOOGLE_REDIRECT_URI`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en Render.
- **Ollama / chat IA**: hoy el proxy SOCKS5 solo reenvía el puerto 5432. Para
  que el chat funcione desde la nube haría falta levantar un segundo
  `tailscale-db-proxy.js` (o generalizar el script para varios puertos)
  apuntado a `11434`, más `OLLAMA_HOST=0.0.0.0:11434` en el Ollama del PC
  (por defecto solo escucha en `127.0.0.1`).

---

## 6. Checklist

- [x] Tailscale instalado en el PC, IP anotada (`100.127.254.17`)
- [x] `pg_hba.conf` actualizado y Postgres reiniciado
- [x] Auth key de Tailscale generado (reusable)
- [x] `npm run db:migrate` corrido (columnas `file_docx`/`file_pdf`)
- [x] Backend desplegado en Render, `/health` responde `ok`
- [x] Frontend desplegado en Vercel
- [x] `ALLOWED_ORIGINS` en Render con el dominio de Vercel
- [x] Login probado end-to-end desde el dominio de Vercel
- [x] Documento de prueba generado y verificado (LibreOffice + guardado en BD)
- [ ] Redirect URI de Google (solo si se usa backup a Drive)
- [ ] `OLLAMA_URL`/proxy para el puerto 11434 (solo si se usa el chat)
- [ ] Probado manualmente en el navegador (login + generar documento desde la UI, no solo por curl)
- [ ] ACL de Tailscale restringiendo el tag del backend (opcional, ver 1.4)

## 7. Volver al modo 100% local (fallback de emergencia)

```
iniciar.bat   # arranca backend + frontend en el PC
tunel.bat     # expone todo por ngrok en un solo puerto
```
