// PT-17: toastStore — add / remove / tipos de toast
import { useToastStore, toast } from '../stores/toastStore';

beforeEach(() => useToastStore.setState({ toasts: [] }));

describe('toastStore', () => {
  it('agrega un toast correctamente', () => {
    useToastStore.getState().add('Mensaje de prueba', 'success', 0);
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Mensaje de prueba');
    expect(toasts[0].type).toBe('success');
  });

  it('elimina un toast por id', () => {
    const id = useToastStore.getState().add('Borrar', 'info', 0);
    useToastStore.getState().remove(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('puede tener múltiples toasts', () => {
    useToastStore.getState().add('A', 'success', 0);
    useToastStore.getState().add('B', 'error', 0);
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });

  it('toast.success usa tipo success', () => {
    toast.success('Ok!');
    const { toasts } = useToastStore.getState();
    expect(toasts.some((t) => t.type === 'success' && t.message === 'Ok!')).toBe(true);
  });

  it('toast.error usa tipo error', () => {
    toast.error('Fallo');
    const { toasts } = useToastStore.getState();
    expect(toasts.some((t) => t.type === 'error')).toBe(true);
  });

  it('toast.warning usa tipo warning', () => {
    toast.warning('Cuidado');
    const { toasts } = useToastStore.getState();
    expect(toasts.some((t) => t.type === 'warning')).toBe(true);
  });

  it('toast.info usa tipo info', () => {
    toast.info('Info');
    const { toasts } = useToastStore.getState();
    expect(toasts.some((t) => t.type === 'info')).toBe(true);
  });
});
