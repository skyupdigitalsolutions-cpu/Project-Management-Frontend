import { useEffect, useState } from 'react'
import { CheckSquare, Clock, FolderKanban, TrendingUp, LogIn, LogOut, CalendarOff, Bell, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import api, { fetchMyLeaves } from '../../api/axios'
import toast from 'react-hot-toast'
import { StatCard, Spinner, StatusBadge, PriorityBadge } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'
import { format, parseISO } from 'date-fns'

export default function EmployeeDashboard() {
  const { user }    = useAuth()
  const [tasks,     setTasks]     = useState([])
  const [today,     setToday]     = useState(null)
  const [stats,     setStats]     = useState(null)
  const [leaves,    setLeaves]    = useState([])
  const [projects,  setProjects]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [clocking,  setClocking]  = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [t, att, ts, p] = await Promise.allSettled([
        api.get('/tasks?limit=5&sort=-createdAt'),
        api.get('/attendance/today'),
        api.get('/tasks/stats'),
        api.get('/projects?limit=3'),
      ])
      if (t.status   === 'fulfilled') setTasks(t.value.data.data ?? [])
      if (att.status === 'fulfilled') setToday(att.value.data.data)
      if (ts.status  === 'fulfilled') setStats(ts.value.data.data)
      if (p.status   === 'fulfilled') setProjects(p.value.data.data ?? [])
      // fetchMyLeaves never throws — returns [] if backend unsupported
      const myLeaves = await fetchMyLeaves()
      setLeaves(myLeaves)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleClockIn = async () => {
    setClocking(true)
    try { await api.post('/attendance/clock-in'); toast.success('Clocked in successfully!'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed to clock in') }
    finally { setClocking(false) }
  }

  const handleClockOut = async () => {
    setClocking(true)
    try { await api.patch('/attendance/clock-out'); toast.success('Clocked out. Have a great day!'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed to clock out') }
    finally { setClocking(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const s = stats || {}
  const pendingLeaves = leaves.filter(l => l.status === 'pending')
  const approvedLeaves = leaves.filter(l => l.status === 'approved')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome row */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-400 text-sm mt-1">{user?.designation} · {user?.department}</p>
        </div>

        {/* Attendance clock */}
        <div className="card !p-4 flex items-center gap-4 min-w-64">
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Attendance</p>
            {today ? (
              <div className="mt-1">
                <div className="flex items-center gap-3">
                  {today.clock_in && <p className="text-xs text-slate-400 font-mono">In: <span className="text-emerald-400">{format(new Date(today.clock_in), 'HH:mm')}</span></p>}
                  {today.clock_out && <p className="text-xs text-slate-400 font-mono">Out: <span className="text-amber-400">{format(new Date(today.clock_out), 'HH:mm')}</span></p>}
                </div>
                {today.status && <StatusBadge status={today.status} />}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1">Not clocked in yet</p>
            )}
          </div>
          {!today?.clock_in ? (
            <button onClick={handleClockIn} disabled={clocking} className="btn-primary py-2">
              {clocking ? <Spinner size="sm" /> : <LogIn size={15} />} Clock In
            </button>
          ) : !today?.clock_out ? (
            <button onClick={handleClockOut} disabled={clocking} className="btn-secondary py-2">
              {clocking ? <Spinner size="sm" /> : <LogOut size={15} />} Clock Out
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-semibold">Done ✓</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Tasks"    value={s.total}               icon={CheckSquare} color="brand"   />
        <StatCard label="In Progress" value={s['in-progress'] ?? 0} icon={TrendingUp}  color="amber"   />
        <StatCard label="Completed"   value={s.completed ?? 0}      icon={CheckSquare} color="emerald" />
        <StatCard label="Pending"     value={s.todo ?? 0}           icon={Clock}       color="blue"    />
      </div>

      {/* Leave status alerts */}
      {leaves.length > 0 && (
        <div className="space-y-2">
          {pendingLeaves.map(leave => (
            <div key={leave._id} className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">
                Your <span className="font-semibold">{leave.leave_type}</span> leave request ({leave.days ?? '?'} day{leave.days !== 1 ? 's' : ''}) is pending approval
              </p>
            </div>
          ))}
          {approvedLeaves.slice(0, 1).map(leave => (
            <div key={leave._id} className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-300">
                Your <span className="font-semibold">{leave.leave_type}</span> leave ({leave.from_date ? format(parseISO(leave.from_date.slice(0,10)), 'MMM d') : ''}–{leave.to_date ? format(parseISO(leave.to_date.slice(0,10)), 'MMM d') : ''}) has been approved
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tasks */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><CheckSquare size={14} className="text-brand-400" /> Recent Tasks</h3>
          {tasks.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">No tasks assigned yet</p>
          ) : (
            <div className="space-y-3">
              {tasks.map(t => {
                const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
                return (
                  <div key={t._id} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${
                        t.priority === 'critical' ? 'bg-red-500' : t.priority === 'high' ? 'bg-orange-500' : t.priority === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{t.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t.project_id?.title ?? 'No project'} ·
                          <span className={overdue ? ' text-red-400' : ''}>
                            {t.due_date ? ` Due ${format(new Date(t.due_date), 'MMM d')}` : ''}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PriorityBadge priority={t.priority} /><StatusBadge status={t.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Leave summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><CalendarOff size={14} className="text-brand-400" /> My Leave Requests</h3>
            <a href="/employee/attendance" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">View all →</a>
          </div>
          {leaves.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CalendarOff size={32} className="text-slate-600 mb-3" />
              <p className="text-slate-500 text-sm">No leave requests</p>
              <a href="/employee/attendance" className="text-xs text-brand-400 mt-2 hover:text-brand-300 transition-colors">Apply for leave →</a>
            </div>
          ) : (
            <div className="space-y-2">
              {leaves.slice(0, 4).map(leave => {
                const statusConfig = {
                  pending:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   icon: AlertCircle  },
                  approved: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
                  rejected: { color: 'text-red-400 bg-red-500/10 border-red-500/20',        icon: XCircle      },
                }[leave.status] ?? {}
                const StatusIcon = statusConfig.icon ?? AlertCircle
                return (
                  <div key={leave._id} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{leave.leave_type} leave</p>
                      <p className="text-xs text-slate-500">
                        {leave.from_date ? format(parseISO(leave.from_date.slice(0, 10)), 'MMM d') : '—'} – {leave.to_date ? format(parseISO(leave.to_date.slice(0, 10)), 'MMM d, yyyy') : '—'}
                        {leave.days && ` · ${leave.days}d`}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusConfig.color}`}>
                      <StatusIcon size={11} /> {leave.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Projects */}
      {projects.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><FolderKanban size={14} className="text-brand-400" /> My Projects</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {projects.map(p => (
              <div key={p._id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">{p.title}</p>
                  <StatusBadge status={p.status} />
                </div>
                {p.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>}
                {p.due_date && (
                  <p className={`text-xs mt-2 ${new Date(p.due_date) < new Date() && p.status !== 'completed' ? 'text-red-400' : 'text-slate-500'}`}>
                    Due {format(new Date(p.due_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
