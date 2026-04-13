import { useEffect, useState, useCallback, useRef } from 'react'
import { LogIn, LogOut, Clock, Users, CalendarOff, Upload, X, FileText, Image, CheckCircle2, XCircle, AlertCircle, RefreshCw, UserMinus } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { PageHeader, SelectInput, Modal, StatusBadge, Spinner, EmptyState, StatCard } from '../../components/common/UI'

const LEAVE_TYPES = [
  { value: 'sick',      label: 'Sick Leave',      icon: '🤒', description: 'Medical illness or health issues' },
  { value: 'casual',    label: 'Casual Leave',    icon: '🌴', description: 'Personal or casual reasons' },
  { value: 'earned',    label: 'Earned Leave',    icon: '🏖️', description: 'Planned annual leave' },
  { value: 'maternity', label: 'Maternity Leave', icon: '👶', description: 'Maternity / paternity leave' },
  { value: 'emergency', label: 'Emergency Leave', icon: '🚨', description: 'Unforeseen emergency situations' },
  { value: 'unpaid',    label: 'Unpaid Leave',    icon: '💸', description: 'Leave without pay' },
]

const LEAVE_STATUS_CONFIG = {
  pending:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   icon: AlertCircle  },
  approved: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  rejected: { color: 'text-red-400 bg-red-500/10 border-red-500/20',        icon: XCircle      },
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
    }`}>{children}</button>
  )
}

export default function ManagerAttendance() {
  const [activeTab, setActiveTab] = useState('my')
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

      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        <TabBtn active={activeTab === 'my'}    onClick={() => setActiveTab('my')}><Clock size={14} /> My Attendance</TabBtn>
        <TabBtn active={activeTab === 'leaves'} onClick={() => setActiveTab('leaves')}><CalendarOff size={14} /> My Leaves</TabBtn>
        <TabBtn active={activeTab === 'team'}  onClick={() => setActiveTab('team')}><Users size={14} /> Team Attendance</TabBtn>
      </div>

      {activeTab === 'my'     && <MyAttendanceTab />}
      {activeTab === 'leaves' && <MyLeavesTab onApply={() => setLeaveModal(true)} />}
      {activeTab === 'team'   && <TeamAttendanceTab />}

      {leaveModal && (
        <ApplyLeaveModal onClose={() => setLeaveModal(false)} onSuccess={() => { setLeaveModal(false); setActiveTab('leaves') }} />
      )}
    </div>
  )
}

function MyAttendanceTab() {
  const [today,   setToday]   = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [clocking,setClocking]= useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, h] = await Promise.all([api.get('/attendance/today'), api.get('/attendance/my?limit=30')])
      setToday(t.data.data); setHistory(h.data.data ?? [])
    } catch { toast.error('Failed to load attendance') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const clockIn  = async () => { setClocking(true); try { await api.post('/attendance/clock-in');   toast.success('Clocked in!');  load() } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setClocking(false) } }
  const clockOut = async () => { setClocking(true); try { await api.patch('/attendance/clock-out'); toast.success('Clocked out!'); load() } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setClocking(false) } }

  const present = history.filter(r => r.status === 'present' || r.status === 'late').length
  const absent  = history.filter(r => r.status === 'absent').length
  const onLeave = history.filter(r => r.status === 'on-leave').length
  const isDone  = today?.clock_in && today?.clock_out

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today — {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            {loading ? <Spinner size="sm" /> : (
              <div className="mt-2 flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-slate-500">Clock In</p>
                  <p className={`text-2xl font-bold font-mono mt-0.5 ${today?.clock_in ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {today?.clock_in ? format(new Date(today.clock_in), 'HH:mm') : '--:--'}
                  </p>
                </div>
                <div className="text-slate-600 text-xl font-thin">→</div>
                <div>
                  <p className="text-xs text-slate-500">Clock Out</p>
                  <p className={`text-2xl font-bold font-mono mt-0.5 ${today?.clock_out ? 'text-amber-400' : 'text-slate-600'}`}>
                    {today?.clock_out ? format(new Date(today.clock_out), 'HH:mm') : '--:--'}
                  </p>
                </div>
                {isDone && <div><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold font-mono mt-0.5 text-brand-400">{((new Date(today.clock_out) - new Date(today.clock_in)) / 3600000).toFixed(1)}h</p></div>}
                {today?.status && <div className="mt-1"><StatusBadge status={today.status} /></div>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {!today?.clock_in ? (
              <button onClick={clockIn} disabled={clocking} className="btn-primary py-3 px-6 text-base flex items-center gap-2">
                {clocking ? <Spinner size="sm" /> : <LogIn size={18} />} Clock In
              </button>
            ) : !today?.clock_out ? (
              <button onClick={clockOut} disabled={clocking} className="btn-secondary py-3 px-6 text-base flex items-center gap-2">
                {clocking ? <Spinner size="sm" /> : <LogOut size={18} />} Clock Out
              </button>
            ) : (
              <div className="px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-emerald-400 font-semibold text-sm">✓ Completed for today</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present Days" value={present} icon={Clock} color="emerald" />
        <StatCard label="Absent Days"  value={absent}  icon={Clock} color="red" />
        <StatCard label="On Leave"     value={onLeave} icon={Clock} color="amber" />
      </div>
      <div className="card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5"><h3 className="text-sm font-semibold text-white">My Attendance History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-200/50">
              <tr>{['Date', 'Status', 'Clock In', 'Clock Out', 'Hours'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="py-12 text-center"><Spinner /></td></tr>
              : history.length === 0 ? <tr><td colSpan={5}><EmptyState icon={Clock} title="No attendance records" /></td></tr>
              : history.map(r => {
                const hrs = r.clock_in && r.clock_out ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1) : null
                return (
                  <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell font-mono text-xs">{r.date ? format(parseISO(r.date.slice(0, 10)), 'EEE, MMM d yyyy') : '—'}</td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell font-mono text-xs text-emerald-400">{r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}</td>
                    <td className="table-cell font-mono text-xs text-amber-400">{r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}</td>
                    <td className="table-cell text-xs text-slate-400">{hrs ? `${hrs}h` : '—'}</td>
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

function MyLeavesTab({ onApply }) {
  const [leaves,  setLeaves]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/leaves/my').then(r => setLeaves(r.data.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (leaves.length === 0) return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <CalendarOff size={40} className="text-slate-600 mb-4" />
      <p className="text-slate-400 font-medium">No leave requests yet</p>
      <button onClick={onApply} className="btn-primary mt-4"><CalendarOff size={15} /> Apply for Leave</button>
    </div>
  )
  return (
    <div className="space-y-3">
      {leaves.map(leave => {
        const cfg = LEAVE_STATUS_CONFIG[leave.status] ?? LEAVE_STATUS_CONFIG.pending
        const StatusIcon = cfg.icon
        const lt = LEAVE_TYPES.find(t => t.value === leave.leave_type)
        return (
          <div key={leave._id} className="card hover:border-white/10 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="text-2xl">{lt?.icon ?? '📋'}</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-white text-sm">{lt?.label ?? leave.leave_type}</h4>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}><StatusIcon size={11} /> {leave.status}</span>
                    {leave.is_urgent && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">🚨 Urgent</span>}
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    {leave.from_date ? format(parseISO(leave.from_date.slice(0, 10)), 'MMM d, yyyy') : '—'} → {leave.to_date ? format(parseISO(leave.to_date.slice(0, 10)), 'MMM d, yyyy') : '—'}
                    {leave.days && <span className="ml-2 text-brand-400">({leave.days} day{leave.days !== 1 ? 's' : ''})</span>}
                  </p>
                  {leave.reason && <p className="text-slate-500 text-xs mt-1 italic">"{leave.reason}"</p>}
                  {leave.admin_note && (
                    <p className={`text-xs mt-2 px-2 py-1 rounded-lg border ${leave.status === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                      Admin: {leave.admin_note}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 flex-shrink-0">{leave.createdAt ? format(new Date(leave.createdAt), 'MMM d, yyyy') : ''}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
      const [r, u] = await Promise.all([api.get('/attendance', { params }), api.get('/users', { params: { role: 'employee', status: 'active' } })])
      setRecords(r.data.data ?? []); setUsers(u.data.data ?? [])
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }, [dateF, statusF])

  useEffect(() => { load() }, [load])

  const handleMarkAbsent = async () => {
    if (!absentIds.length) { toast.error('Select at least one'); return }
    setSaving(true)
    try { await api.post('/attendance/mark-absent', { user_ids: absentIds, date: dateF }); toast.success('Marked absent'); setAbsentModal(false); setAbsentIds([]); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  const present = records.filter(r => r.status === 'present').length
  const absent  = records.filter(r => r.status === 'absent').length
  const late    = records.filter(r => r.status === 'late').length

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button className="btn-secondary flex items-center gap-2" onClick={() => setAbsentModal(true)}><UserMinus size={16} /> Mark Absent</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present" value={present} icon={Clock} color="emerald" />
        <StatCard label="Absent"  value={absent}  icon={Clock} color="red" />
        <StatCard label="Late"    value={late}    icon={Clock} color="amber" />
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
            <thead className="bg-surface-200/50">
              <tr>{['Employee', 'Department', 'Status', 'Clock In', 'Clock Out', 'Hours'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="py-16 text-center"><Spinner /></td></tr>
              : records.length === 0 ? <tr><td colSpan={6}><EmptyState icon={Clock} title="No records" description="Try a different date" /></td></tr>
              : records.map(r => {
                const hrs = r.clock_in && r.clock_out ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1) : null
                return (
                  <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xs">
                          {(r.user_id?.name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white">{r.user_id?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="table-cell text-slate-400 text-sm">{r.user_id?.department ?? '—'}</td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell text-slate-400 font-mono text-xs">{r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}</td>
                    <td className="table-cell text-slate-400 font-mono text-xs">{r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}</td>
                    <td className="table-cell text-slate-400 text-xs">{hrs ? `${hrs}h` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={absentModal} onClose={() => { setAbsentModal(false); setAbsentIds([]) }} title="Mark Users Absent"
        footer={<><button className="btn-secondary" onClick={() => { setAbsentModal(false); setAbsentIds([]) }} disabled={saving}>Cancel</button><button className="btn-primary" onClick={handleMarkAbsent} disabled={saving}>Mark Absent</button></>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Select employees to mark absent for <span className="text-white font-semibold">{dateF}</span>:</p>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-white/5 rounded-xl p-2">
            {users.map(u => (
              <label key={u._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={absentIds.includes(u._id)}
                  onChange={e => setAbsentIds(ids => e.target.checked ? [...ids, u._id] : ids.filter(id => id !== u._id))}
                  className="w-4 h-4 accent-brand-500" />
                <span className="text-sm text-slate-300">{u.name}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ApplyLeaveModal({ onClose, onSuccess }) {
  const fileInputRef = useRef(null)
  const [step, setStep]   = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm]   = useState({ leave_type: '', from_date: '', to_date: '', reason: '', contact_during_leave: '', handover_notes: '', is_urgent: false })
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState({})

  const days = form.from_date && form.to_date ? Math.max(0, Math.ceil((new Date(form.to_date) - new Date(form.from_date)) / 86400000) + 1) : 0

  const validate = () => {
    const e = {}
    if (!form.leave_type) e.leave_type = 'Please select a leave type'
    if (!form.from_date)  e.from_date  = 'Start date is required'
    if (!form.to_date)    e.to_date    = 'End date is required'
    if (form.from_date && form.to_date && form.to_date < form.from_date) e.to_date = 'End date must be after start date'
    if (!form.reason || form.reason.trim().length < 20) e.reason = 'Reason must be at least 20 characters'
    setErrors(e); return Object.keys(e).length === 0
  }

  const addFiles = (newFiles) => {
    const valid = Array.from(newFiles).filter(f => { const ok = f.size <= 5 * 1024 * 1024; if (!ok) toast.error(`${f.name} exceeds 5MB`); return ok })
    setFiles(prev => [...prev, ...valid].slice(0, 5))
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (files.length > 0) {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v))
        fd.append('days', days)
        files.forEach(f => fd.append('documents', f))
        await api.post('/leaves', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        await api.post('/leaves', { ...form, days })
      }
      toast.success('Leave application submitted!'); onSuccess()
    } catch (e) { toast.error(e.response?.data?.message || 'Submission failed') } finally { setSaving(false) }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const selectedType = LEAVE_TYPES.find(t => t.value === form.leave_type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-[#151823] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2"><CalendarOff size={18} className="text-brand-400" /> Apply for Leave</h2>
            <p className="text-xs text-slate-500 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          {[{ n: 1, label: 'Leave Details' }, { n: 2, label: 'Reason & Notes' }, { n: 3, label: 'Documents & Review' }].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s.n ? 'bg-brand-600 text-white' : step > s.n ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-500'}`}>{step > s.n ? '✓' : s.n}</div>
              <span className={`text-xs hidden sm:block ${step === s.n ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
              {i < 2 && <div className="flex-1 h-px bg-white/10 mx-1" />}
            </div>
          ))}
        </div>

        <div className="px-6 py-5 space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="label">Leave Type <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                  {LEAVE_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => f('leave_type', t.value)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${form.leave_type === t.value ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10 hover:text-white'}`}>
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
                  <input type="date" value={form.from_date} min={format(new Date(), 'yyyy-MM-dd')} onChange={e => f('from_date', e.target.value)} className="input" />
                  {errors.from_date && <p className="text-red-400 text-xs mt-1">{errors.from_date}</p>}
                </div>
                <div>
                  <label className="label">To Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.to_date} min={form.from_date || format(new Date(), 'yyyy-MM-dd')} onChange={e => f('to_date', e.target.value)} className="input" />
                  {errors.to_date && <p className="text-red-400 text-xs mt-1">{errors.to_date}</p>}
                </div>
              </div>
              {days > 0 && (
                <div className="flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                  <Clock size={16} className="text-brand-400" />
                  <div>
                    <p className="text-brand-400 font-semibold text-sm">{days} day{days !== 1 ? 's' : ''} of {selectedType?.label ?? 'leave'}</p>
                    <p className="text-slate-500 text-xs">{format(new Date(form.from_date), 'EEE, MMM d')} → {format(new Date(form.to_date), 'EEE, MMM d, yyyy')}</p>
                  </div>
                </div>
              )}
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                <input type="checkbox" checked={form.is_urgent} onChange={e => f('is_urgent', e.target.checked)} className="w-4 h-4 accent-brand-500 mt-0.5" />
                <div><p className="text-sm font-medium text-white">Mark as Urgent 🚨</p><p className="text-xs text-slate-500">Flag for priority review by admin</p></div>
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="label">Reason for Leave <span className="text-red-400">*</span></label>
                <textarea value={form.reason} onChange={e => f('reason', e.target.value)} rows={4} placeholder="Provide a detailed reason (minimum 20 characters)..." className="input resize-none" />
                <div className="flex justify-between mt-1">
                  {errors.reason ? <p className="text-red-400 text-xs">{errors.reason}</p> : <span />}
                  <p className={`text-xs ${form.reason.length < 20 ? 'text-red-400' : 'text-slate-500'}`}>{form.reason.length} / 20 min</p>
                </div>
              </div>
              <div>
                <label className="label">Emergency Contact During Leave</label>
                <input type="tel" value={form.contact_during_leave} onChange={e => f('contact_during_leave', e.target.value)} placeholder="+91 98765 43210" className="input" />
              </div>
              <div>
                <label className="label">Work Handover Notes</label>
                <textarea value={form.handover_notes} onChange={e => f('handover_notes', e.target.value)} rows={3} placeholder="Pending tasks or responsibilities to hand over..." className="input resize-none" />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="label">Supporting Documents <span className="text-slate-500 font-normal">(optional)</span></label>
                <p className="text-xs text-slate-500 mb-3">Upload medical certificates, doctor's notes, etc. Max 5 files, 5MB each.</p>
                <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-brand-500 bg-brand-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'}`}>
                  <Upload size={28} className={`mx-auto mb-3 ${dragOver ? 'text-brand-400' : 'text-slate-500'}`} />
                  <p className="text-sm font-medium text-slate-300">Drop files here or click to browse</p>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG, PDF, DOCX — Max 5MB each</p>
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={e => addFiles(e.target.files)} />
                </div>
                {files.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${file.type.startsWith('image/') ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                          {file.type.startsWith('image/') ? <Image size={14} /> : <FileText size={14} />}
                        </div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{file.name}</p><p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p></div>
                        {file.type.startsWith('image/') && <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                        <button onClick={() => setFiles(fl => fl.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Summary</p>
                <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                  {[['Type', `${selectedType?.icon ?? ''} ${selectedType?.label ?? '—'}`], ['Duration', `${days} day${days !== 1 ? 's' : ''}`], ['From', form.from_date ? format(new Date(form.from_date), 'EEE, MMM d yyyy') : '—'], ['To', form.to_date ? format(new Date(form.to_date), 'EEE, MMM d yyyy') : '—'], ['Priority', form.is_urgent ? '🚨 Urgent' : 'Normal'], ['Documents', files.length > 0 ? `${files.length} file(s)` : 'None']].map(([k, v]) => (
                    <><span key={k} className="text-slate-500">{k}</span><span key={k+'v'} className={`font-medium ${k === 'Duration' ? 'text-brand-400' : 'text-white'}`}>{v}</span></>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <div>{step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-secondary">← Back</button>}</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            {step < 3 ? (
              <button onClick={() => { if (step === 1 && !validate()) return; setStep(s => s + 1) }} className="btn-primary">Next →</button>
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
