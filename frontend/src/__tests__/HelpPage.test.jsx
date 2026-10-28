// Ayuda: cada rol ve solo las guías de lo que puede hacer
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HelpPage from '../pages/HelpPage';

const { authState } = vi.hoisted(() => ({ authState: { user: { role: 'auxiliar' } } }));

vi.mock('../components/ui/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../stores/authStore', () => ({ useAuthStore: () => authState }));

function renderAs(role) {
  authState.user = { role };
  return render(<MemoryRouter><HelpPage /></MemoryRouter>);
}

describe('HelpPage', () => {
  it('el auxiliar ve cómo crear documentos y hacerlos a nombre de un edil, no las tareas de administración', () => {
    renderAs('auxiliar');
    expect(screen.getByText('Crear un documento')).toBeInTheDocument();
    expect(screen.getByText('Hacer un documento a nombre de un edil')).toBeInTheDocument();
    expect(screen.queryByText('Buscar y revisar documentos')).not.toBeInTheDocument();
    expect(screen.queryByText('Agregar a una persona del equipo')).not.toBeInTheDocument();
  });

  it('el edil ve cómo revisar, pero no cómo agregar usuarios', () => {
    renderAs('edil');
    expect(screen.getByText('Buscar y revisar documentos')).toBeInTheDocument();
    expect(screen.queryByText('Agregar a una persona del equipo')).not.toBeInTheDocument();
  });

  it('el administrador ve todas las tareas de administración', () => {
    renderAs('administrador');
    expect(screen.getByText('Agregar a una persona del equipo')).toBeInTheDocument();
    expect(screen.getByText('Tareas del administrador')).toBeInTheDocument();
    expect(screen.getByText('Preguntas frecuentes')).toBeInTheDocument();
  });
});
