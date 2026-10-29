import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { TIPO_TRAMITE_LABEL } from '../../constants';
import Icon from '../ui/Icon';

/**
 * Tipo de documento como ficha de archivo: muesca terracota, folio, nombre en serif
 * y acción visible. Toda la ficha es un único control (enlace o botón).
 */
export default function DocTypeCard({ type, index, to, onSelect }) {
  const folio = String(index + 1).padStart(2, '0');
  const tramite = TIPO_TRAMITE_LABEL[type.tipo_tramite];
  const fieldCount = type.fields?.length ?? 0;
  const body = (
    <>
      <span aria-hidden="true" className="absolute left-5 top-0 h-1.5 w-10 rounded-b-sm bg-accent" />
      <span className="text-eyebrow uppercase text-accent">
        Folio {folio}{tramite ? ` · ${tramite}` : ''}
      </span>
      <span className="title-card block mt-2">{type.name}</span>
      <span className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="text-[0.9375rem] text-ink-muted">
          {fieldCount === 1 ? '1 dato' : `${fieldCount} datos`}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
          Empezar <Icon name="flecha" size={18} />
        </span>
      </span>
    </>
  );
  const cls = `lift relative flex w-full min-h-[9.5rem] flex-col rounded-lg border border-line bg-surface px-5 pb-4 pt-6 text-left
               hover:border-brand-300 focus-visible:border-brand`;

  if (to) return <Link to={to} className={cls}>{body}</Link>;
  return <button type="button" onClick={() => onSelect(type)} className={cls}>{body}</button>;
}

DocTypeCard.propTypes = {
  type: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    tipo_tramite: PropTypes.string,
    fields: PropTypes.array,
  }).isRequired,
  index: PropTypes.number.isRequired,
  to: PropTypes.string,
  onSelect: PropTypes.func,
};
