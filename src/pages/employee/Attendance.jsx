import { useEffect, useState, useCallback, useRef } from 'react'
import {
  LogIn, LogOut, Clock, CalendarOff, Upload, X, FileText, Image,
  CheckCircle2, XCircle, AlertCircle, Wand2, Coffee, PlayCircle,
} from 'lucide-react'
import api, { fetchMyLeaves, submitLeave } from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { PageHeader, StatusBadge, Spinner, EmptyState, StatCard } from '../../components/common/UI'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  { value: 'sick',      label: 'Sick Leave',      icon: '🤒', description: 'Medical illness or health issues' },
  { value: 'casual',    label: 'Casual Leave',    icon: '🌴', description: 'Personal or casual reasons' },
  { value: 'earned',    label: 'Earned Leave',    icon: '🏖️', description: 'Planned annual leave' },
  { value: 'maternity', label: 'Maternity Leave', icon: '👶', description: 'Maternity / paternity leave' },
  { value: 'emergency', label: 'Emergency Leave', icon: '🚨', description: 'Unforeseen emergency situations' },
  { value: 'unpaid',    label: 'Unpaid Leave',    icon: '💸', description: 'Leave without pay' },
]

const LEAVE_STATUS_CONFIG = {
  pending:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       icon: AlertCircle  },
  approved: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  rejected: { color: 'text-red-400 bg-red-500/10 border-red-500/20',             icon: XCircle      },
}

// ─── Break helpers (localStorage-backed) ─────────────────────────────────────
// Each break entry: { id, start: ISO string, end: ISO string | null }

function breakKey(dateStr) { return `breaks_${dateStr}` }
function todayStr()        { return format(new Date(), 'yyyy-MM-dd') }

function loadBreaks(dateStr) {
  try { return JSON.parse(localStorage.getItem(breakKey(dateStr)) || '[]') }
  catch { return [] }
}

function saveBreaks(dateStr, breaks) {
  localStorage.setItem(breakKey(dateStr), JSON.stringify(breaks))
}

/** Sum of all completed (ended) break durations in milliseconds */
function completedBreakMs(breaks) {
  return breaks.reduce((acc, b) => {
    if (b.start && b.end) return acc + (new Date(b.end) - new Date(b.start))
    return acc
  }, 0)
}

