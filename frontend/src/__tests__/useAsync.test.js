// PT-13: Hook useAsync — estados loading / data / error / reload
import { renderHook, waitFor } from '@testing-library/react';
import { useAsync } from '../hooks/useAsync';

describe('useAsync', () => {
  it('empieza en estado loading', () => {
    const { result } = renderHook(() =>
      useAsync(() => new Promise(() => {}), [])
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('');
  });

  it('resuelve data correctamente', async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.resolve({ id: 1, name: 'Test' }), [])
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ id: 1, name: 'Test' });
    expect(result.current.error).toBe('');
  });

  it('captura errores correctamente', async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject(new Error('Fallo de red')), [])
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Fallo de red');
  });

  it('usa mensaje genérico si error no tiene .message', async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject({}), [])
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Error desconocido');
  });

  it('reload vuelve a ejecutar la función', async () => {
    let callCount = 0;
    const { result } = renderHook(() =>
      useAsync(() => { callCount++; return Promise.resolve(callCount); }, [])
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(1);

    result.current.reload();
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(callCount).toBe(2);
  });

  it('re-ejecuta cuando cambian las deps', async () => {
    let dep = 'a';
    const fn = vi.fn(() => Promise.resolve(dep));
    const { result, rerender } = renderHook(() => useAsync(fn, [dep]));

    await waitFor(() => expect(result.current.data).toBe('a'));
    expect(fn).toHaveBeenCalledTimes(1);

    dep = 'b';
    rerender();
    await waitFor(() => expect(result.current.data).toBe('b'));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
