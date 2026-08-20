# Gestor JAL — Backend

API REST del sistema de gestión documental para la Junta Administradora Local de Medellín.

## Stack

- **Node.js 24** + **Express**
- **Sequelize** ORM con **PostgreSQL**
- **JWT** para autenticación
- **Multer** para carga de archivos
- **PizZip + docxtemplater** para generación de documentos DOCX
- **pdf-lib** para conversión a PDF
- **googleapis** para backup en Google Drive
- **Swagger** para documentación de la API

## Desarrollo

```bash
npm install
node src/index.js        # iniciar el servidor
npm run dev              # con nodemon (recarga automática)
```

El servidor arranca en **http://localhost:3001**.  
Documentación Swagger: **http://localhost:3001/api-docs**

## Variables de entorno

Crea un archivo `.env` en esta carpeta (ver [`../.env.example`](../.env.example) o el README principal para la lista completa):

```env
DATABASE_URL=postgresql://postgres:1234@localhost:5432/gestor_jal
JWT_SECRET=cambia_esto_en_produccion
PORT=3001
STORAGE_PATH=./data/output
TEMPLATES_PATH=./plantillas
BACKUPS_LOCAL_PATH=./data/backups
# Opcionales para backup en Drive:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Estructura

```
src/
├── controllers/    Lógica de cada recurso (documentos, usuarios, reportes…)
├── middleware/     Autenticación JWT, autorización por rol, validaciones
├── models/         Modelos Sequelize (Document, DocType, User, Jal, BackupLog…)
├── routes/         Definición de rutas Express
├── services/       Servicios de negocio (generador, backup, auditoría, chat…)
└── validations/    Esquemas Joi para validar el body de las peticiones
migrations/         Migraciones de base de datos
seeders/            Datos iniciales
plantillas/         Plantillas .docx
data/               Documentos generados y backups locales (creado en runtime)
```

## Migraciones

```bash
npx sequelize-cli db:migrate          # aplicar todas las migraciones
npx sequelize-cli db:migrate:undo     # revertir la última
npx sequelize-cli db:seed:all         # cargar seeders
```

---

**Copyright © 2026 Santiago M. Todos los derechos reservados.**  
Parte del proyecto **Gestor JAL** desarrollado por Santiago M.
