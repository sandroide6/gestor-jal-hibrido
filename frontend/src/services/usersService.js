import { api } from './api';

export const fetchUsers     = (token, params = {}) => api.get('/users', { token, params });
export const createUser     = (data, token)        => api.post('/users', data, { token });
export const updateUser     = (id, data, token)    => api.patch(`/users/${id}`, data, { token });
export const deleteUser     = (id, token)          => api.delete(`/users/${id}`, { token });
export const hardDeleteUser = (id, token)          => api.delete(`/users/${id}/permanent`, { token });
