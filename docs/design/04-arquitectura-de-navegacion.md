# 04 · Arquitectura de navegación

Las rutas y los permisos por rol **no cambiaron** (mismos `path` y `roles` que antes). Cambió cómo se agrupan y se muestran.

## Grupos

| Trabajo diario | Roles |
|---|---|
| Inicio `/inicio` | todos |
| Crear documento `/generador` | todos |
| Buscar documentos `/edil` | edil, administrador |
| Reportes `/reportes` | edil, administrador |
| Ayuda `/ayuda` | todos |

| Administración | Roles |
|---|---|
| Resumen `/admin` | administrador, edil |
| Usuarios `/admin/usuarios` | administrador |
| Tipos de documento `/admin/tipos-documento` | administrador |
| Auditoría `/admin/auditoria` | administrador, edil |
| Configuración JAL `/admin/jal-config` | administrador |
| Copias de seguridad `/admin/configuracion/backup` | administrador |

Cuenta (menú bajo el nombre): Mi perfil y firma, Cambiar contraseña, Cerrar sesión.

## Por tamaño de pantalla

- **≥ 1024 px:** lomo verde fijo de 256 px, plegable a 72 px (sin animar el ancho). La página activa es una pestaña color papel con `aria-current="page"`.
- **< 1024 px:** cabecera con el nombre y el estado de conexión; **barra inferior** con Inicio, Crear, Buscar (o Ayuda si el rol no busca) y Menú; el Menú abre un cajón con todo lo demás.
- Siempre: enlace «Saltar al contenido», `document.title` = «Pantalla · Gestor JAL», estado de conexión y campana en la cabecera.

## Atajos de contexto

- Aviso en Inicio «N documentos esperando tu revisión» → `/edil?pendientes=1` (Buscar ya filtrado).
- Cifra «Por revisar» del Resumen → la misma lista.
- Fichas de Inicio → `/generador?tipo=<id>`, que abre directo el paso Datos.
