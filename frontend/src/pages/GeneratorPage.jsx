import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { generateDocument, downloadDocument, cacheEdilSignature, fetchMyRecentDocuments } from '../services/documentService';
import { triggerBlobDownload } from '../services/clientDocumentGenerator';
import { useDocTypes } from '../hooks/useDocTypes';
import { useEdiles } from '../hooks/useEdiles';
import { useAsync } from '../hooks/useAsync';
import { formatDateTime } from '../utils/format';
import DynamicForm from '../components/forms/DynamicForm';
import AppLayout from '../components/ui/AppLayout';
import EmptyState from '../components/ui/EmptyState';

const STEPS = { SELECT: 'select', FORM: 'form', RESULT: 'result' };

// La fecha del propio documento (expedición) arranca en hoy; las fechas de eventos
// (citación, inicio, fin…) no se adivinan. El usuario la ve y puede cambiarla.
export function initialFormValues(fields = []) {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local
  const values = {};
  for (const f of fields) {
    if (f.type === 'date' && (/expedici/i.test(f.label) || /^fecha$/i.test(f.label.trim()))) values[f.name] = today;
  }
  return values;
}

export default function GeneratorPage() {
  const { token, user } = useAuthStore();
  const { isOnline } = useSyncStore();
  const isAuxiliar = user?.role === 'auxiliar';

  const { data: allTypes, loading: loadingTypes, error: typeError } = useDocTypes(token);
  const docTypes = (allTypes ?? []).filter((t) => t.active);
  const { ediles } = useEdiles(isAuxiliar ? token : null);

  const [step, setStep] = useState(STEPS.SELECT);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedEdilId, setSelectedEdilId] = useState('');

  // Campos del formulario
  const [formValues, setFormValues] = useState({});

  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Validación
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [dynErrors, setDynErrors] = useState({});

  const hasDynErrors = Object.values(dynErrors).some(Boolean);
  const canSubmit = !hasDynErrors;

  // Un clic en el tipo abre directamente su formulario (antes: seleccionar + "Continuar")
  function handleSelectType(type) {
    setSelectedType(type);
    setFormValues(initialFormValues(type.fields));
    setResult(null);
    setError('');
    setSubmitAttempted(false);
    setDynErrors({});
    setStep(STEPS.FORM);
  }

  function handleFieldChange(name, value) {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }

  function getBeneficiaryFromForm() {
    const fields = selectedType?.fields ?? [];
    const nameField = fields.find((f) => /^(nombre|nombre_completo|nombre_titular)$/i.test(f.name));
    const idField   = fields.find((f) => /^(cedula|numerodocumento|numero_documento)$/i.test(f.name));
    // Para documentos sin beneficiario personal, usar destinatario/entidad como referencia
    const fallbackField = fields.find((f) => /^(destinatario|nombre_entidad|entidad)$/i.test(f.name));
    return {
      beneficiaryName: nameField
        ? (formValues[nameField.name] ?? '').trim()
        : (fallbackField ? (formValues[fallbackField.name] ?? '').trim() : ''),
      beneficiaryId: idField ? (formValues[idField.name] ?? '').trim() : '',
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) return;
    setError('');
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
      setError(err.message || 'Error al generar el documento');
    } finally {
      setGenerating(false);
    }
  }

  // Vuelve al inicio; el edil elegido se conserva (sigue visible en el formulario)
  function handleReset() {
    setStep(STEPS.SELECT);
    setSelectedType(null);
    setResult(null);
    setError('');
    setFormValues({});
    setSubmitAttempted(false);
    setDynErrors({});
  }

  const selectedEdil = ediles.find((e) => e.id === selectedEdilId);

  // Sin esta lista el auxiliar no tenía cómo volver a descargar un documento ya generado
  const { data: recentDocs = [] } = useAsync(
    () => (isOnline && step === STEPS.SELECT ? fetchMyRecentDocuments(token) : Promise.resolve([])),
    [token, isOnline, step],
  );

  async function handleDownload(docId, fmt, name, offlineBlob) {
    setDownloading(`${docId}:${fmt}`);
    try {
      if (offlineBlob) triggerBlobDownload(offlineBlob, name);
      else await downloadDocument(docId, fmt, token, name);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading('');
    }
  }

  // Cachear la firma del edil para uso offline
  useEffect(() => {
    if (!selectedEdilId || !token) return;
    cacheEdilSignature(selectedEdilId, token);
  }, [selectedEdilId, token]);

  return (
    <AppLayout title="Generador de Documentos">
      {/* Breadcrumb de pasos */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-5 flex-wrap">
        <span className={step === STEPS.SELECT ? 'text-jal-blue-500 font-semibold' : ''}>1. Tipo de documento</span>
        <span>›</span>
        <span className={step === STEPS.FORM ? 'text-jal-blue-500 font-semibold' : ''}>2. Datos</span>
        <span>›</span>
        <span className={step === STEPS.RESULT ? 'text-jal-blue-500 font-semibold' : ''}>3. Listo</span>
      </div>

      {/* PASO 1 — Tipo de documento: un clic abre el formulario */}
      {step === STEPS.SELECT && (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              ¿Qué documento necesitas?
            </h2>
            {loadingTypes ? (
              <p className="text-sm text-gray-400">Cargando tipos de documento…</p>
            ) : docTypes.length === 0 ? (
              <EmptyState message="No hay tipos de documento configurados para esta JAL." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {docTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type)}
                    className="card text-left transition-all cursor-pointer group hover:border-jal-blue-300 hover:shadow-md"
                  >
                    <p className="font-semibold text-sm text-jal-blue-500 group-hover:text-jal-blue-600">
                      {type.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {(type.fields || []).length} campo(s)
                    </p>
                  </button>
                ))}
              </div>
            )}
            {(typeError || error) && (
              <p className="text-sm text-red-600 mt-4">{typeError || error}</p>
            )}
          </div>

          {recentDocs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-3">Tus documentos recientes</h2>
              <ul className="card divide-y divide-gray-100 p-0">
                {recentDocs.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        {doc.doc_type_name} — {doc.beneficiary_name || 'sin nombre'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(doc.created_at)}{doc.numero_radicado ? ` · Radicado ${doc.numero_radicado}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {['pdf', 'docx'].map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          className="text-xs text-jal-blue-500 hover:underline disabled:opacity-50"
                          disabled={!!downloading}
                          onClick={() => handleDownload(doc.id, fmt, `${doc.doc_type_name}_${doc.beneficiary_name}.${fmt}`)}
                        >
                          {downloading === `${doc.id}:${fmt}` ? 'Descargando…' : `Descargar .${fmt}`}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* PASO 2 — Formulario */}
      {step === STEPS.FORM && selectedType && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={handleReset} className="text-sm text-jal-blue-400 hover:underline">
              ← Elegir otro tipo
            </button>
            <h2 className="text-lg font-semibold text-gray-800">{selectedType.name}</h2>
            {selectedEdil && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {selectedEdil.name}
              </span>
            )}
          </div>

          {!isOnline && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-4">
              Estás sin conexión. El documento se generará localmente y podrás descargarlo
              inmediatamente. Se sincronizará con el servidor al reconectarte.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {isAuxiliar && ediles.length > 0 && (
              <div className="card">
                <label className="label" htmlFor="edil_select">
                  Edil a nombre del cual se generará el documento
                </label>
                <select
                  id="edil_select"
                  className="input"
                  value={selectedEdilId}
                  onChange={(e) => setSelectedEdilId(e.target.value)}
                  disabled={generating}
                >
                  <option value="">— Sin edil asignado —</option>
                  {ediles.map((edil) => (
                    <option key={edil.id} value={edil.id}>
                      {edil.name}{edil.cargo_titulo ? ` — ${edil.cargo_titulo}` : ''}
                    </option>
                  ))}
                </select>
                {selectedEdilId && (
                  <p className="text-xs text-amber-700 mt-2">
                    El documento se generará a nombre de <strong>{selectedEdil?.name}</strong> y se le notificará para que lo revise.
                  </p>
                )}
              </div>
            )}

            {(selectedType.fields?.length ?? 0) > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">
                  Datos del documento
                </h3>
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

            {error && (
              <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={generating}>
                {generating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Generando…
                  </span>
                ) : (
                  'Generar documento'
                )}
              </button>
              <button type="button" className="btn-secondary" onClick={handleReset} disabled={generating}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PASO 3 — Resultado */}
      {step === STEPS.RESULT && result && (
        <div>
          <div className="card border-green-200 bg-green-50 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-green-500 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-800 text-sm">
                  {result.offline
                    ? 'Documento guardado localmente'
                    : 'Documento generado exitosamente'}
                </p>
                <p className="text-sm text-green-700 mt-0.5">
                  <strong>{result.beneficiaryName}</strong> — {selectedType?.name}
                </p>
                {selectedEdil && (
                  <p className="text-xs text-green-600 mt-0.5">
                    A nombre de: <strong>{selectedEdil.name}</strong>
                  </p>
                )}
                {result.numero_radicado && (
                  <p className="text-xs text-green-600 mt-1 font-mono">
                    Radicado <strong>{result.numero_radicado}</strong>
                  </p>
                )}
                {result.document_number && (
                  <p className="text-xs text-green-600 mt-1 font-mono">
                    N.° <strong>{result.document_number}</strong>
                  </p>
                )}
                {result.offline && (
                  <p className="text-xs text-amber-700 mt-1">
                    Se sincronizará automáticamente cuando se recupere la conexión.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Botones de descarga */}
          {result?.id && (
            <div className="card mb-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Descargar documento</h3>
              {result.offline && result.offlineBlobError && (
                <p className="text-xs text-amber-600 mb-2">
                  No se pudo generar el archivo localmente ({result.offlineBlobError}). Estará disponible al sincronizarse.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {['pdf', 'docx'].map((fmt) => {
                  const offlineBlob = result.offline ? result.offlineBlobs?.[fmt] : null;
                  if (result.offline && !offlineBlob) return null;
                  const key = `${result.id}:${fmt}`;
                  return (
                    <button
                      key={fmt}
                      disabled={!!downloading}
                      onClick={() => handleDownload(result.id, fmt, `${selectedType?.name}_${result.beneficiaryName}.${fmt}`, offlineBlob)}
                      className={fmt === 'pdf' ? 'btn-primary' : 'btn-secondary'}
                    >
                      {downloading === key ? 'Descargando…' : `Descargar .${fmt}`}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {result.offline
                  ? 'Queda guardado en este equipo y se subirá al sistema al recuperar la conexión.'
                  : 'Queda guardado en el sistema: puedes volver a descargarlo desde "Tus documentos recientes" en la pantalla de inicio del generador.'}
              </p>
              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => handleSelectType(selectedType)} className="btn-primary">
              Otro documento de este tipo
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Elegir otro tipo
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
