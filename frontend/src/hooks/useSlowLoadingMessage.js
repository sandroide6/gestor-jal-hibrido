import { useEffect, useState } from 'react';

const DEFAULT_MESSAGES = [
  'Conectando de forma segura…',
  'Preparando tu entorno…',
  'Casi listo…',
];

// Si `loading` se sostiene más de `delayMs` (ej. el backend despertando tras un cold
// start de Render), empieza a rotar mensajes de estado en vez de dejar un spinner o
// skeleton "congelado" sin explicación. Devuelve `null` mientras no se cumple el plazo.
export function useSlowLoadingMessage(loading, { delayMs = 5000, intervalMs = 2500, messages = DEFAULT_MESSAGES } = {}) {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!loading) {
      setMessage(null);
      return undefined;
    }

    let index = 0;
    let intervalId;
    const timeoutId = setTimeout(() => {
      setMessage(messages[index]);
      intervalId = setInterval(() => {
        index = (index + 1) % messages.length;
        setMessage(messages[index]);
      }, intervalMs);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, delayMs, intervalMs]);

  return message;
}
