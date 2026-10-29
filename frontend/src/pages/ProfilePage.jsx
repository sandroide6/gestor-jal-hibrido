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
import Notice from '../components/ui/Notice';
import Spinner from '../components/ui/Spinner';
import Icon from '../components/ui/Icon';
import { ConfirmDialog } from '../components/ui/Dialog';

export default function ProfilePage() {
  const { token, user, setToken, logout } = useAuthStore();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState(null); // { type: 'ok'|'err', text }
  const [firmaUrl, setFirmaUrl] = useState(null);
  const [uploadingFirma, setUploadingFirma] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'firma' | 'sesiones'
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
    setConfirm(null);
    try {
      await deleteFirma(token);
      setProfile((p) => ({ ...p, has_firma: false }));
      setFirmaUrl(null);
      flash('ok', 'Firma eliminada.');
    } catch (err) {
      flash('err', err.message || 'Error al eliminar');
    }
  }

  async function handleLogoutAll() {
    setLoggingOutAll(true);
    try {
      await api.post('/auth/logout-all', {}, { token });
      await logout();
    } catch (err) {
      setConfirm(null);
      flash('err', err.message || 'Error al cerrar sesiones');
      setLoggingOutAll(false);
    }
  }

  const layout = { title: 'Mi perfil', eyebrow: 'Cuenta', description: 'Tus datos, tu firma y la seguridad de tu cuenta.' };

  if (loading) {
    return (
      <AppLayout {...layout}>
        <div className="space-y-6" role="status" aria-label="Cargando perfil">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={3} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout {...layout}>
      <div className="space-y-8">
        {msg && (
          <Notice tone={msg.type === 'ok' ? 'success' : 'danger'}>{msg.text}</Notice>
        )}

        <section className="card" aria-labelledby="titulo-datos">
          <h2 id="titulo-datos" className="title-section mb-4">Datos básicos</h2>

          <dl className="mb-6 grid gap-4 rounded-md border border-line bg-sunken p-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-ink-muted">Rol</dt>
              <dd className="font-semibold">{ROLE_LABEL[profile?.role] || profile?.role}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">JAL</dt>
              <dd className="font-semibold">{profile?.jal?.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Miembro desde</dt>
              <dd>{formatDateLong(profile?.created_at)}</dd>
            </div>
          </dl>

          <form onSubmit={handleSubmit(onSave)} className="space-y-5" noValidate>
            <div>
              <label className="label" htmlFor="perfil-nombre">Nombre completo</label>
              <input id="perfil-nombre" type="text" autoComplete="name" className="input"
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'perfil-nombre-error' : undefined}
                {...register('name', { required: 'Escribe tu nombre completo.' })} />
              {errors.name && <p id="perfil-nombre-error" className="field-error">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="perfil-correo">Correo electrónico</label>
              <input id="perfil-correo" type="email" autoComplete="email" className="input"
                aria-invalid={errors.email ? 'true' : undefined}
                aria-describedby={errors.email ? 'perfil-correo-error' : undefined}
                {...register('email', {
                  required: 'Escribe tu correo.',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Revisa el correo: debe tener la forma nombre@dominio.com.' },
                })} />
              {errors.email && <p id="perfil-correo-error" className="field-error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="perfil-cargo">Cargo en los documentos</label>
              <p className="hint" id="perfil-cargo-hint">Aparece debajo de tu firma. Por ejemplo: Presidente(a) de la JAL, Edil(a).</p>
              <input id="perfil-cargo" type="text" className="input" aria-describedby="perfil-cargo-hint" {...register('cargo_titulo')} />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={isSubmitting || !isDirty} className="btn-primary" aria-busy={isSubmitting || undefined}>
                {isSubmitting && <Spinner />}
                {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>

        <section className="card" aria-labelledby="titulo-firma">
          <h2 id="titulo-firma" className="title-section mb-1">Firma</h2>
          <p className="mb-5 max-w-prose text-ink-muted">
            Se pone sola en los PDF que crees. Sube una foto o imagen de tu firma sobre fondo blanco, en PNG o JPG (máximo 5 MB).
          </p>

          {profile?.has_firma ? (
            <div className="space-y-4">
              <div className="flex min-h-[6rem] items-center justify-center rounded-sm border border-line bg-white p-4 shadow-sheet">
                {firmaUrl
                  ? <img src={firmaUrl} alt="Tu firma guardada" className="max-h-20 max-w-full object-contain" />
                  : <span className="text-ink-muted">Cargando firma…</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingFirma} className="btn-secondary" aria-busy={uploadingFirma || undefined}>
                  {uploadingFirma && <Spinner />}
                  {uploadingFirma ? 'Subiendo…' : 'Cambiar firma'}
                </button>
                <button type="button" onClick={() => setConfirm('firma')} className="btn-danger-outline">
                  Eliminar firma
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingFirma}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line-control bg-bg p-8 text-center hover:border-brand hover:bg-brand-tint"
            >
              <Icon name="firma" size={32} className="text-brand" />
              <span className="font-semibold text-brand">{uploadingFirma ? 'Subiendo…' : 'Subir mi firma'}</span>
              <span className="text-ink-muted">Elige la imagen desde tu equipo o celular</span>
            </button>
          )}

          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFirmaChange} aria-label="Archivo de firma" />
        </section>

        <TwoFactorSection token={token} onFlash={flash} />

        <section className="card" aria-labelledby="titulo-sesiones">
          <h2 id="titulo-sesiones" className="title-section mb-1">Sesiones abiertas</h2>
          <p className="mb-5 max-w-prose text-ink-muted">
            Si usaste la cuenta en un equipo ajeno o perdiste el celular, cierra la sesión en todos los dispositivos. También se cerrará aquí.
          </p>
          <button type="button" disabled={loggingOutAll} className="btn-danger-outline" onClick={() => setConfirm('sesiones')}>
            Cerrar sesión en todos los dispositivos
          </button>
        </section>
      </div>

      {confirm === 'firma' && (
        <ConfirmDialog
          danger
          title="¿Eliminar tu firma?"
          message="Los documentos que crees desde ahora no la llevarán hasta que subas otra. Los ya creados no cambian."
          confirmLabel="Eliminar firma"
          onConfirm={handleDeleteFirma}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'sesiones' && (
        <ConfirmDialog
          danger
          busy={loggingOutAll}
          title="¿Cerrar sesión en todos los dispositivos?"
          message="Tendrás que volver a iniciar sesión en este equipo y en los demás."
          confirmLabel={loggingOutAll ? 'Cerrando sesiones…' : 'Cerrar todas'}
          onConfirm={handleLogoutAll}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AppLayout>
  );
}
