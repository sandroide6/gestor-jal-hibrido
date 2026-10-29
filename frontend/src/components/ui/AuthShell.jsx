import PropTypes from 'prop-types';
import OfflineBanner from './OfflineBanner';
import ServerStatusBanner from './ServerStatusBanner';

const JAL_NAME = import.meta.env.VITE_JAL_NOMBRE || 'JAL Comuna 12 · La América';

// Marco de las pantallas sin sesión: lomo verde con la identidad a la izquierda (escritorio)
// o arriba (móvil), y la hoja de papel con el formulario.
export default function AuthShell({ children, aside }) {
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[minmax(22rem,40%)_1fr]">
      <section className="relative overflow-hidden bg-brand px-6 py-8 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:py-14">
        {/* Rayado de libro de registro: textura propia, sin imágenes */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 34px)' }}
        />
        <div className="relative">
          <p className="text-eyebrow uppercase text-white/75">Junta Administradora Local</p>
          <p className="mt-2 font-serif text-3xl font-semibold leading-tight lg:text-[2.5rem]">Gestor documental</p>
          <p className="mt-1 text-white/85">{JAL_NAME}</p>
        </div>
        {aside && <div className="relative mt-8 hidden max-w-sm lg:block">{aside}</div>}
      </section>
      <div className="flex min-h-full flex-col">
        <OfflineBanner />
        <ServerStatusBanner />
        <main id="contenido" className="flex flex-1 items-start justify-center px-4 py-10 sm:px-8 lg:items-center">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}

AuthShell.propTypes = {
  children: PropTypes.node.isRequired,
  aside: PropTypes.node,
};
