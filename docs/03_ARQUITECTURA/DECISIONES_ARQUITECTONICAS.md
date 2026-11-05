# Decisiones arquitectónicas (ADR)

Registro **reconstruido** a partir del código, los comentarios, `CHANGELOG.md` y `docs/DESPLIEGUE_HIBRIDO.md`. Ninguna de estas decisiones tiene aprobación institucional documentada; las tomó el desarrollador. Las fechas son las de la evidencia disponible, no las de la decisión original cuando no se conoce.

| ADR | Decisión | Estado |
|---|---|---|
| 001 | Aplicación web con React y API Node/Express | Vigente |
| 002 | PostgreSQL con Sequelize y migraciones reversibles | Vigente |
| 003 | Plantillas Word con variables en lugar de un editor propio | Vigente |
| 004 | Archivos generados guardados dentro de la base de datos | Vigente |
| 005 | Sesión en cookies httpOnly con CSRF y JWT RS256 | Vigente |
| 006 | Modo sin conexión con PWA e IndexedDB | Vigente |
| 007 | Despliegue híbrido Vercel + Render + Supabase | Vigente, sin verificar |
| 008 | Varias JAL en una base, separadas por `jal_id` | Vigente; alta de JAL pendiente |
| 009 | Chat IA con modelo local (Ollama) | Vigente; dependiente de un PC personal |
| 010 | Restauración transaccional con detención ante errores | Nueva en esta entrega |

## ADR-001 · Aplicación web React + Node/Express
- **Contexto:** varias personas, en la sede y fuera de ella, con computadores y celulares distintos.
- **Decisión:** SPA en React servida como PWA; API REST en Express.
- **Alternativas:** aplicación de escritorio (requiere instalar en cada equipo); hoja de cálculo con macros (sin control de acceso ni auditoría).
- **Consecuencias:** un solo código para escritorio y celular; requiere un servidor y conocimientos de JavaScript para mantener.

## ADR-002 · PostgreSQL + Sequelize
- **Decisión:** PostgreSQL por transacciones, JSONB y disponibilidad en servicios gestionados (Supabase). Esquema versionado con 26 migraciones con `down`.
- **Alternativas:** SQLite (más simple, pero sin concurrencia adecuada para varios usuarios en red); MongoDB (sin transacciones simples para el consecutivo).
- **Consecuencias:** el consecutivo del radicado se resuelve con `INSERT … ON CONFLICT` dentro de la transacción. Exige `pg_dump`/`psql` para respaldos.

## ADR-003 · Plantillas `.docx` con variables
- **Decisión:** la JAL diseña sus documentos en Word y marca campos con `{variable}`; docxtemplater los llena.
- **Alternativas:** editor de documentos en la aplicación; generación de PDF desde HTML.
- **Consecuencias:** la JAL conserva el formato oficial y puede cambiarlo sin programar. La fidelidad del PDF depende de LibreOffice; sin él, el respaldo con pdf-lib pierde el diseño. El módulo de imagen gratuito no tiene mantenimiento (riesgo R-11).

## ADR-004 · Archivos en la base de datos (BYTEA)
- **Contexto:** en Render (plan gratuito) el disco es efímero y se pierde en cada despliegue o reinicio [Código: comentario de la migración 25].
- **Decisión:** guardar Word y PDF en `documents.file_docx` y `file_pdf` (migración 25).
- **Alternativas:** almacenamiento de objetos (S3, Supabase Storage).
- **Consecuencias:** una sola copia de la base respalda todo; la base crece con cada documento (≈ 0,5 MB por documento en la prueba: 180 KB de PDF y 288 KB de Word).

## ADR-005 · Cookies httpOnly + CSRF + JWT RS256
- **Decisión:** el token no es accesible desde JavaScript; protección CSRF por doble envío; firma asimétrica en producción.
- **Alternativas:** token en `localStorage` (expuesto a XSS); sesiones en servidor (requiere almacén compartido).
- **Consecuencias:** el arranque en producción falla si faltan las claves, lo que evita desplegar con valores de ejemplo.

## ADR-006 · Modo sin conexión
- **Contexto:** conectividad irregular en la sede (decisión del 09-09-2026).
- **Decisión:** PWA con Workbox; tipos de documento, plantillas y cola en IndexedDB; generación en el navegador y sincronización por lotes.
- **Consecuencias:** el frontend incluye el motor de plantillas (bloque de ≈ 1 MB). El radicado definitivo lo asigna el servidor al sincronizar. No se probó en un navegador real sin red.

## ADR-007 · Vercel + Render + Supabase
- **Decisión:** frontend en Vercel con reenvío de `/v1` a Render (mismo origen para las cookies); backend en contenedor con LibreOffice; base gestionada en Supabase.
- **Alternativas:** un servidor propio con Docker Compose (también incluido en `deploy/`).
- **Consecuencias:** costo inicial bajo; las cuentas están a nombre personal (R-02) y las condiciones de los planes pueden cambiar (R-07).

## ADR-008 · Varias JAL en una base
- **Decisión:** tabla `jals` y columna `jal_id` en los datos; cada consulta filtra por la JAL del usuario.
- **Consecuencias:** aislamiento verificado en la aplicación (S27–S34), no impuesto por la base. Pendientes: alta de JAL, radicado único global (MJ-02), correo único global. Ver [Estrategia multi-JAL](../08_REPLICACION/ESTRATEGIA_MULTIJAL.md).

## ADR-009 · Chat IA local
- **Decisión:** Ollama en un PC alcanzable por Tailscale, para no enviar datos a un proveedor externo de IA.
- **Consecuencias:** depende de que ese PC esté encendido; el contexto incluye nombres de beneficiarios recientes (R-12). Modelo con licencia comunitaria de Llama.

## ADR-010 · Restauración transaccional
- **Contexto:** en la prueba del 29-10-2026 la restauración mostraba "completada" con 83 errores y no devolvía los datos modificados.
- **Decisión:** `pg_dump` con `--clean --if-exists --no-owner --no-privileges`; `psql` con `ON_ERROR_STOP=1` y `--single-transaction`.
- **Consecuencias:** si algo falla no se aplica nada y se informa. Las copias anteriores a este cambio (sin `--clean`) deben restaurarse en una base vacía.
