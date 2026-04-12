import { useEffect, useState } from 'react'
import { Users, FolderKanban, CheckSquare, Clock, TrendingUp, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../../api/axios'
import { StatCard, Spinner, StatusBadge, PriorityBadge } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-100 border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const { user }   = useAuth()
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [users, projects, tasks] = await Promise.all([
          api.get('/users/stats'),
          api.get('/projects/stats'),
          api.get('/tasks/stats'),
        ])
        setData({ users: users.data.data, projects: projects.data.data, tasks: tasks.data.data })
      } catch {} finally { setLoading(false) }
    }
    fetch()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  )

  const u = data?.users || {}
  const p = data?.projects || {}
  const t = data?.tasks || {}

  // Build chart data
  const taskChart = Object.entries(t?.by_status || {}).map(([k, v]) => ({ name: k, count: v }))
  const projectChart = Object.entries(p?.by_status || {}).map(([k, v]) => ({ name: k, value: v }))
  const userByRole = [
    { name: 'Admin',    value: u.admin || 0 },
    { name: 'Manager',  value: u.manager || 0 },
    { name: 'Employee', value: u.employee || 0 },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">Here's what's happening across your organization today.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"     value={u.total}   icon={Users}        color="brand"   trend={`${u.active || 0} active`} />
        <StatCard label="Total Projects"  value={p.total}   icon={FolderKanban} color="emerald" trend={`${p.active || 0} in progress`} />
        <StatCard label="Total Tasks"     value={t.total}   icon={CheckSquare}  color="amber"   trend={`${t.completed || 0} completed`} />
        <StatCard label="Completion Rate" value={t.total ? `${Math.round((t.completed || 0) / t.total * 100)}%` : '0%'} icon={TrendingUp} color="purple" trend="Task completion" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task status bar chart */}
        <div className="lg:col-span-2 card">
          <h3 className="text-sm font-semibold text-white mb-4">Tasks by Status</h3>
          {taskChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={taskChart} barSize={28}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {taskChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No data</div>
          )}
        </div>

        {/* User by role pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Users by Role</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={userByRole} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                {userByRole.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Projects & Task summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Projects by Status</h3>
          <div className="space-y-3">
            {projectChart.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-slate-300 capitalize">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-white">{item.value}</span>
              </div>
            ))}
            {projectChart.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No projects yet</p>}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Stats</h3>
          <div className="space-y-3">
            {[
              { label: 'Active users',      val: u.active || 0,   color: 'text-emerald-400' },
              { label: 'On leave',          val: u['on-leave'] || 0, color: 'text-amber-400' },
              { label: 'Inactive',          val: u.inactive || 0, color: 'text-slate-400' },
              { label: 'Tasks in progress', val: t['in-progress'] || 0, color: 'text-blue-400' },
              { label: 'Overdue tasks',     val: t.overdue || 0,  color: 'text-red-400' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-400">{row.label}</span>
                <span className={`text-sm font-bold ${row.color}`}>{row.val}</span>
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
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
