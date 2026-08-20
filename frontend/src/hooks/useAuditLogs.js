import { fetchAuditLogs } from '../services/adminService';
import { useAsync } from './useAsync';

export function useAuditLogs(params, token) {
  return useAsync(
    () => fetchAuditLogs(params, token),
    [token, JSON.stringify(params)],
  );
}
