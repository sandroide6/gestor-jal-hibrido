import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
  Tooltip, Legend,
} from 'recharts';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { fetchReportStats, downloadDocumentsReport } from '../services/reportsService';
import { useDocTypes } from '../hooks/useDocTypes';
import { useUsers } from '../hooks/useUsers';
import { toast } from '../stores/toastStore';
import Spinner from '../components/ui/Spinner';
import Icon from '../components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';

// Colores de las gráficas tomados de styles/tokens.css (Recharts necesita valores literales).
// Un solo tono por serie: los auxiliares no son categorías distintas, son la misma medida.
const C = {
  brand: '#193B35',
  reviewed: '#2E6B4A',  // --color-success
  pending: '#B07A12',   // --color-warning
  grid: '#E3DED2',      // --color-line
  tick: '#5B6560',      // --color-ink-muted
};
const TICK = { fontSize: 13, fill: C.tick };
const EMPTY_FILTERS = { doc_type_id: '', user_id: '', date_from: '', date_to: '', reviewed: '' };

// ── Componentes reutilizables ─────────────────────────────

function Figure({ label, value, sub }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="text-eyebrow uppercase text-ink-muted">{label}</dt>
      <dd className="mt-1 font-serif text-4xl font-semibold leading-none text-brand">{value ?? '—'}</dd>
      {sub && <dd className="mt-1.5 text-sm text-ink-muted">{sub}</dd>}
    </div>
  );
}

