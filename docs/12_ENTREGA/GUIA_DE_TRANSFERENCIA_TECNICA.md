# Guía de transferencia técnica

Para pasar el sistema del desarrollador a un responsable técnico institucional. **No contiene contraseñas ni claves**: esas se entregan en persona o por un gestor de contraseñas compartido, nunca por correo, chat ni en este repositorio.

## 1. Inventario de cuentas y servicios

| Servicio | Para qué | Titular actual | Destino propuesto | Qué transferir |
|---|---|---|---|---|
| GitHub | Código, CI, PR | Cuenta personal | Organización institucional | Propiedad del repositorio o transferencia a una organización; colaboradores; secretos de Actions si los hay |
| Vercel | Frontend | Cuenta personal (cambio de cuenta reciente detuvo el despliegue) | Equipo institucional | Proyecto, dominio, variables `VITE_*` |
| Render | Backend | Cuenta personal | Cuenta institucional | Servicio, variables de entorno, plan |
| Supabase | Base de datos | Cuenta personal | Organización institucional | Proyecto (incluye **todos los datos**), contraseña de la base, plan y copias |
| Google Cloud / Drive | Copias | Por configurar | Cuenta institucional | Proyecto OAuth, carpeta de copias |
| Tailscale | Red hacia el PC del chat o de la base local | Cuenta personal | Decidir si se mantiene | Red y dispositivos |
| ngrok | Túnel en modalidad local | Cuenta personal | Decidir si se mantiene | Token y dominio |
| PC con Ollama y receptor local | Chat IA y copia local | Equipo personal [Supuesto] | Equipo de la JAL o retirar | — |

## 2. Secretos que se deben entregar o regenerar

`DATABASE_URL`, `JWT_SECRET`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `ENCRYPTION_KEY`, `METRICS_TOKEN`, `GOOGLE_CLIENT_SECRET`, `LOCAL_DOC_RECEIVER_TOKEN`, autenticación de Tailscale y ngrok, contraseña del administrador.

**Recomendación:** después de transferir, **regenerar** todos con `node deploy/generar-claves.js` y en cada servicio. Efectos: se cierran las sesiones (claves JWT) y hay que reconectar Drive (`ENCRYPTION_KEY`). Ver [Operación](../07_OPERACION/OPERACION_Y_MANTENIMIENTO.md#5-cambio-de-claves-ante-sospecha-de-filtración).

## 3. Orden sugerido

1. Designar al responsable técnico y al administrador funcional.
2. Crear las cuentas institucionales con dos factores.
3. Invitar las cuentas institucionales como propietarias en cada servicio (los pasos por servicio están en `PASOS_PENDIENTES_CON_TUS_CUENTAS.md`, en la carpeta compartida `tutoriales/`).
4. Respaldo completo antes de mover nada.
5. Transferir repositorio y servicios; verificar que el despliegue funciona desde las cuentas nuevas.
6. Regenerar secretos y cambiar contraseñas.
7. Prueba de humo contra producción y restauración de ensayo hechas **por el responsable receptor**.
8. Retirar los accesos personales, si así se acordó por escrito.
9. Registrar la transferencia en el formato institucional.

## 4. Conocimiento mínimo del responsable técnico

| Tema | Dónde está |
|---|---|
| Arquitectura y flujos | [Arquitectura](../03_ARQUITECTURA/ARQUITECTURA_GENERAL.md) |
| Instalar, actualizar, volver atrás | [Instalación](../06_DESPLIEGUE/INSTALACION_Y_DESPLIEGUE.md) |
| Respaldar y restaurar | [Respaldo](../07_OPERACION/RESPALDO_Y_RESTAURACION.md) |
| Incidentes y claves | [Operación](../07_OPERACION/OPERACION_Y_MANTENIMIENTO.md) |
| Riesgos abiertos | [Seguridad](../09_SEGURIDAD_Y_PRIVACIDAD/REVISION_DE_SEGURIDAD.md), [Pendientes](PENDIENTES_DE_ENTREGA.md) |
| Stack | JavaScript (Node 20+, Express, Sequelize, React 18, Vite, Tailwind), PostgreSQL, Python básico para los scripts, Docker |

## 5. Sesión de transferencia sugerida (3 horas)

1. Recorrido del repositorio y la arquitectura (45 min).
2. Despliegue desde cero en un entorno de prueba, hecho por el receptor (60 min).
3. Respaldo y restauración, hechos por el receptor (30 min).
4. Revisión de pendientes, riesgos y cuentas (30 min).
5. Preguntas y registro (15 min).
