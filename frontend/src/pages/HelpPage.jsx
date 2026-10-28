import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import AppLayout from '../components/ui/AppLayout';
import { useAuthStore } from '../stores/authStore';

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
      'Si el computador es tuyo, marca «Recordarme en este dispositivo» para no escribirlos cada vez.',
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
      'Toca tu nombre en el menú (abajo a la izquierda en el computador) › «Mi perfil y firma».',
      'Toca «Haz clic para subir tu firma» y elige la foto.',
      'Listo. La firma sale sola en los documentos que se hacen a tu nombre.',
    ],
    tip: 'Si te sale el aviso amarillo «Antes de crear tu primer documento: registra tu firma», es que falta este paso.',
  },
  {
    id: 'crear',
    title: 'Crear un documento',
    img: 'formulario.webp',
    steps: [
      'En «Inicio» o en «Crear documento», toca el documento que necesitas (por ejemplo, Certificado de Residencia).',
      'Escribe los datos de la persona. Los que tienen * rojo son obligatorios.',
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
      'Busca el documento por el nombre de la persona y toca «PDF» o «Word».',
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
      'Escribe el nombre o la cédula en «Beneficiario o cédula», o el número de radicado, y toca «Buscar».',
      'Para ver solo lo que falta revisar, en «Estado revisión» elige «Pendiente revisión».',
      'Abre el PDF para leerlo y, si está bien, toca «✓ Revisar».',
    ],
    tip: 'La campana de arriba te avisa cuando hay documentos nuevos a tu nombre.',
  },
  {
    id: 'reportes',
    title: 'Ver reportes',
    roles: ['edil', 'administrador'],
    steps: [
      'Entra a «Reportes». Ves cuántos documentos se han hecho, por tipo y por día.',
      'Usa los filtros de arriba y toca «Aplicar filtros». «Exportar Excel» descarga la lista.',
    ],
  },
  {
    id: 'usuarios',
    title: 'Agregar a una persona del equipo',
    roles: ['administrador'],
    img: 'nuevo-usuario.webp',
    steps: [
      'Entra a «Usuarios» y toca «+ Nuevo usuario».',
      'Escribe nombre, correo y una contraseña temporal de al menos 8 caracteres.',
      'Elige el rol: Auxiliar (hace documentos), Edil (los hace y los revisa) o Administrador (todo).',
      'Toca «Guardar» y entrégale el correo y la contraseña en persona. Pídele que la cambie al entrar.',
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
      'Toca tu nombre en el menú (abajo a la izquierda en el computador) › «Cambiar contraseña».',
      'Para más seguridad, en «Mi perfil y firma» activa la «Verificación en dos pasos» con una app como Google Authenticator.',
      'Si usas un computador prestado, cierra sesión al terminar.',
    ],
  },
  {
    id: 'celular',
    title: 'Usarlo en el celular o sin internet',
    img: 'celular.webp',
    steps: [
      'Abre la misma página en el celular. El menú está en el botón ☰ de arriba a la izquierda.',
      'Si aparece «Instalar», tócalo: queda como una app en la pantalla de inicio.',
      'Sin internet puedes crear documentos y descargarlos. Se envían al sistema cuando vuelve la conexión.',
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

function Guide({ guide }) {
  return (
    <details id={guide.id} className="card !p-0 group scroll-mt-20">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-5 min-h-[44px]
                          text-lg font-semibold text-jal-blue-600 focus:outline-none focus:ring-2 focus:ring-jal-blue-400 rounded-xl">
        <span>{guide.title}</span>
        <span aria-hidden="true" className="text-2xl transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="px-5 pb-5 space-y-4">
        <ol className="list-decimal pl-6 space-y-2 text-gray-800">
          {guide.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        {guide.tip && (
          <p className="bg-jal-blue-50 border border-jal-blue-200 rounded-lg px-4 py-3 text-gray-900">{guide.tip}</p>
        )}
        {guide.img && (
          <img
            src={`/ayuda/${guide.img}`}
            alt={`Ejemplo en pantalla: ${guide.title}`}
            loading="lazy"
            className="block max-w-full h-auto rounded-lg border border-gray-200"
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
};

export default function HelpPage() {
  const { user } = useAuthStore();
  const guides = GUIDES.filter((g) => !g.roles || g.roles.includes(user?.role));

  return (
    <AppLayout title="Ayuda">
      <div className="max-w-3xl space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-gray-900">¿En qué te ayudamos?</h2>
          <p className="text-gray-600 mt-1">
            Toca un tema para ver los pasos. Las imágenes son de ejemplo, con datos de prueba.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/generador" className="btn-primary">Crear un documento ahora</Link>
            <Link to="/perfil" className="btn-secondary">Mi perfil y firma</Link>
          </div>
        </section>

        <section aria-label="Guías" className="space-y-3">
          {guides.map((g) => <Guide key={g.id} guide={g} />)}
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className="text-xl font-bold text-gray-900 mb-3">Preguntas frecuentes</h2>
          <dl className="card divide-y divide-gray-200 !py-0">
            {FAQ.map(([q, a]) => (
              <div key={q} className="py-4">
                <dt className="font-semibold text-gray-900">{q}</dt>
                <dd className="text-gray-700 mt-1">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </AppLayout>
  );
}
