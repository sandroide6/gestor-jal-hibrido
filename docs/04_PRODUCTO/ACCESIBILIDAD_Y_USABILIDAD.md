# Accesibilidad y usabilidad

**Conclusión:** la interfaz rediseñada (PR #10) sigue buenas prácticas de accesibilidad y pasó una verificación automática sin violaciones. **No** se puede afirmar que sea plenamente accesible ni que sea fácil de usar para personas mayores: faltan la revisión manual con tecnologías de apoyo y la prueba con usuarios reales de la JAL.

## 1. Qué se verificó

| Verificación | Resultado | Fuente |
|---|---|---|
| axe-core 4.10.2 (WCAG 2.0, 2.1 y 2.2, niveles A y AA), 14 pantallas a 1440 y 390 px, con API simulada | 0 violaciones | [docs/design/07](../design/07-accesibilidad.md) |
| Navegación con teclado: saltar al contenido, foco visible de 3 px, diálogo con foco atrapado y Escape | Correcto (Playwright) | docs/design/07 |
| Reflujo: sin desplazamiento horizontal a 390 px | Correcto en las 14 pantallas | [docs/design/11](../design/11-validacion-visual-y-funcional.md) |
| Tamaño de texto base 17 px, objetivos táctiles de 40 a 48 px, contraste documentado | Implementado | docs/design/02 y 07 |

## 2. Qué no se verificó

| Pendiente | Por qué importa | Cómo cerrarlo |
|---|---|---|
| Lectores de pantalla (NVDA, TalkBack) | Las pruebas automáticas detectan alrededor de un tercio de los problemas [Supuesto: estimación habitual del sector] | Recorrer los flujos de la sección 4 con NVDA y TalkBack |
| Zoom 200 % y 400 %, alto contraste de Windows | Personas con baja visión | Revisión manual |
| Safari/iOS y Firefox | Solo se probó Chromium | Revisión en esos navegadores |
| Backend real | Las pruebas visuales usaron API simulada | Repetir con el despliegue real |
| Celular de gama baja | Rendimiento en equipos de la JAL | Medir en un equipo real |
| **Personas mayores y con poca experiencia digital** | Es el objetivo central | Prueba de usabilidad (sección 4) |

## 3. Revisión heurística (sin usuarios)

Hecha sobre el código y las capturas del rediseño. Son observaciones de un revisor, no resultados de prueba con usuarios.

| Aspecto | Lo que ayuda | Riesgo o mejora sugerida [Propuesta] |
|---|---|---|
| Crear documento | Tres pasos con revisión antes de confirmar; ayuda bajo cada campo; errores junto al campo | Confirmar que los nombres de campo de las plantillas de la JAL usan lenguaje cotidiano |
| Persona ya atendida | Evita volver a escribir datos | Recordar al usuario que confirme que los datos siguen vigentes (el mensaje ya lo sugiere) |
| Firma | Aviso visible si falta la firma | El rechazo por falta de firma llega al final; avisar antes de llenar el formulario si el edil elegido no tiene firma |
| Arranque lento del servidor | La pantalla avisa que puede tardar | Plan de servicio sin suspensión si la espera molesta a los usuarios |
| Términos técnicos | "Radicado", "PWA", "sincronizar" | Glosario corto en Ayuda |
| Material de capacitación | Página Ayuda por rol | Videos con interfaz anterior y sin voz ni subtítulos (ver [Tutoriales](../05_TUTORIALES/INVENTARIO_Y_CAPACITACION.md)) |

## 4. Protocolo propuesto de prueba con usuarios [Propuesta]

- **Participantes:** 5 a 8 personas de la JAL, incluidas al menos 2 de 60 años o más y 2 con poca experiencia digital. Participación voluntaria, con consentimiento informado, sin grabar rostros ni datos reales.
- **Entorno:** los equipos y la conexión de la sede; entorno de pruebas con datos ficticios.
- **Tareas:** (1) entrar y aceptar la política; (2) registrar la firma; (3) crear un Certificado de Residencia; (4) crear otro para la misma persona usando sus datos guardados; (5) emitir a nombre de un edil; (6) como edil, encontrar y marcar revisado un documento; (7) cambiar la contraseña.
- **Medidas:** tarea completada sin ayuda (sí/no), tiempo, errores, puntos de duda, y una pregunta de satisfacción al final (escala de 1 a 5).
- **Criterio sugerido:** al menos 80 % de las tareas 1 a 6 completadas sin ayuda. Lo que no lo cumpla entra como mejora priorizada.
- **Registro:** formato de observación sin datos personales de los participantes más allá de rango de edad y experiencia.

## 5. Accesibilidad del material de capacitación

Los 12 videos no tienen audio ni subtítulos ni transcripción. Para cumplir la meta RA-04 deben regrabarse con la interfaz nueva, con narración, subtítulos y una transcripción en texto.
