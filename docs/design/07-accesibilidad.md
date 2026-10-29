# 07 · Accesibilidad (objetivo WCAG 2.2 AA)

## Qué se hizo

| Criterio | Implementación |
|---|---|
| 1.3.1 Información y relaciones | Etiquetas `<label htmlFor>` en todos los campos (antes faltaban en Reportes, Auditoría, Perfil, Tipos, Copias); `fieldset`/`legend` por bloque; tablas con `scope="col"`; `dl` para cifras |
| 1.4.1 Uso del color | Todo estado lleva texto; el asterisco de obligatorio tiene «(obligatorio)» para lector |
| 1.4.3 / 1.4.11 Contraste | Ver tabla en [02](02-sistema-de-diseno.md); bordes de control a 3,75:1 |
| 1.4.4 / 1.4.12 Texto | Base 17 px, mínimo ~15 px; `rem` en todo |
| 1.4.10 Reflujo | Sin desplazamiento horizontal a 390 px en las 14 pantallas (medido) |
| 2.1.1 Teclado | Notificaciones como `<button>`; interruptores `role="switch"`; regiones con tabla desplazable enfocables (`tabIndex=0`) |
| 2.4.1 Saltar bloques | «Saltar al contenido», primer elemento enfocable |
| 2.4.2 Título | `document.title` por pantalla |
| 2.4.3 Orden del foco | Al cambiar de paso en Crear, el foco va al título; los diálogos devuelven el foco al cerrar |
| 2.4.7 / 2.4.11 Foco visible y no tapado | Anillo terracota de 3 px con 2 px de separación; toasts colocados encima de la barra inferior y del botón del asistente; espacio inferior extra en el contenido |
| 2.5.8 Tamaño del objetivo | Botones de 40 a 46 px, campos de 48 px, casillas en zonas de 44 px |
| 3.3.1 / 3.3.3 Errores | Mensaje junto al campo con icono, `aria-invalid` y `aria-describedby`, y resumen arriba del botón |
| 3.3.2 Etiquetas o instrucciones | Ayuda persistente bajo la etiqueta (el placeholder ya no es la única pista) |
| 4.1.2 Nombre, función, valor | Diálogos `role="dialog"`/`alertdialog` con `aria-labelledby`; `aria-current` en navegación y pasos; `aria-pressed` en «Solo pendientes»; `aria-expanded` en menús y filtros |
| 4.1.3 Mensajes de estado | Toasts y avisos con `role="status"`/`alert`; «Escribiendo…» del asistente anunciado |
| 2.3.3 Animación por interacción | `prefers-reduced-motion` respetado ([06](06-motion-y-animaciones.md)) |

## Cómo se verificó
- **axe-core 4.10.2** (WCAG 2.0/2.1/2.2 A y AA) inyectado con Playwright en 14 pantallas a 1440 y 390 px, con API simulada: **0 violaciones** tras corregir dos (estructura `dl` en Resumen y región desplazable sin foco). axe-core se instaló solo en una carpeta temporal, **no** en el proyecto.
- **Teclado** (Playwright): el primer Tab llega a «Saltar al contenido» con anillo de 3 px; el diálogo «Nuevo usuario» recibe el foco y Escape lo cierra.

## Lo que falta verificar a mano
- Lectura completa con NVDA (Windows) y TalkBack (Android).
- Zoom del navegador al 200 % y 400 %.
- Modo de alto contraste de Windows.
