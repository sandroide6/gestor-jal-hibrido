import { api } from './api';

const BASE = '/backup/drive';

export const backupService = {
  getConfig:         (token)            => api.get(`${BASE}/config`, { token }),
  saveConfig:        (data, token)      => api.put(`${BASE}/config`, data, { token }),
  getAuthUrl:        (token)            => api.get(`${BASE}/auth-url`, { token }),
  disconnect:        (token)            => api.delete(`${BASE}/disconnect`, { token }),
  runBackup:         (token)            => api.post(`${BASE}/run`, {}, { token }),
  getLogs:           (token)            => api.get(`${BASE}/logs`, { token }),
  getLocalFiles:     (token)            => api.get(`${BASE}/local-files`, { token }),
  openFolder:        (token)            => api.post(`${BASE}/open-folder`, {}, { token }),
  downloadLocalFile: (filename, token)  =>
    api.download(`${BASE}/local-files/${encodeURIComponent(filename)}`, { token }, filename),
};
