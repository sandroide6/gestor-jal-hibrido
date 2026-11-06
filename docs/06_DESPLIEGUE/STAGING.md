# Entorno de staging

Un entorno de pruebas igual a producción, pero con su propia base y sus propias claves, para probar un cambio (y medir la carga) antes de que llegue a los usuarios. Creado en las correcciones de la auditoría del 05-11-2026 (plan 4.2 y 5.1).

## Por qué no sirven las vistas previas de Vercel

`frontend/vercel.json` reenvía `/v1/*` **siempre** al backend de producción en Render, también en las vistas previas que Vercel crea para cada PR. Una vista previa es frontend nuevo contra backend y datos **reales**: sirve para mirar pantallas, nunca para crear documentos de prueba ni para pruebas de carga.

Por eso el staging es un único servicio de Render que sirve el frontend compilado y la API en el mismo origen (`deploy/staging/Dockerfile`), contra un proyecto de Supabase distinto. No necesita un proyecto de Vercel aparte ni toca `vercel.json`.

| | Producción | Staging |
|---|---|---|
| Frontend | Vercel | El mismo servicio de Render (`/frontend/dist`) |
| Backend | Render `gestor-jal-backend` (`render.yaml`) | Render `gestor-jal-staging` (`deploy/staging/render.staging.yaml`) |
| Base | Supabase de producción | **Otro** proyecto de Supabase (plan gratuito) |
| Rama | `main` | `staging` |
| Claves (JWT, cifrado, admin) | Las de producción | Generadas aparte; nunca copiar las de producción |
| Sentry | `SENTRY_ENVIRONMENT=production` | `SENTRY_ENVIRONMENT=staging` (mismo DSN, otro entorno) |
| Imagen | `deploy/render/Dockerfile.backend` | `deploy/staging/Dockerfile` (misma base, mismo LibreOffice, sin Tailscale) |

La CI construye la imagen de staging y le pasa la misma prueba de humo que a la de Render, más la comprobación de que sirve el frontend (`imagen-staging` en `.github/workflows/ci.yml`).

## Crearlo (una vez, en los paneles)

Estos pasos los hace quien administra las cuentas; no hay nada que ejecutar en el repositorio.

1. **Supabase:** *New project* → nombre `gestor-jal-staging`, región la misma de producción, contraseña nueva y larga. En *Project Settings › Database* copiar la cadena de conexión del *session pooler* (como en producción) y descargar el *SSL certificate*.
2. **Claves:** en un equipo propio, `node deploy/generar-claves.js` (imprime `JWT_SECRET`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` y `ENCRYPTION_KEY`). Elegir una `ADMIN_INITIAL_PASSWORD` distinta a la de producción.
3. **Rama:** `git push origin main:staging` (la rama de la que despliega el servicio).
4. **Render:** *New › Blueprint* → este repositorio → *Blueprint path* `deploy/staging/render.staging.yaml`. Render pide los valores marcados `sync: false`:
   - `DATABASE_URL`: la cadena del paso 1.
   - `DB_SSL_CA`: el contenido PEM del certificado (vacío conecta cifrado pero sin verificar el servidor, con aviso al arrancar).
   - `JWT_*`, `ENCRYPTION_KEY`, `ADMIN_INITIAL_PASSWORD`: los del paso 2.
   - `SENTRY_DSN`: el mismo DSN de producción (los eventos se separan por entorno) o vacío.
   - `ALERT_WEBHOOK_URL`: vacío, o un tema de ntfy distinto del de producción.
5. Si Render asigna otra URL que `https://gestor-jal-staging.onrender.com`, actualizar `ALLOWED_ORIGINS` en el panel.
6. Al primer arranque se aplican las migraciones (`RUN_MIGRATIONS=true`). Sembrar la base una vez desde *Shell* del servicio: `npx sequelize-cli db:seed:all`. Entrar con `admin@jal.gov.co` y la contraseña inicial; la app obliga a cambiarla.

El servicio es del plan gratuito: se duerme tras 15 minutos sin uso y comparte las 750 horas mensuales de la cuenta con producción. Suspenderlo (*Settings › Suspend*) cuando no se use.

## Usarlo

```bash
# Llevar una rama a staging (Render despliega solo)
git push origin <mi-rama>:staging        # --force si staging tenía otra rama

# Comprobar
curl -s https://gestor-jal-staging.onrender.com/health
```

Probar en `https://gestor-jal-staging.onrender.com` (la cabecera dice «JAL · STAGING»). Después, fusionar el PR a `main` como siempre.

## Prueba de carga contra staging

Es la medición que importa: el equipo local es mucho más rápido que los 0,1 CPU de Render Free. Instrucciones y umbrales en [carga/README.md](../../carga/README.md).

```bash
k6 run carga/escenario.js \
  -e BASE_URL=https://gestor-jal-staging.onrender.com \
  -e ADMIN_EMAIL=admin@jal.gov.co -e ADMIN_PASSWORD='<contraseña del admin de STAGING>'
```

Mientras corre, mirar *Metrics* del servicio en Render (memoria y CPU). Guardar la salida de k6 y una captura de *Metrics* como evidencia. Si el pico de memoria pasa de 450 MB de los 512 MB del plan, o `crear_documento` p95 pasa de 15 s, es una señal para el plan de pago (ver el análisis de planes).

## Ensayo de vuelta atrás (plan 4.4)

Hacerlo en staging antes de necesitarlo en producción:

1. Desplegar en staging una rama con una migración nueva.
2. Crear un documento.
3. *Events › despliegue anterior › Rollback*. Comprobar que la app sigue funcionando con la columna de más.
4. Restaurar en la base de staging el respaldo previo, con `deploy/backup/restaurar.sh … --confirmar` (ver [Respaldo y restauración](../07_OPERACION/RESPALDO_Y_RESTAURACION.md)).
5. Anotar los tiempos en el registro de incidentes como simulacro.

## Qué no hacer

- No poner en staging la `DATABASE_URL`, las claves JWT ni la `ENCRYPTION_KEY` de producción.
- No copiar la base de producción a staging: tiene datos personales (cédulas, direcciones). Para datos de prueba usar el seeder y k6.
- No conectar Google Drive real en staging.
