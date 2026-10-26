// Flujo de creación: llegar con ?tipo=, fecha de hoy precargada, revisar antes de emitir
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GeneratorPage from '../pages/GeneratorPage';

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

const CERT = {
  id: 't1',
  name: 'Certificado de Residencia',
  active: true,
  fields: [
    { name: 'fecha', label: 'Fecha de expedición', type: 'date', required: true },
    { name: 'nombre_completo', label: 'Nombre completo', type: 'text', required: true },
    { name: 'fecha_cita', label: 'Fecha de la citación', type: 'date', required: false },
  ],
};

vi.mock('../components/ui/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../stores/authStore', () => ({ useAuthStore: () => ({ token: 'tk', user: { role: 'administrador' } }) }));
vi.mock('../stores/syncStore', () => ({ useSyncStore: () => ({ isOnline: true }) }));
vi.mock('../hooks/useDocTypes', () => ({ useDocTypes: () => ({ data: [CERT], loading: false, error: '' }) }));
vi.mock('../hooks/useEdiles', () => ({ useEdiles: () => ({ ediles: [] }) }));
vi.mock('../services/clientDocumentGenerator', () => ({ triggerBlobDownload: vi.fn() }));
vi.mock('../services/documentService', () => ({
  generateDocument: generateMock,
  downloadDocument: vi.fn(),
  cacheEdilSignature: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/generador?tipo=t1']}>
      <GeneratorPage />
    </MemoryRouter>
  );
}

describe('GeneratorPage', () => {
  beforeEach(() => { generateMock.mockReset(); window.scrollTo = vi.fn(); });

  it('abre el formulario desde ?tipo= con la fecha de expedición en hoy y la otra fecha vacía', async () => {
    renderPage();
    const today = new Date().toLocaleDateString('en-CA');
    expect(await screen.findByLabelText(/Fecha de expedición/)).toHaveValue(today);
    expect(screen.getByLabelText(/Fecha de la citación/)).toHaveValue('');
  });

  it('muestra la revisión antes de crear y conserva los datos si falla', async () => {
    const user = userEvent.setup();
    generateMock.mockRejectedValueOnce(new Error('sin servidor'));
    renderPage();

    await user.type(await screen.findByLabelText(/Nombre completo/), 'Ana Pérez');
    await user.click(screen.getByRole('button', { name: 'Revisar antes de crear' }));
    expect(generateMock).not.toHaveBeenCalled();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sí, crear el documento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tus datos siguen aquí');

    await user.click(screen.getByRole('button', { name: 'Corregir datos' }));
    expect(screen.getByLabelText(/Nombre completo/)).toHaveValue('Ana Pérez');

    generateMock.mockResolvedValueOnce({ id: 'd1', numero_radicado: '2026-X-1' });
    await user.click(screen.getByRole('button', { name: 'Revisar antes de crear' }));
    await user.click(screen.getByRole('button', { name: 'Sí, crear el documento' }));
    await waitFor(() => expect(screen.getByText(/Documento creado y guardado/)).toBeInTheDocument());
    expect(screen.getByText('2026-X-1')).toBeInTheDocument();
    expect(generateMock).toHaveBeenLastCalledWith(expect.objectContaining({ beneficiaryName: 'Ana Pérez' }));
  });

  it('no deja pasar a la revisión si falta un campo obligatorio', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Revisar antes de crear' }));
    expect(screen.getByText(/Falta completar o corregir/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí, crear el documento' })).not.toBeInTheDocument();
  });
});
