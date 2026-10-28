import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { generateDocument, downloadDocument, cacheEdilSignature, findPerson } from '../services/documentService';
import { useDocTypes } from '../hooks/useDocTypes';
import { useEdiles } from '../hooks/useEdiles';
import DynamicForm from '../components/forms/DynamicForm';
import AppLayout from '../components/ui/AppLayout';
import EmptyState from '../components/ui/EmptyState';

const STEPS = { SELECT: 'select', FORM: 'form', RESULT: 'result' };

// La fecha de expedición casi siempre es hoy; otras fechas (p. ej. de una citación) se dejan vacías.
const isIssueDate = (f) => f.type === 'date' && /expedici|^fecha$/i.test(f.label ?? '');
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local

const ID_FIELD = /^(cedula|numerodocumento|numero_documento)$/i;
// Campos de identidad que se pueden traer de un documento anterior de la misma persona
const PERSON_FIELDS = {
  nombre:          /^(nombre|nombre_completo|nombre_titular)$/i,
  tipo_documento:  /^(tipodeidentificacion|tipodocumento|tipo_documento)$/i,
  lugar_documento: /^(lugardedocumento|lugardocumento|lugar_documento)$/i,
};

// Solo llena campos vacíos: nunca pisa lo que el usuario ya escribió
function personFills(fields, values, person) {
  if (!person) return {};
  const fills = {};
  for (const f of fields ?? []) {
    const key = Object.keys(PERSON_FIELDS).find((k) => PERSON_FIELDS[k].test(f.name));
    if (key && person[key] && !values[f.name]) fills[f.name] = person[key];
  }
  return fills;
}

function initialValues(type) {
  return Object.fromEntries((type.fields ?? []).filter(isIssueDate).map((f) => [f.name, todayISO()]));
}

function displayValue(field, value) {
  if (!value) return '—';
  if (field.type === 'date') return new Date(`${value}T00:00:00`).toLocaleDateString('es-CO', { dateStyle: 'long' });
  return value;
}

