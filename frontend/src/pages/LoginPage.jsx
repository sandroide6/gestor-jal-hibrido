import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import AuthShell from '../components/ui/AuthShell';
import Notice from '../components/ui/Notice';
import SpinnerIcon from '../components/ui/Spinner';
import Icon from '../components/ui/Icon';

// En el plan gratis de Render el backend se duerme tras ~15 min sin uso y tarda
// ~30-60s en despertar. Mientras tanto el login falla por red o con 502/503/504
// (el proxy de Vercel se cansa de esperar). En vez de mostrar un error, reintentamos
// solos durante un rato y le explicamos al usuario qué está pasando.
const WAKE_RETRY_MS = 5000;
const WAKE_MAX_MS   = 90_000;
const SLOW_HINT_MS  = 4000;

function isWakingError(err) {
  return !err?.status || [502, 503, 504].includes(err.status);
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

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
  const [waking, setWaking]       = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const { login } = useAuthStore();
  const navigate  = useNavigate();

  // Intenta el login; si el servidor está despertando, reintenta cada WAKE_RETRY_MS
  // hasta WAKE_MAX_MS. Cualquier otro error (401, 423, 500…) se lanza enseguida.
  async function loginWaitingForServer(email, password) {
    const deadline = Date.now() + WAKE_MAX_MS;
    const slowTimer = setTimeout(() => { if (mountedRef.current) setWaking(true); }, SLOW_HINT_MS);
    try {
      for (;;) {
        try {
          return await login(email, password, rememberMe);
        } catch (err) {
          const canRetry = isWakingError(err) && navigator.onLine && Date.now() < deadline && mountedRef.current;
          if (!canRetry) throw err;
          setWaking(true);
          await sleep(WAKE_RETRY_MS);
        }
      }
    } finally {
      clearTimeout(slowTimer);
      if (mountedRef.current) setWaking(false);
    }
  }

  async function onPasswordSubmit({ email, password }) {
    try {
      const result = await loginWaitingForServer(email, password);
      if (result?.requires2fa) {
        setTempToken(result.tempToken);
        setStep('2fa');
      } else {
        if (!result.consent_accepted_at) {
          navigate('/habeas-data', { replace: true });
        } else {
          navigate('/inicio', { replace: true });
        }
      }
    } catch (err) {
      const msg = err.status === 423                       ? err.message
                : err.status === 401 || err.status === 400 ? 'Correo o contraseña incorrectos'
                : !navigator.onLine                        ? 'Sin conexión. No es posible iniciar sesión en modo offline.'
                : isWakingError(err)                       ? 'El servidor no terminó de despertar. Espera un momento e intenta de nuevo.'
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
      navigate('/inicio', { replace: true });
    } catch (err) {
      setTotpError(err.status === 401 ? 'Código incorrecto. Intenta de nuevo.' : 'Error al verificar. Intenta de nuevo.');
      setTotpCode('');
    } finally {
      setTotpLoading(false);
    }
  }

  const aside = (
    <ul className="space-y-4 text-white/90">
      {[
        'Crea certificados y cartas con los datos de cada persona.',
        'Encuentra cualquier documento por nombre, cédula o radicado.',
        'Sigue trabajando aunque se caiga internet: se envía al volver.',
      ].map((t) => (
        <li key={t} className="flex gap-3"><Icon name="check" className="mt-1 text-accent-200" />{t}</li>
      ))}
    </ul>
  );

  return (
    <AuthShell aside={aside}>
      {step === 'password' ? (
        <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-5" noValidate>
          <div className="mb-2">
            <p className="eyebrow mb-2">Acceso del personal</p>
            <h1 className="title-page">Iniciar sesión</h1>
            <p className="mt-1 text-ink-muted">Usa el correo y la contraseña que te dio el administrador de la JAL.</p>
          </div>
          <div>
            <label className="label" htmlFor="email">Correo electrónico</label>
            <input
              id="email" type="email" className="input"
              placeholder="nombre@correo.com"
              autoComplete="username" disabled={isSubmitting}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email', { required: 'Ingresa tu correo electrónico' })}
            />
            {errors.email && <p id="email-error" className="field-error">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password" type="password" className="input"
              autoComplete="current-password" disabled={isSubmitting}
              aria-invalid={errors.password ? 'true' : undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password', { required: 'Ingresa tu contraseña' })}
            />
            {errors.password && <p id="password-error" className="field-error">{errors.password.message}</p>}
          </div>
          <label htmlFor="remember_me" className="flex min-h-[44px] cursor-pointer items-center gap-3 text-ink">
            <input
              id="remember_me" type="checkbox"
              className="h-5 w-5 rounded accent-brand"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isSubmitting}
            />
            Recordarme en este equipo
          </label>
          {waking && (
            <Notice tone="info" title="El servidor se está despertando">
              Pasa después de un rato sin uso y puede tardar hasta un minuto. Seguimos intentando solos; no cierres la página.
            </Notice>
          )}
          {errors.root && (
            <Notice tone="danger">{errors.root.message}</Notice>
          )}
          <button type="submit" className="btn-primary btn-block" disabled={isSubmitting} aria-busy={isSubmitting || undefined}>
            {isSubmitting
              ? <Spinner text={waking ? 'Despertando el servidor…' : 'Verificando…'} />
              : 'Iniciar sesión'}
          </button>
          <p className="text-[0.9375rem] text-ink-muted">¿Olvidaste tu contraseña? Habla con el administrador de la JAL.</p>
        </form>
      ) : (
        <form onSubmit={handleTotpSubmit} className="space-y-5" noValidate>
          <div>
            <p className="eyebrow mb-2">Paso 2 de 2</p>
            <h1 className="title-page">Verificación en dos pasos</h1>
            <p className="mt-1 text-ink-muted">Abre tu app autenticadora y escribe el código de 6 dígitos.</p>
          </div>
          <div>
            <label className="label" htmlFor="totp">Código de verificación</label>
            <input
              id="totp" type="text" inputMode="numeric" pattern="\d{6}"
              className="input text-center font-mono text-2xl tracking-[0.4em]"
              placeholder="000000" maxLength={6}
              value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              required autoComplete="one-time-code" autoFocus disabled={totpLoading}
            />
          </div>
          {totpError && <Notice tone="danger">{totpError}</Notice>}
          <button type="submit" className="btn-primary btn-block" disabled={totpLoading || totpCode.length !== 6}>
            {totpLoading ? <Spinner text="Verificando…" /> : 'Verificar'}
          </button>
          <button type="button" className="btn-ghost btn-block"
            onClick={() => { setStep('password'); setTotpError(''); setTotpCode(''); }}>
            ← Volver al inicio de sesión
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function Spinner({ text }) {
  return (
    <span className="flex items-center gap-2 justify-center">
      <SpinnerIcon />
      {text}
    </span>
  );
}
Spinner.propTypes = { text: PropTypes.string.isRequired };
