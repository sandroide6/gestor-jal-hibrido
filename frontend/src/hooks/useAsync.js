import { useState, useEffect, useCallback } from 'react';

/**
 * Hook genérico para operaciones asíncronas con estados loading/error/data.
 * `asyncFn` se vuelve a llamar cada vez que cambia alguna dependencia en `deps`.
 */
export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    asyncFn()
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((err) => setState({ data: null, loading: false, error: err.message || 'Error desconocido' }));
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { ...state, reload: run };
}
