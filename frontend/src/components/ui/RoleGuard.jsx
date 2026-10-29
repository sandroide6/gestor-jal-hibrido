import PropTypes from 'prop-types';
import { Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function RoleGuard({ children, requireAuth = false, roles = [] }) {
  const { isAuthenticated, hasRole } = useAuthStore();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="card max-w-md text-center">
          <p className="eyebrow justify-center mb-2">Sin permiso</p>
          <h2 className="title-section mb-2">Acceso restringido</h2>
          <p className="text-ink-muted">
            Tu usuario no tiene permiso para esta sección. Si lo necesitas, pídeselo al administrador de la JAL.
          </p>
          <Link to="/inicio" className="btn-primary mt-5">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return children;
}

RoleGuard.propTypes = {
  children:    PropTypes.node.isRequired,
  requireAuth: PropTypes.bool,
  roles:       PropTypes.arrayOf(PropTypes.string),
};
