import { api } from './api';

export async function fetchDocuments(filters, token) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== '' && v !== undefined && v !== null) params.append(k, v);
  });
  const qs = params.toString();
  return api.get(`/documents${qs ? `?${qs}` : ''}`, { token });
}

export async function fetchAuxiliares(token) {
  const users = await api.get('/users', { token });
  return users.filter((u) => u.role === 'auxiliar' || u.role === 'administrador');
}

export async function fetchDocTypes(token) {
  return api.get('/doc-types', { token });
}

export async function markReviewed(docId, token) {
  return api.patch(`/documents/${docId}/review`, {}, { token });
}

export async function fetchPendingCount(token) {
  const { count } = await api.get('/documents/pending-review-count', { token });
  return count;
}

