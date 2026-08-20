# Gestor JAL — Frontend

Interfaz web del sistema de gestión documental para la Junta Administradora Local de Medellín.

## Stack

- **React 18** + **Vite 5**
- **Tailwind CSS** para estilos
- **Recharts 3** para gráficas
- **PWA** con Service Worker para uso offline
- **Zustand** para estado global

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # compilar para producción
npm run preview    # previsualizar el build
```

## Variables de entorno

Crea un archivo `.env` en esta carpeta:

```env
VITE_API_URL=/v1
```

## Estructura

```
src/
├── components/     Componentes reutilizables (formularios, tablas, layout)
├── pages/          Páginas de la aplicación (una por ruta)
├── services/       Funciones para llamar a la API del backend
├── stores/         Estado global con Zustand (auth, etc.)
└── hooks/          Custom hooks compartidos
```

---

**Copyright © 2026 Santiago M. Todos los derechos reservados.**  
Parte del proyecto **Gestor JAL** desarrollado por Santiago M.
