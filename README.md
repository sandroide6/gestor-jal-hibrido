# Gestor JAL — Sistema de Gestión Documental

Sistema de gestión documental para la Junta Administradora Local de Medellín.  
Genera documentos oficiales DOCX y PDF, funciona offline y permite acceso remoto vía **ngrok**.

---

## Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| **Generador de documentos** | Crea DOCX y PDF a partir de plantillas configurables con validaciones por campo |
| **Tipos de documento** | Administración de plantillas con campos dinámicos y reglas de validación opcionales |
| **Gestión de documentos** | Listado, revisión y eliminación de documentos con registro de auditoría completo |
| **Reportes con gráficas** | Estadísticas por tipo, usuario y día con gráficas interactivas (donut, barras, área) |
| **Backup en Google Drive** | Respaldo automático o manual en Drive con retención configurable y copia local |
| **Usuarios y roles** | Tres roles (administrador, edil, auxiliar) con control de acceso granular |
| **Auditoría** | Registro detallado de todas las acciones administrativas con etiquetas legibles |
| **Chat IA** | Asistente integrado para consultas sobre los documentos de la JAL |
| **Acceso remoto** | Túnel ngrok para exponer el sistema a internet desde un solo puerto |
| **PWA offline** | Funciona sin conexión gracias al Service Worker |

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite + Tailwind CSS + PWA (offline) |
| Backend | Node.js 24 + Express + Sequelize |
| Base de datos | PostgreSQL (Windows) |
| Gráficas | Recharts 3 |
| Acceso remoto | ngrok (dominio estático gratuito) |
| Scripts de gestión | Python 3.10+ con venv |

---

## Requisitos previos

| Herramienta | Notas |
|-------------|-------|
| **Python 3.10+** | Marcar "Add Python to PATH" al instalar |
| **Node.js 20 LTS o superior** | https://nodejs.org |
| **PostgreSQL** | Servicio debe estar corriendo en el puerto 5432 |
| **ngrok** | Se instala automáticamente vía `pyngrok` |

---

## Archivos .bat — acceso rápido

Todos se ejecutan con **doble clic** desde la carpeta del proyecto.

| Archivo | Qué hace |
|---------|----------|
| `configurar.bat` | **Primera vez.** Crea el venv, instala dependencias y prepara la base de datos |
| `iniciar.bat` | Inicia el backend y el frontend |
| `detener.bat` | Detiene todos los servicios |
| `estado.bat` | Muestra si los servicios están corriendo |
| `tunel.bat` | Inicia el túnel ngrok para acceso remoto |

---

## Instalación (primera vez)

1. Doble clic en **`configurar.bat`**
2. El asistente crea el entorno virtual Python, instala dependencias Node.js y ejecuta las migraciones

> Si PostgreSQL pide contraseña, la predeterminada del proyecto es `1234`.  
> Puedes cambiarla en `backend/.env` → variable `DB_PASSWORD`.

---

## Uso diario

### 1. Iniciar el sistema

Doble clic en **`iniciar.bat`**

El sistema arranca en:

| Servicio | URL |
|----------|-----|
| Frontend (desarrollo) | http://localhost:5173 |
| Backend / API | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/api-docs |

### 2. Abrir el navegador

Ve a **http://localhost:5173** e inicia sesión con:

| Campo | Valor |
|-------|-------|
| Correo | `admin@jal.gov.co` |
| Contraseña | `Admin1234!` |

### 3. Detener el sistema

Doble clic en **`detener.bat`**

### 4. Ver estado

Doble clic en **`estado.bat`**

---

## Túnel ngrok (acceso remoto)

El túnel expone el sistema a internet para que puedas acceder desde cualquier dispositivo o compartirlo con otras personas.

### Configurar el túnel

Abre **`tunel.bat`** con el Bloc de notas y edita las dos líneas del bloque de configuración:

```bat
set NGROK_AUTHTOKEN=tu_token_aqui
set NGROK_DOMAIN=tu-dominio.ngrok-free.dev
```

- **NGROK_AUTHTOKEN:** cópialo desde https://dashboard.ngrok.com/get-started/your-authtoken
- **NGROK_DOMAIN:** si tienes un dominio estático en ngrok, ponlo aquí. Si lo dejas vacío, ngrok asignará una URL aleatoria cada vez.

### Iniciar el túnel

1. Primero inicia el sistema con `iniciar.bat`
2. Luego doble clic en **`tunel.bat`**
3. La ventana muestra la URL pública del túnel

> El backend sirve el frontend compilado como archivos estáticos, por lo que **un solo puerto (3001) expone toda la aplicación** a través del túnel.

---

## Estructura del proyecto

