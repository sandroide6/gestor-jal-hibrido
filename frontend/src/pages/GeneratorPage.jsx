import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { generateDocument, downloadDocument, cacheEdilSignature, findPerson } from '../services/documentService';
import { useDocTypes } from '../hooks/useDocTypes';
import { useEdiles } from '../hooks/useEdiles';
import DynamicForm from '../components/forms/DynamicForm';
import AppLayout from '../components/ui/AppLayout';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Steps from '../components/ui/Steps';
import Notice from '../components/ui/Notice';
import Radicado from '../components/ui/Radicado';
import Spinner from '../components/ui/Spinner';
import Icon from '../components/ui/Icon';
import { ConfirmDialog } from '../components/ui/Dialog';
import DocTypeCard from '../components/documents/DocTypeCard';
import { SkeletonCard } from '../components/ui/Skeleton';

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

const isPersonField = (f) => ID_FIELD.test(f.name) || Object.values(PERSON_FIELDS).some((re) => re.test(f.name))
  || /^(direccion|barrio|telefono|celular|correo)$/i.test(f.name);

// Bloques del formulario: primero quién es la persona, después lo propio del documento.
function fieldSections(fields = []) {
  const person = fields.filter(isPersonField).map((f) => f.name);
  const rest = fields.filter((f) => !isPersonField(f)).map((f) => f.name);
  if (!person.length || !rest.length) return undefined;
  return [
    { title: 'Datos de la persona', names: person },
    { title: 'Datos del documento', names: rest },
  ];
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

  const [confirmLeave, setConfirmLeave] = useState(false);
  const hasTypedData = step === STEPS.FORM && !!selectedType && (() => {
    const initial = initialValues(selectedType);
    return Object.entries(formValues).some(([k, v]) => v && v !== initial[k]);
  })();

  function handleCancel() {
    if (hasTypedData) { setConfirmLeave(true); return; }
    handleReset();
  }

  // Si cierra o recarga la pestaña con datos escritos, el navegador pregunta antes
  useEffect(() => {
    if (!hasTypedData) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasTypedData]);

  function handleReset() {
    setConfirmLeave(false);
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

  const currentStep = step === STEPS.SELECT ? 0 : step === STEPS.RESULT ? 3 : reviewing ? 2 : 1;

  // Al cambiar de paso: subir y llevar el foco al título para que el lector de pantalla lo anuncie
  const headingRef = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo(0, 0);
    headingRef.current?.querySelector('h1')?.focus();
  }, [currentStep]);

  const header = {
    0: { eyebrow: 'Crear documento · Paso 1 de 4', title: '¿Qué documento necesitas hacer?', description: 'Elige uno. Te pediremos solo los datos que lleva.' },
    1: { eyebrow: 'Crear documento · Paso 2 de 4', title: selectedType?.name, description: 'Escribe los datos. Podrás revisarlos antes de crear el documento.' },
    2: { eyebrow: 'Crear documento · Paso 3 de 4', title: 'Revisa que todo esté bien', description: 'Así saldrá en el documento. Al crearlo se le asigna un número de radicado.' },
    3: { eyebrow: 'Crear documento · Listo', title: result?.offline ? 'Documento creado en este equipo' : 'Documento creado y guardado', description: null },
  }[currentStep];

  return (
    <AppLayout title="Crear documento" header={false} width="narrow">
      <div ref={headingRef} className="[&_h1]:focus:outline-none [&_h1]:scroll-mt-24">
        <PageHeader eyebrow={header.eyebrow} title={header.title || 'Crear documento'} description={header.description} />
      </div>
      <div className="mb-8">
        <Steps steps={['Documento', 'Datos', 'Revisión', 'Listo']} current={currentStep} />
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title="¿Salir sin crear el documento?"
          message="Se perderán los datos que escribiste en este formulario."
          confirmLabel="Sí, salir"
          cancelLabel="Seguir escribiendo"
          danger
          onConfirm={handleReset}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {/* PASO 1 — Elegir tipo */}
      {step === STEPS.SELECT && (
        <div key="select" className="anim-step">
          {loadingTypes ? (
            <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <SkeletonCard key={i} rows={2} />)}</div>
          ) : docTypes.length === 0 ? (
            <EmptyState title="Todavía no hay documentos configurados" message="Pide al administrador de la JAL que los agregue." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {docTypes.map((type, i) => (
                <li key={type.id} className="flex"><DocTypeCard type={type} index={i} onSelect={handleSelectType} /></li>
              ))}
            </ul>
          )}
          {(typeError || error) && (
            <Notice tone="danger" className="mt-4">
              {typeError ? 'No se pudo cargar la lista de documentos. Recarga la página para intentarlo de nuevo.' : error}
            </Notice>
          )}
        </div>
      )}

      {/* PASO 2 y 3 — Datos y revisión */}
      {step === STEPS.FORM && selectedType && (
        <div key={reviewing ? 'review' : 'form'} className="anim-step space-y-6">
          {!isOnline && (
            <Notice tone="info" title="Estás sin conexión">
              El documento se creará en este equipo y podrás descargarlo de una vez. Se enviará al sistema cuando vuelva internet.
            </Notice>
          )}

          {!reviewing ? (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <button type="button" onClick={handleCancel} className="btn-ghost btn-sm -ml-3" disabled={generating}>
                <Icon name="atras" size={18} /> Elegir otro documento
              </button>

              {isAuxiliar && ediles.length > 0 && (
                <div className="card">
                  <label className="label" htmlFor="edil_select">¿A nombre de qué edil sale el documento?</label>
                  <span className="hint" id="edil_hint">Si sale a tu nombre, deja «Ninguno».</span>
                  <select
                    id="edil_select"
                    className="input"
                    aria-describedby="edil_hint"
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
                    <p className="mt-2 text-ink">
                      Saldrá a nombre de <strong>{selectedEdil.name}</strong>, que recibirá un aviso para revisarlo.
                    </p>
                  )}
                </div>
              )}

              {(selectedType.fields?.length ?? 0) > 0 && (
                <div className="sheet p-5 sm:p-8">
                  <p className="mb-6 text-ink-muted">
                    Los campos con <span className="font-semibold text-danger-fg">*</span> son obligatorios.
                  </p>
                  <DynamicForm
                    fields={selectedType.fields}
                    sections={fieldSections(selectedType.fields)}
                    values={formValues}
                    onChange={handleFieldChange}
                    disabled={generating}
                    submitAttempted={submitAttempted}
                    onErrorsChange={setDynErrors}
                  />
                </div>
              )}

              {Object.keys(fills).length > 0 && (
                <Notice
                  tone="info"
                  title={<>Ya atendimos a {person.nombre} con este número.</>}
                  action={
                    <>
                      <button type="button" className="btn-primary btn-sm" onClick={() => { setFormValues((prev) => ({ ...prev, ...fills })); setPerson(null); }}>
                        Usar sus datos
                      </button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setPerson(null)}>No, gracias</button>
                    </>
                  }
                >
                  ¿Llenamos los campos vacíos con sus datos guardados? Revisa que sigan iguales.
                </Notice>
              )}

              {submitAttempted && hasDynErrors && (
                <Notice tone="danger">Falta completar o corregir algunos datos. Están marcados en rojo, junto a cada campo.</Notice>
              )}

              <div className="flex flex-wrap gap-3 border-t border-line pt-6">
                <button type="submit" className="btn-primary">Revisar antes de crear</button>
                <button type="button" className="btn-ghost" onClick={handleCancel}>Cancelar</button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <article className="sheet px-5 py-6 sm:px-10 sm:py-8">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <h2 className="title-section">{selectedType.name}</h2>
                  <Radicado label="Borrador" value="sin radicar" />
                </div>
                <dl>
                  {selectedEdil && (
                    <div className="border-t border-line py-3 sm:grid sm:grid-cols-3 sm:gap-6">
                      <dt className="text-ink-muted">A nombre de</dt>
                      <dd className="font-semibold text-ink sm:col-span-2">{selectedEdil.name}</dd>
                    </div>
                  )}
                  {(selectedType.fields ?? []).map((f) => (
                    <div key={f.name} className="border-t border-line py-3 sm:grid sm:grid-cols-3 sm:gap-6">
                      <dt className="text-ink-muted">{f.label}</dt>
                      <dd className="font-semibold text-ink sm:col-span-2 break-words whitespace-pre-line">
                        {displayValue(f, formValues[f.name])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>

              {error && (
                <Notice tone="danger" title="No se pudo crear el documento">
                  {error}
                  {signatureMissing && (
                    selectedEdilId ? (
                      <p className="mt-1">Pídele al edil que inicie sesión y suba su firma desde <strong>Mi perfil</strong>.</p>
                    ) : (
                      <p className="mt-1">
                        <Link to="/perfil" className="link">Ir a Mi perfil para subir tu firma</Link>
                      </p>
                    )
                  )}
                </Notice>
              )}

              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" onClick={handleGenerate} disabled={generating} aria-busy={generating || undefined}>
                  {generating && <Spinner />}
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

      {/* PASO 4 — Resultado: solo se muestra cuando el sistema confirmó la creación */}
      {step === STEPS.RESULT && result && (
        <div key="result" className="anim-step space-y-6">
          <Notice tone={result.offline ? 'info' : 'success'} title={result.offline ? 'Guardado en este equipo, pendiente de enviar' : 'Quedó guardado en el sistema'}>
            {result.offline
              ? 'Se enviará al sistema cuando vuelva internet. Mientras tanto, descárgalo aquí.'
              : <>Lo encuentras cuando quieras en <Link to="/inicio" className="link">Inicio › Mis documentos recientes</Link>.</>}
          </Notice>

          <article className="sheet px-5 py-6 sm:px-10 sm:py-8">
            <h2 className="title-section">{selectedType?.name}</h2>
            {result.beneficiaryName && <p className="text-ink-muted">{result.beneficiaryName}</p>}
            {selectedEdil && <p className="text-ink">A nombre de <strong>{selectedEdil.name}</strong></p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {result.numero_radicado && <Radicado value={result.numero_radicado} stamp />}
              {result.document_number && <span className="text-ink-muted">N.° <strong className="font-mono text-ink">{result.document_number}</strong></span>}
            </div>

            {result?.id && (
              <div className="mt-6 border-t border-line pt-6">
                <h3 className="mb-3 font-semibold text-ink">Descargar</h3>
                {result.offline && result.offlineBlobError && (
                  <Notice tone="warning" className="mb-3">
                    No se pudo preparar el archivo en este equipo ({result.offlineBlobError}). Podrás descargarlo cuando vuelva internet.
                  </Notice>
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
                        aria-busy={downloading === fmt || undefined}
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
                        {downloading === fmt ? <Spinner /> : <Icon name="descargar" size={18} />}
                        {downloading === fmt ? 'Descargando…' : fmt === 'pdf' ? 'Descargar PDF (para imprimir)' : 'Descargar Word (para editar)'}
                      </button>
                    );
                  })}
                </div>
                {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
              </div>
            )}
          </article>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleReset} className="btn-secondary">Crear otro documento</button>
            <Link to="/inicio" className="btn-ghost">Volver al inicio</Link>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
