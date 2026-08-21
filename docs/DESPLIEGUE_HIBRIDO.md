# Despliegue híbrido — Gestor JAL

Documenta cómo quedó desplegado **frontend + backend en la nube**, con la
**base de datos en Supabase** (Postgres administrado), eliminando el punto
único de falla del modo 100% local original.

> Este documento refleja el despliegue real, actualizado el 2026-08-21. Las
> URLs/IDs de esta sección son los de esa instalación; si vuelves a montar
> esto desde cero (otro PC, otra cuenta), los tuyos van a ser distintos, pero
> los pasos son los mismos.
>
> **Nota histórica**: la primera versión de este despliegue (2026-08-20)
> mantenía Postgres en el PC local, expuesto al backend en Render a través de
> un túnel Tailscale + proxy SOCKS5. Esa arquitectura se abandonó por
> decisión explícita del usuario el 2026-08-21 a favor de Supabase — el
> Postgres local **no se borró**, sigue intacto en el PC como respaldo, pero
> ya no es la fuente de verdad. Tailscale se conserva únicamente si se usa el
> chat IA (Ollama), que sí sigue corriendo en el PC.

---

## Estado actual (referencia rápida)

| Pieza | Valor |
|---|---|
| Repo | https://github.com/sandroide6/gestor-jal-hibrido |
| Frontend (Vercel) | https://gestor-jal-frontend-navy.vercel.app |
| Backend (Render) | https://gestor-jal-backend.onrender.com |
| Base de datos | Supabase, proyecto `gestor-jal` (`miwfoasdkbeoeelyuexn`), región `us-west-2` |
| Postgres local | Sigue instalado en el PC (puerto 5432, DB `gestor_jal`) — ya no en uso activo, respaldo |
| Ollama (opcional) | Local en el PC, alcanzado vía Tailscale si el chat IA está activo |

---

## Arquitectura

```
┌─────────────┐        HTTPS         ┌──────────────────────────────┐
│   Vercel    │ ───────────────────▶ │           Render              │
│  (frontend, │   VITE_API_URL       │  backend Node + LibreOffice   │
│  React/Vite)│ ◀─────────────────── │                                │
└─────────────┘        JSON/API      └───────┬──────────────┬─────────┘
                                              │              │
                                    DATABASE_URL       (opcional)
                                    SSL, pooler         Tailscale
                                              │              │
                                              ▼              ▼
                                    ┌──────────────┐   ┌─────────────┐
                                    │   Supabase    │   │    Tu PC     │
                                    │   (Postgres)  │   │  Ollama :11434│
                                    └──────────────┘   └─────────────┘
```

- El **frontend** (Vercel) solo habla HTTP/JSON con el backend.
- El **backend** (Render) se conecta directo a Supabase por TLS —
  conexión normal de Postgres, sin túnel ni proxy de por medio.
- **Tailscale es opcional**: solo se necesita si usas el chat IA (Ollama
  sigue corriendo en el PC local). Si no lo usas, el backend no necesita
  unirse a ningún tailnet.
- Si la nube completa (Vercel + Render + Supabase) falla, el modo 100%
  local de siempre (`iniciar.bat` + `tunel.bat`, con ngrok, apuntando al
  Postgres local que sigue intacto) sigue funcionando sin cambios.

---

## 1. Supabase — base de datos

### 1.1. Crear el proyecto
Cuenta gratis en https://supabase.com. Con la CLI (requiere un Personal
Access Token de https://supabase.com/dashboard/account/tokens — no hay
login por navegador en un entorno no interactivo):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase orgs list
supabase projects create gestor-jal --org-id TU_ORG_ID \
  --db-password "CONTRASEÑA_SEGURA_SIN_@/#?" --region us-west-2
```

Elige la región más cercana a donde corre el backend en Render (Oregon →
`us-west-2` es lo más cercano en la práctica).

### 1.2. Connection string — usar el pooler, no el host directo
**Error real que costó tiempo evitar**: el host directo
(`db.<ref>.supabase.co:5432`) en varias regiones de Supabase **solo resuelve
por IPv6**. Muchos contenedores/PaaS (Render incluido) no tienen ruta IPv6 de
salida, así que la conexión falla con timeout, no con un error claro.

Usar en cambio el **Session pooler** (compatible con IPv4, se comporta como
una conexión normal — a diferencia del *Transaction pooler* en el puerto
6543, que no soporta bien prepared statements/transacciones largas, algo que
Sequelize sí usa):

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Se obtiene con la API (`db_host`/`db_port` ahí son del *transaction* pooler,
puerto 6543 — para el *session* pooler es el mismo host con puerto 5432):
```bash
curl "https://api.supabase.com/v1/projects/<ref>/config/database/pooler" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

