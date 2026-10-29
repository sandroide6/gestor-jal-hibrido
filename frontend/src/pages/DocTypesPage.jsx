import { useState } from 'react';
import PropTypes from 'prop-types';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { fetchDocType, createDocType, updateDocType } from '../services/docTypesService';
import { useDocTypes } from '../hooks/useDocTypes';
import { FIELD_TYPES, FIELD_TYPE_LABEL, TIPOS_TRAMITE, TIPO_TRAMITE_LABEL } from '../constants';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Dialog, { ConfirmDialog } from '../components/ui/Dialog';
import Notice from '../components/ui/Notice';
import Spinner from '../components/ui/Spinner';
import Icon from '../components/ui/Icon';
import StatusBadge from '../components/ui/StatusBadge';
import { toast } from '../stores/toastStore';

const EMPTY_FIELD = { name: '', label: '', type: 'text', required: true, options: '', placeholder: '', minLength: '', maxLength: '', min: '', max: '', inputFilter: '' };

const PLACEHOLDER_HINT = {
  text:      'ej. Juan Pérez González',
  textarea:  'ej. Describe brevemente el motivo de la solicitud...',
  date:      'ej. 2024-06-15',
  time:      'ej. 08:30',
  number:    'ej. 42',
  checkbox:  'ej. Declaro que la información es verídica',
  duracion:  'ej. 2  (luego elige meses o años)',
  periodo:   'ej. 2024  y luego Semestre 1 o 2',
};