/** Format ms → "Xh Ym" or "Ym" */
function fmtDuration(ms) {
  const m = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

/** Net working hours = (clockOut - clockIn) - totalBreakMs, returns string like "7.5" */
function calcNetHours(clockIn, clockOut, breakMs) {
  if (!clockIn || !clockOut) return null
  const gross = new Date(clockOut) - new Date(clockIn)
  const net   = Math.max(0, gross - breakMs)
  return (net / 3600000).toFixed(1)
}

// ─── Live tick hook — re-renders every second while `active` is true ─────────
function useLiveTick(active) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [active])
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EmployeeAttendance() {
  const [activeTab,  setActiveTab]  = useState('attendance')
  const [today,      setToday]      = useState(null)
  const [history,    setHistory]    = useState([])
  const [leaves,     setLeaves]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [clocking,   setClocking]   = useState(false)
  const [breaking,   setBreaking]   = useState(false)
  const [leaveModal, setLeaveModal] = useState(false)
  const [breaks,     setBreaks]     = useState(() => loadBreaks(todayStr()))

  const dateKey   = todayStr()
  const onBreak   = breaks.some(b => b.start && !b.end)

  // Tick every second while clocked in but not yet clocked out
  useLiveTick(!!(today?.clock_in && !today?.clock_out))

  // ── data loading ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, h] = await Promise.allSettled([
        api.get('/attendance/today'),
        api.get('/attendance/my?limit=30'),
      ])
      if (t.status === 'fulfilled') setToday(t.value.data.data)
      if (h.status === 'fulfilled') setHistory(h.value.data.data ?? [])
      const myLeaves = await fetchMyLeaves()
      setLeaves(myLeaves)
    } catch { toast.error('Failed to load attendance') }
    finally   { setLoading(false) }
    setBreaks(loadBreaks(todayStr()))
  }, [])

  useEffect(() => { load() }, [load])

  // ── clock in / out ───────────────────────────────────────────────────────────
  const clockIn = async () => {
    setClocking(true)
    try {
      await api.post('/attendance/clock-in')
      toast.success('Clocked in!')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Clock-in failed') }
    finally     { setClocking(false) }
  }

  const clockOut = async () => {
    // Auto-end any open break before clocking out
    if (onBreak) {
      const closed = breaks.map(b => (!b.end ? { ...b, end: new Date().toISOString() } : b))
      saveBreaks(dateKey, closed)
      setBreaks(closed)
      toast('Break ended automatically', { icon: '☕' })
    }
    setClocking(true)
    try {
      await api.patch('/attendance/clock-out')
      toast.success('Clocked out!')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Clock-out failed') }
    finally     { setClocking(false) }
  }

  // ── break in / out ───────────────────────────────────────────────────────────
  const startBreak = () => {
    if (onBreak) return
    setBreaking(true)
    const entry   = { id: Date.now(), start: new Date().toISOString(), end: null }
    const updated = [...breaks, entry]
    saveBreaks(dateKey, updated)
    setBreaks(updated)
    toast('Break started ☕', { icon: '🟡' })
    setBreaking(false)
  }

  const endBreak = () => {
    if (!onBreak) return
    setBreaking(true)
    const updated = breaks.map(b => (!b.end ? { ...b, end: new Date().toISOString() } : b))
    saveBreaks(dateKey, updated)
    setBreaks(updated)
    toast.success('Break ended — back to work!')
    setBreaking(false)
  }

  // ── derived values ────────────────────────────────────────────────────────────
  const present = history.filter(r => r.status === 'present' || r.status === 'late').length
  const absent  = history.filter(r => r.status === 'absent').length
  const onLeave = history.filter(r => r.status === 'on-leave').length
  const isDone  = !!(today?.clock_in && today?.clock_out)

  const ongoingBreak    = breaks.find(b => b.start && !b.end)
  const ongoingBreakMs  = ongoingBreak ? Math.max(0, new Date() - new Date(ongoingBreak.start)) : 0
  const totalBreakMs    = completedBreakMs(breaks) + ongoingBreakMs   // includes live ticking

  const grossMs = today?.clock_in && !today?.clock_out
    ? Math.max(0, new Date() - new Date(today.clock_in))
    : null

  // Net hours for today (live while working, final after clock-out)
  const netHoursToday = isDone
    ? calcNetHours(today.clock_in, today.clock_out, completedBreakMs(breaks))
    : grossMs !== null
      ? (Math.max(0, grossMs - totalBreakMs) / 3600000).toFixed(1)
      : null

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="My Attendance"
        subtitle="Track your daily attendance and manage leave requests"
        action={
          <button onClick={() => setLeaveModal(true)} className="btn-primary">
            <CalendarOff size={16} /> Apply for Leave
          </button>
        }
      />

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {[
          { id: 'attendance', label: 'Attendance',    icon: Clock       },
          { id: 'leaves',     label: `Leave Requests${leaves.length > 0 ? ` (${leaves.length})` : ''}`, icon: CalendarOff },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          Attendance tab
      ════════════════════════════════════════════════════════════ */}
      {activeTab === 'attendance' && (
        <>
          {/* ── Today card ── */}
          <div className="card space-y-5">

            {/* Time display + action buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Today — {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </p>

                {loading ? <Spinner size="sm" /> : (
                  <div className="mt-2 flex items-center gap-6 flex-wrap">

                    {/* Clock In time */}
                    <div>
                      <p className="text-xs text-slate-500">Clock In</p>
                      <p className={`text-2xl font-bold font-mono mt-0.5 ${today?.clock_in ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {today?.clock_in ? format(new Date(today.clock_in), 'HH:mm') : '--:--'}
                      </p>
                    </div>

                    <div className="text-slate-600 text-xl font-thin">→</div>

                    {/* Clock Out time */}
                    <div>
                      <p className="text-xs text-slate-500">Clock Out</p>
                      <p className={`text-2xl font-bold font-mono mt-0.5 ${today?.clock_out ? 'text-amber-400' : 'text-slate-600'}`}>
                        {today?.clock_out ? format(new Date(today.clock_out), 'HH:mm') : '--:--'}
                      </p>
                    </div>

                    {/* Break total (shown once clocked in) */}
                    {today?.clock_in && (
                      <div>
                        <p className="text-xs text-slate-500">Break</p>
                        <p className={`text-2xl font-bold font-mono mt-0.5 ${totalBreakMs > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                          {totalBreakMs > 0 ? fmtDuration(totalBreakMs) : '0m'}
                        </p>
                      </div>
                    )}

                    {/* Net working hours */}
                    {netHoursToday !== null && (
                      <div>
                        <p className="text-xs text-slate-500">{isDone ? 'Net Hours' : 'Net (live)'}</p>
                        <p className="text-2xl font-bold font-mono mt-0.5 text-brand-400">
                          {netHoursToday}h
                        </p>
                      </div>
                    )}

                    {today?.status && <div className="mt-1"><StatusBadge status={today.status} /></div>}
                  </div>
                )}
              </div>

              {/* ── Action buttons ── */}
              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                {!today?.clock_in ? (
                  /* Not clocked in */
                  <button onClick={clockIn} disabled={clocking} className="btn-primary py-3 px-6 text-base">
                    {clocking ? <Spinner size="sm" /> : <LogIn size={18} />} Clock In
                  </button>

                ) : !today?.clock_out ? (
                  /* Clocked in — show Break toggle + Clock Out */
                  <>
                    {!onBreak ? (
                      <button
                        onClick={startBreak} disabled={breaking}
                        className="flex items-center gap-2 py-3 px-5 text-sm font-semibold rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all"
                      >
                        {breaking ? <Spinner size="sm" /> : <Coffee size={16} />} Start Break
                      </button>
                    ) : (
                      <button
                        onClick={endBreak} disabled={breaking}
                        className="flex items-center gap-2 py-3 px-5 text-sm font-semibold rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all animate-pulse"
                      >
                        {breaking ? <Spinner size="sm" /> : <PlayCircle size={16} />} End Break
                      </button>
                    )}

                    <button onClick={clockOut} disabled={clocking} className="btn-secondary py-3 px-6 text-base">
                      {clocking ? <Spinner size="sm" /> : <LogOut size={18} />} Clock Out
                    </button>
                  </>

                ) : (
                  /* Completed */
                  <div className="px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-emerald-400 font-semibold text-sm">✓ Completed for today</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Live on-break banner ── */}
            {onBreak && ongoingBreak && (
              <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <Coffee size={16} className="text-orange-400 flex-shrink-0 animate-bounce" />
                <div className="flex-1 min-w-0">
                  <p className="text-orange-400 font-semibold text-sm">On Break</p>
                  <p className="text-slate-400 text-xs">
                    Started at {format(new Date(ongoingBreak.start), 'HH:mm')}
                    &nbsp;·&nbsp;
                    Elapsed: {fmtDuration(ongoingBreakMs)}
                  </p>
                </div>
                <button
                  onClick={endBreak}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  <PlayCircle size={13} /> Resume Work
                </button>
              </div>
            )}

            {/* ── Break log for today ── */}
            {breaks.length > 0 && (
              <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Today's Break Log
                </p>
                <div className="space-y-2">
                  {breaks.map((b, i) => {
                    const bMs  = b.end
                      ? new Date(b.end) - new Date(b.start)
                      : new Date() - new Date(b.start)
                    const dur  = fmtDuration(bMs) + (b.end ? '' : ' (ongoing)')
                    return (
                      <div key={b.id ?? i} className="flex items-center gap-3 text-xs">
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-400 font-bold text-[10px] flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-slate-400 font-mono">{format(new Date(b.start), 'HH:mm')}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-slate-400 font-mono">{b.end ? format(new Date(b.end), 'HH:mm') : '—'}</span>
                        <span className={`ml-auto font-semibold tabular-nums ${b.end ? 'text-orange-400' : 'text-amber-400'}`}>
                          {dur}
                        </span>
                      </div>
                    )
                  })}

                  {/* Summary row */}
                  <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-1 text-xs">
                    <span className="text-slate-500">Total break time</span>
                    <span className="text-right font-bold text-orange-400">{fmtDuration(totalBreakMs)}</span>
                    {netHoursToday !== null && (
                      <>
                        <span className="text-slate-500">Net working hours</span>
                        <span className="text-right font-bold text-brand-400">{netHoursToday}h</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Present Days" value={present} icon={Clock} color="emerald" />
            <StatCard label="Absent Days"  value={absent}  icon={Clock} color="red"     />
            <StatCard label="On Leave"     value={onLeave} icon={Clock} color="amber"   />
          </div>

          {/* ── History table ── */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Attendance History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-200/50">
                  <tr>
                    {['Date', 'Status', 'Clock In', 'Clock Out', 'Break', 'Net Hours'].map(h => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="py-12 text-center"><Spinner /></td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={6}><EmptyState icon={Clock} title="No attendance records" /></td></tr>
                  ) : history.map(r => {
                    const rowDate    = r.date ? r.date.slice(0, 10) : null
                    const rowBreaks  = rowDate ? loadBreaks(rowDate) : []
                    const rowBreakMs = completedBreakMs(rowBreaks)
                    const netHrs     = calcNetHours(r.clock_in, r.clock_out, rowBreakMs)
                    return (
                      <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="table-cell font-mono text-xs">
                          {rowDate ? format(parseISO(rowDate), 'EEE, MMM d yyyy') : '—'}
                        </td>
                        <td className="table-cell"><StatusBadge status={r.status} /></td>
                        <td className="table-cell font-mono text-xs text-emerald-400">
                          {r.clock_in  ? format(new Date(r.clock_in),  'HH:mm') : '—'}
                        </td>
                        <td className="table-cell font-mono text-xs text-amber-400">
                          {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}
                        </td>
                        <td className="table-cell text-xs text-orange-400">
                          {rowBreakMs > 0 ? fmtDuration(rowBreakMs) : '—'}
                        </td>
                        <td className="table-cell text-xs text-brand-400 font-semibold">
                          {netHrs ? `${netHrs}h` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          Leaves tab
      ════════════════════════════════════════════════════════════ */}
      {activeTab === 'leaves' && (
        <LeaveHistoryTab leaves={leaves} loading={loading} onApply={() => setLeaveModal(true)} />
      )}

      {leaveModal && (
        <ApplyLeaveModal
          onClose={() => setLeaveModal(false)}
          onSuccess={() => { setLeaveModal(false); load(); setActiveTab('leaves') }}
        />
      )}
    </div>
  )
}

// ─── Leave History Tab ────────────────────────────────────────────────────────

function LeaveHistoryTab({ leaves, loading, onApply }) {
  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (leaves.length === 0) return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <CalendarOff size={40} className="text-slate-600 mb-4" />
      <p className="text-slate-400 font-medium">No leave requests yet</p>
      <p className="text-slate-500 text-sm mt-1">Apply for a leave to get started</p>
      <button onClick={onApply} className="btn-primary mt-4"><CalendarOff size={15} /> Apply for Leave</button>
    </div>
  )
  return (
    <div className="space-y-3">
      {leaves.map(leave => {
        const cfg        = LEAVE_STATUS_CONFIG[leave.status] ?? LEAVE_STATUS_CONFIG.pending
        const StatusIcon = cfg.icon
        const lt         = LEAVE_TYPES.find(t => t.value === leave.leave_type)
        return (
          <div key={leave._id} className="card hover:border-white/10 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="text-2xl mt-0.5">{lt?.icon ?? '📋'}</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-white text-sm">{lt?.label ?? leave.leave_type}</h4>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      <StatusIcon size={11} /> {leave.status}
                    </span>
                    {leave.is_urgent && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">🚨 Urgent</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    {leave.from_date ? format(parseISO(leave.from_date.slice(0, 10)), 'MMM d, yyyy') : '—'}
                    {' → '}
                    {leave.to_date   ? format(parseISO(leave.to_date.slice(0, 10)),   'MMM d, yyyy') : '—'}
                    {leave.days && <span className="ml-2 text-brand-400">({leave.days} day{leave.days !== 1 ? 's' : ''})</span>}
                  </p>
                  {leave.reason && <p className="text-slate-500 text-xs mt-1 italic">"{leave.reason}"</p>}
                  {leave.admin_note && (
                    <p className={`text-xs mt-2 px-2 py-1 rounded-lg border ${
                      leave.status === 'approved'
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/5 border-red-500/20 text-red-400'
                    }`}>Admin: {leave.admin_note}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 flex-shrink-0">
                {leave.createdAt ? format(new Date(leave.createdAt), 'MMM d, yyyy') : ''}
              </p>
            </div>
            {leave.documents?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                {leave.documents.map((doc, i) => (
                  <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-all">
                    {doc.type?.startsWith('image') ? <Image size={12} /> : <FileText size={12} />}
                    {doc.name ?? `Document ${i + 1}`}
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tone rewriter (Anthropic API) ───────────────────────────────────────────

async function rewriteReason(reason, tone, leaveType) {
  const toneInstructions = {
    casual: `Rewrite this leave request reason in a casual, friendly, and informal tone — like you're messaging a colleague or friend. Keep it natural, warm, and conversational. Keep the same facts but make it sound relaxed and approachable.`,
    formal: `Rewrite this leave request reason in a professional, formal tone suitable for official HR documentation. Use proper grammar, polite language, and a respectful tone. Keep the same facts but elevate the register to be office-appropriate.`,
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `${toneInstructions[tone]}\n\nLeave type: ${leaveType || 'general'}\nOriginal reason: "${reason}"\n\nReturn ONLY the rewritten reason text — no preamble, no quotes, no explanation.`,
      }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text?.trim() ?? reason
}

// ─── Apply Leave Modal ────────────────────────────────────────────────────────

function ApplyLeaveModal({ onClose, onSuccess }) {
  const fileInputRef              = useRef(null)
  const [step,        setStep]    = useState(1)
  const [saving,      setSaving]  = useState(false)
  const [form,        setForm]    = useState({
    leave_type: '', from_date: '', to_date: '', reason: '',
    contact_during_leave: '', handover_notes: '', is_urgent: false,
  })
  const [files,       setFiles]      = useState([])
  const [dragOver,    setDragOver]   = useState(false)
  const [errors,      setErrors]     = useState({})
  const [toneLoading, setToneLoading]= useState(null)

  const days = form.from_date && form.to_date
    ? Math.max(0, Math.ceil((new Date(form.to_date) - new Date(form.from_date)) / 86400000) + 1)
    : 0

  const validate = (currentStep = step) => {
    const e = {}
    if (currentStep === 1) {
      if (!form.leave_type) e.leave_type = 'Please select a leave type'
      if (!form.from_date)  e.from_date  = 'Start date is required'
      if (!form.to_date)    e.to_date    = 'End date is required'
      if (form.from_date && form.to_date && form.to_date < form.from_date)
        e.to_date = 'End date must be after start date'
    }
    if (currentStep === 2) {
      if (!form.reason || form.reason.trim().length < 20)
        e.reason = 'Reason must be at least 20 characters'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleTone = async (tone) => {
    if (!form.reason || form.reason.trim().length < 10) {
      toast.error('Write at least a few words before applying a tone')
      return
    }
    setToneLoading(tone)
    try {
      const rewritten = await rewriteReason(form.reason, tone, form.leave_type)
      setForm(p => ({ ...p, reason: rewritten }))
      toast.success(`Reason rewritten in ${tone} tone ✨`)
    } catch {
      toast.error('Failed to rewrite reason. Please try again.')
    } finally { setToneLoading(null) }
  }

  const addFiles = (newFiles) => {
    const valid = Array.from(newFiles).filter(f => {
      const ok = f.size <= 5 * 1024 * 1024
      if (!ok) toast.error(`${f.name} exceeds 5MB limit`)
      return ok
    })
    setFiles(prev => [...prev, ...valid].slice(0, 5))
  }

  const handleSubmit = async () => {
    const e = {}
    if (!form.leave_type) e.leave_type = 'Please select a leave type'
    if (!form.from_date)  e.from_date  = 'Start date is required'
    if (!form.to_date)    e.to_date    = 'End date is required'
    if (form.from_date && form.to_date && form.to_date < form.from_date)
      e.to_date = 'End date must be after start date'
    if (!form.reason || form.reason.trim().length < 20)
      e.reason = 'Reason must be at least 20 characters'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setSaving(true)
    try {
      let result
      if (files.length > 0) {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        fd.append('days', days)
        files.forEach(f => fd.append('documents', f))
        result = await submitLeave(fd, true)
      } else {
        result = await submitLeave({ ...form, days })
      }
      if (result.ok) {
        toast.success('Leave application submitted!')
        onSuccess()
      } else if (result.unsupported) {
        toast.error('Leave requests are not yet available on this server.')
      } else {
        toast.error(result.message)
      }
    } finally { setSaving(false) }
  }

  const f            = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const selectedType = LEAVE_TYPES.find(t => t.value === form.leave_type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-[#151823] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarOff size={18} className="text-brand-400" /> Apply for Leave
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          {[
            { n: 1, label: 'Leave Details'      },
            { n: 2, label: 'Reason & Notes'     },
            { n: 3, label: 'Documents & Review' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s.n ? 'bg-brand-600 text-white'
                  : step > s.n ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-slate-500'
              }`}>{step > s.n ? '✓' : s.n}</div>
              <span className={`text-xs hidden sm:block ${step === s.n ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
              {i < 2 && <div className="flex-1 h-px bg-white/10 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step body */}
        <div className="px-6 py-5 space-y-5">

          {/* Step 1 */}
          {step === 1 && (
            <>
              <div>
                <label className="label">Leave Type <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                  {LEAVE_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => f('leave_type', t.value)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                        form.leave_type === t.value
                          ? 'border-brand-500 bg-brand-500/10 text-white'
                          : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10 hover:text-white'
                      }`}>
                      <span className="text-lg">{t.icon}</span>
                      <span className="text-xs font-semibold">{t.label}</span>
                      <span className="text-[10px] text-slate-500 leading-tight">{t.description}</span>
                    </button>
                  ))}
                </div>
                {errors.leave_type && <p className="text-red-400 text-xs mt-1">{errors.leave_type}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">From Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.from_date} min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={e => f('from_date', e.target.value)} className="input" />
                  {errors.from_date && <p className="text-red-400 text-xs mt-1">{errors.from_date}</p>}
                </div>
                <div>
                  <label className="label">To Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.to_date}
                    min={form.from_date || format(new Date(), 'yyyy-MM-dd')}
                    onChange={e => f('to_date', e.target.value)} className="input" />
                  {errors.to_date && <p className="text-red-400 text-xs mt-1">{errors.to_date}</p>}
                </div>
              </div>

              {days > 0 && (
                <div className="flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                  <Clock size={16} className="text-brand-400 flex-shrink-0" />
                  <div>
                    <p className="text-brand-400 font-semibold text-sm">
                      {days} day{days !== 1 ? 's' : ''} of {selectedType?.label ?? 'leave'}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {format(new Date(form.from_date), 'EEE, MMM d')} → {format(new Date(form.to_date), 'EEE, MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                <input type="checkbox" checked={form.is_urgent}
                  onChange={e => f('is_urgent', e.target.checked)}
                  className="w-4 h-4 accent-brand-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Mark as Urgent 🚨</p>
                  <p className="text-xs text-slate-500">Flag for priority review by admin</p>
                </div>
              </label>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Reason for Leave <span className="text-red-400">*</span></label>
                  <div className="flex items-center gap-1.5">
                    <Wand2 size={12} className="text-slate-500" />
                    <span className="text-xs text-slate-500 mr-1">Rewrite as:</span>
                    {['casual', 'formal'].map(tone => (
                      <button key={tone} type="button" onClick={() => handleTone(tone)} disabled={!!toneLoading}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          toneLoading === tone
                            ? tone === 'casual'
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 cursor-wait'
                              : 'bg-blue-500/20 border-blue-500/40 text-blue-300 cursor-wait'
                            : tone === 'casual'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                        }`}>
                        {toneLoading === tone ? <Spinner size="xs" /> : tone === 'casual' ? '🌴' : '💼'}
                        {tone.charAt(0).toUpperCase() + tone.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea value={form.reason} onChange={e => f('reason', e.target.value)} rows={4}
                  placeholder="Write your reason here — then use the Casual or Formal buttons to adjust the tone..."
                  className="input resize-none" />
                <div className="flex justify-between mt-1">
                  {errors.reason ? <p className="text-red-400 text-xs">{errors.reason}</p> : <span />}
                  <p className={`text-xs ${form.reason.length < 20 ? 'text-red-400' : 'text-slate-500'}`}>
                    {form.reason.length} / 20 min
                  </p>
                </div>
              </div>

              <div>
                <label className="label">Emergency Contact During Leave</label>
                <input type="tel" value={form.contact_during_leave}
                  onChange={e => f('contact_during_leave', e.target.value)}
                  placeholder="+91 98765 43210" className="input" />
                <p className="text-xs text-slate-500 mt-1">Optional — for urgent contact if needed</p>
              </div>

              <div>
                <label className="label">Work Handover Notes</label>
                <textarea value={form.handover_notes} onChange={e => f('handover_notes', e.target.value)} rows={3}
                  placeholder="List pending tasks or responsibilities that need coverage during your absence..."
                  className="input resize-none" />
                <p className="text-xs text-slate-500 mt-1">Optional — helps your team plan coverage</p>
              </div>
            </>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <>
              <div>
                <label className="label">
                  Supporting Documents <span className="text-slate-500 font-normal">(optional, max 5 files)</span>
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Medical certificates, prescriptions, or other supporting documents. Images, PDF, or Word — max 5MB each.
                </p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragOver ? 'border-brand-500 bg-brand-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                  }`}>
                  <Upload size={28} className={`mx-auto mb-3 ${dragOver ? 'text-brand-400' : 'text-slate-500'}`} />
                  <p className="text-sm font-medium text-slate-300">Drop files here or click to browse</p>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG, PDF, DOCX — Max 5MB each</p>
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx"
                    className="hidden" onChange={e => addFiles(e.target.files)} />
                </div>

                {files.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          file.type.startsWith('image/') ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
                        }`}>
                          {file.type.startsWith('image/') ? <Image size={14} /> : <FileText size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{file.name}</p>
                          <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        {file.type.startsWith('image/') && (
                          <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        )}
                        <button onClick={() => setFiles(fl => fl.filter((_, j) => j !== i))}
                          className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Application Summary</p>
                <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                  {[
                    ['Type',      `${selectedType?.icon ?? ''} ${selectedType?.label ?? '—'}`],
                    ['Duration',  `${days} day${days !== 1 ? 's' : ''}`],
                    ['From',      form.from_date ? format(new Date(form.from_date), 'EEE, MMM d yyyy') : '—'],
                    ['To',        form.to_date   ? format(new Date(form.to_date),   'EEE, MMM d yyyy') : '—'],
                    ['Priority',  form.is_urgent ? '🚨 Urgent' : 'Normal'],
                    ['Documents', files.length > 0 ? `${files.length} file(s)` : 'None'],
                  ].map(([k, v]) => (
                    <>
                      <span key={`k-${k}`} className="text-slate-500">{k}</span>
                      <span key={`v-${k}`} className={`font-medium ${
                        k === 'Duration' ? 'text-brand-400'
                          : k === 'Priority' && form.is_urgent ? 'text-red-400'
                          : 'text-white'
                      }`}>{v}</span>
                    </>
                  ))}
                </div>
                {form.reason && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-slate-500 mb-1">Reason</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{form.reason}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="btn-secondary">← Back</button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            {step < 3 ? (
              <button onClick={() => { if (!validate(step)) return; setStep(s => s + 1) }} className="btn-primary">
                Next →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                {saving ? <Spinner size="sm" /> : <CheckCircle2 size={16} />} Submit Application
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
