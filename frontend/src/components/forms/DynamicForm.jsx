import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

// ── Validación por tipo ───────────────────────────────────

function validateField(field, rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  const isEmpty = value === '' || value === null || value === undefined;

  if (field.required && isEmpty) return 'Este campo es obligatorio';
  if (isEmpty) return null;

  switch (field.type) {
    case 'text':
    case 'textarea': {
      const s = String(value);
      if (field.minLength && s.length < field.minLength)
        return `Mínimo ${field.minLength} caracteres`;
      const max = field.maxLength ?? (field.type === 'textarea' ? 2000 : 500);
      if (s.length > max) return `Máximo ${max} caracteres`;
      break;
    }
    case 'number': {
      const n = parseFloat(value);
      if (isNaN(n)) return 'Ingresa un número válido';
      if (field.min !== undefined && n < field.min) return `El valor mínimo es ${field.min}`;
      if (field.max !== undefined && n > field.max) return `El valor máximo es ${field.max}`;
      break;
    }
    case 'date': {
      const d = new Date(value);
      if (isNaN(d.getTime())) return 'Ingresa una fecha válida';
      const y = d.getFullYear();
      if (y < 1900 || y > 2100) return 'La fecha está fuera de rango';
      if (field.min && value < field.min) return `La fecha mínima es ${field.min}`;
      if (field.max && value > field.max) return `La fecha máxima es ${field.max}`;
      break;
    }
    case 'time': {
      if (!/^\d{2}:\d{2}$/.test(value)) return 'Ingresa una hora válida (HH:MM)';
      const [h, m] = value.split(':').map(Number);
      if (h > 23 || m > 59) return 'Hora no válida';
      break;
    }
    case 'select':
      if (field.required && !value) return 'Selecciona una opción';
      if (field.options?.length && !field.options.includes(value)) return 'Opción no válida';
      break;
    case 'checkbox':
      if (field.required && value !== 'Sí') return 'Debes marcar esta casilla';
      break;
    case 'duracion': {
      const num = parseInt(String(value).split(' ')[0], 10);
      if (isNaN(num) || num <= 0) return 'Ingresa un número mayor a 0';
      break;
    }
    case 'periodo': {
      const [anio, sem] = String(value ?? '').split('-');
      if (!anio || !/^\d{4}$/.test(anio.trim())) return 'Ingresa un año válido (ej. 2024)';
      if (sem !== '1' && sem !== '2') return 'Selecciona el semestre';
      break;
    }
    case 'checklist': {
      const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (field.options?.length && selected.some(s => !field.options.includes(s)))
        return 'Hay opciones no válidas seleccionadas';
      break;
    }
    default:
      break;
  }
  return null;
}

// ── Input según tipo ──────────────────────────────────────

// Campos donde el texto de ejemplo se muestra como ayuda fija bajo la etiqueta
const HINT_TYPES = ['text', 'textarea', 'number', 'duracion', 'periodo'];
const hasHint = (field) => !!field.placeholder && HINT_TYPES.includes(field.type);

