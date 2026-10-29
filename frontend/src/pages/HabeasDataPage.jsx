import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import AuthShell from '../components/ui/AuthShell';
import Notice from '../components/ui/Notice';
import Spinner from '../components/ui/Spinner';


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
      navigate('/inicio', { replace: true });
    } catch {
      setError('No se pudo registrar el consentimiento. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="space-y-5">
        <div>
          <p className="eyebrow mb-2">Antes de empezar · una sola vez</p>
          <h1 className="title-page">Política de privacidad y Habeas Data</h1>
          <p className="mt-1 text-ink-muted">Ley 1581 de 2012 — República de Colombia</p>
        </div>

        <div tabIndex={0} aria-label="Texto de la política de privacidad" className="sheet max-h-[22rem] space-y-3 overflow-y-auto p-5 text-ink">
          <p>
            En cumplimiento de la <strong>Ley 1581 de 2012</strong> y el Decreto Reglamentario 1377 de 2013,
            la {import.meta.env.VITE_JAL_NOMBRE || 'Junta Administradora Local'} informa que sus datos personales
            serán tratados conforme a los siguientes principios:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
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
          <p className="text-ink-muted">
            Al continuar, declara haber leído y aceptado esta política de privacidad y autoriza
            el tratamiento de sus datos personales conforme a lo aquí descrito.
          </p>
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        <button type="button" className="btn-primary btn-block" onClick={handleAccept} disabled={loading} aria-busy={loading || undefined}>
          {loading && <Spinner />}
          {loading ? 'Registrando…' : 'He leído y acepto la política de privacidad'}
        </button>
      </div>
    </AuthShell>
  );
}
