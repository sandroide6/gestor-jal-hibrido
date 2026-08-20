import { fetchDocTypes } from '../services/docTypesService';
import { useAsync } from './useAsync';

export function useDocTypes(token) {
  return useAsync(() => fetchDocTypes(token), [token]);
}
