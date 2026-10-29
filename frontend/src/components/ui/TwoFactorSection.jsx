import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../services/api';
import StatusBadge from './StatusBadge';
import Spinner from './Spinner';

export default function TwoFactorSection({ token, onFlash }) {
  const [step, setStep]       = useState('idle'); // idle | setup | confirm | disable
  const [qrCode, setQrCode]   = useState('');
  const [secret, setSecret]   = useState('');
  const [code, setCode]       = useState('');
  const [enabled, setEnabled] = useState(null); // null = desconocido
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users/me', { token })
      .then((d) => setEnabled(d.totp_enabled ?? false))
      .catch(() => {});
  }, [token]);

  async function handleSetup() {
    setLoading(true);
    try {
      const data = await api.post('/auth/2fa/setup', {}, { token });
      setQrCode(data.qrCode);
      setSecret(data.manualCode);
      setStep('setup');
    } catch (err) {
      onFlash('err', err.message);
    } finally { setLoading(false); }
  }

  async function handleEnable(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/2fa/enable', { token: code }, { token });
      setEnabled(true);
      setStep('idle');
      setCode('');
      onFlash('ok', '2FA activado. Tu cuenta ahora requiere código al iniciar sesión.');
    } catch (err) {
      onFlash('err', err.message);
    } finally { setLoading(false); }
  }

  async function handleDisable(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { token: code }, { token });
      setEnabled(false);
      setStep('idle');
      setCode('');
      onFlash('ok', '2FA desactivado.');
    } catch (err) {
      onFlash('err', err.message);
    } finally { setLoading(false); }
  }

  const cancel = (
    <button type="button" onClick={() => { setStep('idle'); setCode(''); }} className="btn-ghost">
      Cancelar
    </button>
  );

  return (
    <section className="card" aria-labelledby="titulo-2fa">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-2fa" className="title-section">Verificación en dos pasos</h2>
        {enabled !== null && (
          <StatusBadge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Activada' : 'Desactivada'}</StatusBadge>
        )}
      </div>
      <p className="mb-5 max-w-prose text-ink-muted">
        Una protección extra: además de la contraseña, al entrar se pide un código de 6 números que genera una app del celular (Google Authenticator o Authy).
      </p>

      {step === 'idle' && !enabled && (
        <button type="button" onClick={handleSetup} disabled={loading} className="btn-primary" aria-busy={loading || undefined}>
          {loading && <Spinner />}
          {loading ? 'Preparando…' : 'Activar verificación en dos pasos'}
        </button>
      )}

      {step === 'idle' && enabled && (
        <button type="button" onClick={() => setStep('disable')} className="btn-danger-outline">
          Desactivar verificación en dos pasos
        </button>
      )}

      {step === 'setup' && (
        <ol className="space-y-5">
          <li>
            <p className="font-semibold">1. Escanea este código con la app del celular</p>
            {qrCode && (
              <img src={qrCode} alt="Código QR para configurar la verificación en dos pasos" className="mt-3 h-48 w-48 rounded-md border border-line bg-white p-2" />
            )}
            <details className="mt-3">
              <summary className="link cursor-pointer">¿No puedes escanearlo? Escribe el código a mano</summary>
              <p className="mt-2 select-all break-all rounded-md border border-line bg-sunken p-3 font-mono">{secret}</p>
            </details>
          </li>
          <li>
            <label htmlFor="codigo-activar" className="font-semibold">2. Escribe el código de 6 números que muestra la app</label>
            <form onSubmit={handleEnable} className="mt-2 flex flex-wrap items-center gap-2">
              <input
              id="codigo-activar" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
              className="input w-40 text-center font-mono text-lg tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus required
            />
              <button type="submit" disabled={loading || code.length !== 6} className="btn-primary" aria-busy={loading || undefined}>
                {loading && <Spinner />}
                {loading ? 'Verificando…' : 'Confirmar y activar'}
              </button>
              {cancel}
            </form>
          </li>
        </ol>
      )}

      {step === 'disable' && (
        <div>
          <label htmlFor="codigo-desactivar" className="font-semibold">Para desactivarla, escribe el código que muestra la app</label>
          <form onSubmit={handleDisable} className="mt-2 flex flex-wrap items-center gap-2">
            <input
              id="codigo-desactivar" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
              className="input w-40 text-center font-mono text-lg tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus required
            />
            <button type="submit" disabled={loading || code.length !== 6} className="btn-danger" aria-busy={loading || undefined}>
              {loading && <Spinner />}
              {loading ? 'Verificando…' : 'Desactivar'}
            </button>
            {cancel}
          </form>
        </div>
      )}
    </section>
  );
}
TwoFactorSection.propTypes = {
  token: PropTypes.string.isRequired,
  onFlash: PropTypes.func.isRequired,
};
