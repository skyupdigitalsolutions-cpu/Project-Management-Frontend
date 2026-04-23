import { useEffect, useState } from 'react'
import { Users, FolderKanban, CheckSquare, TrendingUp, CalendarOff } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import api, { fetchAllLeaves } from '../../api/axios'
import { StatCard, Spinner, StatusBadge } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'

const COLORS      = ['#7C3AED', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6']
const ROLE_COLORS = ['#7C3AED', '#22C55E', '#F59E0B']

const STATUS_LABELS = {
  todo:          'To Do',
  'in-progress': 'In Progress',
  completed:     'Completed',
  'on-hold':     'On Hold',
  cancelled:     'Cancelled',
}

const safeNum = (v) => {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[16px] shadow-lg">
      <p className="text-neutral mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

const DonutLabel = ({ cx, cy, total }) => (
  <>
    <text x={cx} y={cy - 8} textAnchor="middle" fill="#1F2937" fontSize={22} fontWeight={700}>{total}</text>
    <text x={cx} y={cy + 12} textAnchor="middle" fill="#6B7280" fontSize={11}>users</text>
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
          tasks:    tasksRes?.data?.data?.by_status ?? tasksRes?.data?.data ?? {},
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
  if (error)   return <div className="flex items-center justify-center h-64"><p className="text-danger text-sm">{error}</p></div>

  const u = data?.users    ?? {}
  const p = data?.projects ?? {}
  const tFlat  = data?.tasks ?? {}

  const byRole  = u.by_role   ?? {}
  const byStat  = u.by_status ?? {}
  const pByStat = p.by_status ?? {}

  const totalTasks     = Object.values(tFlat).reduce((s, v) => s + safeNum(v), 0)
  const completedTasks = safeNum(tFlat.completed ?? 0)
  const completionRate = totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '0%'

  const statusOrder = ['todo', 'in-progress', 'completed', 'on-hold', 'cancelled']
  const taskChart = statusOrder
    .filter(k => tFlat[k] !== undefined)
    .map((k, i) => ({ name: STATUS_LABELS[k] ?? k, count: safeNum(tFlat[k]), color: COLORS[i] }))
  Object.keys(tFlat).filter(k => !statusOrder.includes(k)).forEach((k, i) => {
    taskChart.push({ name: STATUS_LABELS[k] ?? k, count: safeNum(tFlat[k]), color: COLORS[(statusOrder.length + i) % COLORS.length] })
  })

  const projectChart = Object.entries(pByStat).map(([k, v]) => ({
    name:  k.charAt(0).toUpperCase() + k.slice(1),
    value: safeNum(v),
  }))

  const userByRole = [
    { name: 'Admin',    value: safeNum(byRole.admin)    },
    { name: 'Manager',  value: safeNum(byRole.manager)  },
    { name: 'Employee', value: safeNum(byRole.employee) },
  ].filter(r => r.value > 0)

  const totalUsers = userByRole.reduce((s, r) => s + safeNum(r.value), 0)

  return (
    <div className="space-y-6 animate-fade-in font-poppins">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-neutral text-sm mt-1">Here's what's happening across your organization today.</p>
      </div>

      {/* Leave banner */}
      {leavePending > 0 && (
        <a href="/admin/attendance" className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-warning/30 rounded-2xl hover:bg-yellow-100 transition-all">
          <CalendarOff size={16} className="text-warning flex-shrink-0" />
          <p className="text-sm text-yellow-700 flex-1">
            <span className="font-semibold">{leavePending} leave request{leavePending !== 1 ? 's' : ''}</span> pending your approval
          </p>
          <span className="text-[16px] text-warning font-semibold">Review →</span>
        </a>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"     value={safeNum(u.total)}   icon={Users}        color="primary" trend={`${safeNum(byStat.active)} active`} />
        <StatCard label="Total Projects"  value={safeNum(p.total)}   icon={FolderKanban} color="emerald" trend={`${safeNum(pByStat['in-progress'] ?? pByStat.active)} in progress`} />
        <StatCard label="Total Tasks"     value={totalTasks}         icon={CheckSquare}  color="amber"   trend={`${completedTasks} completed`} />
        <StatCard label="Completion Rate" value={completionRate}     icon={TrendingUp}   color="purple"  trend="Task completion" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tasks by Status Bar Chart */}
     <div className="lg:col-span-2 card">
  <h3 className="text-sm font-semibold text-gray-700 mb-4">Tasks by Status</h3>
  {taskChart.length > 0 ? (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart
        data={taskChart}
        barSize={36}
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <XAxis
          dataKey="name"
          tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'Poppins' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'Poppins' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
          tickCount={5}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,58,237,0.05)' }} />
        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
          {taskChart.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-300">
      <CheckSquare size={32} className="opacity-30" />
      <span className="text-sm">No tasks found</span>
    </div>
  )}

  {taskChart.length > 0 && (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      {taskChart.map(entry => (
        <div key={entry.name} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-[16px] text-neutral">
            {entry.name}: <span className="text-gray-700 font-semibold">{entry.count}</span>
          </span>
        </div>
      ))}
    </div>
  )}
</div>

        {/* Users by Role Donut */}
        <div className="card flex flex-col">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Users by Role</h3>
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
              <div className="flex justify-center gap-4 mt-2">
                {userByRole.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                    <span className="text-[16px] text-neutral">{r.name}</span>
                    <span className="text-[16px] font-semibold text-gray-800">{r.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral text-sm">No users</div>
          )}
        </div>
      </div>

      {/* Projects & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Projects by Status</h3>
          <div className="space-y-3">
            {projectChart.length > 0 ? projectChart.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-gray-600 capitalize">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-800">{item.value}</span>
              </div>
            )) : (
              <p className="text-neutral text-sm text-center py-4">No projects yet</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            {[
              { label: 'Active users',      val: safeNum(byStat.active),        color: 'text-success' },
              { label: 'On leave',          val: safeNum(byStat['on-leave']),   color: 'text-warning' },
              { label: 'Inactive',          val: safeNum(byStat.inactive),      color: 'text-neutral' },
              { label: 'Tasks in progress', val: safeNum(tFlat['in-progress']), color: 'text-info'    },
              { label: 'Tasks on hold',     val: safeNum(tFlat['on-hold']),     color: 'text-primary' },
              { label: 'Pending leave',     val: safeNum(leavePending),         color: 'text-warning' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                <span className="text-sm text-neutral">{row.label}</span>
                <span className={`text-sm font-bold ${row.color}`}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