function FieldRow({ index, currentType, register, onRemove, disabled }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const nameReg = register(`fields.${index}.name`, { required: true, maxLength: 60 });

  const hasTextLen     = currentType === 'text' || currentType === 'textarea';
  const hasNumRange    = currentType === 'number';
  const hasOptions     = currentType === 'select' || currentType === 'checklist';
  const hasPlaceholder = currentType !== 'select' && currentType !== 'checklist';

  return (
    <div className="space-y-3 rounded-md border border-line bg-sunken p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">Campo {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="btn-ghost btn-sm !text-danger-fg"
          aria-label={`Eliminar campo ${index + 1}`}
        >
          Eliminar
        </button>
      </div>

      {/* Nombre + etiqueta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor={`f${index}-name`}>Nombre interno</label>
          <input
            id={`f${index}-name`}
            className="input"
            placeholder="ej. num_sesion"
            pattern="[a-z_][a-z0-9_]*"
            disabled={disabled}
            {...nameReg}
            onChange={(e) => {
              e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
              nameReg.onChange(e);
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor={`f${index}-label`}>Etiqueta visible</label>
          <input
            id={`f${index}-label`}
            className="input"
            placeholder="ej. Número de sesión"
            disabled={disabled}
            {...register(`fields.${index}.label`, { required: true, maxLength: 200 })}
          />
        </div>
      </div>

      {/* Tipo + obligatorio */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor={`f${index}-type`}>Tipo</label>
          <select id={`f${index}-type`} className="input" disabled={disabled} {...register(`fields.${index}.type`)}>
            {FIELD_TYPES.map(t => (
              <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex min-h-[48px] cursor-pointer items-center gap-2 text-ink">
            <input
              type="checkbox"
              disabled={disabled}
              className="h-5 w-5 rounded accent-brand"
              {...register(`fields.${index}.required`)}
            />
            Obligatorio
          </label>
        </div>
      </div>

      {/* Filtro de entrada — visible siempre para texto corto */}
      {currentType === 'text' && (
        <div>
          <label className="label" htmlFor={`f${index}-filter`}>Filtro de entrada</label>
          <select id={`f${index}-filter`} className="input" disabled={disabled} {...register(`fields.${index}.inputFilter`)}>
            <option value="">Sin filtro (letras y números)</option>
            <option value="solo_letras">Solo letras y espacios</option>
            <option value="solo_numeros">Solo números</option>
          </select>
        </div>
      )}

      {/* Opciones para select y checklist */}
      {hasOptions && (
        <div>
          <label className="label" htmlFor={`f${index}-options`}>
            Opciones (separadas por coma)
            {currentType === 'checklist' && (
              <span className="text-ink-muted font-normal"> — el usuario podrá marcar varias</span>
            )}
          </label>
          <input
            id={`f${index}-options`}
            className="input"
            placeholder="ej. Opción A, Opción B, Opción C"
            disabled={disabled}
            {...register(`fields.${index}.options`, { required: hasOptions })}
          />
        </div>
      )}

      {/* Opciones avanzadas */}
      {(hasTextLen || hasNumRange || hasPlaceholder) && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            aria-expanded={showAdvanced}
            className="btn-ghost btn-sm -ml-2"
          >
            <Icon name="chevron" size={16} className={showAdvanced ? 'rotate-90' : ''} />
            Validaciones opcionales
          </button>

          {showAdvanced && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {hasPlaceholder && (
                <div className="col-span-2">
                  <label className="label" htmlFor={`f${index}-ph`}>Texto de ayuda</label>
                  <p className="hint">Se muestra debajo de la etiqueta para orientar a quien llena el formulario.</p>
                  <input
                    id={`f${index}-ph`}
                    className="input"
                    placeholder={PLACEHOLDER_HINT[currentType] ?? 'ej. Ingresa el valor'}
                    disabled={disabled}
                    {...register(`fields.${index}.placeholder`, { maxLength: 200 })}
                  />
                </div>
              )}
              {hasTextLen && (
                <>
                  <div>
                    <label className="label">Mínimo de caracteres</label>
                    <input type="number" min={0} className="input" disabled={disabled}
                      {...register(`fields.${index}.minLength`, { valueAsNumber: true, min: 0 })} />
                  </div>
                  <div>
                    <label className="label">Máximo de caracteres</label>
                    <input type="number" min={1} className="input" disabled={disabled}
                      placeholder={currentType === 'textarea' ? '2000' : '500'}
                      {...register(`fields.${index}.maxLength`, { valueAsNumber: true, min: 1 })} />
                  </div>
                </>
              )}
              {hasNumRange && (
                <>
                  <div>
                    <label className="label">Valor mínimo</label>
                    <input type="number" className="input" disabled={disabled}
                      {...register(`fields.${index}.min`, { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="label">Valor máximo</label>
                    <input type="number" className="input" disabled={disabled}
                      {...register(`fields.${index}.max`, { valueAsNumber: true })} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
FieldRow.propTypes = {
  index: PropTypes.number.isRequired,
  currentType: PropTypes.string.isRequired,
  register: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

function DocTypeModal({ docType, onClose, onSave }) {
  const isEdit = !!docType;
  const [templateFile, setTemplateFile] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: isEdit ? docType.name : '',
      tipo_tramite: isEdit ? (docType.tipo_tramite || 'salida') : 'salida',
      fields: isEdit
        ? docType.fields.map(f => ({
            ...EMPTY_FIELD,
            ...f,
            options:    Array.isArray(f.options) ? f.options.join(', ') : '',
            minLength:  f.minLength ?? '',
            maxLength:  f.maxLength ?? '',
            min:        f.min ?? '',
            max:        f.max ?? '',
            placeholder: f.placeholder ?? '',
          }))
        : [{ ...EMPTY_FIELD }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'fields' });
  const watchedFields = useWatch({ control, name: 'fields', defaultValue: [] });

  async function onSubmit({ name, tipo_tramite, fields: rawFields }) {
    setWarnings([]);

    if (rawFields.length === 0) {
      setError('root', { message: 'Agrega al menos un campo' });
      return;
    }
    const names = rawFields.map(f => f.name).filter(Boolean);
    if (new Set(names).size !== names.length) {
      setError('root', { message: 'Los nombres internos de los campos deben ser únicos' });
      return;
    }

    const parsedFields = rawFields.map(f => {
      const base = { name: f.name, label: f.label, type: f.type, required: !!f.required };
      if (f.type === 'select' || f.type === 'checklist') {
        base.options = f.options.split(',').map(s => s.trim()).filter(Boolean);
      }
      // Incluir solo las reglas de validación que tengan valor
      if (f.placeholder)                base.placeholder = f.placeholder;
      if (f.minLength > 0)              base.minLength = Number(f.minLength);
      if (f.maxLength > 0)              base.maxLength = Number(f.maxLength);
      if (f.min !== '' && !isNaN(f.min) && f.min !== null && f.min !== undefined) base.min = Number(f.min);
      if (f.max !== '' && !isNaN(f.max) && f.max !== null && f.max !== undefined) base.max = Number(f.max);
      return base;
    });

    const fd = new FormData();
    fd.append('data', JSON.stringify({ name, tipo_tramite, fields: parsedFields }));
    if (templateFile) fd.append('template', templateFile);

    try {
      const result = await onSave(fd);
      if (result?.warnings?.length) {
        setWarnings(result.warnings);
        return;
      }
      onClose();
    } catch (err) {
      setError('root', { message: err.message || 'Error al guardar' });
    }
  }

  return (
    <Dialog
      title={isEdit ? `Editar «${docType.name}»` : 'Nuevo tipo de documento'}
      description="Los campos que definas aquí son los datos que se pedirán al crear el documento."
      onClose={isSubmitting ? () => {} : onClose}
      size="lg"
    >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="label">Nombre del tipo</label>
            <input
              className="input"
              placeholder="ej. Constancia de Participación"
              disabled={isSubmitting}
              {...register('name', { required: 'El nombre es obligatorio', minLength: 2, maxLength: 200 })}
            />
            {errors.name && <p className="text-sm text-danger-fg mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Tipo de trámite</label>
            <select
              className="input"
              disabled={isSubmitting}
              {...register('tipo_tramite', { required: true })}
            >
              {TIPOS_TRAMITE.map((t) => (
                <option key={t} value={t}>{TIPO_TRAMITE_LABEL[t]}</option>
              ))}
            </select>
            <p className="text-sm text-ink-muted mt-1">
              Define la serie del número de radicado (entrada, salida o interno) para los documentos generados con este tipo.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Campos del formulario</label>
              <button
                type="button"
                onClick={() => append({ ...EMPTY_FIELD })}
                disabled={isSubmitting}
                className="text-sm text-brand hover:underline font-medium"
              >
                + Agregar campo
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {fields.map((field, i) => (
                <FieldRow
                  key={field.id}
                  index={i}
                  currentType={watchedFields[i]?.type ?? 'text'}
                  register={register}
                  onRemove={() => remove(i)}
                  disabled={isSubmitting}
                />
              ))}
              {fields.length === 0 && (
                <EmptyState message="Sin campos. Agrega al menos uno." compact />
              )}
            </div>
          </div>

          <div>
            <label className="label">Plantilla .docx (opcional)</label>
            <input
              type="file"
              accept=".docx"
              disabled={isSubmitting}
              onChange={e => setTemplateFile(e.target.files[0] || null)}
              className="block w-full text-sm text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-brand-tint file:text-brand hover:file:bg-brand-tint"
            />
            {isEdit && (docType.has_template || docType.template_path) && !templateFile && (
              <p className="text-sm text-success-fg mt-1">
                Plantilla cargada. Sube un nuevo archivo para reemplazarla.
              </p>
            )}
            <p className="text-sm text-ink-muted mt-1">
              Variables disponibles: <code className="bg-sunken px-1 rounded">{'{{campo_name}}'}</code>,{' '}
              <code className="bg-sunken px-1 rounded">{'{{jal_name}}'}</code>,{' '}
              <code className="bg-sunken px-1 rounded">{'{{beneficiary_name}}'}</code>,{' '}
              <code className="bg-sunken px-1 rounded">{'{{fecha_expedicion}}'}</code>
            </p>
          </div>

          {errors.root && <Notice tone="danger">{errors.root.message}</Notice>}

          {warnings.length > 0 && (
            <Notice tone="warning" title="El tipo quedó guardado, pero revisa la plantilla">
              <ul className="list-disc space-y-1 pl-5">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </Notice>
          )}

          <div className="flex flex-wrap-reverse justify-end gap-2 border-t border-line pt-4">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              {warnings.length > 0 ? 'Cerrar' : 'Cancelar'}
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting} aria-busy={isSubmitting || undefined}>
              {isSubmitting && <Spinner />}
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
    </Dialog>
  );
}
const docTypeShape = PropTypes.shape({ id: PropTypes.string, name: PropTypes.string, fields: PropTypes.array, active: PropTypes.bool });
DocTypeModal.propTypes = {
  docType: docTypeShape,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

function ToggleActiveModal({ docType, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false);

  async function handle() {
    setSaving(true);
    try {
      await onConfirm();
    } catch (err) {
      toast.error(err.message || 'No se pudo cambiar el estado del tipo de documento.');
      setSaving(false);
    }
  }

  return (
    <ConfirmDialog
      danger={docType.active}
      busy={saving}
      title={`¿${docType.active ? 'Desactivar' : 'Activar'} «${docType.name}»?`}
      message={docType.active
        ? 'Dejará de aparecer al crear documentos. Los documentos ya creados no cambian.'
        : 'Volverá a aparecer para que los auxiliares puedan crearlo.'}
      confirmLabel={docType.active ? 'Desactivar' : 'Activar'}
      onConfirm={handle}
      onCancel={onClose}
    />
  );
}
ToggleActiveModal.propTypes = {
  docType: docTypeShape.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

export default function DocTypesPage() {
  const { token } = useAuthStore();
  const { data, loading, error: loadError } = useDocTypes(token);
  const [docTypes, setDocTypes] = useState(null);
  const displayTypes = docTypes ?? data ?? [];

  const [modal, setModal] = useState(null); // null | { type: 'create' | 'edit', docType? }
  const [toggleModal, setToggleModal] = useState(null); // null | docType

  async function handleCreate(fd) {
    const created = await createDocType(fd, token);
    setDocTypes(prev => [...(prev ?? data ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }

  async function handleEdit(id, fd) {
    const updated = await updateDocType(id, fd, token);
    setDocTypes(prev => (prev ?? data ?? []).map(dt => dt.id === id ? { ...dt, ...updated } : dt));
    return updated;
  }

  async function handleToggleActive(docType) {
    const fd = new FormData();
    fd.append('data', JSON.stringify({ active: !docType.active }));
    const updated = await updateDocType(docType.id, fd, token);
    setDocTypes(prev => (prev ?? data ?? []).map(dt => dt.id === docType.id ? { ...dt, ...updated } : dt));
    setToggleModal(null);
  }

  const activeCount = displayTypes.filter(d => d.active).length;

  return (
    <AppLayout
      title="Tipos de documento"
      eyebrow="Administración"
      description={loading ? 'Cargando…' : `${activeCount} activos de ${displayTypes.length}. Cada tipo es una plantilla con los datos que pide.`}
      actions={<button type="button" className="btn-primary" onClick={() => setModal({ type: 'create' })}><Icon name="mas" />Nuevo tipo</button>}
      width="page"
    >
      {modal?.type === 'create' && (
        <DocTypeModal
          onClose={() => setModal(null)}
          onSave={handleCreate}
        />
      )}
      {modal?.type === 'edit' && modal.docType && (
        <DocTypeModal
          docType={modal.docType}
          onClose={() => setModal(null)}
          onSave={fd => handleEdit(modal.docType.id, fd)}
        />
      )}
      {toggleModal && (
        <ToggleActiveModal
          docType={toggleModal}
          onClose={() => setToggleModal(null)}
          onConfirm={() => handleToggleActive(toggleModal)}
        />
      )}

      {loadError && <Notice tone="danger" title="No se pudo cargar la lista" className="mb-4">{loadError}</Notice>}

      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : displayTypes.length === 0 ? (
        <EmptyState
          title="Todavía no hay tipos de documento"
          message="Crea el primero: ponle nombre, define los datos que pide y sube su plantilla de Word."
          action={<button type="button" className="btn-primary" onClick={() => setModal({ type: 'create' })}>Crear el primero</button>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayTypes.map((dt, i) => (
            <li key={dt.id} className={`card relative flex flex-col p-5 ${!dt.active ? 'bg-sunken' : ''}`}>
              <span aria-hidden="true" className="absolute left-0 top-5 h-8 w-1 rounded-r bg-accent" />
              <p className="text-eyebrow uppercase text-ink-muted">
                Folio {String(i + 1).padStart(2, '0')} · {TIPO_TRAMITE_LABEL[dt.tipo_tramite] ?? 'Trámite'}
              </p>
              <h2 className="title-card mt-1">{dt.name}</h2>
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-ink-muted">
                <div><dt className="sr-only">Campos</dt><dd>{dt.fields?.length ?? 0} dato{(dt.fields?.length ?? 0) === 1 ? '' : 's'}</dd></div>
                <div><dt className="sr-only">Plantilla</dt><dd>{(dt.has_template || dt.template_path) ? 'Con plantilla Word' : 'Sin plantilla'}</dd></div>
              </dl>
              <div className="mb-4 mt-3">
                {dt.active ? <StatusBadge tone="success">Activo</StatusBadge> : <StatusBadge tone="neutral">Inactivo</StatusBadge>}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  aria-label={`Editar ${dt.name}`}
                  onClick={async () => {
                    const fresh = await fetchDocType(dt.id, token).catch(() => dt);
                    setModal({ type: 'edit', docType: fresh });
                  }}
                >
                  <Icon name="editar" size={18} />Editar
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  aria-label={`${dt.active ? 'Desactivar' : 'Activar'} ${dt.name}`}
                  onClick={() => setToggleModal(dt)}
                >
                  {dt.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}
