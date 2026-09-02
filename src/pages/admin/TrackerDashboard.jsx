import { useEffect, useState, useCallback } from 'react'
import {
  Clock, Activity, TrendingUp, Users as UsersIcon,
  RefreshCw, Download, ChevronDown, ChevronRight, LogIn, LogOut, Calendar,
  Camera, X, ChevronLeft,
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
  if (s > 0 || parts.length === 0) parts.push(`${s}s`)
  return parts.join(' ')
}

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

const fmtTime = (iso) => (iso ? format(new Date(iso), 'h:mm a') : '—')

const CATEGORY_COLORS = {
  productive: '#1D9E75',
  neutral: '#B4B2A9',
  unproductive: '#D85A30',
  idle: '#E5E7EB',
}

const CATEGORY_BADGE = {
  productive: { bg: 'var(--bg-success)', fg: 'var(--text-success)', label: 'Productive' },
  neutral: { bg: 'var(--fill-control)', fg: 'var(--text-secondary)', label: 'Neutral' },
  unproductive: { bg: 'var(--bg-danger)', fg: 'var(--text-danger)', label: 'Unproductive' },
}

const buildTimeline = (logs) =>
  logs
    .filter((l) => l.duration_sec >= 1)
    .map((l) => ({
      ...l,
      label: l.is_idle ? 'Idle' : l.app_name + (l.window_title ? ` — ${l.window_title}` : ''),
    }))

// ─── Screenshot gallery + lightbox ──────────────────────────────────────────────
// Shots are captured by the desktop agent every 2 minutes. Thumbnails come from
// Cloudinary's on-the-fly resize (thumb_url); the lightbox loads the full image.

function Lightbox({ shots, index, onClose, onMove }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onMove(-1)
      if (e.key === 'ArrowRight') onMove(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onMove])

  const shot = shots[index]
  if (!shot) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white"
        aria-label="Close"
      >
        <X size={28} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMove(-1) }}
        disabled={index === 0}
        className="absolute left-3 text-white/80 hover:text-white disabled:opacity-30"
        aria-label="Previous screenshot"
      >
        <ChevronLeft size={36} />
      </button>
      <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={shot.url}
          alt={`Screenshot at ${fmtTime(shot.taken_at)}`}
          className="w-full max-h-[80vh] object-contain rounded-lg bg-black"
        />
        <div className="mt-2 flex items-center justify-between text-sm text-white/90">
          <span>
            {fmtTime(shot.taken_at)}
            {shot.app_name ? ` · ${shot.app_name}` : ''}
            {shot.is_idle ? ' · Idle' : ''}
            {shot.screen ? ` · ${shot.screen}` : ''}
          </span>
          <span className="text-white/60">{index + 1} / {shots.length}</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onMove(1) }}
        disabled={index === shots.length - 1}
        className="absolute right-3 text-white/80 hover:text-white disabled:opacity-30"
        aria-label="Next screenshot"
      >
        <ChevronRight size={36} />
      </button>
    </div>
  )
}

