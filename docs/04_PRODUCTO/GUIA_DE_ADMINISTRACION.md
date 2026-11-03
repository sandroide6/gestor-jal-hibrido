# Guía de administración (dentro de la aplicación)

Para la persona con rol **administrador** en la JAL. Las tareas técnicas fuera de la aplicación (servidores, respaldos por línea de comandos, actualizaciones) están en [Operación y mantenimiento](../07_OPERACION/OPERACION_Y_MANTENIMIENTO.md).

## 1. Antes de empezar a usarlo en la JAL

| Tarea | Dónde | Por qué |
|---|---|---|
| Cambiar la contraseña inicial del administrador y activar la verificación en dos pasos | Mi perfil y firma | La contraseña de ejemplo del código es pública si no se definió `ADMIN_INITIAL_PASSWORD` |
| Revisar nombre, logo y **código de dependencia** de la JAL | Configuración JAL | El código va en cada radicado. Debe ser único si varias JAL comparten instalación |
| Revisar las plantillas y sus textos legales | Tipos de documento | Los textos y logos vienen de la JAL Comuna 12 |
| Crear los usuarios reales y desactivar los de prueba | Usuarios | |
| Confirmar con el responsable del tratamiento que existe aviso de privacidad para ciudadanos | Fuera del sistema | Ver [Protección de datos](../09_SEGURIDAD_Y_PRIVACIDAD/PROTECCION_DE_DATOS.md) |

## 2. Usuarios

- **Crear:** Usuarios › **Nuevo usuario** › nombre, correo, rol y contraseña inicial. Entregue la contraseña por un canal privado y pida que la cambie.
- **Roles:** auxiliar (crea), edil (crea, busca, revisa, reportes, auditoría), administrador (todo).
- **Desactivar** cuando alguien deja la JAL: conserva su historial y cierra sus sesiones. **Borrar definitivamente** solo con una razón documentada; el sistema no lo permite si la persona tiene documentos registrados.
- El correo no se puede repetir, ni siquiera en otra JAL de la misma instalación.

## 3. Tipos de documento

1. Prepare la plantilla en Word. Donde va un dato, escriba la variable entre llaves, por ejemplo `{nombre}`, `{cedula}`, `{fecha}`. Para la firma use la variable `{firma_img}` (el sistema la convierte en imagen) (tome una como modelo).
2. Tipos de documento › nuevo: nombre, tipo de trámite (**entrada**, **salida** o **interno**, que define ENT/SAL/INT en el radicado) y campos (texto, área de texto, fecha, hora, número, lista, casilla, lista de chequeo, duración, período).
3. Suba la plantilla y guarde. Cree un documento de prueba con datos ficticios y revise el PDF antes de usarlo con el público.
4. Para retirar un tipo, desactívelo; los documentos emitidos se conservan.

## 4. Configuración de la JAL

Nombre, logo, código de dependencia y funciones opcionales. Cambiar el código de dependencia afecta solo los radicados futuros.

## 5. Auditoría

Filtre por usuario, acción y fecha. Acciones registradas, entre otras: inicio y cierre de sesión, cambio de contraseña, aceptación de política, creación, revisión, consulta de persona y borrado de documentos, cambios en usuarios y tipos, cambios de configuración, exportaciones y copias. Revísela al menos una vez al mes y ante cualquier sospecha.

## 6. Copias de seguridad

- **Descargar copia completa (zip):** contiene usuarios, plantillas, documentos y sus archivos, con **datos personales y sin cifrar**. Guárdela en un medio cifrado de la JAL; no la envíe por correo ni la deje en un computador compartido.
- **Google Drive:** requiere que el responsable técnico configure las credenciales de Google; luego **Conectar con Google Drive** y activar las copias automáticas. Hoy no está conectado en producción.
- **Restaurar** un zip desde el panel **no** es posible todavía. La restauración la hace el responsable técnico con los scripts ([Respaldo y restauración](../07_OPERACION/RESPALDO_Y_RESTAURACION.md)).

## 7. Revisión periódica sugerida

| Frecuencia | Tarea |
|---|---|
| Semanal | Revisar documentos pendientes de revisión con los ediles |
| Mensual | Revisar auditoría y usuarios activos; descargar una copia y guardarla de forma segura |
| Al salir una persona | Desactivarla el mismo día |
| Semestral | Revisar plantillas y textos legales con la JAL |