export default function GeneratorPage() {
  const { token, user } = useAuthStore();
  const { isOnline } = useSyncStore();
  const isAuxiliar = user?.role === 'auxiliar';

  const { data: allTypes, loading: loadingTypes, error: typeError } = useDocTypes(token);
  const docTypes = (allTypes ?? []).filter((t) => t.active);
  const { ediles } = useEdiles(isAuxiliar);

  const [step, setStep] = useState(STEPS.SELECT);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedEdilId, setSelectedEdilId] = useState('');

  // Campos del formulario
  const [formValues, setFormValues] = useState({});

  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [signatureMissing, setSignatureMissing] = useState(false);
  const [searchParams] = useSearchParams();
  const tipoParam = searchParams.get('tipo');

  // Validación
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [dynErrors, setDynErrors] = useState({});

  const hasDynErrors = Object.values(dynErrors).some(Boolean);
  const canSubmit = !hasDynErrors;

  function handleSelectType(type) {
    setSelectedType(type);
    setFormValues(initialValues(type));
    setError('');
    setSubmitAttempted(false);
    setDynErrors({});
    setReviewing(false);
    setSignatureMissing(false);
    setStep(STEPS.FORM);
  }

  // Desde Inicio llega ?tipo=<id>: abrir el formulario directamente
  useEffect(() => {
    if (!tipoParam || step !== STEPS.SELECT || selectedType) return;
    const type = docTypes.find((t) => t.id === tipoParam);
    if (type) handleSelectType(type);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoParam, allTypes]);

  // Si la cédula ya fue atendida antes, ofrecer sus datos de identidad
  const idFieldName = selectedType?.fields?.find((f) => ID_FIELD.test(f.name))?.name;
  const cedula = idFieldName ? String(formValues[idFieldName] ?? '').trim() : '';
  const [person, setPerson] = useState(null);
  useEffect(() => {
    setPerson(null);
    if (!isOnline || cedula.length < 5) return;
    let stale = false;
    const t = setTimeout(() => {
      findPerson(cedula, token)
        .then((p) => { if (!stale) setPerson(p); })
        .catch(() => {}); // la sugerencia es opcional: si falla, el usuario escribe a mano
    }, 600);
    return () => { stale = true; clearTimeout(t); };
  }, [cedula, isOnline, token]);
  const fills = personFills(selectedType?.fields, formValues, person);

  function handleFieldChange(name, value) {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }

  function getBeneficiaryFromForm() {
    const fields = selectedType?.fields ?? [];
    const nameField = fields.find((f) => PERSON_FIELDS.nombre.test(f.name));
    const idField   = fields.find((f) => ID_FIELD.test(f.name));
    // Para documentos sin beneficiario personal, usar destinatario/entidad como referencia
    const fallbackField = fields.find((f) => /^(destinatario|nombre_entidad|entidad)$/i.test(f.name));
    return {
      beneficiaryName: nameField
        ? (formValues[nameField.name] ?? '').trim()
        : (fallbackField ? (formValues[fallbackField.name] ?? '').trim() : ''),
      beneficiaryId: idField ? (formValues[idField.name] ?? '').trim() : '',
    };
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) {
      // Llevar al primer campo con error, que puede estar fuera de la pantalla
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setError('');
    setReviewing(true);
    window.scrollTo(0, 0);
  }

  async function handleGenerate() {
    setError('');
    setSignatureMissing(false);
    setGenerating(true);

    const { beneficiaryName, beneficiaryId } = getBeneficiaryFromForm();

    try {
      const res = await generateDocument({
        docType: selectedType,
        formData: formValues,
        beneficiaryName,
        beneficiaryId,
        token,
        edilId:    selectedEdilId || null,
        edilName:  selectedEdil?.name  || null,
        edilCargo: selectedEdil?.cargo_titulo || null,
      });
      setResult({ ...res, beneficiaryName });
      setStep(STEPS.RESULT);
    } catch (err) {
      setError(`No se pudo crear el documento${err.message ? ` (${err.message})` : ''}. Tus datos siguen aquí: puedes corregirlos o intentarlo de nuevo.`);
      setSignatureMissing((err.code || err.data?.code) === 'SIGNATURE_MISSING');
    } finally {
      setGenerating(false);
    }
  }

  function handleCancel() {
    const initial = initialValues(selectedType);
    const hasData = Object.entries(formValues).some(([k, v]) => v && v !== initial[k]);
    if (hasData && !window.confirm('¿Salir sin crear el documento? Se perderán los datos que escribiste.')) return;
    handleReset();
  }

  function handleReset() {
    setReviewing(false);
    setStep(STEPS.SELECT);
    setSelectedType(null);
    setSelectedEdilId('');
    setResult(null);
    setError('');
    setFormValues({});
    setSubmitAttempted(false);
    setDynErrors({});
  }

  const selectedEdil = ediles.find((e) => e.id === selectedEdilId);

  // Cachear la firma del edil para uso offline
  useEffect(() => {
    if (!selectedEdilId) return;
    cacheEdilSignature(selectedEdilId, token);
  }, [selectedEdilId, token]);

  const stepLabels = [
    [STEPS.SELECT, '1. Elegir documento'],
    [STEPS.FORM, reviewing ? '2. Revisar datos' : '2. Escribir datos'],
    [STEPS.RESULT, '3. Listo'],
  ];

  return (
    <AppLayout title="Crear documento">
      <div className="max-w-3xl">
      {/* Pasos */}
      <ol className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap" aria-label="Pasos">
        {stepLabels.map(([key, label], i) => (
          <li key={key} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">›</span>}
            <span className={step === key ? 'text-jal-blue-600 font-semibold' : ''} aria-current={step === key ? 'step' : undefined}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {/* PASO 1 — Elegir tipo */}
      {step === STEPS.SELECT && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Qué documento necesitas hacer?</h2>
          {loadingTypes ? (
            <p className="text-gray-500">Cargando…</p>
          ) : docTypes.length === 0 ? (
            <EmptyState message="Todavía no hay documentos configurados. Pide al administrador que los agregue." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {docTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleSelectType(type)}
                  className="card !p-5 text-left flex items-center justify-between gap-3 text-lg font-semibold text-jal-blue-600
                             hover:border-jal-blue-400 hover:bg-jal-blue-50 focus:outline-none focus:ring-2 focus:ring-jal-blue-400"
                >
                  <span>{type.name}</span>
                  <span aria-hidden="true" className="text-2xl">›</span>
                </button>
              ))}
            </div>
          )}
          {(typeError || error) && (
            <p role="alert" className="text-red-700 mt-4">
              {typeError ? 'No se pudo cargar la lista de documentos. Recarga la página para intentarlo de nuevo.' : error}
            </p>
          )}
        </div>
      )}

      {/* PASO 2 — Datos y revisión */}
      {step === STEPS.FORM && selectedType && (
        <div>
          <div className="mb-6">
            <button type="button" onClick={handleCancel} className="text-jal-blue-600 underline min-h-[44px]" disabled={generating}>
              ← Elegir otro documento
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">{selectedType.name}</h2>
          </div>

          {!isOnline && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-amber-900 mb-4">
              Estás sin conexión. El documento se creará en este equipo y podrás descargarlo de una vez.
              Se enviará al sistema cuando vuelva internet.
            </div>
          )}

          {!reviewing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {isAuxiliar && ediles.length > 0 && (
                <div className="card">
                  <label className="label" htmlFor="edil_select">
                    ¿A nombre de qué edil sale el documento?
                  </label>
                  <select
                    id="edil_select"
                    className="input"
                    value={selectedEdilId}
                    onChange={(e) => setSelectedEdilId(e.target.value)}
                  >
                    <option value="">Ninguno</option>
                    {ediles.map((edil) => (
                      <option key={edil.id} value={edil.id}>
                        {edil.name}{edil.cargo_titulo ? ` — ${edil.cargo_titulo}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedEdil && (
                    <p className="text-sm text-gray-700 mt-2">
                      Saldrá a nombre de <strong>{selectedEdil.name}</strong>, que recibirá un aviso para revisarlo.
                    </p>
                  )}
                </div>
              )}

              {(selectedType.fields?.length ?? 0) > 0 && (
                <div className="card">
                  <p className="text-gray-600 mb-4">Los campos con <span className="text-red-600 font-semibold">*</span> son obligatorios.</p>
                  <DynamicForm
                    fields={selectedType.fields}
                    values={formValues}
                    onChange={handleFieldChange}
                    disabled={generating}
                    submitAttempted={submitAttempted}
                    onErrorsChange={setDynErrors}
                  />
                </div>
              )}

              {Object.keys(fills).length > 0 && (
                <div role="status" className="bg-jal-blue-50 border border-jal-blue-200 rounded-lg px-4 py-3 text-gray-900 flex flex-wrap items-center gap-3">
                  <p className="flex-1 min-w-[12rem]">
                    Ya atendimos a <strong>{person.nombre}</strong> con este número. ¿Usar sus datos guardados?
                  </p>
                  <button type="button" className="btn-primary" onClick={() => { setFormValues((prev) => ({ ...prev, ...fills })); setPerson(null); }}>
                    Usar sus datos
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setPerson(null)}>No, gracias</button>
                </div>
              )}

              {submitAttempted && hasDynErrors && (
                <p role="alert" className="text-red-700">Falta completar o corregir algunos datos. Están marcados en rojo.</p>
              )}

              <div className="flex flex-wrap gap-3">
                <button type="submit" className="btn-primary">Revisar antes de crear</button>
                <button type="button" className="btn-secondary" onClick={handleCancel}>Cancelar</button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-xl font-bold text-gray-900">Revisa que todo esté bien</h3>
                <p className="text-gray-600 mt-1 mb-4">Así saldrá en el documento. Al crearlo se le asigna un número de radicado.</p>
                <dl className="divide-y divide-gray-200">
                  {selectedEdil && (
                    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
                      <dt className="text-gray-600">A nombre de</dt>
                      <dd className="font-semibold text-gray-900 sm:col-span-2">{selectedEdil.name}</dd>
                    </div>
                  )}
                  {(selectedType.fields ?? []).map((f) => (
                    <div key={f.name} className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
                      <dt className="text-gray-600">{f.label}</dt>
                      <dd className="font-semibold text-gray-900 sm:col-span-2 break-words whitespace-pre-line">
                        {displayValue(f, formValues[f.name])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {error && (
                <div role="alert" className="text-red-800 bg-red-50 border border-red-300 rounded-lg px-4 py-3">
                  {error}
                  {signatureMissing && (
                    selectedEdilId ? (
                      <p className="mt-1">Pídele al edil que inicie sesión y suba su firma desde <strong>Mi perfil</strong>.</p>
                    ) : (
                      <p className="mt-1">
                        <Link to="/perfil" className="font-semibold underline">Ir a Mi perfil para subir tu firma →</Link>
                      </p>
                    )
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" onClick={handleGenerate} disabled={generating}>
                  {generating ? 'Creando el documento…' : 'Sí, crear el documento'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setReviewing(false); setError(''); }} disabled={generating}>
                  Corregir datos
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 3 — Resultado */}
      {step === STEPS.RESULT && result && (
        <div className="space-y-6">
          <div className="card border-green-300 bg-green-50" role="status">
            <p className="text-xl font-bold text-green-900">
              {result.offline ? '✓ Documento creado en este equipo' : '✓ Documento creado y guardado'}
            </p>
            <p className="text-green-900 mt-1">
              <strong>{selectedType?.name}</strong>{result.beneficiaryName ? ` — ${result.beneficiaryName}` : ''}
            </p>
            {selectedEdil && <p className="text-green-900">A nombre de <strong>{selectedEdil.name}</strong></p>}
            {result.numero_radicado && <p className="text-green-900 mt-1">Radicado <strong className="font-mono">{result.numero_radicado}</strong></p>}
            {result.document_number && <p className="text-green-900">N.° <strong className="font-mono">{result.document_number}</strong></p>}
            <p className="text-green-900 mt-3">
              {result.offline
                ? 'Se enviará al sistema cuando vuelva internet. Mientras tanto, descárgalo aquí.'
                : <>Quedó guardado en el sistema. Lo encuentras cuando quieras en <Link to="/inicio" className="underline font-semibold">Inicio › Mis documentos recientes</Link>.</>}
            </p>
          </div>

          {result?.id && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Descargar</h3>
              {result.offline && result.offlineBlobError && (
                <p className="text-amber-800 mb-3">
                  No se pudo preparar el archivo en este equipo ({result.offlineBlobError}). Podrás descargarlo cuando vuelva internet.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {['pdf', 'docx'].map((fmt) => {
                  const hasOfflineBlob = result.offline && result.offlineBlobs?.[fmt];
                  const hasOnline = !result.offline;
                  if (!hasOfflineBlob && !hasOnline) return null;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      disabled={!!downloading}
                      onClick={async () => {
                        setDownloading(fmt);
                        setError('');
                        try {
                          const name = `${selectedType?.name}_${result.beneficiaryName}.${fmt}`;
                          if (hasOfflineBlob) {
                            const { triggerBlobDownload } = await import('../services/clientDocumentGenerator');
                            triggerBlobDownload(result.offlineBlobs[fmt], name);
                          } else {
                            await downloadDocument(result.id, fmt, token, name);
                          }
                        } catch {
                          setError('No se pudo descargar. El documento sigue guardado; inténtalo de nuevo.');
                        } finally {
                          setDownloading('');
                        }
                      }}
                      className={fmt === 'pdf' ? 'btn-primary' : 'btn-secondary'}
                    >
                      {downloading === fmt ? 'Descargando…' : fmt === 'pdf' ? 'Descargar PDF (para imprimir)' : 'Descargar Word (para editar)'}
                    </button>
                  );
                })}
              </div>
              {error && <p role="alert" className="text-red-700 mt-3">{error}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleReset} className="btn-secondary">Crear otro documento</button>
            <Link to="/inicio" className="btn-secondary">Volver al inicio</Link>
          </div>
        </div>
      )}
      </div>
    </AppLayout>
  );
}
