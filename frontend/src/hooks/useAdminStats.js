import { fetchAdminStats } from '../services/adminService';
import { useAsync } from './useAsync';

export function useAdminStats(token) {
  return useAsync(() => fetchAdminStats(token), [token]);
}
