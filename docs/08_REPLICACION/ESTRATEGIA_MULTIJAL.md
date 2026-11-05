# Estrategia de replicación a otras JAL

**Conclusión:** hoy la forma segura de llevar el Gestor JAL a otra JAL es una **instalación independiente por JAL (Modelo A)**. El código ya separa los datos por JAL y esa separación pasó las pruebas, pero **no** hay todavía un soporte multi-institución completo: no existe el alta de JAL desde la aplicación, el radicado choca entre JAL con el mismo código y la base de datos no impone el aislamiento. Antes de replicar en cualquier modelo debe resolverse la titularidad del software ([Análisis de PI](../10_LEGAL_Y_LICENCIAS/ANALISIS_DE_LICENCIAS_Y_PI.md)).

## 1. Qué hay hoy en el código

| Elemento | Situación | Evidencia |
|---|---|---|
| Tabla `jals` y `jal_id` en usuarios, tipos, documentos, auditoría, colas, copias y consecutivos | Implementado | [Modelo de datos](../03_ARQUITECTURA/MODELO_DE_DATOS.md) |
| Filtro por `jal_id` en cada consulta | Implementado en controladores y servicios | `multiJal.test.js` (revisa el código fuente de forma estática) |
| Aislamiento en ejecución con dos JAL | **Verificado**: la JAL 2 no ve, abre, descarga ni encuentra datos de la JAL 1 (documentos, personas, usuarios, auditoría, tipos) | Humo S27–S34 |
| Alta de una nueva JAL | **No existe**: solo por SQL o seeder | — |
| Superadministrador entre JAL | **No existe** | — |
| Configuración propia por JAL (nombre, logo, código, funciones, Drive) | Implementado | `jals.config`, `jals.features` |
| Aislamiento en la base de datos (RLS con políticas por JAL) | **No existe**: RLS activado sin políticas; el backend es dueño de las tablas | Migración 26 |

## 2. Brechas para varias JAL en una misma base

| ID | Brecha | Efecto | Evidencia | Corrección propuesta |
|---|---|---|---|---|
| MJ-01 | Sin alta de JAL | Crear una JAL requiere SQL manual | Código | Comando o pantalla de superadministrador que cree la JAL, su administrador, tipos base y código de dependencia |
| MJ-02 | El radicado es **único en toda la base**, pero el código de dependencia por defecto es `JAL` para todas | La segunda JAL que use el código por defecto **no puede generar** su primer documento: error 500 sin explicación | **Reproducido** el 31-10-2026: [colision-radicado-multijal.txt](../11_CALIDAD/evidencias/2026-10-31/colision-radicado-multijal.txt). Con un código propio (`PRUEBA2`) el documento se generó | Mientras tanto: código de dependencia único por JAL **antes** de emitir. Definitivo: migración reversible que cambie el índice único a (`jal_id`, `numero_radicado`), validar que el código no se repita y mostrar un mensaje claro |
| MJ-03 | Correo único global | Una persona que trabaje en dos JAL necesita dos correos | Índice `users_email_key` | Aceptable; o índice (`jal_id`, `email`) con cambio en el login |
| MJ-04 | Aislamiento solo en la aplicación | Un error futuro en una consulta podría mezclar datos | Migración 26 | Políticas RLS por `jal_id` con un rol de aplicación que no sea dueño, o pruebas de aislamiento automáticas obligatorias en CI |
| MJ-05 | Una sola configuración de servidor (Drive, Ollama, receptor local, plantillas por defecto) | Las integraciones son compartidas | `render.yaml` | Credenciales por JAL donde aplique |
| MJ-06 | Copias por JAL desde el panel, pero `pg_dump` respalda todas juntas | Restaurar una JAL afecta a las demás | `scripts/backup.py` | Restauración selectiva por JAL o Modelo A |

## 3. Comparación de modelos

| Criterio | Modelo A: instalación independiente por JAL | Modelo B: una instalación para varias JAL |
|---|---|---|
| Aislamiento de datos | Total (bases separadas) | Lógico en la aplicación; verificado en pruebas, no impuesto por la base |
| Listo hoy | **Sí**, con el procedimiento de la sección 4 | **No**: requiere cerrar MJ-01, MJ-02 y, recomendado, MJ-04 |
| Costo de operación | Mayor: un backend y una base por JAL | Menor: una sola infraestructura |
| Actualizaciones | Una por instalación | Una para todas |
| Falla o incidente | Afecta a una JAL | Afecta a todas |
| Respaldo y restauración | Simple, por instalación | Necesita restauración por JAL |
| Responsable del tratamiento | Cada JAL o el Distrito, separado | Un responsable común o encargos por JAL; más complejo jurídicamente |
| Recomendado para | Piloto con 1 a 3 JAL | Despliegue en muchas JAL, una vez cerradas las brechas |

**Recomendación [Propuesta]:** Modelo A para la siguiente JAL. Pasar al Modelo B solo si la Subsecretaría decide extender el sistema a muchas JAL, con presupuesto para cerrar MJ-01, MJ-02 y MJ-04 y con un responsable técnico institucional.

## 4. Procedimiento para una segunda JAL (Modelo A)

Requisito previo: autorización de uso del software (titularidad resuelta) y responsable del tratamiento designado para la nueva JAL.

1. **Infraestructura:** crear una base PostgreSQL y un backend nuevos (Docker o Render + Supabase) con cuentas institucionales. Guía: [Instalación](../06_DESPLIEGUE/INSTALACION_Y_DESPLIEGUE.md).
2. **Claves propias:** `node deploy/generar-claves.js`. No reutilizar claves de otra JAL.
3. **Migraciones y seeders:** `npm run db:migrate` y `npm run db:seed` con `ADMIN_INITIAL_PASSWORD` propia.
4. **Configuración JAL:** nombre, logo y **código de dependencia** de la nueva JAL.
5. **Plantillas:** reemplazar las de la Comuna 12. Revisar textos, direcciones, teléfonos, fundamentos legales, escudos y gráficas; eliminar tipos que no apliquen.
6. **Frontend:** `VITE_JAL_NOMBRE` y la URL del backend (`frontend/vercel.json` o nginx).
7. **Usuarios:** crear los de la nueva JAL; entregar contraseñas por canal privado.
8. **Datos personales:** publicar o entregar el aviso de privacidad de la nueva JAL.
9. **Verificar:** prueba de humo con datos ficticios, documento de prueba revisado por la JAL, respaldo y restauración de ensayo.
10. **Capacitación** y acta de entrega.

## 5. Pruebas de aislamiento

| Caso | Modelo | Resultado |
|---|---|---|
| La JAL 2 no lista documentos de la JAL 1 | B | Pasa (S28) |
| La JAL 2 no abre el detalle por identificador | B | Pasa, 404 (S29) |
| La JAL 2 no descarga archivos de la JAL 1 | B | Pasa, 404 (S30) |
| La JAL 2 solo ve sus usuarios | B | Pasa (S31) |
| La JAL 2 no encuentra personas atendidas por la JAL 1 | B | Pasa (S32) |
| La auditoría de la JAL 2 no muestra acciones de la JAL 1 | B | Pasa (S33) |
| La JAL 2 no ve los tipos de documento de la JAL 1 | B | Pasa (S34) |
| Dos JAL con el código por defecto generan documentos | B | **Falla** (MJ-02) |
| Dos JAL con códigos distintos generan documentos | B | Pasa |
| Notificaciones, reportes, exportación y copia del panel limitados a la JAL | B | **No probado** en ejecución; pendiente |
| Instalaciones separadas no comparten datos | A | Por diseño (bases separadas); no requiere prueba de aplicación |
