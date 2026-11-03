# Componentes de terceros

Inventario del 29-10-2026 generado desde `package-lock.json` de backend y frontend (solo dependencias de producción) y de los archivos del repositorio. La lista completa, paquete por paquete, está en [dependencias-npm-produccion.csv](dependencias-npm-produccion.csv). Las licencias son las **declaradas** por cada paquete; no se auditó el texto de cada una.

## 1. Dependencias npm de producción

| Subproyecto | Paquetes | Licencias declaradas |
|---|---|---|
| Backend | 319 | MIT 228, ISC 44, Apache-2.0 14, BSD-3-Clause 10, BSD-2-Clause 6, BlueOak-1.0.0 4, otras permisivas (0BSD, Unlicense, Zlib, Python-2.0, MIT/X11), 2 con opción "MIT o GPL-3.0", 1 sin licencia declarada |
| Frontend | 92 | MIT 68, ISC 14, OFL-1.1 2 (tipografías), otras permisivas, 2 con opción "MIT o GPL-3.0" |

**Observaciones**

| Componente | Licencia | Comentario |
|---|---|---|
| `pizzip`, `jszip` (doble licencia) | MIT o GPL-3.0 | Se puede elegir MIT; conviene dejar constancia de la elección en el aviso de terceros |
| `googleapis`, `prom-client` | Apache-2.0 | Exige conservar avisos de copyright y el archivo NOTICE si lo tienen |
| `@fontsource-variable/public-sans`, `source-serif-4` | SIL OFL 1.1 | Uso y redistribución libres; no se pueden vender las fuentes por sí solas |
| `docxtemplater-image-module-free` | MIT | Sin mantenimiento activo (riesgo técnico R-11) |
| `buffers` 0.1.1 (transitiva) | No declarada | Revisar su repositorio; es dependencia de una dependencia del backend |
| Ninguna dependencia de producción | GPL o AGPL obligatoria | Las dependencias **no imponen** una licencia copyleft al proyecto |

## 2. Otros componentes

| Componente | Dónde | Licencia | Comentario |
|---|---|---|---|
| Python: `psycopg2-binary` | `scripts/requirements.txt` | LGPL-3.0 con excepciones | Uso como biblioteca dinámica; sin obligaciones relevantes si no se modifica |
| Python: `requests`, `python-dotenv`, `pyngrok`, `colorama` | `scripts/requirements.txt` | Apache-2.0, BSD-3-Clause, MIT, BSD-3-Clause | Permisivas |
| LibreOffice | Imágenes Docker (`deploy/`, `deploy/render/`) | MPL-2.0 (y otras) | Se instala desde los paquetes del sistema; si se distribuye la imagen Docker, se distribuye LibreOffice con su licencia |
| Tailscale | Imagen de Render | BSD-3-Clause (cliente) y términos del servicio | Servicio de terceros con cuenta |
| PostgreSQL | Servidor | PostgreSQL License (permisiva) | |
| Modelo Llama 3.2 vía Ollama | PC externo, opcional | Licencia comunitaria de Llama 3.2 (con restricciones de uso y de atribución) | No está en el repositorio; revisar si se mantiene el chat |
| Servicios: Vercel, Render, Supabase, Google Drive, ngrok | Nube | Términos de servicio de cada proveedor | Revisar ubicación de datos y condiciones de los planes gratuitos |

## 3. Elementos gráficos y de contenido de terceros

| Elemento | Dónde | Titular aparente | Situación |
|---|---|---|---|
| Escudo de Medellín, escudo de Antioquia, escudo de Colombia | Imágenes dentro de las plantillas `.docx` en `backend/plantillas/` | Distrito de Medellín, Departamento de Antioquia, Nación | Símbolos oficiales; su uso en documentos de la JAL debe estar autorizado o corresponder a la imagen institucional aplicable. **Sin autorización documentada** |
| Gráfica de los Objetivos de Desarrollo Sostenible | Plantillas | Naciones Unidas | La ONU publica lineamientos de uso del logo y los íconos; verificar que el uso en documentos oficiales los cumple |
| Textos y fundamentos legales de las plantillas | Plantillas | JAL Comuna 12 (redacción) | Cada JAL debe revisarlos antes de replicar |
| Iconos de la interfaz | `frontend/` | Ver dependencias y `scripts/generate-icons.js` | Generados en el proyecto o de paquetes con licencia permisiva [Supuesto: no se auditó cada SVG] |

## 4. Obligaciones prácticas si se distribuye el software

1. Incluir un archivo de avisos de terceros con las licencias de las dependencias (se puede generar desde el CSV).
2. Conservar los avisos de copyright de las bibliotecas Apache-2.0, BSD y MIT.
3. Declarar la elección de MIT en los paquetes con doble licencia.
4. Revisar `buffers` y cualquier paquete nuevo antes de cada versión.
5. Retirar o autorizar los escudos y la gráfica de los ODS antes de entregar el software a otra JAL.
