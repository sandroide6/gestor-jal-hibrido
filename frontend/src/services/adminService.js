import { api } from './api';

export const fetchAdminStats = (token) => api.get('/admin/stats', { token });
export const fetchAuditLogs  = (params, token) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) qs.set(k, v); });
  return api.get(`/admin/audit-logs?${qs}`, { token });
};

export function downloadBackup(token) {
  return api.download(
    '/admin/backup',
    { token },
    `backup_jal_${new Date().toISOString().slice(0, 10)}.zip`
  );
}

export function downloadExportData(token, { dateFrom, dateTo } = {}) {
  const qs = new URLSearchParams();
  if (dateFrom) qs.set('date_from', dateFrom);
  if (dateTo)   qs.set('date_to', dateTo);
  const query = qs.toString() ? `?${qs}` : '';
  return api.download(
    `/admin/export${query}`,
    { token },
    `datos_jal_${new Date().toISOString().slice(0, 10)}.zip`
  );
}
