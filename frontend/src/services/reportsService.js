import { api } from './api';

export async function fetchReportStats(filters, token) {
  const params = new URLSearchParams();
  if (filters.doc_type_id)    params.set('doc_type_id', filters.doc_type_id);
  if (filters.user_id)        params.set('user_id', filters.user_id);
  if (filters.date_from)      params.set('date_from', filters.date_from);
  if (filters.date_to)        params.set('date_to', filters.date_to);
  if (filters.reviewed !== '') params.set('reviewed', filters.reviewed);
  return api.get(`/reports/stats?${params}`, { token });
}

export async function downloadDocumentsReport(filters, token) {
  const params = new URLSearchParams();
  if (filters.doc_type_id) params.set('doc_type_id', filters.doc_type_id);
  if (filters.user_id)     params.set('user_id', filters.user_id);
  if (filters.date_from)   params.set('date_from', filters.date_from);
  if (filters.date_to)     params.set('date_to', filters.date_to);
  if (filters.reviewed !== '') params.set('reviewed', filters.reviewed);

  await api.download(
    `/reports/documents?${params}`,
    { token },
    `reporte_documentos_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
