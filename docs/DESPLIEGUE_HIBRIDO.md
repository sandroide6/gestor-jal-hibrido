# Despliegue híbrido — Gestor JAL

Esta guía documenta cómo mover **frontend + backend a la nube** manteniendo
**Postgres en el PC local**, eliminando el punto único de falla actual (todo en
un solo computador) sin mover los datos de sitio.

> Todo lo que hay en este documento son **pasos manuales que ejecutas tú**.
> Ningún archivo de este repo hace un deploy real por sí solo — solo preparan
> la configuración.

---

## Arquitectura

```
┌─────────────┐        HTTPS         ┌──────────────────┐
│   Vercel    │ ───────────────────▶ │      Render       │
│  (frontend, │   VITE_API_URL       │  (backend Node,   │
│  React/Vite)│ ◀─────────────────── │  Docker + LibreOffice)
└─────────────┘        JSON/API      └─────────┬────────┘
                                                │
                                          Tailscale
                                       (WireGuard, privado)
                                                │
                                                ▼
                                     ┌─────────────────────┐
                                     │       Tu PC          │
                                     │  Postgres :5432       │
                                     │  Ollama   :11434 (opc) │
                                     └─────────────────────┘
```

- El **frontend** (Vercel) solo habla HTTP/JSON con el backend — no necesita
  saber nada de Tailscale ni de la base de datos.
- El **backend** (Render) es el único que se une al tailnet, y solo él
  necesita alcanzar el PC local.
- **Postgres nunca se mueve ni se expone directamente a internet** — solo es
  alcanzable desde dispositivos que pertenecen al mismo tailnet privado.
- Si la nube completa (Vercel + Render) tuviera un problema, el modo 100%
  local de siempre (`iniciar.bat` + `tunel.bat`, con ngrok) sigue funcionando
  sin cambios — no se tocó nada de esa ruta.

---

## 0. Prerrequisito: repositorio git

Este proyecto todavía no tiene un repositorio git inicializado. Tanto Vercel
como Render funcionan mejor conectados a un repo (GitHub/GitLab/Bitbucket):
cada `git push` dispara un deploy automático.

```powershell
git init
git add .
git commit -m "Preparar despliegue híbrido"
# Crea el repo en GitHub (vía web o `gh repo create`) y:
git remote add origin https://github.com/TU_USUARIO/gestor-jal.git
git push -u origin main
```

(También puedes desplegar sin git, subiendo el código directo con la CLI de
cada proveedor — más manual, sin despliegue automático en cada cambio.)

---

## 1. Tailscale — conectar el PC local con el backend en la nube

### 1.1. Instalar Tailscale en el PC (Windows)

1. Descarga e instala desde https://tailscale.com/download/windows
2. Inicia sesión (crea una cuenta gratis si no tienes — plan "Personal",
   gratis hasta 3 usuarios / 100 dispositivos).
