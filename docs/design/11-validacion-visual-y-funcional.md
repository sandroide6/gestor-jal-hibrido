# 11 · Validación visual y funcional

Fecha: 29-10-2026. Todo con **datos de prueba** («Persona de Prueba Uno», cédulas 100000000N, radicados `2026-PRUEBA-…`, correos `@ejemplo.test`) y la API simulada en el navegador; no se tocó la base de datos real.

## Pruebas automáticas

| Verificación | Resultado |
|---|---|
| `npx vitest run` | **13 archivos, 121/121 pruebas pasan** (las mismas que antes; ninguna se borró ni se desactivó) |
| `npx eslint src --ext js,jsx` | **0 errores**, 10 avisos (variables sin usar en código no tocado y dependencias de hooks heredadas) |
| `npm run build` | Correcto; PWA `generateSW` con 53 entradas en precache |

## Validación visual (Playwright + Chromium)

- 14 pantallas × 1440, 1024 y 390 px, más menú móvil y panel de notificaciones: 52 capturas en `/mnt/project-files/rediseno-v2/`.
- Flujo completo de Crear documento (Datos → Revisión → Listo) recorrido en los tres anchos.
- Desplazamiento horizontal: 0 px en todas las pantallas.
- Errores de consola: solo los 404 esperados de la firma simulada (la API de prueba responde «sin firma»).

Problemas encontrados en la revisión y corregidos:
1. Tabla de Buscar cortada a 1024 px → fichas hasta 1280 px.
2. Copias y Resumen desbordaban a 390 px → `min-w-0` y contenedores `relative`.
3. Gráficas capturadas a mitad de su animación → animación de entrada desactivada.
4. Menú móvil escondía Configuración y Copias en un desplazamiento interno → ahora se desplaza el cajón completo.
5. Instalar/Nueva versión entraban de lado (la transición pisaba el centrado) → centrado en un contenedor externo.
6. Toasts tapaban el botón del asistente → subidos sobre él.

## Accesibilidad
axe-core 4.10.2 (WCAG 2.2 AA), 14 pantallas × 2 anchos: **0 violaciones**. Teclado: «Saltar al contenido» primero, foco visible de 3 px, diálogo con foco atrapado y Escape. Detalle en [07](07-accesibilidad.md).

## Lo que no se verificó
- Contra el backend real de Render/Supabase (se usó API simulada).
- Safari/iOS y Firefox (solo Chromium).
- Lectores de pantalla reales y zoom al 400 %.
- Rendimiento en un celular de gama baja.
- Las imágenes de `public/ayuda/` y los tutoriales siguen mostrando la interfaz anterior.
