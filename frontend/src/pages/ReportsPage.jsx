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

const PALETTE = ['#1e4d8c', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#ef4444'];
const EMPTY_FILTERS = { doc_type_id: '', user_id: '', date_from: '', date_to: '', reviewed: '' };

// ── Componentes reutilizables ─────────────────────────────

function StatCard({ label, value, sub, color = 'text-jal-blue-600' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
    </div>
  );
}

function ChartCard({ title, children, minH = 220 }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <div style={{ minHeight: minH }}>{children}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[200px]">
      {label && <p className="font-semibold text-gray-700 mb-1 truncate">{label}</p>}
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
        <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          {entry.value}: <strong>{entry.payload.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function EmptyChart({ text = 'Sin datos para el período seleccionado' }) {
  return (
    <div className="flex items-center justify-center h-36 text-sm text-gray-400">{text}</div>
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
      toast.success('Reporte descargado correctamente.');
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
    <AppLayout title="Reportes">

      {/* ── Filtros ── */}
      <form onSubmit={handleApply} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="label">Tipo de documento</label>
            <select className="input text-xs" value={filters.doc_type_id} onChange={(e) => setField('doc_type_id', e.target.value)}>
              <option value="">Todos</option>
              {docTypes.map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Auxiliar</label>
            <select className="input text-xs" value={filters.user_id} onChange={(e) => setField('user_id', e.target.value)}>
              <option value="">Todos</option>
              {auxiliares.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input text-xs" value={filters.date_from} onChange={(e) => setField('date_from', e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input text-xs" value={filters.date_to} onChange={(e) => setField('date_to', e.target.value)} />
          </div>
          <div>
            <label className="label">Revisión</label>
            <select className="input text-xs" value={filters.reviewed} onChange={(e) => setField('reviewed', e.target.value)}>
              <option value="">Todos</option>
              <option value="true">Revisados</option>
              <option value="false">Sin revisar</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button type="submit" className="btn-primary text-xs" disabled={loadingStats}>
            {loadingStats ? 'Cargando…' : 'Aplicar filtros'}
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={handleClear} disabled={loadingStats}>
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loadingExcel || loadingStats}
            className="ml-auto flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {loadingExcel ? 'Generando…' : 'Exportar Excel'}
          </button>
        </div>
      </form>

      {/* ── Loader ── */}
      {loadingStats && (
        <div className="flex justify-center items-center h-52">
          <div className="animate-spin w-9 h-9 border-4 border-jal-blue-200 border-t-jal-blue-600 rounded-full" />
        </div>
      )}

      {/* ── Dashboard ── */}
      {!loadingStats && stats && (
        <div className="space-y-5">

          {/* Tarjetas resumen */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total documentos"      value={stats.total}    color="text-jal-blue-600" />
            <StatCard label="Revisados"             value={stats.reviewed} sub={`${pct}% del total`} color="text-green-600" />
            <StatCard label="Pendientes de revisión" value={stats.pending}  color="text-amber-500" />
          </div>

          {stats.total === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center text-sm text-gray-400">
              No hay documentos para los filtros seleccionados.
            </div>
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
                        <Cell fill="#22c55e" />
                        <Cell fill="#f59e0b" />
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
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => v.length > 20 ? `${v.slice(0, 19)}…` : v}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="reviewed" name="Revisados"  stackId="a" fill="#22c55e" />
                        <Bar dataKey="pending"  name="Pendientes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
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
                          <stop offset="5%"  stopColor="#1e4d8c" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#1e4d8c" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(d) => {
                          const [, m, day] = d.split('-');
                          return `${day}/${m}`;
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="Documentos"
                        stroke="#1e4d8c"
                        strokeWidth={2}
                        fill="url(#areaGrad)"
                        dot={stats.byDay.length <= 20 ? { r: 3, fill: '#1e4d8c' } : false}
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
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v.length > 22 ? `${v.slice(0, 21)}…` : v}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Documentos" radius={[0, 4, 4, 0]}>
                        {stats.byUser.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Solo un auxiliar */}
              {stats.byUser.length === 1 && (
                <ChartCard title="Auxiliar" minH={60}>
                  <p className="text-sm text-gray-600 py-2">
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
