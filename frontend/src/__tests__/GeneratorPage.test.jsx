// GeneratorPage — un clic en el tipo abre el formulario, fecha de expedición por defecto, recientes
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GeneratorPage, { initialFormValues } from '../pages/GeneratorPage';

const DOC_TYPE = {
  id: 't1', name: 'Certificado de Residencia', active: true,
  fields: [
    { name: 'fecha', label: 'Fecha de expedición', type: 'date', required: true },
    { name: 'Nombre', label: 'Nombre completo', type: 'text', required: true },
  ],
};

vi.mock('../stores/authStore', () => ({ useAuthStore: () => ({ token: 't', user: { role: 'edil' } }) }));
vi.mock('../stores/syncStore', () => ({ useSyncStore: () => ({ isOnline: true }) }));
vi.mock('../hooks/useDocTypes', () => ({ useDocTypes: () => ({ data: [DOC_TYPE], loading: false, error: '' }) }));
vi.mock('../hooks/useEdiles', () => ({ useEdiles: () => ({ ediles: [] }) }));
vi.mock('../components/ui/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../services/documentService', () => ({
  generateDocument: vi.fn(),
  downloadDocument: vi.fn(),
  cacheEdilSignature: vi.fn(),
  fetchMyRecentDocuments: vi.fn(async () => [
    { id: 'd1', doc_type_name: 'Comunicado Oficial', beneficiary_name: 'Ana Pérez', numero_radicado: 'S-2026-0001', created_at: '2026-10-20T10:00:00Z' },
  ]),
}));

const today = new Date().toLocaleDateString('en-CA');

describe('initialFormValues()', () => {
  it('pone hoy solo en la fecha del documento, no en fechas de eventos', () => {
    expect(initialFormValues([
      { name: 'fecha', label: 'Fecha', type: 'date' },
      { name: 'f2', label: 'Fecha de expedición', type: 'date' },
      { name: 'f3', label: 'Fecha de la citación', type: 'date' },
      { name: 'f4', label: 'Fecha de inicio', type: 'date' },
      { name: 'n', label: 'Fecha', type: 'text' },
    ])).toEqual({ fecha: today, f2: today });
  });
});

describe('GeneratorPage', () => {
  it('muestra los documentos recientes y abre el formulario con un solo clic', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><GeneratorPage /></MemoryRouter>);

    expect(await screen.findByText(/Comunicado Oficial — Ana Pérez/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continuar/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Certificado de Residencia/ }));

    expect(screen.getByLabelText(/Fecha de expedición/)).toHaveValue(today);
    expect(screen.getByLabelText(/Nombre completo/)).toHaveValue('');
    expect(screen.getByRole('button', { name: /generar documento/i })).toBeInTheDocument();
  });
});