function ScreenshotGallery({ userId, date }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shots, setShots] = useState([])
  const [lightbox, setLightbox] = useState(null) // index or null

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/tracker/screenshots', { params: { user_id: userId, date } })
      setShots(res.data.data || [])
    } catch {
      if (!silent) toast.error('Failed to load screenshots')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userId, date])

  const toggle = () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    load()
  }

  // Keep the open gallery live — new shots land every 2 minutes.
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load({ silent: true })
    }, 60000)
    return () => clearInterval(id)
  }, [open, load])

  return (
    <div className="mt-5">
      <button
        onClick={toggle}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1.5"
      >
        <Camera size={14} />
        {open ? 'Hide' : 'Show'} screenshots
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div className="mt-3">
          {loading ? (
            <div className="py-4 flex justify-center"><Spinner /></div>
          ) : shots.length === 0 ? (
            <p className="text-sm text-neutral">No screenshots for this date.</p>
          ) : (
            <>
              <p className="text-xs text-neutral mb-2">
                {shots.length} screenshot{shots.length === 1 ? '' : 's'} · captured every 2 minutes while tracking
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-80 overflow-y-auto pr-1">
                {shots.map((s, i) => (
                  <button
                    key={s._id}
                    onClick={() => setLightbox(i)}
                    className="group relative rounded-lg overflow-hidden border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    title={`${fmtTime(s.taken_at)}${s.app_name ? ` — ${s.app_name}` : ''}`}
                  >
                    <img
                      src={s.thumb_url || s.url}
                      alt={`Screenshot at ${fmtTime(s.taken_at)}`}
                      loading="lazy"
                      className="w-full aspect-video object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 flex items-center justify-between">
                      <span>{fmtTime(s.taken_at)}</span>
                      {s.is_idle && <span className="text-amber-300">idle</span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          shots={shots}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onMove={(d) => setLightbox((i) => Math.min(Math.max(i + d, 0), shots.length - 1))}
        />
      )}
    </div>
  )
}

// ─── Expanded per-employee summary ──────────────────────────────────────────────

function EmployeeSummary({ userId, date }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [showTimeline, setShowTimeline] = useState(false)
  const [timeline, setTimeline] = useState([])
  const [tlLoading, setTlLoading] = useState(false)
  const [openRow, setOpenRow] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/tracker/employee-summary', { params: { user_id: userId, date } })
      setData(res.data.data)
    } catch {
      if (!silent) toast.error('Failed to load summary')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userId, date])

  useEffect(() => { load() }, [load])

  // Keep the open summary live
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load({ silent: true })
    }, 30000)
    return () => clearInterval(id)
  }, [load])

  const loadTimeline = async () => {
    if (showTimeline) { setShowTimeline(false); return }
    setShowTimeline(true)
    setTlLoading(true)
    try {
      const res = await api.get('/tracker/activity', { params: { user_id: userId, date } })
      setTimeline(buildTimeline(res.data.data || []))
    } catch {
      toast.error('Failed to load timeline')
    } finally {
      setTlLoading(false)
    }
  }

  if (loading) return <div className="py-8 flex justify-center"><Spinner /></div>
  if (!data) return <p className="text-sm text-neutral py-4">No summary available.</p>

  const total = data.tracked_sec || 0

  return (
    <div className="px-2 pb-4 pt-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-neutral flex items-center gap-1"><LogIn size={12} /> First activity</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{fmtTime(data.first_activity)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-neutral flex items-center gap-1"><LogOut size={12} /> Last activity</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{fmtTime(data.last_activity)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-neutral">Total time</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{fmtDuration(data.total_sec ?? (data.tracked_sec || 0) + (data.idle_sec || 0))}</p>
          <p className="text-[11px] text-neutral mt-0.5">Active {fmtDuration(data.tracked_sec)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-neutral">Idle</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{fmtDuration(data.idle_sec)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">Productivity</p>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 mb-3">
            <span style={{ width: `${pct(data.productive_sec, total)}%`, background: CATEGORY_COLORS.productive }} />
            <span style={{ width: `${pct(data.neutral_sec, total)}%`, background: CATEGORY_COLORS.neutral }} />
            <span style={{ width: `${pct(data.unproductive_sec, total)}%`, background: CATEGORY_COLORS.unproductive }} />
          </div>
          <div className="space-y-1.5">
            {['productive', 'neutral', 'unproductive'].map((cat) => (
              <div key={cat} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[cat] }} />
                <span className="flex-1 capitalize text-gray-700">{cat}</span>
                <span className="text-neutral">{fmtDuration(data[`${cat}_sec`])}</span>
                <span className="w-10 text-right text-gray-700">{pct(data[`${cat}_sec`], total)}%</span>
              </div>
            ))}
          </div>

          <p className="text-sm font-medium text-gray-800 mb-2 mt-5">Top apps</p>
          <div className="space-y-1.5">
            {data.top_apps.length === 0 && <p className="text-sm text-neutral">No app activity.</p>}
            {data.top_apps.map((a) => {
              const b = CATEGORY_BADGE[a.category]
              return (
                <div key={a.app_name} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-gray-700">{a.app_name}</span>
                  <span className="text-neutral">{fmtDuration(a.seconds)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: b.bg, color: b.fg }}>
                    {b.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Detailed activity breakdown — exactly which apps/windows counted
              as productive, neutral, or unproductive. Falls back gracefully to
              just the unproductive list if an older backend is deployed. */}
          {(() => {
            const groups = [
              { key: 'productive',   label: 'Productive activity',   color: CATEGORY_COLORS.productive,   items: data.productive_items },
              { key: 'neutral',      label: 'Neutral activity',      color: CATEGORY_COLORS.neutral,      items: data.neutral_items },
              { key: 'unproductive', label: 'Unproductive activity', color: CATEGORY_COLORS.unproductive, items: data.unproductive_items },
            ].filter((g) => g.items && g.items.length > 0)
            if (groups.length === 0) return null
            return groups.map((g) => {
              const totalSec = g.items.reduce((s, it) => s + (it.seconds || 0), 0)
              return (
                <div key={g.key} className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: g.color }}>
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: g.color }} />
                      {g.label}
                    </p>
                    <span className="text-xs text-neutral shrink-0">{g.items.length} · {fmtDuration(totalSec)}</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {g.items.map((u, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate text-gray-700" title={`${u.app_name}${u.window_title ? ' — ' + u.window_title : ''}`}>
                          {u.app_name}{u.window_title ? ` — ${u.window_title}` : ''}
                        </span>
                        <span className="text-neutral shrink-0">{fmtDuration(u.seconds)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          })()}

          {data.idle_reasons && data.idle_reasons.length > 0 && (
            <>
              <p className="text-sm font-medium text-gray-800 mb-2 mt-5">Idle reasons</p>
              <div className="space-y-1.5">
                {data.idle_reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-neutral shrink-0 w-32">
                      {fmtTime(r.idle_start)}–{fmtTime(r.idle_end)}
                    </span>
                    <span className="flex-1 text-gray-700 break-words">{r.reason}</span>
                    <span className="text-neutral shrink-0">{fmtDuration(r.duration_sec)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">Time by project</p>
          <div className="space-y-1.5">
            {data.projects.length === 0 && <p className="text-sm text-neutral">No project time.</p>}
            {data.projects.map((p) => (
              <div key={p.project_name} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate text-gray-700">{p.project_name}</span>
                <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <span className="block h-full" style={{ width: `${pct(p.seconds, total)}%`, background: '#0037CA' }} />
                </div>
                <span className="text-neutral w-16 text-right">{fmtDuration(p.seconds)}</span>
              </div>
            ))}
          </div>

          <button
            onClick={loadTimeline}
            className="mt-5 text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            {showTimeline ? 'Hide' : 'Show'} detailed timeline
            <ChevronDown size={14} style={{ transform: showTimeline ? 'rotate(180deg)' : 'none' }} />
          </button>

          {showTimeline && (
            <div className="mt-3">
              {tlLoading ? (
                <div className="py-4 flex justify-center"><Spinner /></div>
              ) : timeline.length === 0 ? (
                <p className="text-sm text-neutral">No detailed activity.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
                  {timeline.map((b, i) => (
                    <div key={b._id}>
                      <div
                        onClick={() => setOpenRow(openRow === i ? null : i)}
                        className="flex items-center gap-2 py-1.5 px-2 text-sm cursor-pointer hover:bg-gray-50"
                      >
                        <span className="text-neutral w-20 shrink-0">{fmtTime(b.start)}</span>
                        <span className="flex-1 truncate text-gray-700">{b.label}</span>
                        {b.task_id?.title && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded shrink-0">
                            {b.task_id.title}
                          </span>
                        )}
                        <span className="text-neutral w-16 text-right shrink-0">{fmtDuration(b.duration_sec)}</span>
                        <ChevronDown
                          size={14}
                          className="text-neutral shrink-0"
                          style={{ transform: openRow === i ? 'rotate(180deg)' : 'none' }}
                        />
                      </div>
                      {openRow === i && (
                        <div className="px-2 pb-2 text-sm text-gray-700 break-words bg-gray-50">
                          <span className="text-neutral">Full title: </span>{b.label}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ScreenshotGallery userId={userId} date={date} />
    </div>
  )
}

// ─── Main dashboard ──────────────────────────────────────────────────────────────

export default function TrackerDashboard() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [expandedUser, setExpandedUser] = useState(null)

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

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') loadSummary({ silent: true }) }
    const id = setInterval(tick, 30000)
    const onFocus = () => loadSummary({ silent: true })
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [loadSummary])

  const exportCsv = () => {
    if (!summary?.users?.length) return
    const rows = [
      ['Employee', 'Designation', 'Total', 'Active', 'Productive %', 'Neutral %', 'Unproductive %', 'Idle'],
      ...summary.users.map((u) => [
        u.name, u.designation || '', fmtDuration(u.total ?? u.tracked + u.idle), fmtDuration(u.tracked),
        pct(u.productive, u.tracked), pct(u.neutral, u.tracked),
        pct(u.unproductive, u.tracked), fmtDuration(u.idle),
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
          <div className="relative flex items-center">
            <Calendar
              size={16}
              className="absolute left-3 pointer-events-none"
              style={{ color: '#0037CA' }}
            />
            <input
              type="date"
              value={date}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => { setDate(e.target.value); setExpandedUser(null) }}
              className="tracker-date-input"
            />
          </div>
          <style>{`
            .tracker-date-input {
              padding: 8px 12px 8px 34px;
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              font-family: inherit;
              font-size: 14px;
              color: #16181d;
              background: #fff;
              outline: none;
              cursor: pointer;
              transition: border-color .15s, box-shadow .15s;
            }
            .tracker-date-input:hover { border-color: #c3cbe0; }
            .tracker-date-input:focus {
              border-color: #0037CA;
              box-shadow: 0 0 0 3px rgba(0,55,202,0.12);
            }
            /* Hide the browser's default calendar icon (we show our own) but keep it clickable */
            .tracker-date-input::-webkit-calendar-picker-indicator {
              position: absolute;
              left: 0; top: 0;
              width: 100%; height: 100%;
              margin: 0; padding: 0;
              cursor: pointer;
              opacity: 0;
            }
          `}</style>
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
            <StatCard label="Total time" value={fmtDuration(totals.total_sec ?? (totals.tracked_sec || 0) + (totals.idle_sec || 0))} icon={Clock} color="blue" />
            <StatCard label="Productive" value={`${totals.productive_pct}%`} icon={TrendingUp} color="success" />
            <StatCard label="Idle time" value={fmtDuration(totals.idle_sec)} icon={Activity} color="amber" />
            <StatCard label="Active now" value={totals.active_now} icon={UsersIcon} color="primary" />
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Employees</h2>
              <div className="flex items-center gap-4 text-xs text-neutral">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS.productive }} /> Productive</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS.neutral }} /> Neutral</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS.unproductive }} /> Unproductive</span>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {summary.users
                .sort((a, b) => ((b.total ?? b.tracked + b.idle) - (a.total ?? a.tracked + a.idle)))
                .map((u) => {
                  const p = pct(u.productive, u.tracked)
                  const n = pct(u.neutral, u.tracked)
                  const up = pct(u.unproductive, u.tracked)
                  const isOpen = expandedUser === u.user_id
                  return (
                    <div key={u.user_id}>
                      <button
                        onClick={() => setExpandedUser(isOpen ? null : u.user_id)}
                        className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 transition-colors rounded-lg px-2"
                      >
                        {isOpen ? <ChevronDown size={16} className="text-neutral shrink-0" /> : <ChevronRight size={16} className="text-neutral shrink-0" />}
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
                        <span className="text-sm text-gray-700 w-20 text-right shrink-0">{fmtDuration(u.total ?? u.tracked + u.idle)}</span>
                        <span className="text-sm font-medium w-12 text-right shrink-0" style={{ color: CATEGORY_COLORS.productive }}>{p}%</span>
                      </button>
                      {isOpen && <EmployeeSummary userId={u.user_id} date={date} />}
                    </div>
                  )
                })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}