function ChartCard({ title, children, minH = 220 }) {
  return (
    <section className="card p-5">
      <h2 className="title-card mb-4">{title}</h2>
      <div style={{ minHeight: minH }}>{children}</div>
    </section>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-line rounded-lg shadow-float px-3 py-2 text-sm max-w-[200px]">
      {label && <p className="font-semibold text-ink mb-1 truncate">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

function CustomPieLegend({ payload }) {
  return (
    <ul className="flex justify-center gap-4 flex-wrap mt-2">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-1.5 text-sm text-ink-muted">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          {entry.value}: <strong>{entry.payload.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function EmptyChart({ text = 'Sin datos para el período seleccionado' }) {
  return (
    <div className="flex h-36 items-center justify-center text-ink-muted">{text}</div>
  );
}

// ── Página principal ──────────────────────────────────────

export default function ReportsPage() {
  const { token } = useAuthStore();
  const { data: docTypes = [] } = useDocTypes(token);
  const { data: allUsers = [] } = useUsers(token);
  const auxiliares = allUsers.filter((u) => u.role === 'auxiliar' || u.role === 'administrador');

  const [filters, setFilters]       = useState(EMPTY_FILTERS);
  const [applied, setApplied]       = useState(EMPTY_FILTERS);
  const [stats, setStats]           = useState(null);
  const [loadingStats, setLoading]  = useState(true);
  const [loadingExcel, setExcel]    = useState(false);

  const loadStats = useCallback(async (f) => {
    setLoading(true);
    try {
      setStats(await fetchReportStats(f, token));
    } catch (err) {
      toast.error(err.message || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadStats(applied); }, [loadStats]);

  function setField(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  function handleApply(e) {
    e.preventDefault();
    setApplied({ ...filters });
    loadStats(filters);
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    loadStats(EMPTY_FILTERS);
  }

  async function handleDownload() {
    setExcel(true);
    try {
      await downloadDocumentsReport(applied, token);
      toast.success('Reporte en Excel descargado.');
    } catch (err) {
      toast.error(err.message || 'Error al generar el reporte');
    } finally {
      setExcel(false);
    }
  }

  const reviewedPieData = stats ? [
    { name: 'Revisados',  value: stats.reviewed },
    { name: 'Pendientes', value: stats.pending  },
  ] : [];

  const pct = stats?.total ? Math.round((stats.reviewed / stats.total) * 100) : 0;

  return (
    <AppLayout title="Reportes" eyebrow="Cifras del archivo" description="Filtra por tipo, persona o fechas. Lo que veas aquí es lo mismo que se descarga en Excel." width="page">

      {/* ── Filtros ── */}
      <form onSubmit={handleApply} className="card mb-8 p-5" aria-label="Filtros del reporte">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label" htmlFor="r-doc_type_id">Tipo de documento</label>
            <select id="r-doc_type_id" className="input" value={filters.doc_type_id} onChange={(e) => setField('doc_type_id', e.target.value)}>
              <option value="">Todos</option>
              {docTypes.map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="r-user_id">Auxiliar</label>
            <select id="r-user_id" className="input" value={filters.user_id} onChange={(e) => setField('user_id', e.target.value)}>
              <option value="">Todos</option>
              {auxiliares.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="r-date_from">Desde</label>
            <input type="date" id="r-date_from" className="input" value={filters.date_from} onChange={(e) => setField('date_from', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="r-date_to">Hasta</label>
            <input type="date" id="r-date_to" className="input" value={filters.date_to} onChange={(e) => setField('date_to', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="r-reviewed">Revisión</label>
            <select id="r-reviewed" className="input" value={filters.reviewed} onChange={(e) => setField('reviewed', e.target.value)}>
              <option value="">Todos</option>
              <option value="true">Revisados</option>
              <option value="false">Sin revisar</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary" disabled={loadingStats}>
            {loadingStats ? 'Cargando…' : 'Aplicar filtros'}
          </button>
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={loadingStats}>
            Quitar filtros
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loadingExcel || loadingStats}
            className="btn-secondary sm:ml-auto"
            aria-busy={loadingExcel || undefined}
          >
            {loadingExcel ? <Spinner /> : <Icon name="descargar" size={18} />}
            {loadingExcel ? 'Preparando Excel…' : 'Descargar en Excel'}
          </button>
        </div>
      </form>

      {/* ── Loader ── */}
      {loadingStats && (
        <p role="status" className="flex h-52 items-center justify-center gap-2 text-ink-muted">
          <Spinner />Calculando cifras…
        </p>
      )}

      {/* ── Dashboard ── */}
      {!loadingStats && stats && (
        <div className="space-y-6">

          <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            <Figure label="Documentos" value={stats.total} sub="Con los filtros aplicados" />
            <Figure label="Revisados" value={stats.reviewed} sub={`${pct} % del total`} />
            <Figure label="Por revisar" value={stats.pending} sub="Esperan revisión de un edil" />
          </dl>

          {stats.total === 0 ? (
            <EmptyState title="Sin documentos" message="Ningún documento coincide con estos filtros. Prueba con otras fechas o quita los filtros." />
          ) : (
            <>
              {/* Fila 1: donut + tipos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Donut revisados/pendientes */}
                <ChartCard title="Estado de revisión" minH={240}>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={reviewedPieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ percent }) => `${Math.round(percent * 100)}%`}
                        labelLine={false}
                      >
                        <Cell fill={C.reviewed} />
                        <Cell fill={C.pending} />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend content={<CustomPieLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Barras apiladas por tipo */}
                <ChartCard title="Documentos por tipo" minH={240}>
                  {stats.byType.length === 0 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={Math.max(240, stats.byType.length * 46)}>
                      <BarChart
                        layout="vertical"
                        data={stats.byType}
                        margin={{ top: 0, right: 24, left: 4, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.grid} />
                        <XAxis type="number" tick={TICK} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={TICK}
                          tickFormatter={(v) => v.length > 20 ? `${v.slice(0, 19)}…` : v}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 14 }} />
                        <Bar dataKey="reviewed" name="Revisados"  stackId="a" fill={C.reviewed} />
                        <Bar dataKey="pending"  name="Pendientes" stackId="a" fill={C.pending} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* Evolución diaria */}
              {stats.byDay.length > 0 && (
                <ChartCard title="Evolución de documentos por día" minH={200}>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={stats.byDay} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.brand} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={C.brand} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
                      <XAxis
                        dataKey="date"
                        tick={TICK}
                        tickFormatter={(d) => {
                          const [, m, day] = d.split('-');
                          return `${day}/${m}`;
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={TICK} allowDecimals={false} width={28} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="Documentos"
                        stroke={C.brand}
                        strokeWidth={2}
                        fill="url(#areaGrad)"
                        dot={stats.byDay.length <= 20 ? { r: 3, fill: C.brand } : false}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Por auxiliar */}
              {stats.byUser.length > 1 && (
                <ChartCard title="Documentos por auxiliar" minH={140}>
                  <ResponsiveContainer width="100%" height={Math.max(140, stats.byUser.length * 44)}>
                    <BarChart
                      layout="vertical"
                      data={stats.byUser}
                      margin={{ top: 0, right: 24, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.grid} />
                      <XAxis type="number" tick={TICK} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        tick={TICK}
                        tickFormatter={(v) => v.length > 22 ? `${v.slice(0, 21)}…` : v}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Documentos" radius={[0, 4, 4, 0]} fill={C.brand}>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Solo un auxiliar */}
              {stats.byUser.length === 1 && (
                <ChartCard title="Auxiliar" minH={60}>
                  <p className="py-2 text-ink-muted">
                    <strong>{stats.byUser[0].name}</strong> — {stats.byUser[0].total} documento(s)
                  </p>
                </ChartCard>
              )}
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}
