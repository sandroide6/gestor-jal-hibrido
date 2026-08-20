# Estrategia de Actualización Remota — Gestor JAL

## Modelo de despliegue

Cada cliente tiene su propia instalación independiente. No hay servidor central.
El acceso remoto al servidor del cliente se realiza vía túnel **ngrok** activado por el propio cliente.

---

## Vía A — Actualización con Docker (instalación recomendada)

Esta es la vía estándar cuando el cliente usa `docker-compose`.

### Prerequisitos
- Docker Desktop corriendo en el equipo del cliente
- Acceso SSH o PowerShell remoto habilitado en Windows (o ngrok TCP tunnel)
- El cliente ejecutó previamente `docker-compose up -d` desde `deploy/`

### Pasos

```powershell
# 1. Conectarse al equipo del cliente (vía ngrok TCP o TeamViewer / AnyDesk)
# 2. En el directorio deploy/ del proyecto:

cd C:\GestorJAL\deploy          # ruta donde está instalada la app

# 3. Detener los contenedores de aplicación (NO el de base de datos)
docker-compose stop backend frontend

# 4. Obtener la nueva imagen (si se usa un registry privado)
#    Si se distribuye como archivo .tar:
docker load -i gestor-jal-backend-v2.tar
docker load -i gestor-jal-frontend-v2.tar

# 5. Levantar con las nuevas imágenes
docker-compose up -d backend frontend

# 6. Ejecutar migraciones si las hay (solo cuando la nueva versión las incluye)
docker-compose exec backend npm run db:migrate

# 7. Verificar que el sistema responde
curl http://localhost/health
```

### Tiempo estimado: 2-5 minutos. Sin pérdida de datos (pgdata y backend-data son volúmenes persistentes).

---

## Vía B — Actualización nativa Windows (instalación con PM2)

Cuando el cliente no usa Docker y corre la app directamente con PM2.

### Prerequisitos
- Node.js y PM2 instalados
- Acceso remoto al equipo (ngrok + PowerShell Remoting, TeamViewer, etc.)

```powershell
# 1. Entrar al directorio de la app
cd C:\GestorJAL

# 2. Detener el backend con PM2
pm2 stop gestor-jal-backend

# 3. Descargar / descomprimir la nueva versión
#    (reemplazar archivos en backend/src/ y frontend/)
Expand-Archive -Path nueva-version.zip -DestinationPath . -Force

# 4. Instalar dependencias nuevas si las hay
npm install --prefix backend --omit=dev
npm install --prefix frontend

# 5. Recompilar el frontend
npm run build --prefix frontend

# 6. Ejecutar migraciones
cd backend && npm run db:migrate && cd ..

# 7. Reiniciar el backend
pm2 start ecosystem.config.js
pm2 save

# 8. Verificar
pm2 logs gestor-jal-backend --lines 20
```

---

## Acceso remoto durante la actualización

### Opción 1 — ngrok TCP (recomendada)
El cliente activa el túnel ngrok **antes** de la sesión de soporte.
Esto expone SSH o el puerto RDP del servidor Windows a internet de forma segura.

```powershell
# En el equipo del cliente (ejecutar como Administrador)
ngrok tcp 22     # SSH (si tiene OpenSSH)
ngrok tcp 3389   # RDP (Escritorio Remoto Windows)
```

El técnico recibe la URL (ej. `tcp://0.tcp.ngrok.io:12345`) y se conecta.

### Opción 2 — PowerShell Remoting en la red local
Si el técnico está en la misma red o VPN:

```powershell
# En el cliente (una vez, con permisos de Admin)
Enable-PSRemoting -Force

# Desde el equipo del técnico
Enter-PSSession -ComputerName 192.168.1.X -Credential (Get-Credential)
```

### Opción 3 — Herramientas de terceros
- **TeamViewer** / **AnyDesk**: el cliente instala y comparte el código de sesión
- Solo para soporte puntual; no depender de ellas para automatización

---

## Rollback

Si la actualización falla:

### Docker
```powershell
# Volver a la imagen anterior (Docker guarda la versión previa con tag)
docker-compose stop backend frontend
docker tag gestor-jal-backend:previous gestor-jal-backend:latest
docker-compose up -d backend frontend
```

### PM2 nativo
```powershell
# Restaurar el backup ZIP que se tomó antes de actualizar
python gestor.py restore backups\backup_pre_actualizacion.zip
pm2 restart gestor-jal-backend
```

---

## Checklist antes de cada actualización

- [ ] Crear backup antes de actualizar: `python gestor.py backup` o desde el panel → Backup
- [ ] Confirmar con el cliente la hora de la actualización (el sistema estará ~2-5 min sin servicio)
- [ ] Revisar si la nueva versión incluye migraciones de BD (`npm run db:migrate` puede necesitar ejecución manual)
- [ ] Probar el login y la generación de un documento después de la actualización
- [ ] Guardar el backup de `deploy/.env` en lugar seguro antes de modificar variables de entorno

---

## Seguridad del acceso remoto

- El token ngrok **es personal por instalación** — nunca compartir el mismo token entre clientes
- Activar el túnel **solo durante la sesión de soporte**, cerrarlo al terminar
- Usar autenticación fuerte (contraseña larga + 2FA si es posible) en el escritorio remoto
- Registrar en la bitácora del cliente: fecha, motivo y cambios realizados en cada actualización
