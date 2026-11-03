# Estrategia y casos de prueba

## 1. Niveles de prueba

| Nivel | Herramienta | Dónde | Quién la corre | Estado |
|---|---|---|---|---|
| Unitarias e integración del backend | Vitest + PostgreSQL de pruebas | `backend/src/__tests__/` | CI en cada PR y desarrollador | 35 archivos, 418 pruebas |
| Unitarias del frontend | Vitest + jsdom + Testing Library | `frontend/src/__tests__/` | CI y desarrollador | 13 archivos, 121 pruebas |
| Análisis estático | ESLint | backend y frontend | CI | 0 errores |
| Migraciones | `sequelize-cli` subir, bajar todo, subir | Base vacía | Antes de cada versión | Manual |
| Humo de extremo a extremo en modo producción | Script Node con `fetch` | [prueba-humo-produccion.cjs](evidencias/2026-10-29/prueba-humo-produccion.cjs) | Después de cada despliegue | Manual |
| Visual y de accesibilidad automática | Playwright + axe-core | Fuera del repositorio (PR #10) | Ante cambios de interfaz | Manual |
| Respaldo y restauración | Scripts Python sobre base de prueba | [respaldo-restauracion.txt](evidencias/2026-10-29/respaldo-restauracion.txt) | Trimestral | Manual |
| Aceptación con usuarios | Protocolo en [Accesibilidad](../04_PRODUCTO/ACCESIBILIDAD_Y_USABILIDAD.md) | Sede de la JAL | JAL | **No realizada** |

**Reglas:** solo datos ficticios (nombres "de Prueba", cédulas 100000000N, correos `@example.com`); nunca contra la base de producción; ninguna prueba se desactiva para lograr un resultado verde.

## 2. Casos de prueba por requisito

Formato: ID · requisito · pasos resumidos · resultado esperado · ejecución.

| ID | Req. | Caso | Esperado | Ejecución |
|---|---|---|---|---|
| CP-01 | RF-01 | Login con credenciales correctas | 200, cookies httpOnly y `csrf_token` | Humo S06 ✔ |
| CP-02 | RF-01 | Login con contraseña incorrecta | 401 sin indicar qué dato falló | Humo S05 ✔ |
| CP-03 | RF-02 | 10 intentos fallidos | Cuenta bloqueada 15 min | Unitaria ✔ |
| CP-04 | RS-03 | Modificar datos sin `X-CSRF-Token` | 403 | Humo S07 ✔ |
| CP-05 | RF-05 | Aceptar política | 200 y fecha registrada | Humo S08 ✔ |
| CP-06 | RF-06 | Administrador crea auxiliar y edil | 201 | Humo S09–S10 ✔ |
| CP-07 | RF-07 | Auxiliar intenta listar usuarios, todos los documentos, borrar, ver auditoría | 403 en cada caso | Humo S18–S21 ✔ |
| CP-08 | RF-07 | Edil intenta crear usuario | 403 | Humo S26 ✔ |
| CP-09 | RF-11 | Subir firma PNG | 200 | Humo S11 ✔ |
| CP-10 | RF-10, RF-13 | Generar Certificado de Residencia | 201 con radicado `AAAA-COD-SAL-000001` | Humo S13 ✔ |
| CP-11 | RF-10 | Descargar PDF y Word | Archivos válidos (`%PDF`, `PK`) | Humo S14–S15 ✔; PDF revisado visualmente |
| CP-12 | RF-14 | Buscar persona por cédula | Devuelve nombre y tipo de documento | Humo S16 ✔ |
| CP-13 | RF-15 | Auxiliar ve su lista | 200 | Humo S22 ✔ |
| CP-14 | RS-07 | Auxiliar descarga documento ajeno por identificador | 404 | Humo S23 ✔ |
| CP-15 | RF-16, RF-17 | Edil lista y marca revisado | 200 | Humo S24–S25 ✔ |
| CP-16 | RS-07 | Segunda JAL: documentos, detalle, descarga, usuarios, personas, auditoría, tipos | Sin datos de la JAL 1 | Humo S27–S34 ✔ |
| CP-17 | RF-13 | Dos JAL con el código de dependencia por defecto generan su primer documento | Ambas obtienen radicado | **Falla** (MJ-02): [evidencia](evidencias/2026-10-31/colision-radicado-multijal.txt) |
| CP-18 | RF-13 | Dos JAL con códigos distintos | Ambas obtienen radicado | ✔ (misma evidencia) |
| CP-19 | RF-20 | Auditoría registra creación de documento y usuarios | Registros presentes | Humo S35 ✔ |
| CP-20 | RD-02 | Descargar copia completa | Zip válido | Humo S36 ✔ |
| CP-21 | RF-19 | Exportar Excel | `.xlsx` | Humo S37 ✔ |
| CP-22 | RS-09 | `/metrics` sin token y `/api-docs` en producción | 404 y sin Swagger | Humo S02 ✔, S04 ✔ tras revisión |
| CP-23 | RR-02 | Restaurar sobre base alterada | Estado idéntico al respaldo | ✔ tras corrección |
| CP-24 | RR-02 | Restaurar respaldo antiguo sobre base con datos | Se detiene sin cambios y lo informa | ✔ |
| CP-25 | RS-02 | Arrancar en producción sin claves | El proceso se detiene con mensaje | Manual ✔: [arranque-sin-claves.txt](evidencias/2026-10-31/arranque-sin-claves.txt) (sin prueba automatizada) |
| CP-26 | RF-23 | Generar sin red y sincronizar | Documento recibe radicado al volver la red | Solo unitarias; **pendiente en navegador real** |
| CP-27 | RF-03 | Activar 2FA con una app real | Código aceptado | **Pendiente** |
| CP-28 | RA-01 | NVDA y TalkBack en el flujo Crear documento | Flujo completo con lector | **Pendiente** |
| CP-29 | RA-02 | Prueba con usuarios de la JAL | ≥ 80 % de tareas sin ayuda | **Pendiente** |
| CP-30 | RM-01 | Instalación Docker desde cero | Servicio en `/health` | **Pendiente** (sin Docker) |
| CP-31 | — | Humo contra producción | Igual que local | **Bloqueado** |
| CP-32 | RS-07 | Notificaciones, reportes, exportación y copia limitados a la JAL | Sin datos de otra JAL | **Pendiente** en ejecución |

## 3. Criterios de salida para una versión

1. CI verde (lint, pruebas, build).
2. Migraciones probadas en una copia de la base.
3. Humo en el entorno de destino con 0 fallas no explicadas.
4. Respaldo previo verificado.
5. Cambios registrados en `CHANGELOG.md`.
