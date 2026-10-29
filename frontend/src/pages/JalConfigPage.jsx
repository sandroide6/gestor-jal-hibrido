import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { getJalConfig, updateJalConfig } from '../services/jalConfigService';
import { useAsync } from '../hooks/useAsync';
import { toast } from '../stores/toastStore';
import { SkeletonCard } from '../components/ui/Skeleton';
import Notice from '../components/ui/Notice';
import Spinner from '../components/ui/Spinner';

const FEATURE_LABELS = {
  backup:        'Backup automático',
  reports:       'Reportes',
  notifications: 'Notificaciones',
  doc_types:     'Gestión de tipos de documento',
  audit_logs:    'Registro de auditoría',
};

export default function JalConfigPage() {
  const { token } = useAuthStore();
  const { data: config, loading, error: loadError } = useAsync(() => getJalConfig(token), [token]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ defaultValues: { name: '', logo_url: '', codigo_dependencia: '', features: {} } });

  const features  = useWatch({ control, name: 'features', defaultValue: {} });
  const logoUrl   = useWatch({ control, name: 'logo_url', defaultValue: '' });

  useEffect(() => {
    if (config) {
      reset({
        name:               config.name || '',
        logo_url:           config.logo_url || '',
        codigo_dependencia: config.codigo_dependencia || '',
        features:           { ...config.features },
      });
    }
  }, [config, reset]);

  async function onSubmit({ name, logo_url, codigo_dependencia, features: feat }) {
    try {
      await updateJalConfig({ name, logo_url: logo_url || null, codigo_dependencia: codigo_dependencia || null, features: feat }, token);
      reset({ name, logo_url, codigo_dependencia, features: feat });
      toast.success('Configuración guardada.');
    } catch (err) {
      toast.error(err.message || 'Error al guardar la configuración');
    }
  }

  function toggleFeature(key) {
    setValue('features', { ...features, [key]: !features[key] }, { shouldDirty: true });
  }

  const layout = { title: 'Configuración de la JAL', eyebrow: 'Administración', description: 'Datos que aparecen en los documentos y módulos disponibles para el equipo.' };

  if (loading) {
    return (
      <AppLayout {...layout}>
        <div className="space-y-6" role="status" aria-label="Cargando configuración">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={5} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout {...layout}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {loadError && <Notice tone="danger" title="No se pudo cargar la configuración">{loadError}</Notice>}

        <fieldset className="card">
          <legend className="sr-only">Datos generales</legend>
          <h2 className="title-section mb-4" aria-hidden="true">Datos generales</h2>

          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="jal-nombre">Nombre de la JAL</label>
              <input id="jal-nombre" type="text" className="input"
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'jal-nombre-error' : undefined}
                {...register('name', { required: 'Escribe el nombre de la JAL.', minLength: 2, maxLength: 200 })} />
              {errors.name && <p id="jal-nombre-error" className="field-error">{errors.name.message || 'Revisa el nombre (entre 2 y 200 caracteres).'}</p>}
            </div>

            <div>
              <label className="label" htmlFor="jal-codigo">Código de dependencia</label>
              <p className="hint" id="jal-codigo-hint">
                Va dentro del número de radicado (AÑO-CÓDIGO-TIPO-CONSECUTIVO). Solo letras y números, por ejemplo JALC12.
              </p>
              <input id="jal-codigo" type="text" className="input max-w-xs font-mono uppercase"
                aria-invalid={errors.codigo_dependencia ? 'true' : undefined}
                aria-describedby={`jal-codigo-hint${errors.codigo_dependencia ? ' jal-codigo-error' : ''}`}
                {...register('codigo_dependencia', { maxLength: 20, pattern: /^[a-zA-Z0-9]*$/ })} />
              {errors.codigo_dependencia && (
                <p id="jal-codigo-error" className="field-error">Solo letras y números, máximo 20 caracteres.</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="jal-logo">Dirección (URL) del logo institucional</label>
              <p className="hint" id="jal-logo-hint">Opcional. Debe empezar por https://</p>
              <input id="jal-logo" type="url" className="input" aria-describedby="jal-logo-hint"
                {...register('logo_url', { maxLength: 500 })} />
              {logoUrl && (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={logoUrl}
                    alt="Vista previa del logo"
                    className="h-14 w-14 rounded-md border border-line bg-white object-contain p-1"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <span className="text-ink-muted">Vista previa</span>
                </div>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend className="sr-only">Módulos activos</legend>
          <h2 className="title-section mb-1" aria-hidden="true">Módulos activos</h2>
          <p className="mb-4 text-ink-muted">Un módulo apagado deja de mostrarse en el menú.</p>
          <ul className="divide-y divide-line">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
              <li key={key} className="flex min-h-[3.25rem] items-center justify-between gap-4 py-2">
                <span id={`mod-${key}`} className="text-ink">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!features[key]}
                  aria-labelledby={`mod-${key}`}
                  onClick={() => toggleFeature(key)}
                  className={`switch ${features[key] ? 'bg-brand' : 'bg-line-control'}`}
                >
                  <span aria-hidden="true" className={`switch-thumb ${features[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting || !isDirty} className="btn-primary" aria-busy={isSubmitting || undefined}>
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
