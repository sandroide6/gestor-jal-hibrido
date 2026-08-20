import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { getJalConfig, updateJalConfig } from '../services/jalConfigService';
import { useAsync } from '../hooks/useAsync';
import { toast } from '../stores/toastStore';
import { SkeletonCard } from '../components/ui/Skeleton';

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
      toast.success('Configuración guardada correctamente.');
    } catch (err) {
      toast.error(err.message || 'Error al guardar la configuración');
    }
  }

  function toggleFeature(key) {
    setValue('features', { ...features, [key]: !features[key] }, { shouldDirty: true });
  }

  if (loading) {
    return (
      <AppLayout title="Configuración de la JAL">
        <div className="max-w-lg space-y-4">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={5} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Configuración de la JAL">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-6">

        {/* Datos generales */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos generales</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nombre de la JAL
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Junta de Acción Local"
                {...register('name', { required: 'El nombre es obligatorio', minLength: 2, maxLength: 200 })}
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Código de dependencia
              </label>
              <input
                type="text"
                className="input-field font-mono"
                placeholder="ej. JALC12"
                {...register('codigo_dependencia', { maxLength: 20, pattern: /^[a-zA-Z0-9]*$/ })}
              />
              <p className="text-xs text-gray-400 mt-1">
                Identifica esta JAL en el número de radicado de los documentos (AÑO-CÓDIGO-TIPO-CONSECUTIVO). Solo letras y números.
              </p>
              {errors.codigo_dependencia && (
                <p className="text-xs text-red-600 mt-1">Solo letras y números, máximo 20 caracteres.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                URL del logo institucional
              </label>
              <input
                type="url"
                className="input-field"
                placeholder="https://..."
                {...register('logo_url', { maxLength: 500 })}
              />
              {logoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={logoUrl}
                    alt="Vista previa del logo"
                    className="h-10 w-10 object-contain rounded border border-gray-200 bg-gray-50"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <span className="text-xs text-gray-400">Vista previa</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature flags */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Módulos activos</h2>
          <div className="space-y-3">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!features[key]}
                  onClick={() => toggleFeature(key)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
                    transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-jal-blue-500 focus:ring-offset-1
                    ${features[key] ? 'bg-jal-blue-500' : 'bg-gray-300'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0
                      transition duration-200 ease-in-out
                      ${features[key] ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>

        {(loadError) && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {loadError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="btn-primary w-full"
        >
          {isSubmitting ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>
    </AppLayout>
  );
}