function describedBy(field, hasError) {
  const ids = [hasHint(field) && `hint-${field.name}`, hasError && `err-${field.name}`].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

function FieldInput({ field, value, onChange, onBlur, disabled, hasError }) {
  const base   = 'input';
  const id     = field.name;
  const described = describedBy(field, hasError);

  const common = {
    id,
    value,
    onChange: (e) => onChange(field.name, e.target.value),
    onBlur,
    disabled,
    required: field.required || undefined,
    'aria-invalid': hasError || undefined,
    'aria-describedby': described,
  };

  switch (field.type) {
    case 'select':
      return (
        <select {...common} className={base}>
          <option value="">— Seleccionar —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'textarea': {
      const max = field.maxLength ?? 2000;
      const len = (value ?? '').length;
      return (
        <div>
          <textarea
            {...common}
            className="input min-h-[7rem] resize-y"
            maxLength={max}
            rows={4}
          />
          <div className="flex justify-end mt-1">
            <span className={`text-sm ${len > max * 0.9 ? 'font-semibold text-warning-fg' : 'text-ink-muted'}`}>
              {len} de {max} caracteres
            </span>
          </div>
        </div>
      );
    }

    case 'date':
      return (
        <input
          {...common}
          type="date"
          className={base}
          min={field.min ?? '1900-01-01'}
          max={field.max ?? '2100-12-31'}
        />
      );

    case 'time':
      return (
        <input
          {...common}
          type="time"
          className={base}
          min={field.min}
          max={field.max}
        />
      );

    case 'number':
      return (
        <input
          {...common}
          type="number"
          className={base}
          min={field.min ?? 0}
          max={field.max}
          step={field.step ?? 1}
        />
      );

    case 'checkbox':
      return (
        <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center gap-3 mt-1">
          <input
            type="checkbox"
            id={id}
            checked={value === 'Sí'}
            onChange={(e) => onChange(field.name, e.target.checked ? 'Sí' : 'No')}
            onBlur={onBlur}
            disabled={disabled}
            className="w-5 h-5 rounded accent-brand"
            aria-invalid={hasError || undefined}
            aria-describedby={described}
          />
          {field.placeholder && (
            <span className="text-ink">{field.placeholder}</span>
          )}
        </label>
      );

    case 'checklist': {
      const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
      return (
        <div
          className={`space-y-1 mt-1${hasError ? ' rounded-md border border-danger p-2' : ''}`}
          role="group"
          aria-labelledby={`label-${id}`}
          aria-describedby={described}
        >
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex min-h-[44px] items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, opt]
                    : selected.filter(s => s !== opt);
                  onChange(field.name, next.join(', '));
                  onBlur();
                }}
                disabled={disabled}
                className="w-5 h-5 rounded accent-brand"
              />
              <span className="text-ink">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'duracion': {
      const parts  = String(value ?? '').trim().split(' ');
      const numVal = parts[0] && !isNaN(parseInt(parts[0], 10)) ? parts[0] : '';
      const unit   = (parts[1] === 'meses' || parts[1] === 'años') ? parts[1] : 'años';
      const emitDuracion = (n, u) => onChange(field.name, `${n} ${u}`.trim());
      return (
        <div className="flex gap-2">
          <input
            id={id}
            type="number"
            min={1}
            step={1}
            className="input w-28"
            value={numVal}
            onChange={(e) => emitDuracion(e.target.value, unit)}
            onBlur={onBlur}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={described}
          />
          <select
            className="input flex-1"
            value={unit}
            onChange={(e) => emitDuracion(numVal, e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            aria-label={`${field.label}: unidad`}
          >
            <option value="meses">meses</option>
            <option value="años">años</option>
          </select>
        </div>
      );
    }

    case 'periodo': {
      const parts = String(value ?? '').split('-');
      const anio  = parts[0] ?? '';
      const sem   = parts[1] ?? '';
      const emitPeriodo = (a, s) => onChange(field.name, `${a}-${s}`);
      return (
        <div className="flex gap-2">
          <input
            id={id}
            type="number"
            min={2000}
            max={2100}
            step={1}
            className="input w-32"
            value={anio}
            onChange={(e) => emitPeriodo(e.target.value, sem)}
            onBlur={onBlur}
            disabled={disabled}
            aria-label={`${field.label}: año`}
            aria-invalid={hasError || undefined}
            aria-describedby={described}
          />
          <select
            className="input flex-1"
            value={sem}
            onChange={(e) => emitPeriodo(anio, e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            aria-label={`${field.label}: semestre`}
            aria-invalid={hasError || undefined}
          >
            <option value="">— Semestre —</option>
            <option value="1">Semestre 1</option>
            <option value="2">Semestre 2</option>
          </select>
        </div>
      );
    }

    default: { // text
      const applyFilter = (raw) => {
        if (field.inputFilter === 'solo_letras')  return raw.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '');
        if (field.inputFilter === 'solo_numeros') return raw.replace(/\D/g, '');
        return raw;
      };
      return (
        <input
          {...common}
          type="text"
          className={base}
          maxLength={field.maxLength ?? 500}
          onChange={(e) => onChange(field.name, applyFilter(e.target.value))}
          inputMode={field.inputFilter === 'solo_numeros' ? 'numeric' : undefined}
        />
      );
    }
  }
}

const fieldShape = PropTypes.shape({
  name:        PropTypes.string.isRequired,
  label:       PropTypes.string.isRequired,
  type:        PropTypes.string.isRequired,
  required:    PropTypes.bool,
  options:     PropTypes.arrayOf(PropTypes.string),
  placeholder: PropTypes.string,
  minLength:   PropTypes.number,
  maxLength:   PropTypes.number,
  min:         PropTypes.number,
  max:         PropTypes.number,
  step:        PropTypes.number,
});

FieldInput.propTypes = {
  field:    fieldShape.isRequired,
  value:    PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur:   PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
};

// ── Componente principal ──────────────────────────────────

export default function DynamicForm({
  fields = [],
  values = {},
  onChange,
  disabled = false,
  submitAttempted = false,
  onErrorsChange,
  sections,
}) {
  const [touched, setTouched] = useState({});

  const errors = useMemo(() => {
    const map = {};
    for (const f of fields) map[f.name] = validateField(f, values[f.name] ?? '');
    return map;
  }, [fields, values]);

  useEffect(() => {
    if (onErrorsChange) onErrorsChange(errors);
  }, [errors, onErrorsChange]);

  function handleBlur(name) {
    setTouched((t) => ({ ...t, [name]: true }));
  }

  function handleChange(name, value) {
    onChange(name, value);
    setTouched((t) => ({ ...t, [name]: true }));
  }

  function renderField(field) {
    const err       = errors[field.name];
    const showError = !!err && (touched[field.name] || submitAttempted);
    return (
      <div key={field.name}>
        <label className="label" htmlFor={field.name} id={`label-${field.name}`}>
          {field.label}
          {field.required && <span className="text-danger-fg ml-1" aria-hidden="true">*</span>}
          {field.required && <span className="sr-only"> (obligatorio)</span>}
        </label>
        {hasHint(field) && <span id={`hint-${field.name}`} className="hint">{field.placeholder}</span>}
        <FieldInput
          field={field}
          value={values[field.name] ?? ''}
          onChange={handleChange}
          onBlur={() => handleBlur(field.name)}
          disabled={disabled}
          hasError={showError}
        />
        {showError && (
          <p id={`err-${field.name}`} role="alert" className="field-error">
            <svg aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {err}
          </p>
        )}
      </div>
    );
  }

  if (!sections) {
    return <div className="space-y-6">{fields.map(renderField)}</div>;
  }

  // Bloques con título (fieldset + legend): el lector de pantalla anuncia el grupo
  return (
    <div className="space-y-10">
      {sections.map((sec) => (
        <fieldset key={sec.title} className="space-y-6">
          <legend className="fieldset-legend">{sec.title}</legend>
          {fields.filter((f) => sec.names.includes(f.name)).map(renderField)}
        </fieldset>
      ))}
    </div>
  );
}

DynamicForm.propTypes = {
  fields:          PropTypes.arrayOf(fieldShape),
  values:          PropTypes.object,
  onChange:        PropTypes.func.isRequired,
  disabled:        PropTypes.bool,
  submitAttempted: PropTypes.bool,
  onErrorsChange:  PropTypes.func,
  sections:        PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string.isRequired,
    names: PropTypes.arrayOf(PropTypes.string).isRequired,
  })),
};
