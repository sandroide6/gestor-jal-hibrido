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

// Igual que el backend: los campos tipo fecha (AAAA-MM-DD) salen en formato largo en el documento
export function formatDateFields(fields, data) {
  const out = { ...data };
  for (const f of fields || []) {
    if (f.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(out[f.name] ?? '')) {
      out[f.name] = new Date(`${out[f.name]}T00:00:00Z`).toLocaleDateString('es-CO', { ...LONG_DATE_OPTS, timeZone: 'UTC' });
    }
  }
  return out;
}
