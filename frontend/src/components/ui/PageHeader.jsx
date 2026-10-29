import PropTypes from 'prop-types';

// Encabezado común: pestaña del módulo, título serif (único h1 de la página),
// descripción breve y acciones a la derecha en pantallas anchas.
export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 tabIndex={-1} className="title-page focus:outline-none">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:shrink-0">{actions}</div>}
    </header>
  );
}

PageHeader.propTypes = {
  eyebrow: PropTypes.node,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  actions: PropTypes.node,
};
