# Análisis de licencias y propiedad intelectual

> Análisis técnico para el área jurídica. **No es un concepto jurídico.** No se modificó ninguna licencia ni aviso de derechos en el repositorio: hacerlo antes de resolver la titularidad podría tener efectos jurídicos. Los textos de la sección 6 son **borradores**.

## 1. Situación actual

| Hecho | Fuente |
|---|---|
| No hay archivo `LICENSE` ni campo `license` en los `package.json` | Repositorio |
| El `README.md` declara "Copyright © 2026" a nombre de una persona natural (el desarrollador) y "Todos los derechos reservados", con uso restringido a la JAL para la cual fue creado | `README.md`, sección "Licencia y derechos" |
| El desarrollo y soporte se reportan dentro del contrato de prestación de servicios PS 2779 (I.U. Pascual Bravo), derivado del interadministrativo 4600108028 de 2026 con el Distrito de Medellín | Actas e informe de obligaciones [Acta] |
| Parte del desarrollo es **anterior** al contrato: versión 2.0.0 del 14-05-2026 en `CHANGELOG.md` y plantillas fechadas el 11-05-2026; el contrato inicia en agosto de 2026 | `CHANGELOG.md`, metadatos de `backend/plantillas/` |
| El historial de Git del repositorio empieza el 19-08-2026; no contiene el desarrollo anterior, que solo consta en el CHANGELOG | `git log` |
| Hay commits de tres autores: el desarrollador, un segundo usuario de GitHub y, en 25 de 53 commits, un asistente de inteligencia artificial | `git log` |
| No se tuvo el contrato ni su cláusula de propiedad intelectual | — |

## 2. Marco aplicable (resumen)

- **Decisión Andina 351 de 1993:** los programas de ordenador se protegen como obras literarias (art. 23); se reconoce que una persona distinta del autor puede ser titular de los derechos patrimoniales (art. 9).
- **Ley 23 de 1982, art. 20, modificado por el art. 28 de la Ley 1450 de 2011:** en las obras creadas por encargo o en virtud de un contrato de prestación de servicios, se presume, salvo pacto en contrario, que los derechos patrimoniales se transfieren al encargante **en la medida necesaria para el ejercicio de sus actividades habituales** en la época de creación. Para que opere, el contrato debe constar por escrito. El autor conserva los derechos morales.
- El **registro** ante la Dirección Nacional de Derecho de Autor es declarativo, no constitutivo, pero sirve como prueba.

Fuentes y fecha de consulta en la [Matriz normativa](MATRIZ_NORMATIVA.md).

## 3. Escenarios de titularidad

| Escenario | Qué pasaría | Qué hace falta |
|---|---|---|
| A. El contrato tiene cláusula expresa de cesión a la I.U. Pascual Bravo o al Distrito | El titular patrimonial es quien diga la cláusula, para lo creado en ejecución del contrato | Leer la cláusula; separar lo anterior al contrato |
| B. El contrato no dice nada | Opera la presunción del art. 20: transferencia al encargante en la medida necesaria para sus actividades habituales. Es discutible si incluye replicar en otras JAL o licenciar a terceros | Concepto jurídico sobre el alcance; acuerdo escrito que lo aclare |
| C. El software anterior al contrato es del desarrollador | El desarrollador conserva la titularidad de la versión previa; lo hecho durante el contrato se rige por A o B. El resultado es una obra con partes de distinto titular | Inventario de lo previo vs. lo contratado (difícil: el historial de Git no cubre lo previo); acuerdo de licencia o cesión de lo previo |
| D. Contribuciones de terceros (segundo usuario de GitHub) | Debe establecerse quién es y bajo qué condición contribuyó | Identificar al contribuyente y su relación con el proyecto |
| E. Código generado con asistencia de inteligencia artificial | La autoría en el régimen andino y colombiano se reconoce a personas naturales; el tratamiento de los aportes generados por IA es un tema en evolución | Que jurídica evalúe; documentar la participación humana (dirección, selección, revisión) |

**Conclusión técnica:** con la información disponible **no se puede determinar** quién es el titular de los derechos patrimoniales del software completo. Es el bloqueo principal para elegir licencia y replicar.

## 4. Inventario de propiedad intelectual

