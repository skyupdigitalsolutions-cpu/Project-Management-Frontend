/**
 * pages/admin/TrackerDashboard.jsx
 *
 * Desktop tracker productivity dashboard.
 * Reads from the tracker backend routes:
 *   GET /api/tracker/summary?date=YYYY-MM-DD   -> KPIs + per-user split
 *   GET /api/tracker/activity?user_id=&date=   -> one employee's timeline
 *
 * PLACE AT: Project-Management-Frontend/src/pages/admin/TrackerDashboard.jsx
 *
 * Route (in App.jsx, inside the /admin block):
 *   <Route path="tracker" element={<TrackerDashboard />} />
 * Sidebar (in DashboardLayout.jsx admin nav array):
 *   { to: '/admin/tracker', label: 'Productivity', icon: MonitorSmartphone },
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Clock, Activity, TrendingUp, Users as UsersIcon,
  RefreshCw, Download, ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  PageHeader, StatCard, Spinner, EmptyState, Button,
} from '../../components/common/UI'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDuration = (sec = 0) => {
  sec = Math.round(sec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  // Show seconds when they exist, or when nothing else would be shown (e.g. 0s / 45s)
  if (s > 0 || parts.length === 0) parts.push(`${s}s`)
  return parts.join(' ')
}

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

const CATEGORY_COLORS = {
  productive: '#1D9E75',
  neutral: '#B4B2A9',
  unproductive: '#D85A30',
  idle: '#E5E7EB',
}

// Show all entries (only drop sub-second flickers) so exact durations are visible
const buildTimeline = (logs) => {
  return logs
    .filter((l) => l.duration_sec >= 1)
    .map((l) => ({
      ...l,
      label: l.is_idle
        ? 'Idle'
        : l.app_name + (l.window_title ? ` — ${l.window_title}` : ''),
    }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrackerDashboard() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  const loadSummary = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/tracker/summary', { params: { date } })
      setSummary(res.data.data)
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.message || 'Failed to load productivity data')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [date])

  useEffect(() => { loadSummary() }, [loadSummary])

  // Live updates: silent poll every 30s + refetch when the tab regains focus.
  useEffect(() => {
    const POLL_MS = 30000
    const tick = () => {
      if (document.visibilityState === 'visible') loadSummary({ silent: true })
    }
    const id = setInterval(tick, POLL_MS)
    const onFocus = () => loadSummary({ silent: true })
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [loadSummary])

  const fetchTimeline = useCallback(async (userId, { silent = false } = {}) => {
    if (!silent) setTimelineLoading(true)
    try {
      const res = await api.get('/tracker/activity', {
        params: { user_id: userId, date },
      })
      setTimeline(buildTimeline(res.data.data || []))
    } catch (err) {
      if (!silent) { toast.error('Failed to load timeline'); setTimeline([]) }
    } finally {
      if (!silent) setTimelineLoading(false)
    }
  }, [date])

  const openTimeline = (user) => {
    setSelectedUser(user)
    fetchTimeline(user.user_id)
  }

  // Keep the open timeline live too.
  useEffect(() => {
    if (!selectedUser) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTimeline(selectedUser.user_id, { silent: true })
    }, 30000)
    return () => clearInterval(id)
  }, [selectedUser, fetchTimeline])

  const exportCsv = () => {
    if (!summary?.users?.length) return
    const rows = [
      ['Employee', 'Designation', 'Tracked', 'Productive %', 'Neutral %', 'Unproductive %', 'Idle'],
      ...summary.users.map((u) => [
        u.name,
        u.designation || '',
        fmtDuration(u.tracked),
        pct(u.productive, u.tracked),
        pct(u.neutral, u.tracked),
        pct(u.unproductive, u.tracked),
        fmtDuration(u.idle),
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `productivity-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totals = summary?.totals

  return (
    <div>
      <PageHeader
        title="Productivity"
        subtitle="Desktop activity tracked across the team"
        action={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              style={{ width: 'auto' }}
            />
            <Button variant="secondary" onClick={() => loadSummary()}>
              <RefreshCw size={15} className="mr-1.5" /> Refresh
            </Button>
            <Button variant="primary" onClick={exportCsv}>
              <Download size={15} className="mr-1.5" /> Export
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !summary || !summary.users.length ? (
        <EmptyState
          icon={Activity}
          title="No activity recorded"
          description="No desktop tracker data was logged on this date. Make sure employees have the SkyUp Tracker agent installed and running."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Tracked today" value={fmtDuration(totals.tracked_sec)} icon={Clock} color="blue" />
            <StatCard label="Productive" value={`${totals.productive_pct}%`} icon={TrendingUp} color="success" />
            <StatCard label="Idle time" value={fmtDuration(totals.idle_sec)} icon={Activity} color="amber" />
            <StatCard label="Active now" value={totals.active_now} icon={UsersIcon} color="primary" />
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Employees</h2>
              <div className="flex items-center gap-4 text-xs text-neutral">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS.productive }} /> Productive
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS.neutral }} /> Neutral
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS.unproductive }} /> Unproductive
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {summary.users
                .sort((a, b) => b.tracked - a.tracked)
                .map((u) => {
                  const p = pct(u.productive, u.tracked)
                  const n = pct(u.neutral, u.tracked)
                  const up = pct(u.unproductive, u.tracked)
                  return (
                    <button
                      key={u.user_id}
                      onClick={() => openTimeline(u)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 transition-colors rounded-lg px-2"
                    >
                      <div className="w-9 h-9 rounded-full bg-purple-100 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="w-36 shrink-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                        <p className="text-xs text-neutral truncate">{u.designation || '—'}</p>
                      </div>
                      <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-gray-100">
                        <span style={{ width: `${p}%`, background: CATEGORY_COLORS.productive }} />
                        <span style={{ width: `${n}%`, background: CATEGORY_COLORS.neutral }} />
                        <span style={{ width: `${up}%`, background: CATEGORY_COLORS.unproductive }} />
                      </div>
                      <span className="text-sm text-gray-700 w-16 text-right tabular-nums shrink-0">
                        {fmtDuration(u.tracked)}
                      </span>
                      <span className="text-sm font-medium w-12 text-right shrink-0" style={{ color: CATEGORY_COLORS.productive }}>
                        {p}%
                      </span>
                      <ChevronRight size={16} className="text-neutral shrink-0" />
                    </button>
                  )
                })}
            </div>
          </div>

          {selectedUser && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  {selectedUser.name} — timeline
                </h2>
                <button onClick={() => setSelectedUser(null)} className="text-sm text-neutral hover:text-gray-700">
                  Close
                </button>
              </div>

              {timelineLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : !timeline.length ? (
                <p className="text-sm text-neutral py-6 text-center">No detailed activity for this day.</p>
              ) : (
                <>
                  <div className="flex gap-0.5 mb-2 h-6 rounded overflow-hidden">
                    {timeline.map((b) => (
                      <span
                        key={b._id}
                        title={`${b.label} (${fmtDuration(b.duration_sec)})`}
                        style={{
                          flex: b.duration_sec,
                          background: b.is_idle
                            ? CATEGORY_COLORS.idle
                            : CATEGORY_COLORS.productive,
                          minWidth: '2px',
                        }}
                      />
                    ))}
                  </div>
                  <div className="max-h-72 overflow-y-auto mt-4 divide-y divide-gray-100">
                    {timeline.map((b) => (
                      <div key={b._id} className="flex items-center gap-3 py-2 text-sm">
                        <span className="text-neutral w-28 shrink-0 tabular-nums">
                          {format(new Date(b.start), 'h:mm a')}
                        </span>
                        <span className="flex-1 truncate text-gray-700">{b.label}</span>
                        {b.task_id?.title && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full shrink-0">
                            {b.task_id.title}
                          </span>
                        )}
                        <span className="text-neutral w-16 text-right shrink-0 tabular-nums">
                          {fmtDuration(b.duration_sec)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}