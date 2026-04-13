import { useEffect, useState } from 'react'
import { Users, FolderKanban, CheckSquare, TrendingUp, CalendarOff } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import api, { fetchAllLeaves } from '../../api/axios'
import { StatCard, Spinner, StatusBadge } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'

// Indigo, emerald, amber, red, purple, cyan
const COLORS      = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const ROLE_COLORS = ['#6366f1', '#22c55e', '#f59e0b']   // admin, manager, employee

// Pretty labels for raw status keys
const STATUS_LABELS = {
  todo:          'To Do',
  'in-progress': 'In Progress',
  completed:     'Completed',
  'on-hold':     'On Hold',
  cancelled:     'Cancelled',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-100 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

// Donut centre label
const DonutLabel = ({ cx, cy, total }) => (
  <>
    <text x={cx} y={cy - 8} textAnchor="middle" fill="#ffffff" fontSize={22} fontWeight={700}>{total}</text>
    <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize={11}>users</text>
  </>
)

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [data,         setData]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
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
        setLeavePending((Array.isArray(leavesRes) ? leavesRes : []).length)
        setData({
          users:    usersRes?.data?.data    ?? {},
          projects: projectsRes?.data?.data ?? {},
          // tasks/stats returns a FLAT object: { todo: N, "in-progress": N, ... }
          tasks:    tasksRes?.data?.data    ?? {},
        })
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (error)   return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-sm">{error}</p></div>

  const u = data?.users    ?? {}
  const p = data?.projects ?? {}
  // tasks data is a flat map: { todo: N, "in-progress": N, completed: N, ... }
  const tFlat  = data?.tasks ?? {}

  const byRole  = u.by_role   ?? {}
  const byStat  = u.by_status ?? {}
  const pByStat = p.by_status ?? {}

  // Derive total & completed directly from flat task map
  const totalTasks     = Object.values(tFlat).reduce((s, v) => s + Number(v), 0)
  const completedTasks = Number(tFlat.completed ?? 0)
  const completionRate = totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '0%'

  // Build bar-chart data with pretty labels, sorted by a natural order
  const statusOrder = ['todo', 'in-progress', 'completed', 'on-hold', 'cancelled']
  const taskChart = statusOrder
    .filter(k => tFlat[k] !== undefined)
    .map((k, i) => ({ name: STATUS_LABELS[k] ?? k, count: Number(tFlat[k]), color: COLORS[i] }))
  // Also pick up any unexpected statuses
  Object.keys(tFlat).filter(k => !statusOrder.includes(k)).forEach((k, i) => {
    taskChart.push({ name: STATUS_LABELS[k] ?? k, count: Number(tFlat[k]), color: COLORS[(statusOrder.length + i) % COLORS.length] })
  })

  const projectChart = Object.entries(pByStat).map(([k, v]) => ({
    name:  k.charAt(0).toUpperCase() + k.slice(1),
    value: Number(v),
  }))

  const userByRole = [
    { name: 'Admin',    value: Number(byRole.admin    ?? 0) },
    { name: 'Manager',  value: Number(byRole.manager  ?? 0) },
    { name: 'Employee', value: Number(byRole.employee ?? 0) },
  ].filter(r => r.value > 0)

  const totalUsers = userByRole.reduce((s, r) => s + r.value, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-slate-400 text-sm mt-1">Here's what's happening across your organization today.</p>
      </div>

      {/* Leave banner */}
      {leavePending > 0 && (
        <a href="/admin/attendance" className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl hover:bg-amber-500/10 transition-all">
          <CalendarOff size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300 flex-1">
            <span className="font-semibold">{leavePending} leave request{leavePending !== 1 ? 's' : ''}</span> pending your approval
          </p>
          <span className="text-xs text-amber-400">Review →</span>
        </a>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"       value={u.total ?? 0}   icon={Users}        color="brand"   trend={`${byStat.active ?? 0} active`} />
        <StatCard label="Total Projects"    value={p.total ?? 0}   icon={FolderKanban} color="emerald" trend={`${pByStat['in-progress'] ?? pByStat.active ?? 0} in progress`} />
        <StatCard label="Total Tasks"       value={totalTasks}     icon={CheckSquare}  color="amber"   trend={`${completedTasks} completed`} />
        <StatCard label="Completion Rate"   value={completionRate} icon={TrendingUp}   color="purple"  trend="Task completion" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Tasks by Status — Bar Chart ── */}
        <div className="lg:col-span-2 card">
          <h3 className="text-sm font-semibold text-white mb-4">Tasks by Status</h3>
          {taskChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={taskChart} barSize={36} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {taskChart.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-600">
              <CheckSquare size={32} className="opacity-30" />
              <span className="text-sm">No tasks found</span>
            </div>
          )}

          {/* Legend below bar chart */}
          {taskChart.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {taskChart.map(entry => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                  <span className="text-xs text-slate-500">{entry.name}: <span className="text-slate-300 font-medium">{entry.count}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Users by Role — Donut Chart ── */}
        <div className="card flex flex-col">
          <h3 className="text-sm font-semibold text-white mb-2">Users by Role</h3>
          {userByRole.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={userByRole}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    labelLine={false}
                  >
                    {userByRole.map((_, i) => (
                      <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} strokeWidth={0} />
                    ))}
                    <DonutLabel cx="50%" cy="50%" total={totalUsers} />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Custom legend */}
              <div className="flex justify-center gap-4 mt-2">
                {userByRole.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                    <span className="text-xs text-slate-400">{r.name}</span>
                    <span className="text-xs font-semibold text-white">{r.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">No users</div>
          )}
        </div>
      </div>

      {/* Projects & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Projects by Status</h3>
          <div className="space-y-3">
            {projectChart.length > 0 ? projectChart.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-slate-300 capitalize">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-white">{item.value}</span>
              </div>
            )) : (
              <p className="text-slate-600 text-sm text-center py-4">No projects yet</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Stats</h3>
          <div className="space-y-3">
            {[
              { label: 'Active users',      val: byStat.active            ?? 0, color: 'text-emerald-400' },
              { label: 'On leave',          val: byStat['on-leave']       ?? 0, color: 'text-amber-400'   },
              { label: 'Inactive',          val: byStat.inactive          ?? 0, color: 'text-slate-400'   },
              { label: 'Tasks in progress', val: tFlat['in-progress']     ?? 0, color: 'text-blue-400'    },
              { label: 'Tasks on hold',     val: tFlat['on-hold']         ?? 0, color: 'text-purple-400'  },
              { label: 'Pending leave',     val: leavePending,                  color: 'text-orange-400'  },
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
