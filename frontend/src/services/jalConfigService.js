import { api } from './api';

export const getJalConfig    = (token)         => api.get('/admin/jal-config', { token });
export const updateJalConfig = (data, token)   => api.patch('/admin/jal-config', data, { token });
