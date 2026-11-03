# Instalación y despliegue

Hay tres modalidades. Solo la **instalación local en Linux en modo producción** se ejecutó de punta a punta en esta revisión (29-10-2026). Las demás están documentadas y corregidas, pero **no se probaron desde cero** aquí. No se despliega nada sobre servicios reales sin autorización.

| Modalidad | Cuándo usarla | Guía detallada | Probada en esta revisión |
|---|---|---|---|
| A. Servidor propio con Docker Compose | La entidad tiene un servidor o PC dedicado | Sección 3 y `deploy/` | No (sin Docker en el entorno) |
| B. Nube: Vercel + Render + Supabase | Uso desde cualquier lugar sin servidor propio | Sección 4 y [DESPLIEGUE_HIBRIDO.md](../DESPLIEGUE_HIBRIDO.md) | No (sin acceso) |
| C. Windows local con asistentes `.bat` | Un solo PC en la sede | Sección 5 y [README](../../README.md) | No |
| Desarrollo o verificación (Linux) | Pruebas | Sección 2 | **Sí** |

## 1. Requisitos

| Componente | Versión | Nota |
|---|---|---|
| Node.js | ≥ 20 (probado con 22.22) | Backend y frontend |
| PostgreSQL | 16 probado; 18 en `docker-compose.yml`; Supabase en la nube | |
| LibreOffice | Cualquiera reciente | Necesario para PDF fiel en Linux (incluido en las imágenes Docker) |
| Python | ≥ 3.10 | Solo para los scripts de operación (`gestor.py`, respaldo y restauración) |
| `pg_dump` / `psql` | Misma versión mayor que el servidor o superior | Respaldo y restauración |
| Navegador | Chromium probado; Safari y Firefox sin probar | |

## 2. Instalación desde cero (verificada, Linux)

```bash
# 1. Base de datos vacía
createdb gestor_jal

# 2. Claves (imprime JWT_SECRET, ENCRYPTION_KEY y el par RSA en una línea cada uno)
node deploy/generar-claves.js

# 3. Backend
cd backend
cp .env.example .env     # completar DATABASE_URL, las claves del paso 2, NODE_ENV=production,
                         # ALLOWED_ORIGINS y ADMIN_INITIAL_PASSWORD (una contraseña robusta propia)
npm ci
npm run db:migrate
npm run db:seed          # crea la JAL inicial, el administrador y los tipos de documento
npm start                # http://localhost:3001

# 4. Frontend
cd ../frontend
npm ci
VITE_API_URL=/v1 VITE_JAL_NOMBRE="Nombre de la JAL" npm run build
# El backend sirve frontend/dist si existe; o publicar dist/ detrás de nginx.
```

**Verificación:** `curl http://localhost:3001/health` responde 200 con la base de datos en `ok`; entrar como administrador, cambiar la contraseña y generar un documento de prueba con datos ficticios. La prueba de humo usada en esta revisión está en [prueba-humo-produccion.cjs](../11_CALIDAD/evidencias/2026-10-29/prueba-humo-produccion.cjs).

## 3. Modalidad A: Docker Compose

```bash
cd deploy
cp .env.example .env
node generar-claves.js         # pegar los valores en .env
# completar contraseñas de PostgreSQL, ALLOWED_ORIGINS y ADMIN_INITIAL_PASSWORD
docker compose up -d
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed     # solo la primera vez
```

Correcciones hechas en esta entrega: `docker-compose.yml` no pasaba `ENCRYPTION_KEY`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` ni `ADMIN_INITIAL_PASSWORD` al backend, que en producción se habría detenido al arrancar; y en `.env.example` los comentarios al final de líneas vacías se leían como valores. Verificado con `docker compose config`; **el arranque de los contenedores no se probó**. Actualizaciones: [deploy/ACTUALIZACION.md](../../deploy/ACTUALIZACION.md).

## 4. Modalidad B: nube

Resumen; el paso a paso está en [DESPLIEGUE_HIBRIDO.md](../DESPLIEGUE_HIBRIDO.md).

1. **Supabase:** crear el proyecto y usar la cadena del *session pooler* como `DATABASE_URL`, con `DB_SSL=true`.
2. **Render:** crear el servicio desde `render.yaml` (imagen `deploy/render/Dockerfile.backend`). Cargar los secretos marcados `sync: false`: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` (agregados a `render.yaml` en esta entrega) y, si aplican, Google, Tailscale, receptor local, `TRUST_PROXY_HOPS` y `METRICS_TOKEN`. Las migraciones **no** corren solas: ejecutarlas contra Supabase antes de abrir el servicio.
3. **Vercel:** proyecto con raíz `frontend/`; `frontend/vercel.json` reenvía `/v1` y `/health` al backend de Render. Si cambia la URL del backend, cambiarla ahí.
4. **Verificar:** `/health`, inicio de sesión, documento de prueba y `TRUST_PROXY_HOPS` (que el registro muestre IP distintas para equipos distintos).

