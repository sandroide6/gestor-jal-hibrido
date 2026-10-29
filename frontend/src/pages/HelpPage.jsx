import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import AppLayout from '../components/ui/AppLayout';
import { useAuthStore } from '../stores/authStore';
import Icon from '../components/ui/Icon';
import Notice from '../components/ui/Notice';

// Guías cortas, en el orden en que las necesita alguien que empieza.
// `roles` limita la guía a quien puede hacer esa tarea; sin `roles`, la ven todos.
// `img` es una captura con datos de prueba, en public/ayuda/.
const GUIDES = [
  {
    id: 'entrar',
    title: 'Entrar al sistema',
    img: 'login.webp',
    steps: [
      'Abre la página del Gestor JAL en el navegador (Chrome, Edge o el del celular).',
      'Escribe tu correo y tu contraseña. Te los da el administrador de la JAL.',
      'Si el computador es tuyo, marca «Recordarme en este equipo» para no escribirlos cada vez.',
      'Toca «Iniciar sesión». La primera vez te pedirá aceptar la política de privacidad.',
    ],
    tip: 'Si el sistema llevaba un rato sin uso, puede tardar hasta un minuto en abrir. Espera: la página lo intenta sola.',
  },
  {
    id: 'firma',
    title: 'Registrar tu firma (una sola vez)',
    img: 'firma.webp',
    steps: [
      'Firma en una hoja blanca y tómale una foto bien derecha, o escanéala.',
      'En el computador, toca tu nombre abajo a la izquierda › «Mi perfil y firma». En el celular, toca «Menú» abajo a la derecha.',
      'Toca «Subir mi firma» y elige la foto.',
      'Listo. La firma sale sola en los documentos que se hacen a tu nombre.',
    ],
    tip: 'Si en Inicio te sale el aviso amarillo «Antes de crear tu primer documento, registra tu firma», es que falta este paso.',
  },
  {
    id: 'crear',
    title: 'Crear un documento',
    img: 'formulario.webp',
    steps: [
      'En «Inicio» o en «Crear documento», toca la ficha del documento que necesitas (por ejemplo, Certificado de Residencia).',
      'Escribe los datos de la persona. Los que tienen * son obligatorios. Arriba ves en qué paso vas: Documento, Datos, Revisión y Listo.',
      'Toca «Revisar antes de crear». Si algo falta, el campo se pone en rojo y te dice qué corregir.',
      'Lee el resumen con calma. Si todo está bien, toca «Sí, crear el documento». Si no, «Corregir datos».',
      'Toca «Descargar PDF (para imprimir)» o «Descargar Word (para editar)».',
    ],
    tip: 'Cada documento recibe un número de radicado. Queda guardado y lo puedes volver a descargar cuando quieras.',
  },
  {
    id: 'repetido',
    title: 'Si la persona ya vino antes',
    img: 'cedula.webp',
    steps: [
      'Empieza el documento y escribe primero el número de cédula.',
      'Si ya la atendieron, aparece «Ya atendimos a … con este número».',
      'Toca «Usar sus datos» y se llenan nombre, documento y dirección. Revisa que sigan iguales.',
    ],
  },
  {
    id: 'descargar',
    title: 'Volver a descargar o imprimir un documento',
    steps: [
      'Entra a «Inicio» y baja hasta «Mis documentos recientes».',
      'Busca el documento por la fecha o el nombre de la persona y toca «PDF» o «Word».',
    ],
  },
  {
    id: 'edil',
    title: 'Hacer un documento a nombre de un edil',
    roles: ['auxiliar'],
    img: 'a-nombre-de-edil.webp',
    steps: [
      'Al abrir el documento, elige el edil en «¿A nombre de qué edil sale el documento?».',
      'Llena los datos y créalo como siempre. Sale con la firma de ese edil.',
      'El edil recibe un aviso para revisarlo.',
    ],
    tip: 'Si dice que falta la firma, pídele al edil que entre al sistema y suba su firma en «Mi perfil».',
  },
  {
    id: 'revisar',
    title: 'Buscar y revisar documentos',
    roles: ['edil', 'administrador'],
    img: 'buscar.webp',
    steps: [
      'Entra a «Buscar documentos».',
      'Escribe el nombre o la cédula en «Nombre o cédula de la persona» y toca «Buscar». Para buscar por radicado, tipo o fechas, toca «Más filtros».',
      'Para ver solo lo que falta revisar, toca «Solo pendientes» arriba a la derecha.',
      'Abre el PDF para leerlo y, si está bien, toca «Revisado».',
    ],
    tip: 'La campana de arriba te avisa cuando hay documentos nuevos a tu nombre.',
  },
  {
    id: 'reportes',
    title: 'Ver reportes',
    roles: ['edil', 'administrador'],
    steps: [
      'Entra a «Reportes». Ves cuántos documentos se han hecho, por tipo y por día.',
      'Usa los filtros de arriba y toca «Aplicar filtros». «Descargar en Excel» descarga la lista.',
    ],
  },
  {
    id: 'usuarios',
    title: 'Agregar a una persona del equipo',
    roles: ['administrador'],
    img: 'nuevo-usuario.webp',
    steps: [
      'Entra a «Usuarios» y toca «Nuevo usuario».',
      'Escribe nombre, correo y una contraseña temporal de al menos 8 caracteres.',
      'Elige el rol: Auxiliar (hace documentos), Edil (los hace y los revisa) o Administrador (todo).',
      'Toca «Crear usuario» y entrégale el correo y la contraseña en persona. Pídele que la cambie al entrar.',
    ],
    tip: 'Cuando alguien deja la JAL, toca «Desactivar». Sus documentos se conservan.',
  },
  {
    id: 'admin',
    title: 'Tareas del administrador',
    roles: ['administrador'],
    steps: [
      '«Tipos de documento»: agregar o desactivar documentos y sus campos.',
      '«Configuración JAL»: nombre de la JAL y código de dependencia, que va en los radicados.',
      '«Auditoría»: quién hizo qué y cuándo.',
      '«Copias de seguridad»: descargar una copia o conectar Google Drive para copias automáticas.',
    ],
  },
  {
    id: 'cuenta',
    title: 'Cambiar tu contraseña y proteger tu cuenta',
    steps: [
      'En el computador, toca tu nombre abajo a la izquierda › «Cambiar contraseña». En el celular, toca «Menú» abajo a la derecha.',
      'Para más seguridad, en «Mi perfil y firma» activa la «Verificación en dos pasos» con una app como Google Authenticator.',
      'Si usas un computador prestado, cierra sesión al terminar.',
    ],
  },
  {
    id: 'celular',
    title: 'Usarlo en el celular o sin internet',
    img: 'celular.webp',
    steps: [
      'Abre la misma página en el celular. Abajo tienes Inicio, Crear y Buscar (o Ayuda); el resto está en «Menú».',
      'Si aparece «Instalar», tócalo: queda como una app en la pantalla de inicio.',
      'Sin internet puedes crear documentos y descargarlos. Arriba verás «Sin conexión · N por enviar»; se envían solos cuando vuelve la conexión.',
    ],
  },
];

