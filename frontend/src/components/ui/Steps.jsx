import PropTypes from 'prop-types';
import Icon from './Icon';

// Folios de un trámite: número, nombre y estado. El paso actual lleva aria-current="step".
export default function Steps({ steps, current }) {
  return (
    <ol aria-label="Pasos" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3" aria-current={active ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className="hidden h-px w-6 bg-line-strong sm:block" />}
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`grid h-8 w-8 place-items-center rounded-full text-[0.9375rem] font-semibold transition-colors duration-base
                  ${active ? 'bg-brand text-white' : done ? 'bg-brand-tint text-brand' : 'border border-line-strong text-ink-muted'}`}
              >
                {done ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <span className={active ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-ink-muted'}>
                {label}
                {done && <span className="sr-only"> (hecho)</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

Steps.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.string).isRequired,
  current: PropTypes.number.isRequired,
};
