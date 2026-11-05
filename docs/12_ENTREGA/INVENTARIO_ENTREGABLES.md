# Inventario de entregables

Estado al 31-10-2026. **Listo**: existe y se verificó · **Parcial**: existe con brechas señaladas · **Pendiente**: no existe o requiere una acción externa · **Bloqueado**: depende de información o acceso que no se tiene.

## 1. Software

| Entregable | Ubicación | Estado | Observación |
|---|---|---|---|
| Código fuente del backend, frontend y scripts | Repositorio `gestor-jal-hibrido`, rama `main` (`91a14ac`) + rama de esta entrega | Listo (código) | Los cambios de esta entrega están sin integrar a `main` hasta que se autorice |
| Migraciones y seeders | `backend/migrations/`, `backend/seeders/` | Listo | 26 migraciones reversibles probadas |
| Pruebas automáticas y CI | `backend/src/__tests__/`, `frontend/src/__tests__/`, `.github/workflows/` | Listo | 539 pruebas pasan localmente |
| Configuración de despliegue Docker | `deploy/` | Parcial | Corregida; sin probar en ejecución |
| Configuración de despliegue en la nube | `render.yaml`, `deploy/render/`, `frontend/vercel.json` | Parcial | Corregida; producción sin verificar |
| Generador de claves | `deploy/generar-claves.js` | Listo | Nuevo en esta entrega |
| Scripts de respaldo y restauración | `scripts/backup.py`, `scripts/restore.py` | Listo | Corregidos y probados en Linux |
| Plantillas de documentos | `backend/plantillas/` | Parcial | Con escudos y gráfica de los ODS sin autorización documentada |
| Instancia en producción | Vercel + Render + Supabase | **Bloqueado** | No verificada; rediseño no desplegado |

## 2. Documentación

| Entregable | Ubicación | Estado |
|---|---|---|
| Índice y guía de lectura | [INDICE_GENERAL.md](../00_LEEME/INDICE_GENERAL.md) | Listo |
| Resumen ejecutivo | [RESUMEN_EJECUTIVO.md](../00_LEEME/RESUMEN_EJECUTIVO.md) | Listo |
| Diagnóstico del estado real | [ESTADO_REAL_DEL_PROYECTO.md](../00_LEEME/ESTADO_REAL_DEL_PROYECTO.md) | Listo |
| Contexto y alcance | [CONTEXTO_Y_ALCANCE.md](../01_GESTION/CONTEXTO_Y_ALCANCE.md) | Listo |
| Requisitos y trazabilidad | [Requisitos](../01_GESTION/MATRIZ_REQUISITOS.md), [Trazabilidad](../01_GESTION/MATRIZ_TRAZABILIDAD.md) | Parcial: provisionales, sin línea base aprobada |
| Matriz contractual | [MATRIZ_CONTRACTUAL.md](../01_GESTION/MATRIZ_CONTRACTUAL.md) | Parcial: basada en fuente secundaria |
| Riesgos y bloqueos | [RIESGOS_Y_BLOQUEOS.md](../01_GESTION/RIESGOS_Y_BLOQUEOS.md) | Listo |
| Procesos, historias y casos de uso | [PROCESOS_HISTORIAS_Y_CASOS_DE_USO.md](../02_REQUISITOS/PROCESOS_HISTORIAS_Y_CASOS_DE_USO.md) | Listo |
| Arquitectura, datos, API, decisiones | [03_ARQUITECTURA](../03_ARQUITECTURA/ARQUITECTURA_GENERAL.md) | Listo |
| Manual funcional y guía de administración | [04_PRODUCTO](../04_PRODUCTO/MANUAL_FUNCIONAL.md) | Listo |
| Auditoría de accesibilidad y usabilidad | [ACCESIBILIDAD_Y_USABILIDAD.md](../04_PRODUCTO/ACCESIBILIDAD_Y_USABILIDAD.md) | Parcial: sin prueba con usuarios |
| Instalación y despliegue | [INSTALACION_Y_DESPLIEGUE.md](../06_DESPLIEGUE/INSTALACION_Y_DESPLIEGUE.md) | Parcial: solo una modalidad probada |
| Operación, RACI, respaldo | [07_OPERACION](../07_OPERACION/OPERACION_Y_MANTENIMIENTO.md) | Parcial: RACI y RPO/RTO son propuestas |
| Estrategia de replicación | [ESTRATEGIA_MULTIJAL.md](../08_REPLICACION/ESTRATEGIA_MULTIJAL.md) | Listo (como análisis) |
| Seguridad y protección de datos | [09_SEGURIDAD_Y_PRIVACIDAD](../09_SEGURIDAD_Y_PRIVACIDAD/REVISION_DE_SEGURIDAD.md) | Listo (como análisis); borradores sin adoptar |
| Legal y licencias | [10_LEGAL_Y_LICENCIAS](../10_LEGAL_Y_LICENCIAS/ANALISIS_DE_LICENCIAS_Y_PI.md) | Parcial: titularidad sin resolver |
| Estrategia e informe de pruebas, evidencias | [11_CALIDAD](../11_CALIDAD/INFORME_DE_PRUEBAS.md) | Listo |
| Transferencia técnica | [GUIA_DE_TRANSFERENCIA_TECNICA.md](GUIA_DE_TRANSFERENCIA_TECNICA.md) | Listo como guía; transferencia no ejecutada |

## 3. Capacitación

| Entregable | Ubicación | Estado |
|---|---|---|
| Página Ayuda en la aplicación | `frontend/src/pages/HelpPage.jsx` | Parcial: imágenes de la interfaz anterior |
| Guía escrita con 35 capturas | Carpeta compartida `tutoriales/` | Parcial: interfaz anterior |
| 12 videos | Carpeta compartida `tutoriales/videos/` | Parcial: interfaz anterior, sin voz ni subtítulos |
| Sesiones de capacitación con evidencia | — | Pendiente |

## 4. Institucional

| Entregable | Estado |
|---|---|
| Acta de entrega firmada | Pendiente (hay una [lista de verificación previa](ACTA_DE_VERIFICACION_PREVIA.md) sin firmas) |
| Acuerdo de titularidad o licencia | Bloqueado |
| Cuentas de servicio a nombre de la entidad | Pendiente |
| Política, aviso y autorización de datos | Pendiente (borradores) |
