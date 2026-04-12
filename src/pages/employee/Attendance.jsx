import { useEffect, useState, useCallback } from 'react'
import { LogIn, LogOut, RefreshCw, Clock } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { PageHeader, StatusBadge, Spinner, EmptyState, StatCard } from '../../components/common/UI'

export default function EmployeeAttendance() {
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
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const clockIn = async () => {
    setClocking(true)
    try { await api.post('/attendance/clock-in'); toast.success('Clocked in!'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setClocking(false) }
  }

  const clockOut = async () => {
    setClocking(true)
    try { await api.patch('/attendance/clock-out'); toast.success('Clocked out!'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setClocking(false) }
  }

  // Stats from history
  const present = history.filter(r => r.status === 'present' || r.status === 'late').length
  const absent  = history.filter(r => r.status === 'absent').length
  const onLeave = history.filter(r => r.status === 'on-leave').length

  const isClockedIn  = today?.clock_in && !today?.clock_out
  const isDone       = today?.clock_in && today?.clock_out

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="My Attendance" subtitle="Track your daily clock-ins and attendance history" />

      {/* Clock card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today — {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            {loading ? (
              <Spinner size="sm" />
            ) : (
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
                {isDone && today.clock_in && today.clock_out && (
                  <div>
                    <p className="text-xs text-slate-500">Total Hours</p>
                    <p className="text-2xl font-bold font-mono mt-0.5 text-brand-400">
                      {((new Date(today.clock_out) - new Date(today.clock_in)) / 3600000).toFixed(1)}h
                    </p>
                  </div>
                )}
                {today?.status && (
                  <div className="mt-1"><StatusBadge status={today.status}/></div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {!today?.clock_in ? (
              <button onClick={clockIn} disabled={clocking} className="btn-primary py-3 px-6 text-base">
                {clocking ? <Spinner size="sm"/> : <LogIn size={18}/>}
                Clock In
              </button>
            ) : !today?.clock_out ? (
              <button onClick={clockOut} disabled={clocking} className="btn-secondary py-3 px-6 text-base">
                {clocking ? <Spinner size="sm"/> : <LogOut size={18}/>}
                Clock Out
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
          <h3 className="text-sm font-semibold text-white">Attendance History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-200/50">
              <tr>
                {['Date','Status','Clock In','Clock Out','Hours'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><Spinner/></td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={Clock} title="No attendance records" /></td></tr>
              ) : history.map(r => {
                const hrs = r.clock_in && r.clock_out
                  ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1) : null
                return (
                  <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell font-mono text-xs">{r.date ? format(parseISO(r.date.slice(0,10)), 'EEE, MMM d yyyy') : '—'}</td>
                    <td className="table-cell"><StatusBadge status={r.status}/></td>
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