```
gestor-jal-main/
├── backend/                Node.js + Express (API REST)
│   ├── src/                Código fuente del backend
│   ├── migrations/         Migraciones Sequelize
│   ├── seeders/            Datos iniciales (admin, tipos de doc)
│   ├── plantillas/         Plantillas .docx de la JAL
│   ├── data/output/        Documentos generados (se crea en runtime)
│   ├── data/backups/       Copias locales de los backups ZIP
│   └── .env                Variables de entorno (no subir a git)
│
├── frontend/               React 18 + Vite + PWA
│   ├── src/                Código fuente
│   ├── dist/               Build de producción (se genera con npm run build)
│   └── .env                VITE_API_URL=/v1
│
├── scripts/                Scripts Python de gestión
│   ├── requirements.txt    Dependencias Python (pyngrok, psycopg2, etc.)
│   ├── utils.py            Utilidades compartidas
│   ├── start.py            Inicia backend y frontend
│   ├── stop.py             Detiene los servicios
│   ├── status.py           Estado del sistema
│   ├── backup.py           Copia de seguridad
│   ├── restore.py          Restauración
│   └── ngrok_daemon.py     Proceso daemon del túnel ngrok
│
├── logs/                   Logs y PIDs (se crea en runtime)
├── backups/                Backups .zip (se crea en runtime)
├── venv/                   Entorno virtual Python (se crea con configurar.bat)
│
├── gestor.py               CLI principal (Python)
├── configurar.bat          Configuración inicial
├── iniciar.bat             Iniciar servicios
├── detener.bat             Detener servicios
├── estado.bat              Ver estado
└── tunel.bat               Iniciar túnel ngrok
```

---

## Variables de entorno

### `backend/.env`

```env
DATABASE_URL=postgresql://postgres:1234@localhost:5432/gestor_jal
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gestor_jal
DB_USER=postgres
DB_PASSWORD=1234

JWT_SECRET=cambia_esto_en_produccion

PORT=3001
NODE_ENV=development

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

STORAGE_PATH=./data/output
TEMPLATES_PATH=./plantillas
BACKUPS_LOCAL_PATH=./data/backups

JAL_NOMBRE=JAL Comuna 12 - La América - Medellín
JAL_NOMBRE_CORTO=JAL C12

NGROK_AUTHTOKEN=tu_token_aqui
NGROK_DOMAIN=tu-dominio.ngrok-free.dev

# Backup Google Drive (opcional)
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
```

### `frontend/.env`

```env
VITE_API_URL=/v1
```

> Este valor hace que todas las llamadas a la API usen rutas relativas (`/v1/...`),  
> lo que funciona tanto en local (via proxy Vite) como a través del túnel ngrok.

---

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| **Administrador** | Acceso total: usuarios, tipos de documentos, configuración JAL, backup, auditoría |
| **Edil** | Ver y revisar documentos de toda la JAL |
| **Auxiliar** | Generar sus propios documentos |

---

## Backup en Google Drive

El módulo de backup permite guardar copias de seguridad cifradas en Google Drive y localmente.

### Configurar credenciales OAuth

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilita la API de Google Drive
3. Crea credenciales OAuth 2.0 (tipo "Aplicación web")
4. Agrega como URI de redirección autorizado: `http://localhost:3001/v1/backup/drive/callback`
5. Copia el Client ID y Client Secret al archivo `backend/.env`

### Uso

- Ve a **Configuración → Backup Drive** en el panel de administración
- Conecta con Google Drive con el botón "Conectar con Google"
- Configura la frecuencia (horario, diario o semanal) y la retención
- Usa "Ejecutar backup ahora" para un respaldo manual inmediato
- Los backups locales se guardan en `backend/data/backups/` y se pueden descargar o abrir desde el panel

---

## Backups (línea de comandos)

### Crear backup
```bat
python gestor.py backup
```
Genera un `.zip` en `backups/` con el dump de PostgreSQL y los documentos generados.

### Restaurar backup
```bat
python gestor.py restore backups\backup_20260521_120000.zip
```

> Para que funcione, `pg_dump` y `psql` deben estar en el PATH de Windows.  
> Normalmente están en `C:\Program Files\PostgreSQL\18\bin`.

---

## Solución de problemas

### "Error al conectar con el servidor" al iniciar sesión
- Verifica que el backend esté corriendo: doble clic en `estado.bat`
- Comprueba que PostgreSQL esté activo: `services.msc` → busca `postgresql-x64-18`
- Asegúrate de abrir el navegador en **http://localhost:5173** (no en localhost:3001 directamente)

### PostgreSQL no conecta
- Verifica que el servicio esté corriendo en Windows (`services.msc`)
- Comprueba la contraseña en `backend/.env` → `DB_PASSWORD`

### Puerto 3001 o 5173 ocupado
```bat
netstat -ano | findstr :3001
taskkill /F /PID <numero_pid>
```

### El frontend no carga después de cambiar código
Reconstruye el frontend:
```bat
cd frontend
npm run build
```

### pg_dump no encontrado al hacer backup
Agrega la carpeta `bin` de PostgreSQL al PATH del sistema:
1. Panel de control → Sistema → Configuración avanzada → Variables de entorno
2. En **Path** del sistema, agrega: `C:\Program Files\PostgreSQL\18\bin`

### El túnel ngrok no arranca
- Verifica que el token en `tunel.bat` sea correcto
- Comprueba que el backend esté corriendo antes de iniciar el túnel
- Si el dominio estático no funciona, prueba dejando `NGROK_DOMAIN` vacío para usar una URL aleatoria

---

## Licencia y derechos

**Copyright © 2026 Santiago M. Todos los derechos reservados.**

Este software fue desarrollado por **Santiago M** para la Junta Administradora Local (JAL) de Medellín.

Queda prohibida la reproducción, distribución o modificación total o parcial de este software sin autorización expresa y por escrito del autor. El uso del sistema está restringido a los fines administrativos de la JAL para la cual fue creado.

> **Autor:** Santiago M  
> **Proyecto:** Gestor JAL — Sistema de Gestión Documental  
> **Año:** 2026
