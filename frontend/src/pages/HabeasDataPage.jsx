import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

const ROLE_REDIRECT = {
  administrador: '/admin',
  edil: '/edil',
  auxiliar: '/generador',
};

export default function HabeasDataPage() {
  const { token, user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/auth/consent', {}, { token });
      await setUser({ ...user, consent_accepted_at: data.consent_accepted_at });
      navigate(ROLE_REDIRECT[user?.role] || '/', { replace: true });
    } catch {
      setError('No se pudo registrar el consentimiento. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-jal-blue-500 to-jal-blue-700 p-4">
      <div className="w-full max-w-lg">
        <div className="card">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-jal-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-jal-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-800">Política de Privacidad y Habeas Data</h1>
            <p className="text-xs text-gray-500 mt-1">Ley 1581 de 2012 — República de Colombia</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto text-sm text-gray-700 space-y-3 mb-6 border border-gray-200">
            <p>
              En cumplimiento de la <strong>Ley 1581 de 2012</strong> y el Decreto Reglamentario 1377 de 2013,
              la {import.meta.env.VITE_JAL_NOMBRE || 'Junta Administradora Local'} informa que sus datos personales
              serán tratados conforme a los siguientes principios:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Finalidad:</strong> Los datos recopilados se usan exclusivamente para la gestión de documentos y trámites institucionales ante la JAL.</li>
              <li><strong>Legitimación:</strong> El tratamiento está autorizado por la función pública de la JAL y el consentimiento expreso del titular.</li>
              <li><strong>Conservación:</strong> Los datos se conservan durante el tiempo exigido por la normatividad colombiana y el archivo público.</li>
              <li><strong>Destinatarios:</strong> Los datos no se comparten con terceros salvo obligación legal o autorización del titular.</li>
              <li><strong>Derechos:</strong> Usted tiene derecho a conocer, actualizar, rectificar y suprimir su información personal.</li>
            </ul>
            <p>
              <strong>Datos tratados:</strong> nombre completo, número de cédula, correo electrónico institucional y firma digital.
              Estos datos son necesarios para la expedición de documentos oficiales.
            </p>
            <p>
              <strong>Ejercicio de derechos:</strong> Para ejercer sus derechos como titular de datos personales,
              diríjase a la secretaría de la JAL o al correo institucional indicado en la plataforma.
            </p>
            <p className="text-xs text-gray-500">
              Al continuar, declara haber leído y aceptado esta política de privacidad y autoriza
              el tratamiento de sus datos personales conforme a lo aquí descrito.
            </p>
          </div>

          {error && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <button
            type="button"
            className="btn-primary w-full"
            onClick={handleAccept}
            disabled={loading}
          >
            {loading ? 'Registrando…' : 'He leído y acepto la política de privacidad'}
          </button>
        </div>
      </div>
    </div>
  );
}
