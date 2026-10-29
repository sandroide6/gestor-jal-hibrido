# 06 · Movimiento y animaciones

Skills usadas: **review-animations** (auditoría, tabla en [00](00-auditoria-diseno.md)), **animate** y **emil-design-eng** (construcción). Reglas: solo `transform` y `opacity`; menos de 300 ms; nada en acciones de cientos de veces al día ni en atajos de teclado; `prefers-reduced-motion` y `@media (hover: hover) and (pointer: fine)` desde el inicio.

Implementación: CSS puro en `frontend/src/index.css`, sección «Movimiento». Entradas con `@starting-style` (sin JS): un navegador sin soporte muestra el contenido igual, sin animar. Sin librerías nuevas.

| Clase | Dónde | Frecuencia / propósito | Ingredientes |
|---|---|---|---|
| `.btn:active` | Todos los botones | Retroalimentación | `scale(.97)`, 140 ms, `--ease-out` |
| `.lift` | Fichas de documento | Hover (solo puntero fino) | `translateY(-2px)`, 160 ms; `scale(.98)` al presionar |
| `.anim-dialog` + `.anim-backdrop` | Diálogos | Ocasional; evita salto brusco | `scale(.96)→1` y opacidad, 240 ms; origen centrado (modal) |
| `.anim-pop` | Menú de cuenta, notificaciones, asistente | Ocasional; relación espacial | `scale(.97)` y opacidad, 160 ms; origen en el botón que lo abre |
| `.anim-drawer` | Menú móvil | Ocasional | `translateX(-100%)→0`, 280 ms, `--ease-drawer` |
| `.anim-toast` | Toasts, Instalar, Nueva versión | Ocasional | `translateY(12px)` y opacidad, 240 ms; transición (interrumpible), salida inmediata |
| `.anim-step` | Cambio de paso al crear, «Más filtros» | Indicación de estado | `translateY(6px)` y opacidad, 200 ms |
| `.anim-stamp` | Sello de radicado al expedir | **Raro**: aquí vive el único detalle de «deleite» | `rotate(-2deg) scale(1.08)→0`, 280 ms |
| `.switch-thumb` | Interruptores de módulos | Estado | `translateX`, 200 ms, `--ease-in-out` |
| `.help-chevron` | Guías de Ayuda | Estado | `rotate(90deg)`, 200 ms, `--ease-in-out` |
| `.chat-fab:active` | Botón del asistente | Retroalimentación | `scale(.95)`, 140 ms; sin escala en hover |
| Barra de envío | `SyncProgressBanner` | Progreso | `scaleX()` (antes `width`) |

## Deliberadamente sin animación
- Plegar el menú lateral (cambia el ancho: sería animar diseño, y se usa a diario).
- Gráficas de Reportes (`isAnimationActive={false}`): son datos.
- Salida de toasts y diálogos: inmediata, la persona ya decidió.
- Cambio de página.

## Reducir movimiento
Con `prefers-reduced-motion: reduce` se conservan los fundidos y se quitan desplazamientos y escalas (`@starting-style` sin `transform`), el cajón aparece sin deslizar, se apaga el pulso de los skeletons, el spinner gira más lento, el asistente desplaza sin `smooth` y el paso de Crear no hace scroll suave.

## Pendiente de verificar a ojo
El «sello» (280 ms) y la entrada del cajón conviene mirarlos a velocidad lenta en DevTools › Animations en un equipo real; desde el código no se puede juzgar la sensación.