**Estado actual:** el rediseño (PR #10) está en `main` pero el despliegue en Vercel quedó detenido por un cambio de cuenta; la producción no se pudo verificar desde el entorno de revisión.

## 5. Modalidad C: Windows local

`configurar.bat` crea el entorno de Python, instala dependencias, crea el `.env` y ejecuta migraciones y seeders; `iniciar.bat` arranca; `detener.bat`, `estado.bat` y `tunel.bat` (ngrok) completan la operación. Requiere PostgreSQL instalado en Windows. Detalle en el [README](../../README.md).

## 6. Variables de entorno del backend

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a PostgreSQL |
| `DB_SSL` | En la nube | `true` para Supabase |
| `NODE_ENV` | Sí | `production` en cualquier instalación real |
| `JWT_SECRET` | Sí en producción | Distinta a la de ejemplo |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | Sí en producción | Par RSA en una línea con `\n` (usar `deploy/generar-claves.js`) |
| `ENCRYPTION_KEY` | Sí en producción | 32 bytes en hexadecimal; cifra los tokens de Drive. **Si se pierde, hay que volver a conectar Drive** |
| `ALLOWED_ORIGINS` | Sí si el frontend está en otro origen | Lista separada por comas |
| `PORT` | No | 3001 por defecto en el ejemplo |
| `ADMIN_INITIAL_PASSWORD` | Muy recomendada | Contraseña del administrador que crea el seeder |
| `TRUST_PROXY_HOPS` | Detrás de proxy | Por defecto 1 |
| `METRICS_TOKEN` | No | Habilita `/metrics` en producción |
| `STORAGE_PATH`, `TEMPLATES_PATH`, `MAX_FILE_SIZE_MB`, `BACKUPS_LOCAL_PATH` | No | Rutas y límites |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Solo para Drive | |
| `OLLAMA_URL`, `OLLAMA_MODEL` | Solo para el chat | |
| `LOCAL_DOC_RECEIVER_URL`, `LOCAL_DOC_RECEIVER_TOKEN` | Solo para el receptor local | |
| `LOG_SQL` | No | Depuración |

No las lee el backend (ver D6 y D7 del [Estado real](../00_LEEME/ESTADO_REAL_DEL_PROYECTO.md)): `JAL_NOMBRE`, `JAL_NOMBRE_CORTO`, `VAPID_*`. Frontend: `VITE_API_URL` (normalmente `/v1`) y `VITE_JAL_NOMBRE`.

**Nunca** subir `.env` al repositorio (está en `.gitignore`) ni enviar estos valores por correo o chat.

## 7. Actualización y vuelta atrás

1. Respaldar la base ([Respaldo](../07_OPERACION/RESPALDO_Y_RESTAURACION.md)).
2. Actualizar el código o la imagen.
3. `npm run db:migrate` (solo aplica las pendientes).
4. Verificar `/health` y un documento de prueba.
5. **Vuelta atrás:** volver a la versión anterior del código. Si la nueva versión tenía migraciones, preferir **restaurar el respaldo** del paso 1 antes que `db:migrate:undo`, porque deshacer migraciones en una base con datos puede borrar columnas. El procedimiento de vuelta atrás no se ha ensayado.

## 8. Diagnóstico

| Síntoma | Causa probable | Qué revisar |
|---|---|---|
| El backend se detiene al arrancar | Falta una clave obligatoria o tiene el valor de ejemplo | Mensaje de `validateEnv` en el registro |
| `/health` responde error de base de datos | `DATABASE_URL`, SSL o pooler | Probar la conexión con `psql` |
| PDF sin el diseño de la plantilla | No hay LibreOffice ni Word | Instalar LibreOffice en el servidor |
| Todos los usuarios quedan bloqueados a la vez por intentos | `TRUST_PROXY_HOPS` mal ajustado: todas las peticiones parecen venir de la misma IP | IP en el registro de `POST /v1/auth/login` |
| Error de CORS o 403 en todas las peticiones | `ALLOWED_ORIGINS` o falta de cookie CSRF | Origen del frontend y cookies del navegador |
| Primera carga muy lenta en la nube | El plan del servidor se suspende por inactividad | Plan del servicio |
