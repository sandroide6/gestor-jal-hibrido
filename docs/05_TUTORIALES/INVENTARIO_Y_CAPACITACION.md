# Tutoriales: inventario y plan de capacitación

## 1. Material existente

Ubicación: carpeta compartida del proyecto, `tutoriales/` (no está en el repositorio por su peso: ≈ 9 MB). Contiene `TUTORIALES.md` (guía escrita paso a paso), 35 capturas, 12 videos y un PDF de ejemplo. Todo con **datos ficticios**. Además, la aplicación trae su propia página **Ayuda** con 12 temas por rol e imágenes en `frontend/public/ayuda/`.

| # | Video | Duración | Resolución | Tema | Roles | Estado |
|---|---|---|---|---|---|---|
| 01 | `01-iniciar-sesion.mp4` | 11 s | 1280×800 | Entrar y aceptar la política | Todos | Interfaz anterior |
| 02 | `02-subir-firma.mp4` | 9 s | 1280×800 | Registrar la firma | Todos | Interfaz anterior |
| 03 | `03-crear-usuario.mp4` | 15 s | 1280×800 | Crear un usuario | Administrador | Interfaz anterior |
| 04 | `04-crear-documento.mp4` | 21 s | 1280×800 | Crear un documento | Todos | Interfaz anterior |
| 05 | `05-cedula-ya-atendida.mp4` | 12 s | 1280×800 | Persona ya atendida | Todos | Interfaz anterior |
| 06 | `06-buscar-documentos.mp4` | 8 s | 1280×800 | Buscar documentos | Edil, administrador | Interfaz anterior |
| 07 | `07-panel-admin.mp4` | 24 s | 1280×800 | Pantallas del administrador | Administrador | Interfaz anterior |
| 08 | `08-edil-primer-ingreso.mp4` | 12 s | 1280×800 | Primer ingreso de un edil | Edil | Interfaz anterior |
| 09 | `09-auxiliar-a-nombre-de-edil.mp4` | 24 s | 1280×800 | Emitir a nombre de un edil | Auxiliar | Interfaz anterior |
| 10 | `10-edil-revisar.mp4` | 8 s | 1280×800 | Revisar un documento | Edil | Interfaz anterior |
| 11 | `11-celular.mp4` | 6 s | 390×844 | Uso en celular | Todos | Interfaz anterior |
| 12 | `12-pagina-de-ayuda.mp4` | 8 s | 1280×800 | Página de ayuda | Todos | Interfaz anterior |

Duración total ≈ 2 min 38 s. **Ninguno** tiene audio, subtítulos ni transcripción. Son grabaciones automáticas de pantalla que sirven de guion visual, **no** son video tutoriales terminados.

## 2. Brechas

| Brecha | Efecto | Acción [Propuesta] |
|---|---|---|
| Muestran la interfaz anterior al rediseño v2 | Confunden al usuario al ver pantallas distintas | Regrabar con la versión desplegada |
| Sin narración | No explican el porqué ni los cuidados | Agregar voz con guion en lenguaje claro |
| Sin subtítulos ni transcripción | No accesibles para personas sordas o con baja audición | Subtítulos `.vtt` y transcripción en texto |
| Muy cortos (6 a 24 s) | Pasan rápido para personas con poca experiencia | Ritmo más lento, pausas en cada paso |
| Faltan temas | Cambio de contraseña y 2FA, reportes, auditoría, copias, tipos de documento, trabajo sin internet | Grabar los temas faltantes |
| Imágenes de la página Ayuda con la interfaz anterior | Igual que arriba | Reemplazar las imágenes de `frontend/public/ayuda/` |

## 3. Guion sugerido para la nueva serie [Propuesta]

| # | Título | Duración meta | Público |
|---|---|---|---|
| 1 | Qué es el Gestor JAL y quién hace qué | 1 min | Todos |
| 2 | Entrar por primera vez, aceptar la política y cambiar la contraseña | 2 min | Todos |
| 3 | Registrar la firma | 1 min | Todos |
| 4 | Crear un certificado paso a paso | 3 min | Todos |
| 5 | Persona que ya vino antes | 1 min | Todos |
| 6 | Emitir a nombre de un edil | 2 min | Auxiliar |
| 7 | Buscar, descargar y revisar | 2 min | Edil |
| 8 | Reportes y cuidado de los datos del Excel | 2 min | Edil, administrador |
| 9 | Usuarios y roles | 2 min | Administrador |
| 10 | Crear un tipo de documento con plantilla Word | 4 min | Administrador |
| 11 | Auditoría y copias de seguridad | 3 min | Administrador |
| 12 | Usarlo en el celular y sin internet | 2 min | Todos |

Cada video: narración pausada, subtítulos, datos ficticios, una idea por video, cierre con "qué hacer si algo sale mal".

## 4. Plan de capacitación [Propuesta]

| Sesión | Público | Duración | Contenido | Evidencia |
|---|---|---|---|---|
| 1 | Auxiliares y ediles | 90 min | Videos 1 a 7 con práctica guiada en entorno de prueba | Lista de asistencia en formato institucional |
| 2 | Administradores | 120 min | Videos 9 a 11, revisión de la [Guía de administración](../04_PRODUCTO/GUIA_DE_ADMINISTRACION.md) | Lista de asistencia; ejercicio de crear un tipo de documento |
| 3 | Responsable técnico | 180 min | [Transferencia técnica](../12_ENTREGA/GUIA_DE_TRANSFERENCIA_TECNICA.md), despliegue, respaldo y restauración en vivo | Acta de transferencia; restauración ejecutada por la persona receptora |

Recomendación: hacer la prueba de usabilidad ([Accesibilidad](../04_PRODUCTO/ACCESIBILIDAD_Y_USABILIDAD.md#4-protocolo-propuesto-de-prueba-con-usuarios-propuesta)) **antes** de grabar la serie final, para no grabar flujos que vayan a cambiar.
