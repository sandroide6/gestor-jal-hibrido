import PropTypes from 'prop-types';

// Iconos de línea (24×24, trazo 1.75) — un solo juego para toda la app.
// Siempre acompañan un texto visible; por eso son decorativos (aria-hidden).
const PATHS = {
  inicio:     ['M3 10.5 12 3l9 7.5', 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5'],
  crear:      ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M12 11v6', 'M9 14h6'],
  buscar:     ['M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z', 'm21 21-5.2-5.2'],
  reportes:   ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  ayuda:      ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z', 'M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6', 'M12 17h.01'],
  resumen:    ['M4 5h16', 'M4 12h16', 'M4 19h10'],
  usuarios:   ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1', 'M16 3.1a4 4 0 0 1 0 7.8', 'M22 21v-1a6 6 0 0 0-4-5.6'],
  tipos:      ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  auditoria:  ['M12 3 4 6v6c0 4.6 3.4 8.4 8 9 4.6-.6 8-4.4 8-9V6z', 'm9 12 2 2 4-4'],
  config:     ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  copia:      ['M7 18a4.5 4.5 0 0 1-.9-8.9A6 6 0 0 1 17.7 8 4 4 0 0 1 18 16', 'M12 12v9', 'm9 15 3-3 3 3'],
  perfil:     ['M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M4 21a8 8 0 0 1 16 0'],
  llave:      ['M7 15a4 4 0 1 1 3.9-4.9L21 10v4h-3v3h-3v-3h-4.1A4 4 0 0 1 7 15z'],
  salir:      ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 17l5-5-5-5', 'M15 12H3'],
  menu:       ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  cerrar:     ['M6 6l12 12', 'M18 6 6 18'],
  flecha:     ['M5 12h14', 'm13 6 6 6-6 6'],
  atras:      ['M19 12H5', 'm11 18-6-6 6-6'],
  descargar:  ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  check:      ['m5 12.5 4.5 4.5L19 7.5'],
  alerta:     ['M12 3 2 20h20z', 'M12 10v4', 'M12 17h.01'],
  info:       ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z', 'M12 11v5', 'M12 8h.01'],
  error:      ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z', 'M12 8v5', 'M12 16h.01'],
  campana:    ['M6 16V11a6 6 0 1 1 12 0v5l2 2H4z', 'M10 20a2 2 0 0 0 4 0'],
  nube:       ['M7 18a4.5 4.5 0 0 1-.9-8.9A6 6 0 0 1 17.7 8 4 4 0 0 1 18 16H7z'],
  sinred:     ['M3 3l18 18', 'M8.5 16.5a5 5 0 0 1 7 0', 'M5 12.9a10 10 0 0 1 4.3-2.5', 'M14.7 10.4A10 10 0 0 1 19 12.9', 'M2 8.8a15 15 0 0 1 4.2-2.6', 'M10.7 5.1A15 15 0 0 1 22 8.8', 'M12 20h.01'],
  firma:      ['M3 17c3-1 4.5-6 6-6s0 6 2 6 3-4 4-4 1 3 3 3', 'M3 21h18'],
  papelera:   ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13', 'M9 7V4h6v3'],
  editar:     ['M4 20h4L19 9l-4-4L4 16z', 'm14 6 4 4'],
  filtro:     ['M3 5h18', 'M6 12h12', 'M10 19h4'],
  documento:  ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'],
  carpeta:    ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  mas:        ['M12 5v14', 'M5 12h14'],
  chevron:    ['m9 6 6 6-6 6'],
  colapsar:   ['M4 4h16v16H4z', 'M9 4v16'],
};

export default function Icon({ name, size = 20, className = '' }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

Icon.propTypes = {
  name: PropTypes.oneOf(Object.keys(PATHS)).isRequired,
  size: PropTypes.number,
  className: PropTypes.string,
};
