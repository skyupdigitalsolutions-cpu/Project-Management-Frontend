import { useEffect, useState } from 'react'
import { Users, FolderKanban, CheckSquare, TrendingUp, CalendarOff } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api, { fetchAllLeaves } from '../../api/axios'
import { StatCard, Spinner, StatusBadge, PriorityBadge } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-100 border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [leavePending, setLeavePending] = useState(0)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setError(null)
        const [usersRes, projectsRes, tasksRes, leavesRes] = await Promise.all([
          api.get('/users/stats'),
          api.get('/projects/stats'),
          api.get('/tasks/stats'),
          fetchAllLeaves({ status: 'pending' }).catch(() => []),
        ])
        const pendingLeaves = Array.isArray(leavesRes) ? leavesRes : []
        setLeavePending(pendingLeaves.length)

        setData({
          users: usersRes?.data?.data ?? {},
          projects: projectsRes?.data?.data ?? {},
          tasks: tasksRes?.data?.data ?? {},
        })
      } catch (err) {
        console.error('Dashboard fetch error:', err)
        setError(err?.response?.data?.message || 'Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  )

  const u = data?.users ?? {}
  const p = data?.projects ?? {}
  const t = data?.tasks ?? {}

  // FIX: Backend returns nested by_role / by_status — extract them first
  const byRole   = u.by_role   ?? {}
  const byStat   = u.by_status ?? {}
  const pByStat  = p.by_status ?? {}
  const tByStat  = t.by_status ?? {}

  // Build chart data from nested keys
  const taskChart    = Object.entries(tByStat).map(([k, v]) => ({ name: k, count: v }))
  const projectChart = Object.entries(pByStat).map(([k, v]) => ({ name: k, value: v }))

  // FIX: Read from byRole, not flat u
  const userByRole = [
    { name: 'Admin',    value: Number(byRole.admin    ?? 0) },
    { name: 'Manager',  value: Number(byRole.manager  ?? 0) },
    { name: 'Employee', value: Number(byRole.employee ?? 0) },
  ]

  // Completion rate from task stats
  const total     = Number(t.total     ?? 0)
  const completed = Number(t.completed ?? 0)
  const completionRate = total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Here's what's happening across your organization today.
        </p>
      </div>

      {/* Leave pending banner */}
      {leavePending > 0 && (
        <a href="/admin/attendance" className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl hover:bg-amber-500/10 transition-all">
          <CalendarOff size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300 flex-1">
            <span className="font-semibold">{leavePending} leave request{leavePending !== 1 ? 's' : ''}</span> pending your approval
          </p>
          <span className="text-xs text-amber-400">Review →</span>
        </a>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={u.total ?? 0}
          icon={Users}
          color="brand"
          // FIX: was u.active (flat) → now byStat.active (nested)
          trend={`${byStat.active ?? 0} active`}
        />
        <StatCard
          label="Total Projects"
          value={p.total ?? 0}
          icon={FolderKanban}
          color="emerald"
          trend={`${pByStat.active ?? pByStat['in-progress'] ?? 0} in progress`}
        />
        <StatCard
          label="Total Tasks"
          value={t.total ?? 0}
          icon={CheckSquare}
          color="amber"
          trend={`${completed} completed`}
        />
        <StatCard
          label="Completion Rate"
          value={completionRate}
          icon={TrendingUp}
          color="purple"
          trend="Task completion"
        />
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
              <Pie
                data={userByRole}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                paddingAngle={3}
              >
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
            {projectChart.length === 0 && (
              <p className="text-slate-600 text-sm text-center py-4">No projects yet</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Stats</h3>
          <div className="space-y-3">
            {[
              // FIX: All user stats now read from byStat (by_status) and byRole (by_role)
              { label: 'Active users',      val: byStat.active          ?? 0, color: 'text-emerald-400' },
              { label: 'On leave',          val: byStat['on-leave']     ?? 0, color: 'text-amber-400'   },
              { label: 'Inactive',          val: byStat.inactive        ?? 0, color: 'text-slate-400'   },
              { label: 'Tasks in progress', val: tByStat['in-progress'] ?? tByStat.in_progress ?? 0, color: 'text-blue-400' },
              { label: 'Overdue tasks',     val: t.overdue              ?? 0, color: 'text-red-400'     },
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
