import { useEffect, useState } from 'react'
import { FolderKanban, CheckSquare, Users, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../../api/axios'
import { StatCard, Spinner, StatusBadge, PriorityBadge } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

const Tooltip_ = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-100 border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.fill }} className="font-semibold">{p.value}</p>)}
    </div>
  )
}

export default function ManagerDashboard() {
  const { user } = useAuth()
  const [data, setData]     = useState(null)
  const [tasks, setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [p, t, ts] = await Promise.all([
          api.get('/projects/stats'),
          api.get('/tasks?limit=5&sort=-createdAt'),
          api.get('/tasks/stats'),
        ])
        setData({ projects: p.data.data, taskStats: ts.data.data })
        setTasks(t.data.data ?? [])
      } catch {} finally { setLoading(false) }
    }
    fetch()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg"/></div>

  const p  = data?.projects   || {}
  const ts = data?.taskStats  || {}
  const taskChart = Object.entries(ts?.by_status || {}).map(([k,v]) => ({ name: k, count: v }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">Here's an overview of your projects and team.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Projects"  value={p.total}               icon={FolderKanban} color="brand"   trend={`${p.active||0} active`} />
        <StatCard label="Total Tasks"  value={ts.total}              icon={CheckSquare}  color="amber"   trend={`${ts.completed||0} done`} />
        <StatCard label="In Progress"  value={ts['in-progress']||0}  icon={TrendingUp}   color="blue" />
        <StatCard label="Completion"   value={ts.total ? `${Math.round((ts.completed||0)/ts.total*100)}%` : '0%'} icon={TrendingUp} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Task Status Breakdown</h3>
          {taskChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={taskChart} barSize={24}>
                <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#64748b', fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tooltip_/>} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="count" radius={[5,5,0,0]}>
                  {taskChart.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-40 flex items-center justify-center text-slate-600 text-sm">No task data</div>}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Tasks</h3>
          <div className="space-y-3">
            {tasks.length === 0
              ? <p className="text-slate-600 text-sm text-center py-6">No tasks yet</p>
              : tasks.map(t => (
                <div key={t._id} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{t.title}</p>
                    <p className="text-xs text-slate-500">{t.assigned_to?.name ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge   status={t.status} />
                  </div>
                </div>
              ))}
          </div>
        </div>
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