### 1.3. Migrar los datos del Postgres local
```bash
pg_dump --no-owner --no-privileges --clean --if-exists \
  "postgresql://postgres:TU_PASSWORD@localhost:5432/gestor_jal" \
  -f dump.sql

psql "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  -f dump.sql
```

Verificar con conteos de filas antes de dar por buena la migración:
```bash
psql "$LOCAL_URL"  -t -c "SELECT 'users', count(*) FROM users UNION ALL SELECT 'documents', count(*) FROM documents;"
psql "$SUPA_URL"   -t -c "SELECT 'users', count(*) FROM users UNION ALL SELECT 'documents', count(*) FROM documents;"
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
   | `DATABASE_URL` | connection string del Session pooler de Supabase (ver 1.2) |
   | `DB_SSL` | `true` (Supabase lo exige) |
   | `JWT_SECRET` / `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` — no reuses los de `backend/.env` local |
   | `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | par RSA para RS256 (obligatorio en producción, `validateEnv()` no arranca sin esto): `crypto.generateKeyPairSync('rsa', {modulusLength: 2048, ...})`, con los saltos de línea reales convertidos a `\n` literal en el valor de la env var |
   | `ALLOWED_ORIGINS` | el dominio de Vercel del paso 3 |
   | `TS_AUTHKEY` / `PROXY_TARGET_HOST` | dejar vacíos salvo que uses el chat IA (ver sección 4) |

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
> servidor — reintentando…" en el frontend (`ServerStatusBanner.jsx`) hace
> polling real cada 5s a `/health` y se quita solo cuando el backend
> despierta — no hace falta recargar la página.
>
> **Incidentes de plataforma**: Render depende de proveedores upstream (ej.
> Google Cloud) — hubo un incidente real que deshabilitó builds/deploys y
> el spin-up del free tier por casi una hora, sin relación con este proyecto.
> Revisar https://status.render.com si un deploy se queda pegado en
> `queued`/`BLOCKED` sin motivo aparente.

---

## 3. Vercel — frontend

Hecho con la CLI (`npm install -g vercel`, `vercel login`, `vercel link`,
`vercel env add VITE_API_URL production`, `vercel --prod`) — el resultado es
el mismo que hacerlo por el dashboard web:

1. Cuenta gratis en https://vercel.com.
2. Importar el repo, **Root Directory** = `frontend` (`frontend/vercel.json`
   ya trae la config de framework/rewrites para SPA).
3. Variable de entorno **Production**: `VITE_API_URL` = URL de Render del
   paso 2 **+ `/v1`** (ej. `https://TU_BACKEND.onrender.com/v1`) — el código
   del frontend llama rutas relativas (`/auth/login`, `/documents`, etc.)
   esperando que esta variable ya incluya el prefijo `/v1`; sin él, todo da
   404. Costó un ciclo de deploy no ponerlo la primera vez — verificar
   siempre con una prueba de login real en el navegador, no solo con curl a
   `/v1/...` directo (eso enmascara el bug: la ruta absoluta sí existe).
4. Deploy → dominio `https://TU_PROYECTO.vercel.app`.
5. Volver a Render y actualizar `ALLOWED_ORIGINS` con ese dominio exacto
   (recordar: hace falta un deploy nuevo en Render, no solo guardar la
   variable, para que el backend la relea — ver sección 2).

**Error real: cuenta equivocada.** Si el proyecto se crea mientras el
navegador tiene otra sesión de Google iniciada (ej. un dispositivo
compartido), Vercel puede quedar bajo una cuenta que no es la tuya. Cuando
el repo de GitHub está conectado, Vercel valida que el autor de los commits
tenga acceso al equipo — si no, bloquea los deploys con
`readyState: BLOCKED` y `"reason": "Git author ... must have access to the
team"`, sin mensaje claro en la UI normal (solo visible consultando la API:
`GET https://api.vercel.com/v13/deployments/<id>`). Si pasa esto: `vercel
logout && vercel login` con la sesión correcta, y recrear el proyecto
(`vercel link`) bajo esa cuenta.

---

## 4. Tailscale + Ollama (opcional, solo si usas el chat IA)

La base de datos ya no depende de esto. Si no usas el chat, se puede omitir
toda esta sección y dejar `TS_AUTHKEY`/`PROXY_TARGET_HOST` vacíos en Render.

