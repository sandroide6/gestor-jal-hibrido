import { useState, useEffect } from 'react';
import { api } from '../services/api';

// `enabled` en vez del token: la sesión viaja en cookies y `token` siempre es null.
export function useEdiles(enabled) {
  const [ediles, setEdiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    api.get('/users/ediles')
      .then(setEdiles)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [enabled]);

  return { ediles, loading, error };
}
