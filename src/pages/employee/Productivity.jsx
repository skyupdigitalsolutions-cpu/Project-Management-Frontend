import { useEffect, useState, useCallback } from 'react'
import {
  Activity, Clock, Coffee, TrendingUp, CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight, MonitorSmartphone, FolderKanban, Save,
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { PageHeader, StatCard, Spinner, EmptyState } from '../../components/common/UI'

// Quick-pick reasons, mirroring the presets the desktop tracker used to show.
const PRESETS = ['Meeting', 'Client call', 'Tea / lunch break', 'Power or internet issue', 'Personal break']

const fmtDur = (sec) => {
  const m = Math.max(1, Math.round((sec || 0) / 60))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h}h ${String(m % 60).padStart(2, '0')}m`
}
const fmtHrs = (sec) => {
  const h = Math.floor((sec || 0) / 3600)
  const m = Math.floor(((sec || 0) % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}
const fmtClock = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

const isoDay = (d) => format(d, 'yyyy-MM-dd')

export default function EmployeeProductivity() {
  const [date, setDate] = useState(() => new Date())
  const [summary, setSummary] = useState(null)
  const [stretches, setStretches] = useState([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({})     // entry_id -> reason text being edited
  const [saving, setSaving] = useState({})      // entry_id -> bool

  const dayStr = isoDay(date)
  const isToday = dayStr === isoDay(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, idleRes] = await Promise.all([
        api.get('/tracker/my/summary', { params: { date: dayStr } }),
        api.get('/tracker/my/idle-stretches', { params: { date: dayStr } }),
      ])
      setSummary(sumRes.data.data || null)
      const list = idleRes.data.data || []
      setStretches(list)
      // Seed drafts with any already-saved reasons so editing starts from them.
      const seeded = {}
      list.forEach((s) => { seeded[s.entry_id] = s.reason || '' })
      setDrafts(seeded)
    } catch {
      toast.error('Failed to load your productivity')
    } finally {
      setLoading(false)
    }
  }, [dayStr])

  useEffect(() => { load() }, [load])

  const shiftDay = (days) => {
    setDate((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + days)
      // Never let the picker move into the future.
      return next > new Date() ? d : next
    })
  }

  const setDraft = (id, val) => setDrafts((p) => ({ ...p, [id]: val }))

  const saveReason = async (entry_id) => {
    const reason = String(drafts[entry_id] || '').trim()
    if (!reason) return toast.error('Please enter a reason')
    setSaving((p) => ({ ...p, [entry_id]: true }))
    try {
      await api.post('/tracker/my/idle-reason', { entry_id, reason })
      setStretches((list) =>
        list.map((s) =>
          s.entry_id === entry_id ? { ...s, reason, answered: true, answered_at: new Date().toISOString() } : s
        )
      )
      toast.success('Reason saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save reason')
    } finally {
      setSaving((p) => ({ ...p, [entry_id]: false }))
    }
  }

  const pending = stretches.filter((s) => !s.answered).length
  const productivePct = summary?.productive_pct ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Productivity"
        subtitle="Your tracked time for the day, and where you can explain each idle stretch."
        action={
          <div className="flex items-center gap-2">
            <button className="btn-secondary !px-2" onClick={() => shiftDay(-1)} title="Previous day">
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              className="input !py-2 !w-auto"
              value={dayStr}
              max={isoDay(new Date())}
              onChange={(e) => e.target.value && setDate(new Date(e.target.value))}
            />
            <button
              className="btn-secondary !px-2 disabled:opacity-40"
              onClick={() => shiftDay(1)}
              disabled={isToday}
              title="Next day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="Tracked" value={fmtHrs(summary?.total_sec)} icon={Clock} color="primary"
              trend={`${fmtHrs(summary?.tracked_sec)} active`} />
            <StatCard label="Idle" value={fmtHrs(summary?.idle_sec)} icon={Coffee} color="amber"
              trend={`${stretches.length} stretch${stretches.length === 1 ? '' : 'es'}`} />
            <StatCard label="Productive" value={`${productivePct}%`} icon={TrendingUp}
              color={productivePct >= 60 ? 'success' : productivePct >= 35 ? 'amber' : 'danger'}
              trend={`${fmtHrs(summary?.productive_sec)} of active`} />
            <StatCard label="Reasons pending" value={pending} icon={AlertCircle}
              color={pending ? 'danger' : 'success'}
              trend={pending ? 'awaiting your note' : 'all explained'} />
          </div>

          {/* Idle stretches — the reason entry that used to live in the tracker */}
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <Coffee size={18} className="text-warning" />
              <h2 className="text-base font-semibold text-gray-800">Idle stretches</h2>
              {pending > 0 && (
                <span className="badge badge-danger ml-1">{pending} to explain</span>
              )}
            </div>
            <p className="text-sm text-neutral mb-4">
              Every gap of 4 minutes or more shows up here. Add a short note so your manager knows what it was.
            </p>

            {stretches.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No idle stretches"
                description="Nothing to explain for this day — nice work." />
            ) : (
              <div className="space-y-3">
                {stretches.map((s) => {
                  const busy = !!saving[s.entry_id]
                  const draft = drafts[s.entry_id] ?? ''
                  const changed = draft.trim() !== (s.reason || '').trim()
                  return (
                    <div key={s.entry_id}
                      className={`rounded-xl border p-3 sm:p-4 transition-colors ${
                        s.answered ? 'border-green-200 bg-green-50/40' : 'border-yellow-200 bg-yellow-50/40'
                      }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                          <Clock size={15} className="text-neutral" />
                          {fmtClock(s.idle_start)} – {fmtClock(s.idle_end)}
                          <span className="text-neutral font-normal">· {fmtDur(s.duration_sec)}</span>
                        </div>
                        {s.answered ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                            <CheckCircle2 size={14} /> Answered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
                            <AlertCircle size={14} /> Needs a reason
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {PRESETS.map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setDraft(s.entry_id, label)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              draft === label
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          maxLength={300}
                          className="input flex-1"
                          placeholder="What were you doing?"
                          value={draft}
                          onChange={(e) => setDraft(s.entry_id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && changed && !busy) saveReason(s.entry_id) }}
                        />
                        <button
                          className="btn-primary justify-center sm:w-auto"
                          onClick={() => saveReason(s.entry_id)}
                          disabled={busy || !draft.trim() || (!changed && s.answered)}
                        >
                          {busy ? <Spinner size="sm" /> : <Save size={15} />}
                          {s.answered ? (changed ? 'Update' : 'Saved') : 'Save'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Read-only breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <MonitorSmartphone size={18} className="text-primary" />
                <h2 className="text-base font-semibold text-gray-800">Top apps</h2>
              </div>
              {summary?.top_apps?.length ? (
                <ul className="space-y-2">
                  {summary.top_apps.map((a, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          a.category === 'productive' ? 'bg-success'
                            : a.category === 'unproductive' ? 'bg-danger' : 'bg-gray-300'
                        }`} />
                        <span className="truncate text-gray-700">{a.app_name}</span>
                      </span>
                      <span className="text-neutral flex-shrink-0 ml-2">{fmtHrs(a.seconds)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral py-4 text-center">No app activity recorded.</p>
              )}
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <FolderKanban size={18} className="text-primary" />
                <h2 className="text-base font-semibold text-gray-800">Time by project</h2>
              </div>
              {summary?.projects?.length ? (
                <ul className="space-y-2">
                  {summary.projects.map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate text-gray-700">{p.project_name}</span>
                      <span className="text-neutral flex-shrink-0 ml-2">{fmtHrs(p.seconds)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral py-4 text-center">No project time recorded.</p>
              )}
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-neutral px-1">
            <Activity size={13} />
            Idle time is captured automatically by the SkyUp Tracker — you only need to add the reason here.
          </p>
        </>
      )}
    </div>
  )
}