import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useEdiles(token) {
  const [ediles, setEdiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    api.get('/users/ediles', { token })
      .then(setEdiles)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return { ediles, loading, error };
}
