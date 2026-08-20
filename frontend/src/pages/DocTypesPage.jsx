import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { fetchDocType, createDocType, updateDocType } from '../services/docTypesService';
import { useDocTypes } from '../hooks/useDocTypes';
import { FIELD_TYPES, FIELD_TYPE_LABEL, TIPOS_TRAMITE, TIPO_TRAMITE_LABEL } from '../constants';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

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
    <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Campo #{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="text-xs text-red-500 hover:underline disabled:opacity-40"
        >
          Eliminar
        </button>
      </div>

      {/* Nombre + etiqueta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="label">Nombre interno</label>
          <input
            className="input text-xs"
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
          <label className="label">Etiqueta visible</label>
          <input
            className="input text-xs"
            placeholder="ej. Número de sesión"
            disabled={disabled}
            {...register(`fields.${index}.label`, { required: true, maxLength: 200 })}
          />
        </div>
      </div>

      {/* Tipo + obligatorio */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Tipo</label>
          <select className="input text-xs" disabled={disabled} {...register(`fields.${index}.type`)}>
            {FIELD_TYPES.map(t => (
              <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled}
              className="w-3.5 h-3.5 rounded accent-jal-blue-500"
              {...register(`fields.${index}.required`)}
            />
            Obligatorio
          </label>
        </div>
      </div>

      {/* Filtro de entrada — visible siempre para texto corto */}
      {currentType === 'text' && (
        <div>
          <label className="label">Filtro de entrada</label>
          <select className="input text-xs" disabled={disabled} {...register(`fields.${index}.inputFilter`)}>
            <option value="">Sin filtro (letras y números)</option>
            <option value="solo_letras">Solo letras y espacios</option>
            <option value="solo_numeros">Solo números</option>
          </select>
        </div>
      )}

      {/* Opciones para select y checklist */}
      {hasOptions && (
        <div>
          <label className="label">
            Opciones (separadas por coma)
            {currentType === 'checklist' && (
              <span className="text-gray-400 font-normal"> — el usuario podrá marcar varias</span>
            )}
          </label>
          <input
            className="input text-xs"
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
            className="text-xs text-jal-blue-500 hover:underline flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Validaciones opcionales
          </button>

          {showAdvanced && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {hasPlaceholder && (
                <div className="col-span-2">
                  <label className="label">Texto de ayuda (placeholder)</label>
                  <input
                    className="input text-xs"
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
                    <input type="number" min={0} className="input text-xs" disabled={disabled}
                      {...register(`fields.${index}.minLength`, { valueAsNumber: true, min: 0 })} />
                  </div>
                  <div>
                    <label className="label">Máximo de caracteres</label>
                    <input type="number" min={1} className="input text-xs" disabled={disabled}
                      placeholder={currentType === 'textarea' ? '2000' : '500'}
                      {...register(`fields.${index}.maxLength`, { valueAsNumber: true, min: 1 })} />
                  </div>
                </>
              )}
              {hasNumRange && (
                <>
                  <div>
                    <label className="label">Valor mínimo</label>
                    <input type="number" className="input text-xs" disabled={disabled}
                      {...register(`fields.${index}.min`, { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="label">Valor máximo</label>
                    <input type="number" className="input text-xs" disabled={disabled}
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
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, { onEscape: onClose });

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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="doctype-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="doctype-modal-title" className="font-semibold text-gray-800">
            {isEdit ? 'Editar tipo de documento' : 'Nuevo tipo de documento'}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div>
            <label className="label">Nombre del tipo</label>
            <input
              className="input"
              placeholder="ej. Constancia de Participación"
              disabled={isSubmitting}
              {...register('name', { required: 'El nombre es obligatorio', minLength: 2, maxLength: 200 })}
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
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
            <p className="text-xs text-gray-400 mt-1">
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
                className="text-xs text-jal-blue-500 hover:underline font-medium"
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
              className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-jal-blue-50 file:text-jal-blue-600 hover:file:bg-jal-blue-100"
            />
            {isEdit && (docType.has_template || docType.template_path) && !templateFile && (
              <p className="text-xs text-green-600 mt-1">
                Plantilla cargada. Sube un nuevo archivo para reemplazarla.
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Variables disponibles: <code className="bg-gray-100 px-1 rounded">{'{{campo_name}}'}</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{jal_name}}'}</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{beneficiary_name}}'}</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{fecha_expedicion}}'}</code>
            </p>
          </div>

          {errors.root && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errors.root.message}
            </p>
          )}

          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">{w}</p>
              ))}
              <p className="text-xs text-amber-600 font-medium">
                El tipo fue guardado. Revisa las variables de la plantilla.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const action = docType.active ? 'desactivar' : 'activar';
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, { onEscape: onClose });

  async function handle() {
    setSaving(true);
    await onConfirm();
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-describedby="toggle-active-desc"
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
      >
        <p id="toggle-active-desc" className="text-gray-700 text-sm mb-6">
          ¿{docType.active ? 'Desactivar' : 'Activar'} el tipo <strong>{docType.name}</strong>?{' '}
          {docType.active
            ? 'No aparecerá en el generador de documentos.'
            : 'Volverá a estar disponible para los auxiliares.'}
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className={docType.active ? 'btn-danger' : 'btn-primary'}
            onClick={handle}
            disabled={saving}
          >
            {saving ? '…' : `Sí, ${action}`}
          </button>
        </div>
      </div>
    </div>
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
    <AppLayout title="Tipos de Documento">
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

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {activeCount} activo(s) · {displayTypes.length} total
        </p>
        <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Nuevo tipo
        </button>
      </div>

      {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-jal-blue-500 text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium hidden sm:table-cell">Campos</th>
              <th className="px-4 py-3 text-left text-xs font-medium hidden sm:table-cell">Plantilla</th>
              <th className="px-4 py-3 text-left text-xs font-medium">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-4"><SkeletonTable rows={4} cols={5} /></td>
              </tr>
            )}
            {!loading && displayTypes.length === 0 && (
              <tr><EmptyState message="No hay tipos de documento. Crea el primero." colSpan={5} /></tr>
            )}
            {!loading && displayTypes.map(dt => (
              <tr key={dt.id} className={`hover:bg-gray-50 ${!dt.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-800 text-xs">{dt.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">
                  {dt.fields?.length ?? 0} campo(s)
                </td>
                <td className="px-4 py-3 text-xs hidden sm:table-cell">
                  {(dt.has_template || dt.template_path)
                    ? <span className="text-green-600 font-medium">Sí</span>
                    : <span className="text-gray-400">No</span>}
                </td>
                <td className="px-4 py-3">
                  {dt.active
                    ? <span className="badge-synced">Activo</span>
                    : <span className="badge-conflict">Inactivo</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-jal-blue-500 hover:underline"
                      onClick={async () => {
                        const fresh = await fetchDocType(dt.id, token).catch(() => dt);
                        setModal({ type: 'edit', docType: fresh });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className={`text-xs hover:underline ${dt.active ? 'text-red-500' : 'text-green-600'}`}
                      onClick={() => setToggleModal(dt)}
                    >
                      {dt.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
