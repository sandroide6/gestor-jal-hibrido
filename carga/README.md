# Pruebas de carga (k6)

Simulan el uso real de una JAL y comprueban los umbrales de la auditoría del 05-11-2026 (plan 3.2 y 5.1). **Nunca contra producción:** crean usuarios y documentos de prueba. Usar la base local o el [staging](../docs/06_DESPLIEGUE/STAGING.md).

## Qué simula `escenario.js`

| Escenario | Qué hace | Por defecto |
|---|---|---|
| `consultas` | Personas abriendo Inicio: mis documentos, tipos, perfil, con pausas de 1 a 3 s | 5 usuarios durante 2 min |
| `creacion` | Documentos nuevos con la plantilla oficial (DOCX → PDF con LibreOffice) y descarga del PDF | 12 por minuto durante 2 min |
| `rafaga` | Documentos simultáneos al final (el peor caso: todos a la vez) | 10 a la vez |

Antes de empezar, `setup()` crea los auxiliares de prueba con la cuenta del administrador, les cambia la contraseña inicial y les sube una firma.

## Umbrales (k6 termina con código distinto de 0 si no se cumplen)

| Métrica | Umbral |
|---|---|
| Peticiones fallidas (`http_req_failed`) | < 1 % |
| Consultas p95 | < 800 ms |
| Crear documento p95 (incluye el PDF) | < 15 s |
| Descargar el PDF p95 | < 2 s |

## Cómo correrla

1. Instalar k6 (<https://grafana.com/docs/k6/latest/set-up/install-k6/>; es un solo binario).
2. Backend corriendo contra una base de **prueba** sembrada, con LibreOffice instalado.
3. Ejecutar desde la raíz del repositorio:

```bash
k6 run carga/escenario.js \
  -e BASE_URL=http://localhost:3001 \
  -e ADMIN_EMAIL=admin@jal.gov.co -e ADMIN_PASSWORD='<contraseña del admin de pruebas>'
# Opcionales: -e USUARIOS=5 -e DURACION=2m -e DOCS_POR_MIN=12 -e RAFAGA=10
```

Para medir también la memoria del backend y de LibreOffice (solo en local, donde se ven los procesos):

```bash
carga/medir-memoria.sh "$(pgrep -f 'node src/index.js')" memoria.csv &
k6 run carga/escenario.js …
kill %1      # imprime el pico total
```

En Render, la memoria se mira en *Metrics* del servicio mientras corre la prueba.

## Resultados

| Fecha | Dónde | Resultado | Evidencia |
|---|---|---|---|
| 06-11-2026 | Local (4 CPU, 16 GB, PostgreSQL 16, LibreOffice 24.2) | Todos los umbrales cumplidos, 0 de 991 peticiones fallidas. Crear documento p95 11,7 s (mediana 1,5 s), PDF p95 19 ms, consultas p95 8,5 ms. Memoria pico 399 MB (backend 190 MB, LibreOffice 212 MB, un solo proceso a la vez) | `evidencias/19-carga-k6-local.txt` |
| Pendiente | Staging (Render Free, 0,1 CPU, 512 MB) | Es la medición que decide si hace falta un plan de pago | |

El p95 de crear documento en local viene de la ráfaga: LibreOffice convierte un documento a la vez, así que el último de 10 simultáneos espera a los demás. En Render Free, con 0,1 CPU, se espera bastante más lento; por eso la medición en staging es obligatoria antes de dar la capacidad por buena.
