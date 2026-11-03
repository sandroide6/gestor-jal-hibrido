# Informe de pruebas

Período: 29 a 31 de octubre de 2026. Código: `main` en `91a14ac` más los cambios de esta entrega (scripts de respaldo y restauración, configuración de despliegue y documentación; **no** se cambió código de la aplicación). Entorno: Linux, Node 22.22.0, PostgreSQL 16.15, Python 3.13, Chromium. Datos: solo ficticios. Las salidas completas están en [evidencias/](evidencias/).

## 1. Resumen

| Prueba | Resultado | Evidencia |
|---|---|---|
| Backend: pruebas automáticas | **418 de 418 pasan** (35 archivos) | [backend-tests.txt](evidencias/2026-10-29/backend-tests.txt) |
| Frontend: pruebas automáticas | **121 de 121 pasan** (13 archivos) | [frontend-tests.txt](evidencias/2026-10-29/frontend-tests.txt) |
| Lint | Backend 0 avisos; frontend 0 errores y 10 avisos | [lint.txt](evidencias/2026-10-29/lint.txt) |
| Build del frontend | Correcto; aviso por bloque de 1 053 KB (motor de plantillas para el modo sin conexión) | [build-frontend.txt](evidencias/2026-10-29/build-frontend.txt) |
| `npm audit` producción | 0 vulnerabilidades en backend y frontend | [npm-audit.txt](evidencias/2026-10-29/npm-audit.txt) |
| `npm audit` con desarrollo | Backend 7 (3 moderadas, 4 altas); frontend 20 (5 bajas, 7 moderadas, 8 altas), todas en herramientas de desarrollo | npm-audit.txt |
| Migraciones: subir 26, bajar 26, subir 26 y seeders | Sin errores | [migraciones.txt](evidencias/2026-10-29/migraciones.txt) |
| Humo de extremo a extremo en modo producción | **38 de 39**; la falla S04 es del criterio de la prueba, no del sistema (Swagger no se publica) | [prueba-humo-produccion.txt](evidencias/2026-10-29/prueba-humo-produccion.txt) |
| PDF generado | Revisado visualmente: plantilla, datos, firma y radicado correctos | Humo S14 |
| Respaldo y restauración | **Falla grave encontrada** en la versión de `main` (informa éxito sin restaurar); **corregida** y probada en 4 escenarios | [respaldo-restauracion.txt](evidencias/2026-10-29/respaldo-restauracion.txt) |
| Colisión de radicados entre dos JAL | **Falla** con el código de dependencia por defecto; pasa con códigos distintos | [colision-radicado-multijal.txt](evidencias/2026-10-31/colision-radicado-multijal.txt) |
| Arranque en producción sin claves | Se detiene, como se espera | [arranque-sin-claves.txt](evidencias/2026-10-31/arranque-sin-claves.txt) |
| `docker compose config` con el nuevo `.env.example` | Variables vacías se leen como vacías (antes leía el comentario como valor) | Ejecutado durante la revisión; no se guardó salida aparte |
| Visual y accesibilidad automática (PR #10) | 14 pantallas × 3 anchos, 0 violaciones axe-core | [docs/design/11](../design/11-validacion-visual-y-funcional.md) |

## 2. Defectos encontrados

| ID | Defecto | Severidad | Estado |
|---|---|---|---|
| DEF-01 | `restore.py` informa "Restauración completada" aunque `psql` falle y los datos no se restauren | Alta | **Corregido** en esta entrega (`scripts/backup.py`, `scripts/restore.py`) |
| DEF-02 | `deploy/docker-compose.yml` no pasaba `ENCRYPTION_KEY`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` ni `ADMIN_INITIAL_PASSWORD`; el backend no habría arrancado en producción | Alta | **Corregido**; arranque con Docker sin probar |
| DEF-03 | En `deploy/.env.example`, los comentarios al final de líneas vacías se interpretaban como valores (`NGROK_AUTHTOKEN`, `NGROK_DOMAIN` y otras) | Media | **Corregido** y comprobado con `docker compose config` |
| DEF-04 | `render.yaml` no declaraba `JWT_PRIVATE_KEY` ni `JWT_PUBLIC_KEY` (obligatorias en producción) | Alta para un despliegue nuevo | **Corregido**; sin probar en Render |
| DEF-05 | Dos JAL con el mismo código de dependencia no pueden generar documentos (error 500) | Alta en Modelo B; no aplica en Modelo A | **Abierto** (MJ-02); mitigación por configuración |
| DEF-06 | El README afirmaba copias "cifradas" | Media (documental) | **Corregido** |
| DEF-07 | Auditoría registra `user.delete` como éxito antes de borrar | Baja | Abierto (SEG-11) |
| DEF-08 | `gestor.py` devuelve código 0 aunque la restauración falle | Baja | Abierto |

## 3. Lo que no se pudo probar

| Prueba | Motivo |
|---|---|
| Producción (Vercel, Render, Supabase) | Red del entorno de revisión bloqueada; despliegue de Vercel detenido por cambio de cuenta |
| Docker Compose en ejecución | Docker no disponible |
| Windows (`.bat`, Word COM) | Entorno Linux |
| Google Drive | Requiere credenciales de Google |
| Chat IA | Requiere Ollama en el PC del responsable |
| Modo sin conexión en navegador real | No se ejecutó en esta revisión |
| 2FA con aplicación real | No se ejecutó |
| Lectores de pantalla, zoom, Safari, Firefox | Fuera del alcance de las herramientas usadas |
| Usuarios reales | No hubo sesión con la JAL |
| Carga y rendimiento | Sin metas definidas |

## 4. Conclusión

Con datos ficticios y en un entorno controlado, el flujo principal funciona y los controles de acceso y de aislamiento entre JAL se comportan como se espera. Se encontraron y corrigieron defectos de operación (restauración y configuración de despliegue) que habrían afectado una instalación nueva o una recuperación. Queda abierto el choque de radicados entre JAL en una misma base. El resultado no cubre producción, Windows, Docker en ejecución ni usuarios reales.
