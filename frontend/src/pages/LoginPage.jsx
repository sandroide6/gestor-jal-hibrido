import { useState } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

const ROLE_REDIRECT = {
  administrador: '/admin',
  edil: '/edil',
  auxiliar: '/generador',
};


export default function LoginPage() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  const [step, setStep]           = useState('password');
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode]   = useState('');
  const [totpError, setTotpError] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { login } = useAuthStore();
  const navigate  = useNavigate();

  async function onPasswordSubmit({ email, password }) {
    try {
      const result = await login(email, password, rememberMe);
      if (result?.requires2fa) {
        setTempToken(result.tempToken);
        setStep('2fa');
      } else {
        if (!result.consent_accepted_at) {
          navigate('/habeas-data', { replace: true });
        } else {
          navigate(ROLE_REDIRECT[result.role] || '/', { replace: true });
        }
      }
    } catch (err) {
      const msg = err.status === 423                       ? err.message
                : err.status === 401 || err.status === 400 ? 'Correo o contraseña incorrectos'
                : !navigator.onLine                        ? 'Sin conexión. No es posible iniciar sesión en modo offline.'
                :                                            'Error al conectar con el servidor. Intente de nuevo.';
      setError('root', { message: msg });
    }
  }

  async function handleTotpSubmit(e) {
    e.preventDefault();
    setTotpError('');
    setTotpLoading(true);
    try {
      const data = await api.post('/auth/2fa/validate', { tempToken, token: totpCode });
      const { completeLogin } = useAuthStore.getState();
      await completeLogin(data.user);
      navigate(ROLE_REDIRECT[data.user.role] || '/', { replace: true });
    } catch (err) {
      setTotpError(err.status === 401 ? 'Código incorrecto. Intenta de nuevo.' : 'Error al verificar. Intenta de nuevo.');
      setTotpCode('');
    } finally {
      setTotpLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-jal-blue-500 to-jal-blue-700 p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-jal-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
              <span className="text-white text-2xl font-bold select-none">
                {(import.meta.env.VITE_JAL_SHORT || 'JAL').slice(0, 3)}
              </span>
            </div>
            <h1 className="text-xl font-bold text-jal-blue-500">
              {import.meta.env.VITE_JAL_NOMBRE || 'Gestor JAL'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Junta Administradora Local — Medellín</p>
          </div>

          {step === 'password' ? (
            <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4" noValidate>
              <div>
                <label className="label" htmlFor="email">Correo electrónico</label>
                <input
                  id="email" type="email" className="input"
                  placeholder="auxiliar@jal.gov.co"
                  autoComplete="username" disabled={isSubmitting}
                  {...register('email', { required: 'Ingresa tu correo electrónico' })}
                />
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="password">Contraseña</label>
                <input
                  id="password" type="password" className="input"
                  placeholder="••••••••"
                  autoComplete="current-password" disabled={isSubmitting}
                  {...register('password', { required: 'Ingresa tu contraseña' })}
                />
                {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="remember_me" type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-jal-blue-500 focus:ring-jal-blue-400"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isSubmitting}
                />
                <label htmlFor="remember_me" className="text-sm text-gray-600 select-none">
                  Recordarme en este dispositivo
                </label>
              </div>
              {errors.root && (
                <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errors.root.message}
                </div>
              )}
              <button type="submit" className="btn-primary w-full mt-2" disabled={isSubmitting}>
                {isSubmitting ? <Spinner text="Verificando…" /> : 'Iniciar sesión'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTotpSubmit} className="space-y-4" noValidate>
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-jal-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-jal-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="font-semibold text-gray-800">Verificación en dos pasos</h2>
                <p className="text-sm text-gray-500 mt-1">Abre tu app autenticadora e ingresa el código de 6 dígitos</p>
              </div>
              <div>
                <label className="label" htmlFor="totp">Código de verificación</label>
                <input
                  id="totp" type="text" inputMode="numeric" pattern="\d{6}"
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="000000" maxLength={6}
                  value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  required autoComplete="one-time-code" autoFocus disabled={totpLoading}
                />
              </div>
              {totpError && (
                <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {totpError}
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={totpLoading || totpCode.length !== 6}>
                {totpLoading ? <Spinner text="Verificando…" /> : 'Verificar'}
              </button>
              <button type="button" className="w-full text-sm text-gray-500 hover:text-gray-700 mt-1"
                onClick={() => { setStep('password'); setTotpError(''); setTotpCode(''); }}>
                ← Volver al inicio de sesión
              </button>
            </form>
          )}

          <p className="text-xs text-center text-gray-400 mt-6">
            Sistema institucional — acceso restringido al personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner({ text }) {
  return (
    <span className="flex items-center gap-2 justify-center">
      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      {text}
    </span>
  );
}
Spinner.propTypes = { text: PropTypes.string.isRequired };
