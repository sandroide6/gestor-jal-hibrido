import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import AppLayout from '../components/ui/AppLayout';
import { useAuthStore } from '../stores/authStore';
import { getProfile, updateProfile, uploadFirma, deleteFirma } from '../services/profileService';
import { api } from '../services/api';
import { ROLE_LABEL } from '../constants';
import TwoFactorSection from '../components/ui/TwoFactorSection';
import { formatDateLong } from '../utils/format';
import { SkeletonCard } from '../components/ui/Skeleton';

export default function ProfilePage() {
  const { token, user, setToken, logout } = useAuthStore();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState(null); // { type: 'ok'|'err', text }
  const [firmaUrl, setFirmaUrl] = useState(null);
  const [uploadingFirma, setUploadingFirma] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const fileRef = useRef();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ defaultValues: { name: '', email: '', cargo_titulo: '' } });

  async function loadFirma() {
    try {
      const { data_url } = await api.get('/users/me/firma', { token });
      setFirmaUrl(data_url);
    } catch (err) {
      if (err?.status !== 404) console.error('[Firma] Error al cargar:', err?.message || err);
    }
  }

  useEffect(() => {
    getProfile(token)
      .then((p) => {
        setProfile(p);
        reset({ name: p.name, email: p.email, cargo_titulo: p.cargo_titulo || '' });
        if (p.has_firma) loadFirma();
      })
      .catch(() => setMsg({ type: 'err', text: 'No se pudo cargar el perfil' }))
      .finally(() => setLoading(false));
  }, [token]);

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  async function onSave(values) {
    try {
      const updated = await updateProfile(values, token);
      setProfile((p) => ({ ...p, ...updated }));
      reset({ name: updated.name, email: updated.email, cargo_titulo: updated.cargo_titulo || '' });
      flash('ok', 'Perfil actualizado correctamente');
    } catch (err) {
      flash('err', err.message || 'Error al guardar');
    }
  }

  async function handleFirmaChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFirma(true);
    try {
      await uploadFirma(file, token);
      setProfile((p) => ({ ...p, has_firma: true }));
      await loadFirma();
      flash('ok', 'Firma guardada correctamente');
    } catch (err) {
      flash('err', err.message || 'Error al subir la firma');
    } finally {
      setUploadingFirma(false);
      e.target.value = '';
    }
  }

  async function handleDeleteFirma() {
    if (!confirm('¿Eliminar la firma guardada?')) return;
    try {
      await deleteFirma(token);
      setProfile((p) => ({ ...p, has_firma: false }));
      setFirmaUrl(null);
      flash('ok', 'Firma eliminada');
    } catch (err) {
      flash('err', err.message || 'Error al eliminar');
    }
  }

  if (loading) {
    return (
      <AppLayout title="Mi Perfil">
        <div className="max-w-2xl space-y-4">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={3} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Mi Perfil">
      <div className="max-w-2xl mx-auto space-y-6">

        {msg && (
          <div className={`text-sm px-4 py-3 rounded-lg ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {msg.text}
          </div>
        )}

        {/* Datos básicos */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Datos básicos</h2>

          {/* Rol y JAL (solo lectura) */}
          <div className="grid grid-cols-2 gap-4 mb-5 p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Rol</p>
              <p className="text-sm font-medium text-gray-800">{ROLE_LABEL[profile?.role] || profile?.role}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">JAL</p>
              <p className="text-sm font-medium text-gray-800 truncate">{profile?.jal?.name || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-0.5">Miembro desde</p>
              <p className="text-sm text-gray-700">
                {formatDateLong(profile?.created_at)}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jal-blue-500"
                {...register('name', { required: 'El nombre es obligatorio' })}
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jal-blue-500"
                {...register('email', {
                  required: 'El correo es obligatorio',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo no válido' },
                })}
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Cargo en documentos
                <span className="ml-1 text-gray-400 font-normal">(aparece en las plantillas)</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Presidente(a) de la JAL, Edil(a)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jal-blue-500"
                {...register('cargo_titulo')}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !isDirty}
                className="bg-jal-blue-500 text-white text-sm px-5 py-2 rounded-lg hover:bg-jal-blue-600 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>

        {/* Firma */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Firma digital</h2>
          <p className="text-xs text-gray-500 mb-4">
            Se incrusta automáticamente en los PDF generados. Sube una imagen PNG o JPG de tu firma sobre fondo blanco.
          </p>

          {profile?.has_firma ? (
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-[80px]">
                {firmaUrl && (
                  <img
                    src={firmaUrl}
                    alt="Firma actual"
                    className="max-h-20 max-w-full object-contain"
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingFirma}
                  className="flex-1 sm:flex-none text-sm bg-jal-blue-500 text-white px-4 py-2 rounded-lg hover:bg-jal-blue-600 disabled:opacity-50 transition-colors"
                >
                  {uploadingFirma ? 'Subiendo…' : 'Cambiar firma'}
                </button>
                <button
                  onClick={handleDeleteFirma}
                  className="flex-1 sm:flex-none text-sm border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-jal-blue-400 hover:bg-blue-50/30 transition-colors"
            >
              <div className="text-3xl mb-2 text-gray-400 select-none">✍</div>
              <p className="text-sm text-gray-600 font-medium">
                {uploadingFirma ? 'Subiendo…' : 'Haz clic para subir tu firma'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG o JPG · máx. 5 MB</p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFirmaChange}
          />
        </div>

        {/* Verificación en dos pasos */}
        <TwoFactorSection token={token} onFlash={flash} />

        {/* Seguridad — sesiones */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Sesiones activas</h2>
          <p className="text-xs text-gray-500 mb-4">
            Cierra todas las sesiones abiertas en otros dispositivos o navegadores.
            Tu sesión actual también se cerrará.
          </p>
          <button
            type="button"
            disabled={loggingOutAll}
            className="border border-red-300 text-red-600 text-sm px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            onClick={async () => {
              if (!confirm('¿Cerrar sesión en todos los dispositivos? Deberás iniciar sesión de nuevo.')) return;
              setLoggingOutAll(true);
              try {
                await api.post('/auth/logout-all', {}, { token });
                await logout();
              } catch (err) {
                flash('err', err.message || 'Error al cerrar sesiones');
                setLoggingOutAll(false);
              }
            }}
          >
            {loggingOutAll ? 'Cerrando sesiones…' : 'Cerrar sesión en todos los dispositivos'}
          </button>
        </div>

      </div>
    </AppLayout>
  );
}
