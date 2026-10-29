# 02 · Sistema de diseño

Fuente de verdad: `frontend/src/styles/tokens.css` (variables CSS como canales RGB) y `frontend/tailwind.config.js` (nombres semánticos). Cada token tiene su par en Figma (ver [09](09-figma-y-entrega.md)).

## Color

| Token | Valor | Uso |
|---|---|---|
| `bg` | #F6F3EC | Papel, fondo de página |
| `surface` | #FFFFFF | Hojas, tarjetas, campos |
| `sunken` | #F1EDE4 | Zonas hundidas, cabeceras de tabla |
| `ink` | #222A27 | Texto principal |
| `ink-muted` | #5B6560 | Texto secundario |
| `line` / `line-strong` | #E3DED2 / #CFC9BB | Filetes decorativos |
| `line-control` | #7D8681 | Borde de campos y controles (≥ 3:1) |
| `brand` | #193B35 | Verde institucional: lomo, botón principal |
| `brand-hover` / `brand-tint` | #12302A / #EEF3F0 | Estados |
| `accent` | #9B4133 | Terracota: radicado, folio, foco, avisos de no leído |
| `success` · `warning` · `danger` · `info` | fondo, texto, borde y sólido cada uno | Estados del sistema |

Escala `gray` sobrescrita con grises cálidos; `gray-400` (#6B746F) es el primer paso apto para texto sobre blanco. Los alias heredados `jal.blue` y `jal.gold` apuntan ahora a la escala verde y a la terracota, para que ningún resto del código anterior rompa la paleta.

### Contrastes medidos (WCAG 2.x, script `contrast.py`)

| Par | Relación | Mínimo |
|---|---|---|
| Texto sobre papel | 13,27:1 | 4,5 |
| Texto secundario sobre papel | 5,45:1 | 4,5 |
| Blanco sobre verde | 12,22:1 | 4,5 |
| Terracota sobre papel | 5,93:1 | 4,5 |
| Borde de control sobre blanco | 3,75:1 | 3 (no texto) |
| Éxito (texto sobre su fondo) | 7,85:1 | 4,5 |
| Advertencia | 6,42:1 | 4,5 |
| Error | 7,10:1 | 4,5 |
| Información | 8,08:1 | 4,5 |
| `gray-400` sobre blanco | 4,82:1 | 4,5 |
| `gray-400` sobre papel | 4,35:1 | **No apto** para texto pequeño: no se usa así |

axe-core 4.10 confirmó 0 violaciones de contraste en las 14 pantallas (ver [11](11-validacion-visual-y-funcional.md)).

## Tipografía

Autoalojadas con `@fontsource-variable` (licencia OFL) para que funcionen **sin conexión** dentro de la PWA:

- **Public Sans Variable** (5.3.0): interfaz y lectura. Diseñada para gobierno: neutra y muy legible.
- **Source Serif 4 Variable** (5.3.1): títulos, nombres de documento y cifras. Da el tono de archivo.
- **Monoespaciada del sistema**: números de radicado.

| Clase | Tamaño | Uso |
|---|---|---|
| `title-page` | 28 / 32 px serif | Título de pantalla |
| `title-section` | 22 / 24 px serif | Secciones |
| `title-card` | 18 / 20 px serif | Fichas y diálogos |
| base | 17 px | Cuerpo (`html { font-size: 106.25% }`) |
| `text-sm` | ~15 px | Secundario; mínimo permitido |
| `text-eyebrow` | 12,75 px, mayúsculas espaciadas, peso 600 | Solo rótulos tipo pestaña |

## Forma

Radios `sm 4 · md 6 · lg 10 · tab 12` px. Sin sombras por defecto: las hojas se separan con filete. `shadow-sheet` para la hoja de revisión y `shadow-float` para diálogos, menús y toasts.

## Movimiento

Curvas `--ease-out cubic-bezier(.23,1,.32,1)`, `--ease-in-out cubic-bezier(.77,0,.175,1)`, `--ease-drawer cubic-bezier(.32,.72,0,1)`. Duraciones: pulsación 140, rápida 160, base 200, entrada 240, cajón 280 ms. Detalle en [06](06-motion-y-animaciones.md).

## Iconos

Un solo juego de iconos de línea (24 px, trazo 1,75) en `components/ui/Icon.jsx`, siempre junto a un texto visible y por eso `aria-hidden`.
