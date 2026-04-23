import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardList, ChevronDown, ChevronUp, CheckCircle,
  User, Plus, X, AlertTriangle, Users
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { PageHeader, Spinner, EmptyState } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Root — two tabs: My Report | Team Reports
// ─────────────────────────────────────────────────────────────────────────────
export default function ManagerDailyReports() {
  const [activeTab, setActiveTab] = useState('my')

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Daily Reports"
        subtitle="Submit your own report and review your team's updates"
        icon={ClipboardList}
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl w-fit">
        <TabBtn active={activeTab === 'my'}   onClick={() => setActiveTab('my')}>
          <ClipboardList size={14} /> My Report
        </TabBtn>
        <TabBtn active={activeTab === 'team'} onClick={() => setActiveTab('team')}>
          <Users size={14} /> Team Reports
        </TabBtn>
      </div>

      {activeTab === 'my'   && <MyReportTab />}
      {activeTab === 'team' && <TeamReportsTab />}
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-brand-600 text-gray-800 shadow' : 'text-neutral hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 — Manager submits their own daily report
// ─────────────────────────────────────────────────────────────────────────────
function MyReportTab() {
  const { user }     = useAuth()
  const [todayReport, setTodayReport] = useState(null)
  const [history,     setHistory]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [expanded,    setExpanded]    = useState(null)

  const [form, setForm] = useState({
    summary: '', tasks_completed: [''], blockers: '', plan_for_tomorrow: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [todayRes, histRes] = await Promise.all([
        api.get('/daily-reports/today'),
        api.get('/daily-reports/my?limit=30'),
      ])
      const t = todayRes.data.data
      setTodayReport(t)
      setHistory(histRes.data.data ?? [])
      if (t) {
        setForm({
          summary:           t.summary || '',
          tasks_completed:   t.tasks_completed?.length ? t.tasks_completed : [''],
          blockers:          t.blockers || '',
          plan_for_tomorrow: t.plan_for_tomorrow || '',
        })
      }
    } catch { toast.error('Failed to load your reports') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleTaskChange = (i, val) => {
    const u = [...form.tasks_completed]; u[i] = val
    setForm(f => ({ ...f, tasks_completed: u }))
  }
  const addTask    = () => setForm(f => ({ ...f, tasks_completed: [...f.tasks_completed, ''] }))
  const removeTask = (i) => setForm(f => ({ ...f, tasks_completed: f.tasks_completed.filter((_, idx) => idx !== i) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.summary.trim()) return toast.error('Summary is required')
    setSubmitting(true)
    try {
      await api.post('/daily-reports', {
        ...form,
        tasks_completed: form.tasks_completed.filter(t => t.trim()),
      })
      toast.success(todayReport ? 'Report updated!' : 'Report submitted to admin!')
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit report')
    } finally { setSubmitting(false) }
  }

  const openForm = () => {
    if (!todayReport) setForm({ summary: '', tasks_completed: [''], blockers: '', plan_for_tomorrow: '' })
    setShowForm(true)
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5">
      {/* Today status banner */}
      <div className={`card !p-4 flex items-center gap-4 border ${todayReport ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${todayReport ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
          {todayReport
            ? <CheckCircle size={20} className="text-emerald-400" />
            : <AlertTriangle size={20} className="text-amber-400" />}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${todayReport ? 'text-emerald-300' : 'text-amber-300'}`}>
            {todayReport ? "Today's report submitted ✓" : "Today's report pending"}
          </p>
          <p className="text-xs text-neutral mt-0.5">
            {todayReport
              ? `Submitted ${format(parseISO(todayReport.createdAt), 'hh:mm a')}`
              : 'Submit your daily update so admin can track your progress'}
          </p>
        </div>
        <button onClick={openForm} className="btn-primary py-1.5 text-sm gap-2 flex items-center flex-shrink-0">
          <Plus size={14} />
          {todayReport ? 'Update' : 'Submit'}
        </button>
      </div>

      {/* Submit / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#1a1f2e] border border-gray-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  {todayReport ? 'Update Daily Report' : 'Submit Daily Report'}
                </h2>
                <p className="text-xs text-neutral mt-0.5">{format(new Date(), 'MMMM d, yyyy')} · Visible to Admin</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-neutral hover:text-gray-800 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Summary */}
              <div>
                <label className="block text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">
                  Work Summary <span className="text-red-400">*</span>
                </label>
                <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  rows={3} maxLength={2000} placeholder="Describe what you worked on today..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-slate-600 focus:outline-none focus:border-brand-500 resize-none" />
                <p className="text-xs text-neutral mt-1 text-right">{form.summary.length}/2000</p>
              </div>

              {/* Tasks */}
              <div>
                <label className="block text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">Tasks Completed</label>
                <div className="space-y-2">
                  {form.tasks_completed.map((task, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-neutral text-xs w-4 text-right">{i + 1}.</span>
                      <input value={task} onChange={e => handleTaskChange(i, e.target.value)}
                        placeholder={`Task ${i + 1}...`}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-slate-600 focus:outline-none focus:border-brand-500" />
                      {form.tasks_completed.length > 1 && (
                        <button type="button" onClick={() => removeTask(i)} className="text-neutral hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addTask} className="mt-2 text-xs text-primary hover:text-primary flex items-center gap-1">
                  <Plus size={12} /> Add task
                </button>
              </div>

              {/* Blockers */}
              <div>
                <label className="block text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">Blockers / Issues</label>
                <textarea value={form.blockers} onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))}
                  rows={2} placeholder="Any blockers or challenges? (optional)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-slate-600 focus:outline-none focus:border-brand-500 resize-none" />
              </div>

              {/* Plan for tomorrow */}
              <div>
                <label className="block text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">Plan for Tomorrow</label>
                <textarea value={form.plan_for_tomorrow} onChange={e => setForm(f => ({ ...f, plan_for_tomorrow: e.target.value }))}
                  rows={2} placeholder="What do you plan to work on tomorrow? (optional)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-slate-600 focus:outline-none focus:border-brand-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 gap-2 flex items-center justify-center">
                  {submitting && <Spinner size="sm" />}
                  {todayReport ? 'Update Report' : 'Submit to Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">My Report History</h3>
        {history.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No reports yet" description="Submit your first daily report to get started" />
        ) : (
          <div className="space-y-2">
            {history.map(r => (
              <OwnReportCard key={r._id} report={r}
                expanded={expanded === r._id}
                onToggle={() => setExpanded(expanded === r._id ? null : r._id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 — View employees' reports
// ─────────────────────────────────────────────────────────────────────────────
function TeamReportsTab() {
  const [reports,    setReports]    = useState([])
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState(null)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [filters,    setFilters]    = useState({ user_id: '', from: '', to: '', page: 1 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.user_id) params.append('user_id', filters.user_id)
      if (filters.from)    params.append('from', filters.from)
      if (filters.to)      params.append('to', filters.to)
      params.append('page',  filters.page)
      params.append('limit', 20)
      const res = await api.get(`/daily-reports?${params}`)
      setReports(res.data.data ?? [])
      setPagination(res.data.pagination ?? { total: 0, pages: 1 })
    } catch { toast.error('Failed to load team reports') }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/users?limit=200')
      .then(r => setUsers((r.data.data ?? []).filter(u => u.role === 'employee')))
      .catch(() => {})
  }, [])

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }))
  const todayStr  = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card !p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">Employee</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral" />
             <select
                    value={filters.user_id}
                    onChange={e => setFilter('user_id', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-brand-500 appearance-none"
                  style={{ backgroundColor: '#1e2535' }}
                  >
              <option value="" style={{ backgroundColor: '#1e2535', color: '#fff' }}>All Employees</option>
              {users.filter(u => u.role === 'employee').map(u => (
              <option key={u._id} value={u._id} style={{ backgroundColor: '#1e2535', color: '#fff' }}>{u.name}</option>
              ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">From</label>
            <input type="date" value={filters.from} max={todayStr} onChange={e => setFilter('from', e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">To</label>
            <input type="date" value={filters.to} max={todayStr} onChange={e => setFilter('to', e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-brand-500" />
          </div>
          <button onClick={() => setFilters({ user_id: '', from: '', to: '', page: 1 })} className="btn-secondary py-2 text-sm">
            Clear
          </button>
        </div>
      </div>

      {/* Quick chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilters(f => ({ ...f, from: todayStr, to: todayStr, page: 1 }))}
          className="text-xs px-3 py-1 rounded-full border border-primary/30 text-primary hover:bg-purple-50 transition-colors">
          Today
        </button>
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setFilters(f => ({ ...f, from: format(d, 'yyyy-MM-dd'), to: todayStr, page: 1 })) }}
          className="text-xs px-3 py-1 rounded-full border border-gray-200 text-neutral hover:border-white/20 transition-colors">
          Last 7 Days
        </button>
        <span className="text-xs text-neutral ml-auto">{pagination.total} report{pagination.total !== 1 ? 's' : ''}</span>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : reports.length === 0 ? (
        <div className="card">
          <EmptyState icon={Users} title="No reports found" description="No employee reports match the selected filters" />
        </div>
      ) : (
        <div className="card space-y-2">
          {reports.map(r => (
            <TeamReportCard key={r._id} report={r}
              expanded={expanded === r._id}
              onToggle={() => setExpanded(expanded === r._id ? null : r._id)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setFilters(f => ({ ...f, page: p }))}
              className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
                filters.page === p ? 'bg-brand-500 border-brand-500 text-gray-800' : 'border-gray-200 text-neutral hover:border-white/20'
              }`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared card components
// ─────────────────────────────────────────────────────────────────────────────
function OwnReportCard({ report, expanded, onToggle }) {
  const dateStr = report.date ? format(parseISO(report.date), 'EEEE, MMMM d, yyyy') : '—'
  const isToday = report.date && format(parseISO(report.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
              {dateStr}
              {isToday && <span className="text-xs bg-purple-50 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full">Today</span>}
            </p>
            <p className="text-xs text-neutral mt-0.5 line-clamp-1">{report.summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {expanded ? <ChevronUp size={15} className="text-neutral" /> : <ChevronDown size={15} className="text-neutral" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <Sec label="Summary" content={report.summary} />
          {report.tasks_completed?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">Tasks Completed</p>
              <ul className="space-y-1">
                {report.tasks_completed.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.blockers          && <Sec label="Blockers"          content={report.blockers}          highlight="amber" />}
          {report.plan_for_tomorrow && <Sec label="Plan for Tomorrow" content={report.plan_for_tomorrow} />}
        </div>
      )}
    </div>
  )
}

function TeamReportCard({ report, expanded, onToggle }) {
  const user    = report.user_id
  const dateStr = report.date ? format(parseISO(report.date), 'EEE, MMM d yyyy') : '—'
  const isToday = report.date && format(parseISO(report.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors text-left gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-600/30 flex items-center justify-center text-emerald-300 text-xs font-bold flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">{user?.name || 'Unknown'}</p>
            <span className="text-xs text-neutral">{user?.designation}</span>
            {isToday && <span className="text-xs bg-purple-50 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full">Today</span>}
          </div>
          <p className="text-xs text-neutral mt-0.5 truncate">{dateStr} · {report.summary?.slice(0, 80)}{report.summary?.length > 80 ? '…' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded ? <ChevronUp size={15} className="text-neutral" /> : <ChevronDown size={15} className="text-neutral" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="flex items-center gap-3 text-xs text-neutral flex-wrap">
            <span>{user?.department}</span>
          </div>
          <Sec label="Work Summary" content={report.summary} />
          {report.tasks_completed?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral uppercase tracking-wider mb-1.5">Tasks Completed</p>
              <ul className="space-y-1">
                {report.tasks_completed.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.blockers          && <Sec label="Blockers"          content={report.blockers}          highlight="amber" />}
          {report.plan_for_tomorrow && <Sec label="Plan for Tomorrow" content={report.plan_for_tomorrow} />}
        </div>
      )}
    </div>
  )
}

function Sec({ label, content, highlight }) {
  return (
    <div>
      <p className="text-xs font-semibold text-neutral uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm ${highlight === 'amber' ? 'text-amber-300' : 'text-gray-600'}`}>{content}</p>
    </div>
  )
}
