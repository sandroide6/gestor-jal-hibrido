# Manual funcional

Para quien usa el Gestor JAL en la JAL. Describe la versión con el rediseño v2 (PR #10). Dentro de la aplicación, la página **Ayuda** muestra estos pasos según el rol. Los tutoriales paso a paso con capturas (`TUTORIALES.md`) están en la carpeta compartida del proyecto; sus imágenes muestran la interfaz **anterior** al rediseño, pero los pasos son los mismos.

Todos los ejemplos usan datos ficticios.

## 1. Catálogo de funcionalidades

| Funcionalidad | Menú | Auxiliar | Edil | Administrador | Estado |
|---|---|---|---|---|---|
| Entrar y aceptar la política de privacidad | Pantalla de inicio de sesión | ✔ | ✔ | ✔ | Verificado |
| Inicio: documentos disponibles y recientes | Inicio | ✔ | ✔ | ✔ | Verificado |
| Crear documento (Word y PDF con radicado y firma) | Crear documento | ✔ | ✔ | ✔ | Verificado |
| Recuperar datos de una persona ya atendida | Dentro de Crear documento | ✔ | ✔ | ✔ | Verificado |
| Emitir a nombre de un edil | Dentro de Crear documento | ✔ | ✔ | ✔ | Implementado |
| Buscar y revisar documentos de la JAL | Buscar documentos | | ✔ | ✔ | Verificado |
| Reportes y Excel | Reportes | | ✔ | ✔ | Verificado |
| Resumen (tablero) | Resumen | | ✔ | ✔ | Implementado |
| Auditoría | Auditoría | | ✔ | ✔ | Verificado |
| Usuarios | Usuarios | | | ✔ | Verificado |
| Tipos de documento y plantillas | Tipos de documento | | | ✔ | Implementado |
| Configuración de la JAL | Configuración JAL | | | ✔ | Implementado |
| Copias de seguridad | Copias de seguridad | | | ✔ | Zip verificado; Drive bloqueado |
| Perfil, firma, contraseña y verificación en dos pasos | Su nombre › Mi perfil y firma | ✔ | ✔ | ✔ | Implementado |
| Notificaciones | Campana | ✔ | ✔ | ✔ | Implementado |
| Asistente de chat | Botón del asistente | ✔ | ✔ | ✔ | Bloqueado (depende de un PC) |
| Trabajo sin internet | Automático | ✔ | ✔ | ✔ | Sin verificar en navegador real |

## 2. Primer ingreso

1. Abra la dirección del Gestor JAL que le dio el administrador.
2. Escriba su correo y contraseña. Si el equipo es suyo, marque **Recordarme en este equipo**.
3. La primera vez aparece la política de privacidad. Léala y acepte. Sin aceptar no puede continuar.
4. Registre su firma: tome una foto derecha de su firma en papel blanco y súbala en **Mi perfil y firma**. Sin firma no se pueden crear documentos a su nombre.
5. Cambie la contraseña que le entregaron.

> Si el sistema estuvo sin uso un rato, puede tardar hasta un minuto en abrir la primera vez (el servidor en la nube se "despierta"). No cierre la página.

## 3. Crear un documento

1. En **Inicio** o **Crear documento**, elija el tipo (por ejemplo, Certificado de Residencia).
2. Escriba primero el número de documento de la persona. Si ya fue atendida, el sistema pregunta si quiere **Usar sus datos**; revise que sigan vigentes.
3. Complete los campos. Los obligatorios están marcados; la ayuda bajo cada campo explica qué escribir.
4. Si el documento va a nombre de un edil, elíjalo en la lista.
5. Toque **Revisar antes de crear**. Si falta algo, el campo se marca y arriba del botón aparece un resumen.
6. Lea la revisión. Si todo está bien, **Sí, crear el documento**; si no, **Corregir datos**.
7. Aparece el número de radicado. Descargue **PDF (para imprimir)** o **Word (para editar)**.

**Qué no se puede hacer:** cambiar un documento ya creado (se genera uno nuevo) ni crear documentos si no hay firma registrada.

## 4. Buscar y revisar (edil y administrador)

1. Abra **Buscar documentos**. Use los filtros por fecha, tipo, persona o **Solo pendientes**.
2. Abra un documento para ver el detalle y descargarlo.
3. Si lo revisó, márquelo como **Revisado**. Queda registrado quién y cuándo.

## 5. Reportes y resumen (edil y administrador)

- **Resumen:** cifras generales y gráficas de la JAL.
- **Reportes:** elija el período y descargue el Excel con los documentos emitidos. **Cuidado:** el Excel contiene datos personales de ciudadanos; guárdelo solo en equipos de la JAL y no lo envíe por canales abiertos.

## 6. Perfil y seguridad de la cuenta

- **Mi perfil y firma:** nombre, cargo, firma.
- **Cambiar contraseña:** al cambiarla se cierran sus otras sesiones.
- **Verificación en dos pasos:** recomendada para administradores. Se activa escaneando un código QR con una aplicación de autenticación.
- **Cerrar sesión en todos los equipos:** si perdió un equipo o cree que alguien conoce su contraseña.

## 7. Trabajo sin internet

Si se cae la conexión, la aplicación lo indica y permite seguir creando documentos con los tipos ya descargados. Al volver la conexión los envía solos y reciben su radicado. **Pendiente de verificar** en un navegador real y de acordar con la JAL si se entregan documentos antes de sincronizar.

## 8. Mensajes frecuentes

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| Correo o contraseña incorrectos | Los datos no coinciden | Revise mayúsculas; tras 10 intentos la cuenta se bloquea 15 minutos |
| … no tiene firma registrada | El firmante o el edil elegido no subió su firma | Registrar la firma en el perfil |
| Su sesión venció | Pasó el tiempo de la sesión | Vuelva a entrar |
| No tiene permiso | Su rol no permite esa acción | Pida al administrador |
| Sin conexión | No hay internet | Puede seguir; se sincroniza al volver |

Para administradores: [Guía de administración](GUIA_DE_ADMINISTRACION.md).
