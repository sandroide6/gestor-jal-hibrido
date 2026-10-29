# Changelog del diseño

## 2026-10-29 — «El archivo vivo de la comunidad»

### Agregado
- Tokens de color, forma y movimiento (`src/styles/tokens.css`) enlazados con variables de Figma.
- Fuentes Public Sans y Source Serif 4 autoalojadas (funcionan sin conexión).
- Componentes: `Icon`, `Notice`, `StatusBadge`/`DocumentStatus`, `Radicado`, `Spinner`, `Dialog`/`ConfirmDialog`, `PageHeader`, `Steps`, `ConnectionStatus`, `AuthShell`, `DocTypeCard`, `DocumentRow`.
- Barra inferior y cajón de menú en celular; enlace «Saltar al contenido»; título de pestaña por pantalla.
- Crear documento por pasos con sello de radicado; formulario en bloques con ayuda persistente.
- Buscar documentos con «Más filtros» y «Solo pendientes»; enlace directo desde Inicio y Resumen.
- Documentación `docs/design/00`–`11` y archivo de Figma.

### Cambiado
- Las 14 pantallas, los banners de estado, los toasts, las notificaciones, el asistente, la verificación en dos pasos y el cambio de contraseña.
- Paleta institucional #193B35 / #F6F3EC / #9B4133; `theme_color` del manifiesto.
- Reportes con colores de la marca y sin animación; Resumen como franja de cifras.
- Textos de la página Ayuda alineados con la nueva interfaz.

### Corregido
- Campos sin estilo en Configuración JAL (clase `input-field` inexistente).
- Etiquetas sin asociar en varios formularios; notificaciones no operables con teclado.
- Error de copias de seguridad visible solo como `title`.
- Animaciones de propiedades de diseño, `transition-all`, rebote infinito y hover en táctil.

### Quitado
- `window.confirm()` del navegador (reemplazado por diálogos).
- Icono de Google Drive dibujado a mano y la etiqueta fija «IA local · llama3.2» del asistente (el modelo es configurable en el servidor).
