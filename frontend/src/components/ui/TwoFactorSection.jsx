import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../services/api';

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-gray-800">Verificación en dos pasos (2FA)</h2>
        {enabled !== null && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {enabled ? 'Activado' : 'Desactivado'}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Añade una capa extra de seguridad. Al iniciar sesión necesitarás el código de tu app autenticadora (Google Authenticator, Authy).
      </p>

      {/* Estado: desactivado */}
      {step === 'idle' && !enabled && (
        <button onClick={handleSetup} disabled={loading}
          className="bg-jal-blue-500 text-white text-sm px-5 py-2 rounded-lg hover:bg-jal-blue-600 disabled:opacity-50 transition-colors">
          {loading ? 'Generando…' : 'Activar 2FA'}
        </button>
      )}

      {/* Estado: activado */}
      {step === 'idle' && enabled && (
        <button onClick={() => setStep('disable')}
          className="border border-red-300 text-red-600 text-sm px-5 py-2 rounded-lg hover:bg-red-50 transition-colors">
          Desactivar 2FA
        </button>
      )}

      {/* Paso 1: mostrar QR */}
      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 font-medium">1. Escanea este código QR con tu app autenticadora:</p>
          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="QR 2FA" className="w-48 h-48 border border-gray-200 rounded-lg p-2" />
            </div>
          )}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">¿No puedes escanear? Ingresa el código manualmente</summary>
            <p className="mt-2 font-mono bg-gray-50 border border-gray-200 rounded p-2 break-all select-all">{secret}</p>
          </details>
          <p className="text-sm text-gray-700 font-medium">2. Ingresa el código de 6 dígitos para confirmar:</p>
          <form onSubmit={handleEnable} className="flex gap-2">
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center w-36 focus:outline-none focus:ring-2 focus:ring-jal-blue-500"
              placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus required
            />
            <button type="submit" disabled={loading || code.length !== 6}
              className="bg-jal-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-jal-blue-600 disabled:opacity-50 transition-colors">
              {loading ? 'Verificando…' : 'Confirmar y activar'}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setCode(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 px-2">
              Cancelar
            </button>
          </form>
        </div>
      )}

      {/* Desactivar: pedir código */}
      {step === 'disable' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Ingresa el código de tu app autenticadora para desactivar 2FA:</p>
          <form onSubmit={handleDisable} className="flex gap-2">
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center w-36 focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus required
            />
            <button type="submit" disabled={loading || code.length !== 6}
              className="bg-red-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
              {loading ? 'Verificando…' : 'Desactivar'}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setCode(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 px-2">
              Cancelar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
TwoFactorSection.propTypes = {
  token: PropTypes.string.isRequired,
  onFlash: PropTypes.func.isRequired,
};
