# 09 · Figma y entrega

**Archivo:** [Gestor JAL — Sistema de Diseño y Experiencia de Usuario](https://www.figma.com/design/Inxuw9tkcuxo50UiuqNOdi) (clave `Inxuw9tkcuxo50UiuqNOdi`), creado con el conector oficial de Figma en esta sesión.

## Contenido

**Página «01 · Sistema de diseño»**
- Variables: colección *Primitivos* (46 colores, ocultos para publicar), *Tokens* (28 alias semánticos con sintaxis de código `rgb(var(--color-…))`) y *Dimensiones* (espacio 1–12, radios sm/md/lg/pestaña con `var(--space-*)` / `var(--radius-*)`).
- 10 estilos de texto: Título página, sección y ficha; Cuerpo, Cuerpo fuerte, Pequeño; Etiqueta de campo; Botón; Pestaña; Radicado.
- Fundamentos: muestras de color con su contraste y escala tipográfica.
- Componentes con variantes: Botón (4 tipos × Normal, Hover, Foco, Deshabilitado, Procesando), Insignia de estado (5 tonos), Sello de radicado, Campo de formulario (Normal, Foco, Error, Deshabilitado), Aviso (4 tonos), Elemento de navegación (Normal, Activo, Foco), Ficha de documento, Encabezado de página, Pasos del trámite.

**Página «02 · Pantallas»**
- Inicio — Escritorio 1440
- Crear documento — Datos, Revisión y Listo
- Buscar documentos — Escritorio 1440
- Inicio — Móvil 390

## Límites encontrados (plan Starter de Figma)

- **3 páginas máximo**: la tercera, «03 · Flujos y entrega», quedó **vacía**.
- **Límite de llamadas del MCP de Figma alcanzado** a mitad de trabajo. Por eso **no** quedaron en Figma: la pantalla de entrada, las vistas de tableta a 1024 px ni las pantallas de administración.
- El último ajuste a la tabla de «Buscar documentos» en Figma (se quitó la columna «Hecho por») no se pudo verificar con una captura.
- El símbolo «✓» del componente Pasos no se dibuja en la fuente usada en Figma.
- En Figma el radicado usa IBM Plex Mono; en código, la monoespaciada del sistema.

**La referencia completa y verificada es el código y las capturas** en `/mnt/project-files/rediseno-v2/` (todas las pantallas a 1440, 1024 y 390 px). No se generó Code Connect.

## Capturas de tutoriales que quedaron desactualizadas

- `/mnt/project-files/tutoriales/capturas/` 01–35 y `videos/` 01–12
- `frontend/public/ayuda/*.webp` (imágenes de la página Ayuda)
- `/mnt/project-files/rediseno-2026-10-26/` (rediseño anterior)

Deben regenerarse con datos de prueba. Los textos de la página Ayuda ya se actualizaron a la nueva interfaz.

## Herramientas y skills usadas

| Herramienta | Uso | Resultado |
|---|---|---|
| Conector de Figma (MCP) | Crear archivo, variables, estilos, componentes y pantallas | Hecho hasta el límite del plan Starter |
| `review-animations` | Auditar el movimiento existente | Tabla en [00](00-auditoria-diseno.md) |
| `animate` | Construir entradas, toasts, diálogos y sello | Clases `anim-*` en `index.css` |
| `emil-design-eng` | Criterio de detalle: presión de botones, origen de menús, tiempos | Aplicado en componentes |
| `scroll-world` | **Evaluada y descartada** | Sirve para páginas de presentación con video que avanza con el scroll, y necesita servicios de generación de video (Higgsfield/Monid). Una herramienta de trabajo diario para personas no técnicas no debe mover el contenido al desplazarse, y no hay landing pública en el alcance |
| Playwright + Chromium (preinstalado) | Capturas y medición de desbordes | 52 capturas |
| axe-core 4.10.2 (carpeta temporal) | Auditoría WCAG | 0 violaciones |
