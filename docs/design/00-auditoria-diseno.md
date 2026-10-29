# 00 · Auditoría del diseño anterior

Estado del frontend **antes** del rediseño (commit base `dbddf54`), revisado en el código. No se tocó el backend.

## Stack verificado

| Pieza | Estado real | Dónde se comprobó |
|---|---|---|
| React 18 + Vite + Tailwind 3 | Sí | `frontend/package.json` |
| PWA (Service Worker, funciona sin conexión) | Sí, `vite-plugin-pwa` 0.20 en modo `generateSW` | `frontend/vite.config.js` |
| Sequelize | Sí, `sequelize` 6 y `sequelize-cli` (migraciones) | `backend/package.json` |
| Base de datos | PostgreSQL (`pg`); Supabase en el despliegue híbrido | `README.md`, `docs/DESPLIEGUE_HIBRIDO.md` |
| Despliegue | Frontend en Vercel, backend en Render | `render.yaml`, `frontend/vercel.json` |

## Hallazgos visuales y de experiencia

| # | Hallazgo | Efecto para el usuario |
|---|---|---|
| 1 | Paleta `jal.blue` que en realidad era verde (#1E6B3A) más dorado #D4A017, y además azules, morados, ámbar y rosas de Tailwind sueltos en cada pantalla | Sin identidad; colores sin significado estable |
| 2 | Fuente declarada `Inter` pero **nunca cargada** | Cada equipo mostraba su fuente del sistema |
| 3 | `text-xs` (12,75 px) usado 191 veces | Texto difícil de leer para personas mayores |
| 4 | Tarjetas de cifras de colores distintos por métrica en el Panel | Ruido; el color no significaba nada |
| 5 | Gráficas de Reportes con 8 colores arbitrarios para auxiliares | Sugería categorías donde solo hay una medida |
| 6 | `window.confirm()` del navegador para borrar firma, cerrar sesiones y desconectar Drive | Texto genérico, sin explicar qué se pierde |
| 7 | Tres modales hechos a mano con estilos distintos (usuarios, tipos, contraseña) | Inconsistencia; foco gestionado tres veces |
| 8 | Configuración JAL usaba la clase `input-field`, **que no existía** | Campos sin estilo ni foco visible |
| 9 | En Copias, el detalle de un error de backup solo estaba en un `title` | Inaccesible con teclado y lector de pantalla |
| 10 | Placeholders usados como única ayuda en los formularios | La pista desaparece al escribir |
| 11 | Notificaciones como `<div onClick>` | No se podían marcar como leídas con teclado |
| 12 | Etiquetas `<label>` sin `htmlFor` en Reportes, Auditoría, Perfil y Tipos | El lector de pantalla no anunciaba el campo |
| 13 | Menú lateral fijo y banners de estado flotando sobre el contenido | Tapaban texto en pantallas pequeñas |
| 14 | Icono de Google Drive dibujado a mano | Imitación de una marca ajena |

## Auditoría de animaciones (skill `review-animations`)

| Antes | Después | Por qué |
| --- | --- | --- |
| `AppLayout`: `transition-all duration-300` sobre `width` y `margin` del menú lateral | Sin animación al contraer (cambio inmediato) | Animaba propiedades de diseño, 300 ms, y se usa a diario |
| `NavItem` con `transition-all` | `transition` solo de color | `all` anima lo que no debe |
| `ChatWidget`: `animate-bounce` en «escribiendo» | Spinner con texto «Escribiendo…» (`role=status`) | Rebote infinito y sin significado para lector |
| `ChatWidget`: `transition-all hover:scale-105` sin condición | `:active scale(.95)` en 140 ms; sin escala al pasar el puntero | Hover sin `@media (hover:hover)` dispara en táctil |
| `SyncProgressBanner`: barra animando `width` | `transform: scaleX()` | Solo propiedades de GPU |
| Skeletons con `animate-pulse` sin `prefers-reduced-motion` | Pulso apagado con reducir movimiento | Accesibilidad |
| Toasts sin animación de entrada | `@starting-style`, sube 12 px en 240 ms | Evita un cambio brusco en algo ocasional |
| Recharts con animación de entrada por defecto (1,5 s) | `isAnimationActive={false}` | Son datos para leer; no deben moverse |
| `JalConfigPage`: interruptor con `ease-in-out` 200 ms | Se conserva (movimiento en su sitio) | Correcto según la regla |
| Chevrón de `<details>` en Ayuda | Se conserva, 200 ms `ease-in-out`, apagado con reducir movimiento | Correcto |