1. Tailscale instalado en el PC (`winget install Tailscale.Tailscale`),
   autenticado (`tailscale up`). Anotar la IP asignada (`100.x.y.z`).
2. Ollama debe escuchar en la red, no solo en `localhost`:
   ```powershell
   [System.Environment]::SetEnvironmentVariable("OLLAMA_HOST", "0.0.0.0:11434", "User")
   # reiniciar el proceso ollama para que tome el cambio
   ```
3. Firewall de Windows — restringir el puerto al rango de Tailscale, no
   dejarlo abierto a toda la red (requiere PowerShell como administrador):
   ```powershell
   New-NetFirewallRule -DisplayName "Tailscale - Ollama (11434)" -Direction Inbound -Protocol TCP -LocalPort 11434 -RemoteAddress 100.64.0.0/10 -Action Allow -Profile Any
   ```
4. Auth key reusable para el contenedor de Render, en
   https://login.tailscale.com/admin/settings/keys — **debe ser
   "Reusable"**: una llave de un solo uso funciona la primera vez y falla
   con `invalid key` en cualquier reinicio posterior (Render reinicia
   contenedores todo el tiempo). Cuidado también con las dos pestañas
   parecidas de esa página: "Auth keys" (`tskey-auth-...`, la correcta) vs
   "API access tokens" (`tskey-api-...`, sirve para la API REST de
   Tailscale, no para `tailscale up`).
5. En Render: `TS_AUTHKEY` = la llave del paso anterior, `PROXY_TARGET_HOST`
   = la IP de Tailscale del PC, `OLLAMA_URL=http://127.0.0.1:11434`
   (127.0.0.1, no la IP de Tailscale directa — `entrypoint.sh` levanta un
   forwarder SOCKS5 local, ver `deploy/render/tailscale-db-proxy.js`, porque
   Render no permite `/dev/net/tun` y Tailscale solo puede correr en modo
   userspace-networking, que no enruta el tráfico normal de la app sin este
   puente).

---

## 5. Verificación end-to-end

```bash
# Login real
curl -X POST https://TU_BACKEND.onrender.com/v1/auth/login \
  -H "Origin: https://TU_FRONTEND.vercel.app" -H "Content-Type: application/json" \
  -c cookies.txt -d '{"email":"admin@jal.gov.co","password":"Admin1234!"}'
```

Probado en navegador real (no solo curl) con Playwright headless: login
completo, navegación a `/admin`, panel renderizado — confirma que
`VITE_API_URL`, CORS, cookies cross-origin y la conexión a Supabase
funcionan juntos, no solo por separado.

Generar un documento real (requiere que el usuario tenga firma registrada,
`POST /v1/users/me/firma`) confirma LibreOffice + guardado dual en BD
(columnas `file_docx`/`file_pdf`) — probado con un PDF de 143 KB con formato
completo (no el fallback plano de mammoth).

---

## 6. Ajustes opcionales

- **Google Drive backup**: agregar en Google Cloud Console el redirect URI
  `https://TU_BACKEND.onrender.com/v1/backup/drive/callback`, actualizar
  `GOOGLE_REDIRECT_URI`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en Render.

---

## 7. Checklist

- [x] Proyecto Supabase creado, datos migrados y verificados (conteos de filas)
- [x] `DATABASE_URL`/`DB_SSL=true` en Render apuntando al Session pooler
- [x] `npm run db:migrate` corrido (columnas `file_docx`/`file_pdf`)
- [x] Backend desplegado en Render, `/health` responde `ok`
- [x] Frontend desplegado en Vercel, bajo la cuenta correcta
- [x] `ALLOWED_ORIGINS` en Render con el dominio de Vercel
- [x] Login probado end-to-end en navegador real (Playwright)
- [x] Documento de prueba generado y verificado (LibreOffice + guardado en BD)
- [x] Banner de "servidor no disponible" hace polling real y se autocorrige
- [ ] Redirect URI de Google (solo si se usa backup a Drive)
- [ ] Tailscale + Ollama (solo si se usa el chat, ver sección 4)

## 8. Volver al modo 100% local (fallback de emergencia)

El Postgres local **sigue intacto** (no se tocó ni se borró al migrar a
Supabase) — puede usarse como respaldo si la nube falla:

```
iniciar.bat   # arranca backend + frontend en el PC, usando el Postgres local
tunel.bat     # expone todo por ngrok en un solo puerto
```

Nota: `backend/.env` local sigue apuntando al Postgres del PC (no a
Supabase) — los dos ambientes están desacoplados a propósito. Si generas
documentos en modo local, esos datos NO se sincronizan automáticamente con
Supabase.
