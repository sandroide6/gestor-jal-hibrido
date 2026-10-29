# 05 · Flujos de usuario

Capturas de cada paso en `/mnt/project-files/rediseno-v2/` (datos de prueba).

## 1. Entrar
Correo → contraseña → «Recordarme en este equipo» (opcional) → **Iniciar sesión**. Si la cuenta tiene verificación en dos pasos, se pide el código de 6 números. Si el servidor está despertando (Render), un aviso lo dice y la página reintenta sola. Primera vez: «Política de privacidad y Habeas Data».

## 2. Crear un documento (todos los roles)
1. **Documento.** Inicio o Crear documento muestran fichas; se toca una.
2. **Datos.** Formulario en dos bloques, «Datos de la persona» y «Datos del documento». La ayuda queda visible bajo cada etiqueta. Si la cédula ya fue atendida aparece «Ya atendimos a … con este número» con **Usar sus datos**. Auxiliares eligen «¿A nombre de qué edil sale el documento?».
3. **Revisión.** Hoja con todos los datos y el sello «Borrador · sin radicar». **Sí, crear el documento** o **Corregir datos**.
4. **Listo.** Solo cuando el sistema confirma: sello de radicado estampado, «Descargar PDF (para imprimir)» y «Descargar Word (para editar)». Sin conexión: «Guardado en este equipo, pendiente de enviar», sin radicado definitivo.

Salir con datos escritos pide confirmación («¿Salir sin crear el documento?») y el navegador avisa si se cierra la pestaña. Al cambiar de paso, el foco va al título.

## 3. Volver a descargar
Inicio → «Mis documentos recientes» → renglón (fecha, documento, persona, radicado) → **PDF** o **Word**.

## 4. Buscar y revisar (edil, administrador)
Buscar documentos → «Nombre o cédula de la persona» → **Buscar**. «Más filtros» abre tipo, radicado, revisión, quién lo hizo y fechas. **Solo pendientes (N)** filtra lo que falta revisar. En cada documento: PDF, Word, **Revisado** (y **Eliminar** para administrador, con confirmación). En escritorio ancho es una tabla; en tableta y celular, fichas.

## 5. Administración
- **Usuarios:** Nuevo usuario (diálogo), Editar, Desactivar (confirmación que explica que los documentos se conservan), Eliminar para siempre (solo sin documentos).
- **Tipos de documento:** fichas con folio, número de datos y si tiene plantilla Word; editor en diálogo grande; activar/desactivar con confirmación.
- **Configuración JAL, Copias, Auditoría, Reportes:** formularios con etiqueta y ayuda; avisos del sistema común de toasts.

## 6. Sin conexión
Cabecera: «Sin conexión · N por enviar». Al volver: «Enviando X de Y» con barra de progreso. Si el envío falla, el aviso rojo dice el motivo y ofrece «Descartar los N pendientes…», que pide confirmación; el reintento sigue siendo automático al recuperar la conexión.
