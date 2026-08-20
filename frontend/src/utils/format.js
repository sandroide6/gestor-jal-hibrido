const DEFAULT_DATE_OPTS     = { day: '2-digit', month: '2-digit', year: 'numeric' };
const DEFAULT_DATETIME_OPTS = { dateStyle: 'short', timeStyle: 'medium' };
const LONG_DATE_OPTS        = { year: 'numeric', month: 'long', day: 'numeric' };

export function formatDate(iso, opts) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', opts || DEFAULT_DATE_OPTS);
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', DEFAULT_DATETIME_OPTS);
}

export function formatDateLong(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', LONG_DATE_OPTS);
}
