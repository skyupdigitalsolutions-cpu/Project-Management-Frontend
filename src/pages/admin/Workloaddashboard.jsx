/**
 * WorkloadDashboard.jsx  (replaces/enhances existing WorkflowDashboard.jsx)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin view showing:
 *  - Per-employee workload (hours booked vs capacity)
 *  - Task distribution by status/priority
 *  - Overdue alerts
 *  - Quick task reassignment
 *
 * ROUTE: /admin/workflow  (existing route — just replace WorkflowDashboard import)
 */

import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  RefreshCw, AlertTriangle, Users, CheckSquare, Clock,
  BarChart2, TrendingUp, Loader2, ChevronDown, ChevronUp,
  User, Calendar, ArrowRight, Zap,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLOR = {
  critical: { bg: 'bg-red-100',    text: 'text-red-700',    bar: 'bg-red-500' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' },
  medium:   { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500' },
  low:      { bg: 'bg-gray-100',   text: 'text-gray-600',   bar: 'bg-gray-400' },
}

const STATUS_COLOR = {
  todo:          'bg-gray-100 text-gray-600',
  'in-progress': 'bg-blue-100 text-blue-700',
  completed:     'bg-green-100 text-green-700',
  'on-hold':     'bg-yellow-100 text-yellow-700',
  cancelled:     'bg-red-100 text-red-500',
}

function fmt(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkloadDashboard() {
  const [loading,        setLoading]        = useState(true)
  const [workload,       setWorkload]        = useState([])  // per-employee workload
  const [stats,          setStats]           = useState(null)
  const [tasks,          setTasks]           = useState([])
  const [overdueTasks,   setOverdueTasks]    = useState([])
  const [expandedUser,   setExpandedUser]    = useState(null)
  const [reassigning,    setReassigning]     = useState(null)
  const [users,          setUsers]           = useState([])
  const [reassignTo,     setReassignTo]      = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [workloadRes, statsRes, tasksRes, usersRes] = await Promise.all([
        api.get('/tasks/workload'),
        api.get('/tasks/stats'),
        api.get('/tasks', { params: { limit: 200 } }),
        api.get('/users', { params: { role: 'employee', status: 'active' } }),
      ])

      const allTasks = tasksRes.data?.data?.tasks || tasksRes.data?.data || []
      setWorkload(workloadRes.data?.data || [])
      setStats(statsRes.data?.data || null)
      setTasks(allTasks)
      setOverdueTasks(
        allTasks.filter(t =>
          t.is_delayed && t.status !== 'completed' && t.status !== 'cancelled'
        )
      )
      setUsers(usersRes.data?.data?.users || usersRes.data?.data || [])
    } catch {
      toast.error('Failed to load workload data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Quick Reassign ──────────────────────────────────────────────────────
  const handleReassign = async (taskId) => {
    const toUserId = reassignTo[taskId]
    if (!toUserId) return toast.error('Select an employee to reassign to')
    setReassigning(taskId)
    try {
      await api.patch(`/tasks/${taskId}/reassign`, {
        new_assignee_id: toUserId,
        reason: 'Manual reassignment from workload dashboard',
      })
      toast.success('Task reassigned!')
      setReassignTo(prev => { const n = { ...prev }; delete n[taskId]; return n })
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reassignment failed')
    } finally {
      setReassigning(null)
    }
  }

  // ─── Computed stats ──────────────────────────────────────────────────────
  const totalActive   = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length
  const totalComplete = tasks.filter(t => t.status === 'completed').length
  const inProgress    = tasks.filter(t => t.status === 'in-progress').length

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workload Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time task distribution and employee capacity</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Top Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Active Tasks"    value={totalActive}          icon={CheckSquare}  color="indigo" />
        <StatBox label="In Progress"     value={inProgress}           icon={TrendingUp}   color="info" />
        <StatBox label="Completed"       value={totalComplete}        icon={CheckSquare}  color="green" />
        <StatBox label="Overdue"         value={overdueTasks.length}  icon={AlertTriangle} color={overdueTasks.length > 0 ? 'red' : 'green'} />
      </div>

      {/* ── Overdue Alert Banner ── */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-800">{overdueTasks.length} Overdue Tasks</h3>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {overdueTasks.map(task => (
              <div key={task._id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                  <p className="text-[16px] text-gray-400">
                    {task.assigned_to?.name || '—'} · Due: {fmt(task.due_date)}
                  </p>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <select
                    className="text-[16px] border border-gray-200 rounded-md px-2 py-1 bg-white"
                    value={reassignTo[task._id] || ''}
                    onChange={e => setReassignTo(p => ({ ...p, [task._id]: e.target.value }))}
                  >
                    <option value="">Reassign to…</option>
                    {users.filter(u => u._id !== task.assigned_to?._id).map(u => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleReassign(task._id)}
                    disabled={reassigning === task._id || !reassignTo[task._id]}
                    className="text-[16px] px-2 py-1 bg-red-600 text-gray-800 rounded-md hover:bg-red-700 disabled:opacity-40 flex items-center gap-1"
                  >
                    {reassigning === task._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                    Go
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Employee Workload Cards ── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Employee Workload
        </h2>

        {workload.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-200">
            <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No workload data yet. Assign tasks to employees first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workload.map(entry => (
              <EmployeeWorkloadCard
                key={entry.user?._id}
                entry={entry}
                tasks={tasks.filter(t => t.assigned_to?._id === entry.user?._id || t.assigned_to === entry.user?._id)}
                expanded={expandedUser === entry.user?._id}
                onToggle={() => setExpandedUser(prev => prev === entry.user?._id ? null : entry.user?._id)}
                users={users}
                reassignTo={reassignTo}
                onReassignToChange={(taskId, val) => setReassignTo(p => ({ ...p, [taskId]: val }))}
                onReassign={handleReassign}
                reassigning={reassigning}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Priority Distribution ── */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            Task Priority Distribution
          </h3>
          <div className="space-y-3">
            {['critical', 'high', 'medium', 'low'].map(p => {
              const count = stats.byPriority?.[p] || 0
              const total = stats.total || 1
              const pct   = Math.round((count / total) * 100)
              const c     = PRIORITY_COLOR[p]
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className={`text-[16px] font-medium w-16 ${c.text}`}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[16px] text-gray-500 w-16 text-right">{count} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Employee Workload Card ────────────────────────────────────────────────────

function EmployeeWorkloadCard({ entry, tasks, expanded, onToggle, users, reassignTo, onReassignToChange, onReassign, reassigning }) {
  const { user, totalHours, activeDays, dailyLoad } = entry
  const dailyCap   = entry.dailyWorkingHours || 8
  const pct        = Math.min(100, Math.round((totalHours / (dailyCap * 5)) * 100)) // vs 1-week capacity
  const isOverloaded = pct >= 80

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const overdueCount = tasks.filter(t => t.is_delayed && t.status !== 'completed').length

  return (
    <div className={`bg-white rounded-xl border-2 transition-colors ${isOverloaded ? 'border-orange-200' : 'border-gray-200'}`}>
      <div className="px-5 py-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800 text-sm">{user?.name || 'Unknown'}</p>
                {isOverloaded && (
                  <span className="text-[16px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                    Heavy load
                  </span>
                )}
                {overdueCount > 0 && (
                  <span className="text-[16px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> {overdueCount} overdue
                  </span>
                )}
              </div>
              <p className="text-[16px] text-gray-400 mt-0.5">
                {user?.designation || '—'} · {activeTasks.length} active tasks · {totalHours}h booked
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Workload bar */}
            <div className="hidden md:block w-36">
              <div className="flex justify-between text-[16px] text-gray-400 mb-1">
                <span>{totalHours}h</span>
                <span className="text-gray-300">{dailyCap * 5}h/wk cap</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : 'bg-indigo-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </div>

      {/* Expanded: task list */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-2 max-h-80 overflow-y-auto">
          {activeTasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-2 text-center">No active tasks</p>
          ) : (
            activeTasks.map(task => (
              <div key={task._id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${task.is_delayed ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{task.title}</p>
                  <p className="text-[16px] text-gray-400 mt-0.5 flex items-center gap-3">
                    <span className={`px-1.5 py-0.5 rounded-full text-[16px] ${STATUS_COLOR[task.status]}`}>{task.status}</span>
                    {task.estimated_hours && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{task.estimated_hours}h</span>}
                    {task.end_date && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{fmt(task.end_date)}</span>}
                    {task.is_delayed && <span className="text-red-500 font-medium flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />Overdue</span>}
                  </p>
                </div>
                {/* Quick reassign */}
                <div className="ml-2 flex items-center gap-1 flex-shrink-0">
                  <select
                    className="text-[16px] border border-gray-200 rounded-md px-1.5 py-1 bg-white max-w-[120px]"
                    value={reassignTo[task._id] || ''}
                    onChange={e => onReassignToChange(task._id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="">Move to…</option>
                    {users.filter(u => u._id !== user?._id).map(u => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
                  {reassignTo[task._id] && (
                    <button
                      onClick={e => { e.stopPropagation(); onReassign(task._id) }}
                      disabled={reassigning === task._id}
                      className="p-1 bg-indigo-600 text-gray-800 rounded-md hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {reassigning === task._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stat Box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, icon: Icon, color }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    green:  'bg-green-50 text-green-600 border-green-100',
    red:    'bg-red-50 text-red-600 border-red-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-[16px] font-medium opacity-70">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}