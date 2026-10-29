# 10 · Guía de implementación

Para quien siga construyendo pantallas en `frontend/`.

## Reglas rápidas
1. **Colores solo por token:** `bg-bg`, `bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `bg-brand`, `text-accent`, `bg-success-bg text-success-fg`… Nunca `text-blue-600` ni hexadecimales en JSX (excepción: Recharts, que necesita valores literales; están al inicio de `ReportsPage.jsx` con su token al lado).
2. **Nada por debajo de `text-sm`.** `text-xs` no se usa (salvo la cifra del globo de notificaciones, decorativa y `aria-hidden`).
3. **Página nueva:**
   ```jsx
   <AppLayout title="Nombre" eyebrow="Grupo" description="Para qué sirve, en una frase." actions={<button className="btn-primary">…</button>}>
     …
   </AppLayout>
   ```
   `width="page"` o `"wide"` para tablas; por defecto es estrecho, para leer.
4. **Campo:** `label.label[htmlFor]` + `p.hint[id]` + `input.input[aria-describedby]` + `p.field-error[id]` con `aria-invalid` cuando hay error.
5. **Confirmar algo destructivo:** `ConfirmDialog danger` con título en pregunta («¿Eliminar tu firma?»), un mensaje que diga qué se pierde y qué no, y un botón con el verbo exacto. Nunca `window.confirm`.
6. **Avisos:** `Notice` dentro de la página para lo que debe quedar a la vista; `toast.success/error` para confirmaciones pasajeras. El éxito se anuncia **después** de que la API responda.
7. **Estados de un documento:** usa `DocumentStatus` (no inventes textos).
8. **Movimiento:** reutiliza las clases `anim-*`; si hace falta otra, solo `transform`/`opacity`, tokens `--dur-*` y `--ease-*`, y su línea en el bloque de reducir movimiento.
9. **Tablas anchas:** envuélvelas en `div.table-wrap.relative.overflow-x-auto[tabIndex=0][role=region][aria-label]` y ofrece fichas en pantallas pequeñas.
10. **Columnas de grilla o flex con tablas dentro:** `min-w-0`.

## Comandos
```bash
cd frontend
npm run lint      # 0 errores (quedan 10 avisos heredados de variables sin usar)
npm test          # vitest
npm run build     # incluye el Service Worker
```

## Archivos clave
`src/styles/tokens.css` · `tailwind.config.js` · `src/index.css` · `src/components/ui/*` · `src/components/documents/*`.
