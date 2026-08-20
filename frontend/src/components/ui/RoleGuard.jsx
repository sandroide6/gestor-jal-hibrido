import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function RoleGuard({ children, requireAuth = false, roles = [] }) {
  const { isAuthenticated, hasRole } = useAuthStore();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Acceso restringido</h2>
          <p className="text-sm text-gray-600">
            No tienes permisos para acceder a esta sección.
          </p>
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
