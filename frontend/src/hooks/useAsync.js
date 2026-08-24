import { useState, useEffect, useCallback } from 'react';

/**
 * Hook genérico para operaciones asíncronas con estados loading/error/data.
 * `asyncFn` se vuelve a llamar cada vez que cambia alguna dependencia en `deps`.
 */
export function useAsync(asyncFn, deps = []) {
  // `undefined`, no `null`: los componentes que consumen este hook suelen destructurar
  // con un valor por defecto (`const { data: x = [] } = useAsync(...)`) — ese default
  // solo se aplica cuando el valor es `undefined`, nunca con `null` explícito. Con
  // `data: null` aquí, la primera renderización (antes de que la petición resuelva)
  // dejaba pasar `null` sin aplicar el default, y un `.filter()`/`.map()` posterior
  // sobre ese `null` tumbaba la página entera (ver EdilPage/ReportsPage/AuditLogsPage).
  const [state, setState] = useState({ data: undefined, loading: true, error: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    asyncFn()
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((err) => setState({ data: undefined, loading: false, error: err.message || 'Error desconocido' }));
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { ...state, reload: run };
}
