# 03 · Componentes de interfaz

Todos en `frontend/src/components/`. Clases base en `frontend/src/index.css` (`@layer components`).

| Componente | Archivo | Qué resuelve |
|---|---|---|
| Botones | `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-danger-outline`, `.btn-ghost`, `.btn-sm`, `.btn-block` | 46 px de alto (40 en `sm`), se encogen a 0,97 al presionar |
| Campos | `.input`, `.label`, `.hint`, `.field-error`, `.fieldset-legend` | 48 px; ayuda persistente bajo la etiqueta; error con `aria-invalid` y `aria-describedby` |
| Interruptor | `.switch`, `.switch-thumb` | `role="switch"` con `aria-checked` y `aria-labelledby` |
| `Icon` | `ui/Icon.jsx` | 35 iconos de línea propios |
| `Notice` | `ui/Notice.jsx` | Aviso info/éxito/advertencia/error con título, cuerpo y acción; error = `role="alert"` |
| `StatusBadge`, `DocumentStatus` | `ui/StatusBadge.jsx` | Estado con texto: Revisado, Pendiente de revisión, Sin enviar, Conflicto |
| `Radicado` | `ui/Radicado.jsx` | Sello del número de radicado; `stamp` lo «estampa» al expedir |
| `Spinner` | `ui/Spinner.jsx` | Indicador de proceso dentro de botones |
| `Dialog`, `ConfirmDialog` | `ui/Dialog.jsx` | Modal con foco atrapado, Escape, título y descripción enlazados; confirmación que nombra lo que se pierde |
| `PageHeader` | `ui/PageHeader.jsx` | Rótulo, título (recibe el foco al cambiar de paso), descripción y acciones |
| `Steps` | `ui/Steps.jsx` | Pasos del trámite con `aria-current="step"` y «(hecho)» para lector |
| `ConnectionStatus` | `ui/ConnectionStatus.jsx` | En línea · Enviando X de Y · Sin conexión · N por enviar |
| `AuthShell` | `ui/AuthShell.jsx` | Marco de Entrar y Política de datos |
| `AppLayout` | `ui/AppLayout.jsx` | Lomo lateral, cabecera, barra inferior móvil, menú móvil, enlace «Saltar al contenido» |
| `EmptyState` | `ui/EmptyState.jsx` | Qué falta y qué hacer |
| `ToastContainer` | `ui/ToastContainer.jsx` | Avisos flotantes con barra de color, icono y texto |
| `NotificationBell` | `ui/NotificationBell.jsx` | Panel de notificaciones con botones reales |
| `ChatWidget` | `ui/ChatWidget.jsx` | Asistente; formulario con etiqueta, sin rebote |
| `DocTypeCard` | `documents/DocTypeCard.jsx` | Ficha de documento: muesca, folio, trámite, número de datos, «Empezar →» |
| `DocumentRow`, `LedgerDate` | `documents/DocumentRow.jsx` | Renglón del libro de registro con descargas etiquetadas |
| `DynamicForm` | `forms/DynamicForm.jsx` | Formularios por tipo; ahora con secciones (`fieldset`) y ayuda persistente |

Reglas: un solo botón principal por zona; los botones destructivos dicen exactamente qué hacen («Eliminar firma», «Desactivar»); nada de `window.confirm`.