3. Anota la IP de Tailscale que te asigna (`Configuración → General`, algo
   como `100.x.y.z`) o el nombre MagicDNS (`tu-pc.tailXXXXX.ts.net`,
   visible en https://login.tailscale.com/admin/machines).

### 1.2. Permitir que Postgres acepte conexiones desde el tailnet

Por defecto, Postgres en Windows solo escucha en `localhost`. Hay que decirle
que también escuche en la interfaz de Tailscale, y decirle a `pg_hba.conf` que
acepte conexiones desde el rango de Tailscale (no desde cualquier IP).

Archivos típicos (ajusta la versión, el README del proyecto ya usa la 18):
`C:\Program Files\PostgreSQL\18\data\postgresql.conf` y
`...\data\pg_hba.conf`.

**`postgresql.conf`** — busca la línea `listen_addresses` y déjala así:
```
listen_addresses = '*'
```
(o, más restrictivo, solo `localhost,100.x.y.z` con tu IP de Tailscale)

**`pg_hba.conf`** — agrega una línea acotada al rango de Tailscale
(`100.64.0.0/10`, el CGNAT que usa toda la red de Tailscale), **no**
`0.0.0.0/0`:
```
host    gestor_jal    postgres    100.64.0.0/10    scram-sha-256
```

Después reinicia el servicio de Postgres:
```powershell
Restart-Service postgresql-x64-18
```

> Esto es lo único "sensible" del lado local: solo dispositivos autenticados
> en tu tailnet (WireGuard) pueden siquiera llegar a este rango de IPs — no es
> una IP pública. Aun así, `pg_hba.conf` es una segunda capa de defensa.

### 1.3. Crear un Auth Key para el backend en Render

1. Ve a https://login.tailscale.com/admin/settings/keys
2. "Generate auth key" → reusable, con expiración razonable (ej. 90 días,
   recuerda renovarlo), y opcionalmente un tag propio (ej. `tag:jal-backend`).
3. Guarda el valor generado — es `TS_AUTHKEY` en Render (paso 3).

### 1.4. (Opcional pero recomendado) ACL restringiendo el acceso

En https://login.tailscale.com/admin/acls, limita el tag del backend a solo
los puertos que necesita del PC (5432 Postgres, 11434 Ollama si usas el chat):

```json
{
  "tagOwners": {
    "tag:jal-backend": ["autogroup:admin"],
    "tag:jal-db":      ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["tag:jal-backend"],
      "dst": ["tag:jal-db:5432", "tag:jal-db:11434"]
    }
  ]
}
```
Etiqueta tu PC con `tag:jal-db` y, cuando conectes el contenedor de Render,
etiquétalo con `tag:jal-backend` (se hace en el admin console, "Machines").

---

## 2. Render — backend

1. Crea cuenta en https://render.com (gratis, sin tarjeta).
2. Dashboard → **New** → **Blueprint** → conecta el repo de GitHub → Render
   detecta `render.yaml` automáticamente (tiene que estar en la raíz del repo
   — si alguna vez lo mueves, hay un campo "Blueprint Path" en el mismo paso
   para apuntarlo a otra ruta).
3. Render te pedirá cada variable marcada `sync: false`. Usa
   `deploy/render/.env.example` como referencia de qué poner en cada una —
   en particular:
   - `DATABASE_URL`: con la IP/MagicDNS de Tailscale del PC (paso 1.1).
   - `TS_AUTHKEY`: el valor del paso 1.3.
   - `ALLOWED_ORIGINS`: lo sabrás después del paso 3 (Vercel) — puedes volver
     a editarlo luego, Render permite cambiar env vars sin rehacer el
     Blueprint.
   - `JWT_SECRET` / `ENCRYPTION_KEY`: genera valores nuevos con
     `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
     — **no reuses** los que tengas en `backend/.env` local.
4. Deploy. La primera build tarda varios minutos (instala LibreOffice).
5. Verifica: `https://TU_BACKEND.onrender.com/health` debe responder
   `{"status":"ok", "checks":{"db":{"status":"ok"}}}`. Si da `503`/`degraded`,
   revisa `DATABASE_URL`/`DB_SSL`/Tailscale antes de seguir.

> **Free tier de Render**: el servicio "duerme" tras ~15 min sin tráfico —
> la primera petición después de dormir tarda ~30-50s (cold start). El
> banner "No se pudo contactar al servidor — reintentando…" que se agregó al
> frontend (`ServerStatusBanner.jsx`) cubre justo ese caso.

---

## 3. Vercel — frontend

1. Crea cuenta en https://vercel.com (gratis).
2. **Add New → Project** → importa el mismo repo de GitHub.
3. Vercel detecta Vite automáticamente (usa `frontend/vercel.json` ya
   incluido); configura **Root Directory** = `frontend`.
4. En **Settings → Environment Variables**, agrega:
   - `VITE_API_URL` = `https://TU_BACKEND.onrender.com` (la URL de Render del
     paso 2, sin barra final).
5. Deploy. Vercel te da un dominio `https://TU_PROYECTO.vercel.app`.
6. Vuelve a Render (paso 2.3) y actualiza `ALLOWED_ORIGINS` con este dominio
   exacto.

---

## 4. Ajustes finales

- **Google Drive backup** (si lo usas): en Google Cloud Console, agrega el
  nuevo redirect URI:
  `https://TU_BACKEND.onrender.com/v1/backup/drive/callback`, y actualiza
  `GOOGLE_REDIRECT_URI` en Render.
- **Ollama / chat IA** (si lo usas): asegúrate que Ollama en el PC escuche en
  la interfaz de Tailscale, no solo en `localhost` (por defecto Ollama
  escucha en `127.0.0.1:11434`; para exponerlo en la red hay que arrancarlo
  con `OLLAMA_HOST=0.0.0.0:11434` o similar) y que `OLLAMA_URL` en Render
  apunte a `http://<ip-tailscale-pc>:11434`.

---

## 5. Pendientes conocidos (decisión ya tomada, ejecución pendiente)

Estos dos puntos se decidieron con el usuario del proyecto durante la
migración; el código ya está preparado, pero falta el paso de ejecución real:

1. **Migración de esquema** (`backend/migrations/20260101000025-add-file-bytes-to-documents.js`):
   agrega las columnas `file_docx`/`file_pdf` (BYTEA) que usa el código para
   guardar los documentos generados también en Postgres (no solo en disco).
   **No se ha corrido.** Antes de desplegar el backend en Render, corre:
   ```bash
   cd backend
   npm run db:migrate
   ```
   contra tu Postgres local (con un backup previo, `python gestor.py backup`).
   Si no la corres, el backend seguirá funcionando pero perderá los
   documentos generados en la nube cada vez que Render reinicie el
   contenedor (disco efímero).

2. **LibreOffice headless**: el código ya intenta usarlo en Linux
   (`backend/src/services/libreOfficeConverter.js`), pero **no se ha podido
   probar en este PC Windows** (LibreOffice headless solo se ejercita en el
   contenedor de Render). Después del primer deploy, genera un documento de
   prueba desde la app en producción y compara el PDF resultante contra uno
   generado localmente con Word — si el formato se ve mal, revisa los logs
   de Render (`docxBufferToPdf` deja warnings de cuál conversor se usó).

---

## 6. Checklist antes de ir a producción

- [ ] Tailscale instalado en el PC, IP/MagicDNS anotada
- [ ] `postgresql.conf`/`pg_hba.conf` actualizados y Postgres reiniciado
- [ ] Auth key de Tailscale generado (y ACL aplicada, opcional)
- [ ] `npm run db:migrate` corrido localmente (columnas file_docx/file_pdf)
- [ ] Backend desplegado en Render, `/health` responde `ok`
- [ ] Frontend desplegado en Vercel, `VITE_API_URL` apunta al backend
- [ ] `ALLOWED_ORIGINS` en Render incluye el dominio final de Vercel
- [ ] Login probado end-to-end desde el dominio de Vercel
- [ ] Generar un documento de prueba y verificar el PDF (fidelidad LibreOffice)
- [ ] Redirect URI de Google actualizado (si se usa backup a Drive)
- [ ] `OLLAMA_URL` apuntando al PC vía Tailscale (si se usa el chat)

## 7. Volver al modo 100% local (fallback de emergencia)

Si la nube falla por completo, el modo local original sigue intacto y no
depende de nada de este documento:

```
iniciar.bat   # arranca backend + frontend en el PC
tunel.bat     # expone todo por ngrok en un solo puerto
```
