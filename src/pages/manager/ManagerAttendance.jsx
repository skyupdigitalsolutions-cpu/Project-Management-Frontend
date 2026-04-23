import { useEffect, useState, useCallback, useRef } from 'react'
import {
  LogIn, LogOut, Clock, Users, CalendarOff, Upload, X, FileText, Image,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, UserMinus, Wand2,
  Coffee, PlayCircle,
} from 'lucide-react'
import api, { fetchMyLeaves, submitLeave } from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { PageHeader, SelectInput, Modal, StatusBadge, Spinner, EmptyState, StatCard } from '../../components/common/UI'

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

/** Net working hours = (clockOut - clockIn) - totalBreakMs */
function calcNetHours(clockIn, clockOut, breakMs) {
  if (!clockIn || !clockOut) return null
  const gross = new Date(clockOut) - new Date(clockIn)
  const net   = Math.max(0, gross - breakMs)
  return (net / 3600000).toFixed(1)
}

// ─── Live tick hook ───────────────────────────────────────────────────────────

function useLiveTick(active) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [active])
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active ? 'bg-brand-600 text-gray-800 shadow' : 'text-neutral hover:text-gray-800'
    }`}>{children}</button>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function ManagerAttendance() {
  const [activeTab,  setActiveTab]  = useState('my')
  const [leaveModal, setLeaveModal] = useState(false)

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Attendance"
        subtitle="Track your attendance, apply for leave, and monitor your team"
        action={
          <button onClick={() => setLeaveModal(true)} className="btn-primary">
            <CalendarOff size={16} /> Apply for Leave
          </button>
        }
      />

      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl w-fit">
        <TabBtn active={activeTab === 'my'} onClick={() => setActiveTab('my')}>
          <Clock size={14} /> My Attendance
        </TabBtn>
        <TabBtn active={activeTab === 'leaves'} onClick={() => setActiveTab('leaves')}>
          <CalendarOff size={14} /> My Leaves
        </TabBtn>
        <TabBtn active={activeTab === 'team'} onClick={() => setActiveTab('team')}>
          <Users size={14} /> Team Attendance
        </TabBtn>
      </div>

      {activeTab === 'my'     && <MyAttendanceTab />}
      {activeTab === 'leaves' && <MyLeavesTab onApply={() => setLeaveModal(true)} />}
      {activeTab === 'team'   && <TeamAttendanceTab />}

      {leaveModal && (
        <ApplyLeaveModal
          onClose={() => setLeaveModal(false)}
          onSuccess={() => { setLeaveModal(false); setActiveTab('leaves') }}
        />
      )}
    </div>
  )
}

// ─── My Attendance Tab (with break tracking) ──────────────────────────────────

function MyAttendanceTab() {
  const [today,   setToday]   = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [clocking,setClocking]= useState(false)
  const [breaking,setBreaking]= useState(false)
  const [breaks,  setBreaks]  = useState(() => loadBreaks(todayStr()))

  const dateKey = todayStr()
  const onBreak = breaks.some(b => b.start && !b.end)

  // Tick every second while clocked in but not yet clocked out
  useLiveTick(!!(today?.clock_in && !today?.clock_out))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, h] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/attendance/my?limit=30'),
      ])
      setToday(t.data.data)
      setHistory(h.data.data ?? [])
    } catch { toast.error('Failed to load attendance') }
    finally {
      setLoading(false)
      setBreaks(loadBreaks(todayStr()))
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Clock in / out ────────────────────────────────────────────────────────

  const clockIn = async () => {
    setClocking(true)
    try {
      await api.post('/attendance/clock-in')
      toast.success('Clocked in!')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
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
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally     { setClocking(false) }
  }

  // ── Break in / out ────────────────────────────────────────────────────────

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

  // ── Derived values ────────────────────────────────────────────────────────

  const present = history.filter(r => r.status === 'present' || r.status === 'late').length
  const absent  = history.filter(r => r.status === 'absent').length
  const onLeave = history.filter(r => r.status === 'on-leave').length
  const isDone  = !!(today?.clock_in && today?.clock_out)

  const ongoingBreak   = breaks.find(b => b.start && !b.end)
  const ongoingBreakMs = ongoingBreak ? Math.max(0, new Date() - new Date(ongoingBreak.start)) : 0
  const totalBreakMs   = completedBreakMs(breaks) + ongoingBreakMs

  const grossMs = today?.clock_in && !today?.clock_out
    ? Math.max(0, new Date() - new Date(today.clock_in))
    : null

  const netHoursToday = isDone
    ? calcNetHours(today.clock_in, today.clock_out, completedBreakMs(breaks))
    : grossMs !== null
      ? (Math.max(0, grossMs - totalBreakMs) / 3600000).toFixed(1)
      : null

  return (
    <div className="space-y-6">

      {/* ── Today card ── */}
      <div className="card space-y-5">

        {/* Time display + action buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-neutral uppercase tracking-wider">
              Today — {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>

            {loading ? <Spinner size="sm" /> : (
              <div className="mt-2 flex items-center gap-6 flex-wrap">

                <div>
                  <p className="text-xs text-neutral">Clock In</p>
                  <p className={`text-2xl font-bold font-mono mt-0.5 ${today?.clock_in ? 'text-emerald-400' : 'text-neutral'}`}>
                    {today?.clock_in ? format(new Date(today.clock_in), 'HH:mm') : '--:--'}
                  </p>
                </div>

                <div className="text-neutral text-xl font-thin">→</div>

                <div>
                  <p className="text-xs text-neutral">Clock Out</p>
                  <p className={`text-2xl font-bold font-mono mt-0.5 ${today?.clock_out ? 'text-amber-400' : 'text-neutral'}`}>
                    {today?.clock_out ? format(new Date(today.clock_out), 'HH:mm') : '--:--'}
                  </p>
                </div>

                {/* Break total — shown once clocked in */}
                {today?.clock_in && (
                  <div>
                    <p className="text-xs text-neutral">Break</p>
                    <p className={`text-2xl font-bold font-mono mt-0.5 ${totalBreakMs > 0 ? 'text-orange-400' : 'text-neutral'}`}>
                      {totalBreakMs > 0 ? fmtDuration(totalBreakMs) : '0m'}
                    </p>
                  </div>
                )}

                {/* Net working hours */}
                {netHoursToday !== null && (
                  <div>
                    <p className="text-xs text-neutral">{isDone ? 'Net Hours' : 'Net (live)'}</p>
                    <p className="text-2xl font-bold font-mono mt-0.5 text-primary">
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
              <button onClick={clockIn} disabled={clocking} className="btn-primary py-3 px-6 text-base flex items-center gap-2">
                {clocking ? <Spinner size="sm" /> : <LogIn size={18} />} Clock In
              </button>

            ) : !today?.clock_out ? (
              <>
                {/* Break toggle */}
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

                <button onClick={clockOut} disabled={clocking} className="btn-secondary py-3 px-6 text-base flex items-center gap-2">
                  {clocking ? <Spinner size="sm" /> : <LogOut size={18} />} Clock Out
                </button>
              </>

            ) : (
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
              <p className="text-neutral text-xs">
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
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-neutral uppercase tracking-wider mb-3">
              Today's Break Log
            </p>
            <div className="space-y-2">
              {breaks.map((b, i) => {
                const bMs = b.end
                  ? new Date(b.end) - new Date(b.start)
                  : new Date() - new Date(b.start)
                const dur = fmtDuration(bMs) + (b.end ? '' : ' (ongoing)')
                return (
                  <div key={b.id ?? i} className="flex items-center gap-3 text-xs">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-400 font-bold text-[10px] flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-neutral font-mono">{format(new Date(b.start), 'HH:mm')}</span>
                    <span className="text-neutral">→</span>
                    <span className="text-neutral font-mono">{b.end ? format(new Date(b.end), 'HH:mm') : '—'}</span>
                    <span className={`ml-auto font-semibold tabular-nums ${b.end ? 'text-orange-400' : 'text-amber-400'}`}>
                      {dur}
                    </span>
                  </div>
                )
              })}

              {/* Summary row */}
              <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-1 text-xs">
                <span className="text-neutral">Total break time</span>
                <span className="text-right font-bold text-orange-400">{fmtDuration(totalBreakMs)}</span>
                {netHoursToday !== null && (
                  <>
                    <span className="text-neutral">Net working hours</span>
                    <span className="text-right font-bold text-primary">{netHoursToday}h</span>
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
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">My Attendance History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100/50">
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
                    <td className="table-cell text-xs text-primary font-semibold">
                      {netHrs ? `${netHrs}h` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── My Leaves Tab ────────────────────────────────────────────────────────────

function MyLeavesTab({ onApply }) {
  const [leaves,  setLeaves]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMyLeaves().then(data => setLeaves(data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (leaves.length === 0) return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <CalendarOff size={40} className="text-neutral mb-4" />
      <p className="text-neutral font-medium">No leave requests yet</p>
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
          <div key={leave._id} className="card hover:border-gray-200 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="text-2xl">{lt?.icon ?? '📋'}</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-800 text-sm">{lt?.label ?? leave.leave_type}</h4>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      <StatusIcon size={11} /> {leave.status}
                    </span>
                    {leave.is_urgent && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">🚨 Urgent</span>
                    )}
                  </div>
                  <p className="text-neutral text-xs mt-1">
                    {leave.from_date ? format(parseISO(leave.from_date.slice(0, 10)), 'MMM d, yyyy') : '—'}
                    {' → '}
                    {leave.to_date   ? format(parseISO(leave.to_date.slice(0, 10)),   'MMM d, yyyy') : '—'}
                    {leave.days && <span className="ml-2 text-primary">({leave.days} day{leave.days !== 1 ? 's' : ''})</span>}
                  </p>
                  {leave.reason && <p className="text-neutral text-xs mt-1 italic">"{leave.reason}"</p>}
                  {leave.admin_note && (
                    <p className={`text-xs mt-2 px-2 py-1 rounded-lg border ${
                      leave.status === 'approved'
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/5 border-red-500/20 text-red-400'
                    }`}>
                      Admin: {leave.admin_note}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral flex-shrink-0">
                {leave.createdAt ? format(new Date(leave.createdAt), 'MMM d, yyyy') : ''}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Team Attendance Tab ──────────────────────────────────────────────────────

function TeamAttendanceTab() {
  const [records,     setRecords]     = useState([])
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [dateF,       setDateF]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [statusF,     setStatusF]     = useState('')
  const [absentModal, setAbsentModal] = useState(false)
  const [absentIds,   setAbsentIds]   = useState([])
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateF)   params.date   = dateF
      if (statusF) params.status = statusF
      const [r, u] = await Promise.all([
        api.get('/attendance', { params }),
        api.get('/users', { params: { role: 'employee', status: 'active' } }),
      ])
      setRecords(r.data.data ?? [])
      setUsers(u.data.data ?? [])
    } catch { toast.error('Failed to load') }
    finally   { setLoading(false) }
  }, [dateF, statusF])

  useEffect(() => { load() }, [load])

  const handleMarkAbsent = async () => {
    if (!absentIds.length) { toast.error('Select at least one'); return }
    setSaving(true)
    try {
      await api.post('/attendance/mark-absent', { user_ids: absentIds, date: dateF })
      toast.success('Marked absent')
      setAbsentModal(false)
      setAbsentIds([])
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally     { setSaving(false) }
  }

  const present = records.filter(r => r.status === 'present').length
  const absent  = records.filter(r => r.status === 'absent').length
  const late    = records.filter(r => r.status === 'late').length

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button className="btn-secondary flex items-center gap-2" onClick={() => setAbsentModal(true)}>
          <UserMinus size={16} /> Mark Absent
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present" value={present} icon={Clock} color="emerald" />
        <StatCard label="Absent"  value={absent}  icon={Clock} color="red"     />
        <StatCard label="Late"    value={late}    icon={Clock} color="amber"   />
      </div>
      <div className="flex flex-wrap gap-3">
        <input type="date" value={dateF} onChange={e => setDateF(e.target.value)} className="input w-44" />
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={['present', 'absent', 'late', 'on-leave', 'half-day'].map(s => ({ value: s, label: s }))} className="w-40" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100/50">
              <tr>
                {['Employee', 'Department', 'Status', 'Clock In', 'Clock Out', 'Hours'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><Spinner /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={Clock} title="No records" description="Try a different date" /></td></tr>
              ) : records.map(r => {
                const hrs = r.clock_in && r.clock_out
                  ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1)
                  : null
                return (
                  <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xs">
                          {(r.user_id?.name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{r.user_id?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="table-cell text-neutral text-sm">{r.user_id?.department ?? '—'}</td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell text-neutral font-mono text-xs">
                      {r.clock_in  ? format(new Date(r.clock_in),  'HH:mm') : '—'}
                    </td>
                    <td className="table-cell text-neutral font-mono text-xs">
                      {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}
                    </td>
                    <td className="table-cell text-neutral text-xs">{hrs ? `${hrs}h` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={absentModal} onClose={() => { setAbsentModal(false); setAbsentIds([]) }} title="Mark Users Absent"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setAbsentModal(false); setAbsentIds([]) }} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleMarkAbsent} disabled={saving}>Mark Absent</button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-neutral">
            Select employees to mark absent for <span className="text-gray-800 font-semibold">{dateF}</span>:
          </p>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
            {users.map(u => (
              <label key={u._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={absentIds.includes(u._id)}
                  onChange={e => setAbsentIds(ids => e.target.checked ? [...ids, u._id] : ids.filter(id => id !== u._id))}
                  className="w-4 h-4 accent-brand-500" />
                <span className="text-sm text-gray-600">{u.name}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Tone rewriter ────────────────────────────────────────────────────────────

async function rewriteReason(reason, tone, leaveType) {
  const instructions = {
    casual: 'Rewrite this leave request reason in a casual, friendly, and informal tone — like messaging a colleague. Keep the facts the same but make it relaxed and conversational.',
    formal: 'Rewrite this leave request reason in a professional, formal tone suitable for official HR documentation. Keep the same facts but elevate the register.',
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `${instructions[tone]}\n\nLeave type: ${leaveType || 'general'}\nOriginal reason: "${reason}"\n\nReturn ONLY the rewritten reason text — no preamble, no quotes, no explanation.`,
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

  const validate = () => {
    const e = {}
    if (!form.leave_type) e.leave_type = 'Please select a leave type'
    if (!form.from_date)  e.from_date  = 'Start date is required'
    if (!form.to_date)    e.to_date    = 'End date is required'
    if (form.from_date && form.to_date && form.to_date < form.from_date)
      e.to_date = 'End date must be after start date'
    if (!form.reason || form.reason.trim().length < 20)
      e.reason = 'Reason must be at least 20 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const addFiles = (newFiles) => {
    const valid = Array.from(newFiles).filter(f => {
      const ok = f.size <= 5 * 1024 * 1024
      if (!ok) toast.error(`${f.name} exceeds 5MB`)
      return ok
    })
    setFiles(prev => [...prev, ...valid].slice(0, 5))
  }

  const handleSubmit = async () => {
    if (!validate()) return
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
    } catch { toast.error('Failed to rewrite reason. Please try again.') }
    finally   { setToneLoading(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-[#151823] border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <CalendarOff size={18} className="text-primary" /> Apply for Leave
            </h2>
            <p className="text-xs text-neutral mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="text-neutral hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-50">
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
                step === s.n ? 'bg-brand-600 text-gray-800'
                  : step > s.n ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-50 text-neutral'
              }`}>{step > s.n ? '✓' : s.n}</div>
              <span className={`text-xs hidden sm:block ${step === s.n ? 'text-gray-800' : 'text-neutral'}`}>{s.label}</span>
              {i < 2 && <div className="flex-1 h-px bg-white/10 mx-1" />}
            </div>
          ))}
        </div>

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
                          ? 'border-brand-500 bg-purple-50 text-gray-800'
                          : 'border-gray-100 bg-white/[0.02] text-neutral hover:border-gray-200 hover:text-gray-800'
                      }`}>
                      <span className="text-lg">{t.icon}</span>
                      <span className="text-xs font-semibold">{t.label}</span>
                      <span className="text-[10px] text-neutral leading-tight">{t.description}</span>
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
                <div className="flex items-center gap-3 p-3 bg-purple-50 border border-primary/30 rounded-xl">
                  <Clock size={16} className="text-primary" />
                  <div>
                    <p className="text-primary font-semibold text-sm">
                      {days} day{days !== 1 ? 's' : ''} of {selectedType?.label ?? 'leave'}
                    </p>
                    <p className="text-neutral text-xs">
                      {format(new Date(form.from_date), 'EEE, MMM d')} → {format(new Date(form.to_date), 'EEE, MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                <input type="checkbox" checked={form.is_urgent}
                  onChange={e => f('is_urgent', e.target.checked)}
                  className="w-4 h-4 accent-brand-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Mark as Urgent 🚨</p>
                  <p className="text-xs text-neutral">Flag for priority review by admin</p>
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
                    <Wand2 size={12} className="text-neutral" />
                    <span className="text-xs text-neutral mr-1">Rewrite as:</span>
                    <button type="button" onClick={() => handleTone('casual')} disabled={!!toneLoading}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        toneLoading === 'casual'
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 cursor-wait'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                      }`}>
                      {toneLoading === 'casual' ? <Spinner size="xs" /> : '🌴'} Casual
                    </button>
                    <button type="button" onClick={() => handleTone('formal')} disabled={!!toneLoading}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        toneLoading === 'formal'
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 cursor-wait'
                          : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                      }`}>
                      {toneLoading === 'formal' ? <Spinner size="xs" /> : '💼'} Formal
                    </button>
                  </div>
                </div>
                <textarea value={form.reason} onChange={e => f('reason', e.target.value)} rows={4}
                  placeholder="Write your reason here — then use the Casual or Formal buttons to adjust the tone..."
                  className="input resize-none" />
                <div className="flex justify-between mt-1">
                  {errors.reason ? <p className="text-red-400 text-xs">{errors.reason}</p> : <span />}
                  <p className={`text-xs ${form.reason.length < 20 ? 'text-red-400' : 'text-neutral'}`}>
                    {form.reason.length} / 20 min
                  </p>
                </div>
                <p className="text-xs text-neutral mt-1 flex items-center gap-1">
                  <Wand2 size={10} /> Use the tone buttons above to auto-rewrite your reason as casual or formal.
                </p>
              </div>
              <div>
                <label className="label">Emergency Contact During Leave</label>
                <input type="tel" value={form.contact_during_leave}
                  onChange={e => f('contact_during_leave', e.target.value)}
                  placeholder="+91 98765 43210" className="input" />
              </div>
              <div>
                <label className="label">Work Handover Notes</label>
                <textarea value={form.handover_notes} onChange={e => f('handover_notes', e.target.value)} rows={3}
                  placeholder="Pending tasks or responsibilities to hand over..."
                  className="input resize-none" />
              </div>
            </>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <>
              <div>
                <label className="label">
                  Supporting Documents <span className="text-neutral font-normal">(optional)</span>
                </label>
                <p className="text-xs text-neutral mb-3">
                  Upload medical certificates, doctor's notes, etc. Max 5 files, 5MB each.
                </p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragOver ? 'border-brand-500 bg-purple-50' : 'border-gray-200 hover:border-white/20 hover:bg-white/[0.02]'
                  }`}>
                  <Upload size={28} className={`mx-auto mb-3 ${dragOver ? 'text-primary' : 'text-neutral'}`} />
                  <p className="text-sm font-medium text-gray-600">Drop files here or click to browse</p>
                  <p className="text-xs text-neutral mt-1">JPG, PNG, PDF, DOCX — Max 5MB each</p>
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx"
                    className="hidden" onChange={e => addFiles(e.target.files)} />
                </div>
                {files.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-gray-100 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          file.type.startsWith('image/') ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
                        }`}>
                          {file.type.startsWith('image/') ? <Image size={14} /> : <FileText size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                          <p className="text-xs text-neutral">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        {file.type.startsWith('image/') && (
                          <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        )}
                        <button onClick={() => setFiles(fl => fl.filter((_, j) => j !== i))}
                          className="text-neutral hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 bg-white/[0.02] border border-gray-100 rounded-xl">
                <p className="text-xs font-semibold text-neutral uppercase tracking-wider mb-3">Summary</p>
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
                      <span key={`k-${k}`} className="text-neutral">{k}</span>
                      <span key={`v-${k}`} className={`font-medium ${k === 'Duration' ? 'text-primary' : 'text-gray-800'}`}>{v}</span>
                    </>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div>{step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-secondary">← Back</button>}</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            {step < 3 ? (
              <button onClick={() => { if (step === 1 && !validate()) return; setStep(s => s + 1) }} className="btn-primary">
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
