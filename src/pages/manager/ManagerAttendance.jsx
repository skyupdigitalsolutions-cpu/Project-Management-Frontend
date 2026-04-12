import { useEffect, useState, useCallback } from 'react'
import { LogIn, LogOut, RefreshCw, UserMinus, Clock, Users } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import {
  PageHeader, SelectInput, Modal, StatusBadge,
  Spinner, EmptyState, StatCard
} from '../../components/common/UI'

// ─── Root: two tabs ───────────────────────────────────────────────────────────
export default function ManagerAttendance() {
  const [activeTab, setActiveTab] = useState('my')

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Attendance"
        subtitle="Track your own attendance and monitor your team"
      />

      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        <TabBtn active={activeTab === 'my'}   onClick={() => setActiveTab('my')}>
          <Clock size={14} /> My Attendance
        </TabBtn>
        <TabBtn active={activeTab === 'team'} onClick={() => setActiveTab('team')}>
          <Users size={14} /> Team Attendance
        </TabBtn>
      </div>

      {activeTab === 'my'   && <MyAttendanceTab />}
      {activeTab === 'team' && <TeamAttendanceTab />}
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Tab 1: Manager's own clock in/out ───────────────────────────────────────
function MyAttendanceTab() {
  const [today,    setToday]    = useState(null)
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [clocking, setClocking] = useState(false)

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
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const clockIn = async () => {
    setClocking(true)
    try { await api.post('/attendance/clock-in'); toast.success('Clocked in!'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed to clock in') }
    finally { setClocking(false) }
  }

  const clockOut = async () => {
    setClocking(true)
    try { await api.patch('/attendance/clock-out'); toast.success('Clocked out!'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed to clock out') }
    finally { setClocking(false) }
  }

  const present = history.filter(r => r.status === 'present' || r.status === 'late').length
  const absent  = history.filter(r => r.status === 'absent').length
  const onLeave = history.filter(r => r.status === 'on-leave').length
  const isDone  = today?.clock_in && today?.clock_out

  return (
    <div className="space-y-6">
      {/* Clock card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today — {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
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
                {isDone && (
                  <div>
                    <p className="text-xs text-slate-500">Total Hours</p>
                    <p className="text-2xl font-bold font-mono mt-0.5 text-brand-400">
                      {((new Date(today.clock_out) - new Date(today.clock_in)) / 3600000).toFixed(1)}h
                    </p>
                  </div>
                )}
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present Days" value={present} icon={Clock} color="emerald" />
        <StatCard label="Absent Days"  value={absent}  icon={Clock} color="red" />
        <StatCard label="On Leave"     value={onLeave} icon={Clock} color="amber" />
      </div>

      {/* History */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">My Attendance History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-200/50">
              <tr>
                {['Date', 'Status', 'Clock In', 'Clock Out', 'Hours'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><Spinner /></td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={Clock} title="No attendance records" /></td></tr>
              ) : history.map(r => {
                const hrs = r.clock_in && r.clock_out
                  ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1) : null
                return (
                  <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell font-mono text-xs">
                      {r.date ? format(parseISO(r.date.slice(0, 10)), 'EEE, MMM d yyyy') : '—'}
                    </td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell font-mono text-xs text-emerald-400">
                      {r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}
                    </td>
                    <td className="table-cell font-mono text-xs text-amber-400">
                      {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}
                    </td>
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

// ─── Tab 2: Team attendance view ──────────────────────────────────────────────
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
    finally { setLoading(false) }
  }, [dateF, statusF])

  useEffect(() => { load() }, [load])

  const handleMarkAbsent = async () => {
    if (!absentIds.length) { toast.error('Select at least one'); return }
    setSaving(true)
    try {
      await api.post('/attendance/mark-absent', { user_ids: absentIds, date: dateF })
      toast.success('Marked absent'); setAbsentModal(false); setAbsentIds([]); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
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
        <StatCard label="Absent"  value={absent}  icon={Clock} color="red" />
        <StatCard label="Late"    value={late}    icon={Clock} color="amber" />
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="date" value={dateF} onChange={e => setDateF(e.target.value)} className="input w-44" />
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={['present', 'absent', 'late', 'on-leave', 'half-day'].map(s => ({ value: s, label: s }))}
          className="w-40" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-200/50">
              <tr>{['Employee', 'Department', 'Status', 'Clock In', 'Clock Out', 'Hours'].map(h => (
                <th key={h} className="table-header text-left">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><Spinner /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={Clock} title="No records" description="Try a different date" /></td></tr>
              ) : records.map(r => {
                const hrs = r.clock_in && r.clock_out
                  ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1) : null
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
                    <td className="table-cell text-slate-400 font-mono text-xs">
                      {r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}
                    </td>
                    <td className="table-cell text-slate-400 font-mono text-xs">
                      {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}
                    </td>
                    <td className="table-cell text-slate-400 text-xs">{hrs ? `${hrs}h` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={absentModal} onClose={() => { setAbsentModal(false); setAbsentIds([]) }}
        title="Mark Users Absent"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setAbsentModal(false); setAbsentIds([]) }} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleMarkAbsent} disabled={saving}>Mark Absent</button>
          </>
        }
      >
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