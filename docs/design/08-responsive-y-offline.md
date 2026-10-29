# 08 · Responsive y sin conexión

## Puntos de quiebre (Tailwind)

| Ancho | Comportamiento |
|---|---|
| < 640 px (celular) | Una columna; barra inferior Inicio/Crear/Buscar o Ayuda/Menú; diálogos anclados abajo; botones de descarga a lo ancho |
| 640–1023 px | Fichas a dos columnas; cabecera con estado de conexión |
| ≥ 1024 px | Lomo lateral fijo (plegable); cabecera solo con estado y campana |
| ≥ 1280 px | Buscar documentos usa tabla; por debajo, fichas (a 1024 px la tabla no cabía). Usuarios cambia a tabla desde 1024 px |

Validado con capturas a **1440, 1024 y 390 px** en 14 pantallas, más menú móvil y notificaciones (52 capturas). Un script mide `scrollWidth - clientWidth`: 0 en todas tras corregir `min-w-0` en el contenido y en columnas de grilla, y contenedores de tabla `relative` (un `sr-only` absoluto escapaba del recorte).

## Sin conexión (PWA)

- La PWA ya existía (`vite-plugin-pwa`, `generateSW`). El rediseño **no tocó** la lógica de cola ni de sincronización.
- Las fuentes se autoalojan con `@fontsource-variable` y entran al precache del Service Worker (53 entradas, ~2,1 MB): sin internet la app se ve igual.
- `theme_color` #193B35 y `background_color` #F6F3EC en el manifiesto y en `index.html`.
- Estados honestos: «Sin conexión · N por enviar», «Enviando X de Y», documento «Sin enviar» en las listas y «Guardado en este equipo, pendiente de enviar» al crear sin conexión. Nunca se muestra «sincronizado» antes de que el servidor lo confirme.
- Para entrar hace falta internet; la pantalla de entrada lo dice.