| Activo | Ubicación | Titular probable | Observación |
|---|---|---|---|
| Código del backend y del frontend | `backend/`, `frontend/` | Por determinar (sección 3) | |
| Scripts de operación | raíz, `scripts/`, `deploy/` | Por determinar | |
| Migraciones y modelo de datos | `backend/migrations/` | Por determinar | |
| Sistema de diseño e interfaz v2 | `docs/design/`, `frontend/` | Por determinar | Creado en octubre de 2026 |
| Documentación | `docs/`, `README.md` | Por determinar | |
| Plantillas `.docx` | `backend/plantillas/` | Textos: JAL Comuna 12 [Supuesto]; imágenes: terceros | Ver [Componentes de terceros](COMPONENTES_DE_TERCEROS.md#3-elementos-gráficos-y-de-contenido-de-terceros) |
| Tutoriales (videos y capturas) | Carpeta compartida | Por determinar | Con datos ficticios |
| Nombre "Gestor JAL" | — | Sin registro de marca conocido | Evaluar si se necesita |
| Datos (documentos, usuarios) | Bases de datos | No son del desarrollador: pertenecen al ámbito de la JAL y los titulares | El software y los datos son cosas distintas |
| Dependencias de terceros | `node_modules` (no versionado) | Sus autores | Licencias permisivas |

## 5. Comparación de licencias

| Criterio | MIT | Apache-2.0 | GPL-3.0 | AGPL-3.0 | Propietaria / licencia de uso |
|---|---|---|---|---|---|
| Otras JAL o entidades pueden usar y modificar | Sí | Sí | Sí | Sí | Solo si la licencia lo dice |
| Las mejoras de terceros deben publicarse | No | No | Sí, si distribuyen | Sí, también si lo ofrecen como servicio web | No aplica |
| Protege frente a quien lo ofrezca como servicio sin compartir cambios | No | No | No (el uso en red no es distribución) | **Sí** | Según contrato |
| Concesión expresa de patentes | No | **Sí** | Sí | Sí | Según contrato |
| Compatible con las dependencias actuales | Sí | Sí | Sí | Sí | Sí (son permisivas) |
| Complejidad de cumplimiento | Muy baja | Baja (avisos y NOTICE) | Media | Media-alta | Depende |
| Permite a un proveedor cerrar una versión mejorada | Sí | Sí | No | No | — |
| Requiere que el titular esté definido | **Sí** | **Sí** | **Sí** | **Sí** | **Sí** |

## 6. Recomendación condicionada [Propuesta]

Solo es aplicable **después** de resolver la titularidad (sección 3) y con aprobación de jurídica:

| Si se decide que… | Opción sugerida | Por qué |
|---|---|---|
| El Distrito (o la I.U.) es titular y quiere que cualquier JAL o entidad lo use y lo mejore libremente | **Apache-2.0** | Permisiva, con concesión de patentes y avisos claros; fácil de cumplir para otras entidades |
| El titular quiere que las mejoras hechas por proveedores para otras JAL vuelvan a estar disponibles, incluso si lo ofrecen en la nube | **AGPL-3.0** | Es la única de la lista que cubre el uso como servicio web |
| El desarrollador conserva la titularidad | **Licencia de uso** escrita a favor del Distrito: no exclusiva, perpetua, irrevocable, para todas las JAL de Medellín, con derecho a modificar, a contratar el mantenimiento con terceros y con entrega del código fuente | Garantiza continuidad sin depender del autor |
| Titularidad mixta (escenario C) | Acuerdo que unifique: cesión o licencia de lo previo y luego una de las opciones anteriores | Evita una obra con partes bajo condiciones distintas |

MIT es una alternativa a Apache-2.0 si se prefiere el texto más corto, a costa de no tener concesión expresa de patentes.

## 7. Borradores [BORRADOR, no aplicar sin autorización]

### 7.1 Encabezado de archivo (si se adopta Apache-2.0)
```text
BORRADOR — NO APLICAR
Copyright [AÑO] [TITULAR DEFINIDO EN EL CONTRATO]
Licenciado bajo la Licencia Apache, Versión 2.0. Ver el archivo LICENSE.
```

### 7.2 Aviso para el README
```text
BORRADOR — NO APLICAR
Gestor JAL. Titular de los derechos patrimoniales: [POR DEFINIR].
Autor: [NOMBRE DEL AUTOR, derechos morales].
Desarrollado en el marco de [CONTRATO, SI APLICA].
Licencia: [POR DEFINIR]. Componentes de terceros: ver docs/10_LEGAL_Y_LICENCIAS/COMPONENTES_DE_TERCEROS.md.
Los escudos y símbolos incluidos en las plantillas pertenecen a sus titulares y no se licencian con este software.
```

### 7.3 Cláusula sugerida para un acuerdo de transferencia o licencia (puntos a cubrir)
Objeto (código fuente, documentación, plantillas sin símbolos de terceros); versión y fecha exacta (commit); titularidad o licencia; alcance territorial e institucional (otras JAL); derecho a modificar y a contratar con terceros; entrega del código y de las credenciales; derechos morales del autor; garantías sobre componentes de terceros; tratamiento de lo desarrollado antes del contrato.