const FAQ = [
  ['La página dice «El servidor se está despertando».', 'Es normal si nadie lo usó en un rato. Espera hasta un minuto sin cerrar la página.'],
  ['Me equivoqué en un dato y ya creé el documento.', 'Crea uno nuevo con los datos correctos. Si el malo no debe quedar, pídele al administrador que lo elimine.'],
  ['Olvidé mi contraseña.', 'Habla con el administrador de la JAL para que te ayude a recuperar el acceso.'],
  ['No me deja crear el documento: dice que falta la firma.', 'Sube tu firma en «Mi perfil y firma». Si el documento va a nombre de un edil, es él quien debe subirla.'],
  ['Dice «Demasiadas solicitudes».', 'Espera un minuto y vuelve a intentarlo.'],
];

function Guide({ guide, index }) {
  return (
    <details id={guide.id} className="group scroll-mt-20 rounded-lg border border-line bg-surface open:shadow-sheet">
      <summary className="flex min-h-[3.5rem] cursor-pointer list-none items-center gap-4 rounded-lg px-5 py-4 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="font-mono text-sm text-accent">{String(index + 1).padStart(2, '0')}</span>
        <span className="flex-1 font-serif text-lg font-semibold text-ink">{guide.title}</span>
        <Icon name="chevron" className="help-chevron text-ink-muted group-open:rotate-90" />
      </summary>
      <div className="space-y-4 border-t border-line px-5 pb-5 pt-4">
        <ol className="list-decimal space-y-2 pl-6 text-ink marker:font-semibold marker:text-brand">
          {guide.steps.map((s) => <li key={s} className="pl-1">{s}</li>)}
        </ol>
        {guide.tip && <Notice tone="info">{guide.tip}</Notice>}
        {guide.img && (
          <img
            src={`/ayuda/${guide.img}`}
            alt={`Ejemplo en pantalla: ${guide.title}`}
            loading="lazy"
            className="block h-auto max-w-full rounded-md border border-line"
          />
        )}
      </div>
    </details>
  );
}

Guide.propTypes = {
  guide: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    steps: PropTypes.arrayOf(PropTypes.string).isRequired,
    tip: PropTypes.string,
    img: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
};

export default function HelpPage() {
  const { user } = useAuthStore();
  const guides = GUIDES.filter((g) => !g.roles || g.roles.includes(user?.role));

  return (
    <AppLayout
      title="Ayuda"
      eyebrow="Guías paso a paso"
      heading="¿En qué te ayudamos?"
      description="Toca un tema para ver los pasos. Las imágenes son de ejemplo, con datos de prueba."
      actions={<Link to="/generador" className="btn-primary">Crear un documento ahora</Link>}
    >
      <div className="space-y-10">
        <section aria-label="Guías" className="space-y-3">
          {guides.map((g, i) => <Guide key={g.id} guide={g} index={i} />)}
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className="title-section mb-3">Preguntas frecuentes</h2>
          <dl className="divide-y divide-line rounded-lg border border-line bg-surface px-5">
            {FAQ.map(([q, a]) => (
              <div key={q} className="py-4">
                <dt className="font-semibold text-ink">{q}</dt>
                <dd className="mt-1 text-ink-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </AppLayout>
  );
}
