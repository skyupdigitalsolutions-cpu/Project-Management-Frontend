import { useEffect, useState, useCallback } from 'react'
import { ClipboardList, ChevronDown, ChevronUp, CheckCircle, User } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { PageHeader, Spinner, EmptyState } from '../../components/common/UI'

export default function AdminDailyReports() {
  const [reports,  setReports]  = useState([])
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })

  const [filters, setFilters] = useState({ user_id: '', from: '', to: '', page: 1 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.user_id) params.append('user_id', filters.user_id)
      if (filters.from)    params.append('from', filters.from)
      if (filters.to)      params.append('to', filters.to)
      params.append('page', filters.page)
      params.append('limit', 20)

      const res = await api.get(`/daily-reports?${params}`)
      setReports(res.data.data ?? [])
      setPagination(res.data.pagination ?? { total: 0, pages: 1 })
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/users?limit=200').then(r => setUsers(r.data.data ?? [])).catch(() => {})
  }, [])

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }))

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Daily Reports"
        subtitle={`${pagination.total} report${pagination.total !== 1 ? 's' : ''} found`}
        icon={ClipboardList}
      />

      {/* Filters */}
      <div className="card !p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Employee</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={filters.user_id}
                onChange={e => setFilter('user_id', e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 appearance-none"
              >
                <option value="">All Employees</option>
                {users.filter(u => u.role === 'employee').map(u => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">From</label>
            <input
              type="date" value={filters.from} max={todayStr}
              onChange={e => setFilter('from', e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">To</label>
            <input
              type="date" value={filters.to} max={todayStr}
              onChange={e => setFilter('to', e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            onClick={() => setFilters({ user_id: '', from: '', to: '', page: 1 })}
            className="btn-secondary py-2 text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick-filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilters(f => ({ ...f, from: todayStr, to: todayStr, page: 1 }))}
          className="text-xs px-3 py-1 rounded-full border border-brand-500/30 text-brand-300 hover:bg-brand-500/10 transition-colors"
        >
          Today's Reports
        </button>
        <button
          onClick={() => {
            const d = new Date(); d.setDate(d.getDate() - 7)
            setFilters(f => ({ ...f, from: format(d, 'yyyy-MM-dd'), to: todayStr, page: 1 }))
          }}
          className="text-xs px-3 py-1 rounded-full border border-white/10 text-slate-400 hover:border-white/20 transition-colors"
        >
          Last 7 Days
        </button>
        <button
          onClick={() => {
            const d = new Date(); d.setDate(d.getDate() - 30)
            setFilters(f => ({ ...f, from: format(d, 'yyyy-MM-dd'), to: todayStr, page: 1 }))
          }}
          className="text-xs px-3 py-1 rounded-full border border-white/10 text-slate-400 hover:border-white/20 transition-colors"
        >
          Last 30 Days
        </button>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : reports.length === 0 ? (
        <div className="card">
          <EmptyState icon={ClipboardList} title="No reports found" description="No daily reports match the selected filters" />
        </div>
      ) : (
        <div className="card space-y-2">
          {reports.map(r => (
            <AdminReportCard
              key={r._id}
              report={r}
              expanded={expanded === r._id}
              onToggle={() => setExpanded(expanded === r._id ? null : r._id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setFilters(f => ({ ...f, page: p }))}
              className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
                filters.page === p ? 'bg-brand-500 border-brand-500 text-white' : 'border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminReportCard({ report, expanded, onToggle }) {
  const user    = report.user_id
  const dateStr = report.date ? format(parseISO(report.date), 'EEE, MMM d yyyy') : '—'
  const isToday = report.date && format(parseISO(report.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors text-left gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-300 text-xs font-bold flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{user?.name || 'Unknown'}</p>
            <span className="text-xs text-slate-500">{user?.designation}</span>
            {isToday && <span className="text-xs bg-brand-500/20 text-brand-300 border border-brand-500/30 px-1.5 py-0.5 rounded-full">Today</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{dateStr} · {report.summary?.slice(0, 80)}{report.summary?.length > 80 ? '…' : ''}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span>{user?.department}</span>
            <span>·</span>
            <span>{user?.email}</span>
          </div>

          <ReportSection label="Work Summary" content={report.summary} />
          {report.tasks_completed?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tasks Completed</p>
              <ul className="space-y-1">
                {report.tasks_completed.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.blockers          && <ReportSection label="Blockers"          content={report.blockers}          highlight="amber" />}
          {report.plan_for_tomorrow && <ReportSection label="Plan for Tomorrow" content={report.plan_for_tomorrow} />}
        </div>
      )}
    </div>
  )
}

function ReportSection({ label, content, highlight }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm ${highlight === 'amber' ? 'text-amber-300' : 'text-slate-300'}`}>{content}</p>
    </div>
  )
}
