import { api } from './api';

export const fetchDocTypes  = (token)           => api.get('/doc-types', { token });
export const fetchDocType   = (id, token)       => api.get(`/doc-types/${id}`, { token });
export const createDocType  = (data, token)     => api.post('/doc-types', data, { token, isFormData: true });
export const updateDocType  = (id, data, token) => api.patch(`/doc-types/${id}`, data, { token, isFormData: true });
