import { fetchUsers } from '../services/usersService';
import { useAsync } from './useAsync';

// Por defecto carga hasta 200 usuarios (suficiente para filtros/dropdowns).
// Para paginación explícita, pasa { page, limit } y usa el resultado raw.
export function useUsers(token, params = { limit: 200 }) {
  return useAsync(
    () => fetchUsers(token, params).then((r) => r?.data ?? r),
    [token, JSON.stringify(params)],
  );
}
