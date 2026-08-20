import { api } from './api.js';

export const getProfile    = (token)         => api.get('/users/me', { token });
export const updateProfile = (data, token)   => api.patch('/users/me', data, { token });
export const uploadFirma   = (file, token)   => {
  const form = new FormData();
  form.append('firma', file);
  return api.post('/users/me/firma', form, { token, isFormData: true });
};
export const deleteFirma   = (token)         => api.delete('/users/me/firma', { token });
export const getFirmaUrl   = ()              => `${import.meta.env.VITE_API_URL || ''}/users/me/firma`;
