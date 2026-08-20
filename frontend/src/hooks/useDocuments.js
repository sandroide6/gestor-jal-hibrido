import { fetchDocuments } from '../services/edilService';
import { useAsync } from './useAsync';

export function useDocuments(filters, token) {
  return useAsync(
    () => fetchDocuments(filters, token),
    [token, JSON.stringify(filters)],
  );
}
