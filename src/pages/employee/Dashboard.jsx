import { useEffect, useState } from 'react'
import { CheckSquare, Clock, FolderKanban, TrendingUp, LogIn, LogOut } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { StatCard, Spinner, StatusBadge, PriorityBadge } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'

export default function EmployeeDashboard() {
  const { user }  = useAuth()
  const [tasks,   setTasks]   = useState([])
  const [today,   setToday]   = useState(null)
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [clocking,setClocking]= useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [t, att, ts] = await Promise.all([
        api.get('/tasks?limit=5&sort=-createdAt'),
        api.get('/attendance/today'),
        api.get('/tasks/stats'),
      ])
      setTasks(t.data.data ?? [])
      setToday(att.data.data)
      setStats(ts.data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleClockIn = async () => {
    setClocking(true)
    try {
      await api.post('/attendance/clock-in')
      toast.success('Clocked in successfully!'); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to clock in') }
    finally { setClocking(false) }
  }

  const handleClockOut = async () => {
    setClocking(true)
    try {
      await api.patch('/attendance/clock-out')
      toast.success('Clocked out. Have a great day!'); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to clock out') }
    finally { setClocking(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg"/></div>

  const s          = stats || {}
  const isClockedIn = today?.clock_in && !today?.clock_out

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">{user?.designation} · {user?.department}</p>
        </div>

        {/* Attendance clock */}
        <div className="card !p-4 flex items-center gap-4 min-w-64">
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Attendance</p>
            {today ? (
              <div className="mt-1">
                <div className="flex items-center gap-3">
                  {today.clock_in && (
                    <p className="text-xs text-slate-400 font-mono">
                      In: <span className="text-emerald-400">{format(new Date(today.clock_in), 'HH:mm')}</span>
                    </p>
                  )}
                  {today.clock_out && (
                    <p className="text-xs text-slate-400 font-mono">
                      Out: <span className="text-amber-400">{format(new Date(today.clock_out), 'HH:mm')}</span>
                    </p>
                  )}
                </div>
                {today.status && <StatusBadge status={today.status} />}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1">Not clocked in yet</p>
            )}
          </div>
          {!today?.clock_in ? (
            <button onClick={handleClockIn} disabled={clocking} className="btn-primary py-2">
              {clocking ? <Spinner size="sm"/> : <LogIn size={15}/>} Clock In
            </button>
          ) : !today?.clock_out ? (
            <button onClick={handleClockOut} disabled={clocking} className="btn-secondary py-2">
              {clocking ? <Spinner size="sm"/> : <LogOut size={15}/>} Clock Out
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-semibold">Done for today ✓</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Tasks"    value={s.total}               icon={CheckSquare}  color="brand" />
        <StatCard label="In Progress" value={s['in-progress'] ?? 0} icon={TrendingUp}   color="amber" />
        <StatCard label="Completed"   value={s.completed ?? 0}      icon={CheckSquare}  color="emerald" />
        <StatCard label="Pending"     value={s.todo ?? 0}           icon={Clock}        color="blue" />
      </div>

      {/* Recent tasks */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Tasks</h3>
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
                      t.priority === 'critical' ? 'bg-red-500' :
                      t.priority === 'high'     ? 'bg-orange-500' :
                      t.priority === 'medium'   ? 'bg-yellow-500' : 'bg-emerald-500'
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
                    <PriorityBadge priority={t.priority}/>
                    <StatusBadge   status={t.status}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
