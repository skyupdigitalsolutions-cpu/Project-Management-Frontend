/**
 * EmployeeTaskDashboard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Employee view: today's tasks, upcoming schedule, and workload overview.
 *
 * ROUTE: /employee/my-tasks  (replaces or alongside MyTasksEnhanced.jsx)
 *
 * FEATURES:
 *  - Today's tasks with scheduled hours
 *  - Daily capacity bar (X / 8 hrs used)
 *  - Status update (todo → in-progress → completed)
 *  - Overdue tasks highlighted
 *  - Weekly schedule view
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  Clock, Calendar, CheckCircle2, Circle, AlertTriangle,
  ChevronRight, Loader2, RefreshCw, BarChart2, ArrowRight,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FLOW = {
  todo:        { next: 'in-progress', label: 'Start Task',    color: 'bg-gray-100 text-gray-600' },
  'in-progress':{ next: 'completed', label: 'Mark Complete', color: 'bg-blue-100 text-blue-700' },
  completed:   { next: null,          label: 'Completed',     color: 'bg-green-100 text-green-700' },
  'on-hold':   { next: 'in-progress', label: 'Resume',        color: 'bg-yellow-100 text-yellow-700' },
}

const PRIORITY_DOT = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-gray-400',
}

function fmt(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function fmtFull(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })
}

function isToday(date) {
  if (!date) return false
  const d = new Date(date)
  const t = new Date()
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
}

function isOverdue(task) {
  if (!task.due_date) return false
  if (task.status === 'completed') return false
  return new Date(task.due_date) < new Date()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmployeeTaskDashboard() {
  const { user } = useAuth()
  const [loading,  setLoading]  = useState(true)
  const [tasks,    setTasks]    = useState([])
  const [view,     setView]     = useState('today')   // 'today' | 'upcoming' | 'all'
  const [updating, setUpdating] = useState(null)      // task._id being updated

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/tasks', {
        params: { assigned_to: user._id, limit: 100 },
      })
      const allTasks = res.data?.data?.tasks || res.data?.data || []
      setTasks(allTasks)
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [user._id])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // ─── Computed views ────────────────────────────────────────────────────────

  const todayTasks = tasks.filter(t =>
    (isToday(t.start_date) || t.status === 'in-progress') &&
    t.status !== 'completed' && t.status !== 'cancelled'
  )

  const upcomingTasks = tasks.filter(t => {
    if (!t.start_date) return false
    if (t.status === 'completed' || t.status === 'cancelled') return false
    const start = new Date(t.start_date)
    const today = new Date(); today.setHours(0,0,0,0)
    return start > today
  }).sort((a,b) => new Date(a.start_date) - new Date(b.start_date))

  const overdueTasks = tasks.filter(isOverdue)

  // ─── Daily capacity ────────────────────────────────────────────────────────
  const dailyCap = user.dailyWorkingHours || 8
  const todayHours = todayTasks.reduce((s, t) => s + (t.estimated_hours || 0), 0)
  const capacityPct = Math.min(100, Math.round((todayHours / dailyCap) * 100))

  // ─── Status update ─────────────────────────────────────────────────────────
  const handleStatusChange = async (task, newStatus) => {
    setUpdating(task._id)
    try {
      await api.patch(`/tasks/${task._id}`, { status: newStatus })
      setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t))
      toast.success(newStatus === 'completed' ? '✅ Task completed!' : `Status updated to ${newStatus}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  // ─── Displayed tasks ───────────────────────────────────────────────────────
  const displayTasks =
    view === 'today'    ? todayTasks    :
    view === 'upcoming' ? upcomingTasks :
    tasks.filter(t => t.status !== 'cancelled')

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={fetchTasks} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Today"
          value={todayTasks.length}
          sub={`${todayHours}h scheduled`}
          color="indigo"
          active={view === 'today'}
          onClick={() => setView('today')}
        />
        <SummaryCard
          label="Upcoming"
          value={upcomingTasks.length}
          sub="next tasks"
          color="info"
          active={view === 'upcoming'}
          onClick={() => setView('upcoming')}
        />
        <SummaryCard
          label="Overdue"
          value={overdueTasks.length}
          sub="need attention"
          color={overdueTasks.length > 0 ? 'red' : 'green'}
          active={false}
          onClick={() => setView('all')}
        />
      </div>

      {/* ── Daily Capacity Bar ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            Today's Capacity
          </div>
          <span className="text-sm text-gray-500">
            {todayHours}h / {dailyCap}h used
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              capacityPct >= 100 ? 'bg-red-500' :
              capacityPct >= 75  ? 'bg-orange-500' :
              capacityPct >= 50  ? 'bg-yellow-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${capacityPct}%` }}
          />
        </div>
        {capacityPct >= 100 && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Daily capacity exceeded — some tasks may be rescheduled
          </p>
        )}
      </div>

      {/* ── View Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {[['today','Today'], ['upcoming','Upcoming'], ['all','All Tasks']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
              view === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Task List ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">
            {view === 'today' ? 'No tasks scheduled for today!' : 'No tasks found'}
          </p>
          {view === 'today' && <p className="text-sm mt-1">Enjoy your free time 🎉</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {displayTasks.map(task => (
            <TaskCard
              key={task._id}
              task={task}
              updating={updating === task._id}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color, active, onClick }) {
  const colors = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    blue:   'border-blue-200 bg-blue-50 text-blue-700',
    red:    'border-red-200 bg-red-50 text-red-700',
    green:  'border-green-200 bg-green-50 text-green-700',
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all ${
        active ? colors[color] + ' ring-2 ring-offset-1 ring-current' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className={`text-2xl font-bold ${active ? '' : 'text-gray-800'}`}>{value}</div>
      <div className={`text-xs font-medium mt-0.5 ${active ? '' : 'text-gray-500'}`}>{label}</div>
      <div className={`text-xs mt-0.5 opacity-70`}>{sub}</div>
    </button>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, updating, onStatusChange }) {
  const overdue = isOverdue(task)
  const statusInfo = STATUS_FLOW[task.status] || STATUS_FLOW.todo

  return (
    <div className={`bg-white rounded-xl border transition-all ${
      overdue ? 'border-red-200' :
      task.status === 'completed' ? 'border-green-200 opacity-70' :
      task.status === 'in-progress' ? 'border-blue-300' : 'border-gray-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Status icon */}
          <div className="mt-0.5 flex-shrink-0">
            {task.status === 'completed'
              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
              : <Circle className={`w-5 h-5 ${task.status === 'in-progress' ? 'text-blue-500' : 'text-gray-300'}`} />
            }
          </div>

          <div className="flex-1 min-w-0">
            {/* Title + priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {task.title}
              </h3>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`} title={task.priority} />
              {overdue && (
                <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
                  <AlertTriangle className="w-3 h-3" /> Overdue
                </span>
              )}
            </div>

            {/* Project / assignment */}
            {task.project_id?.title && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {task.project_id.title}
                {task.assignment_id?.title && <> · {task.assignment_id.title}</>}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              {task.estimated_hours && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {task.estimated_hours}h estimated
                </span>
              )}
              {(task.start_date || task.end_date) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {fmt(task.start_date)} <ArrowRight className="w-3 h-3" /> {fmt(task.end_date)}
                </span>
              )}
              {task.due_date && (
                <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
                  Due: {fmtFull(task.due_date)}
                </span>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-gray-400 mt-2 line-clamp-2">{task.description}</p>
            )}
          </div>
        </div>

        {/* Status action */}
        {statusInfo.next && task.status !== 'completed' && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onStatusChange(task, statusInfo.next)}
              disabled={!!updating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                statusInfo.next === 'completed'
                  ? 'bg-green-100 hover:bg-green-200 text-green-700'
                  : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
              }`}
            >
              {updating
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : statusInfo.next === 'completed'
                ? <CheckCircle2 className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />
              }
              {statusInfo.label}
            </button>
          </div>
        )}
      </div>

      {/* In-progress indicator */}
      {task.status === 'in-progress' && (
        <div className="h-1 bg-blue-100 rounded-b-xl overflow-hidden">
          <div className="h-full bg-blue-500 w-1/3 animate-pulse rounded-full" />
        </div>
      )}
    </div>
  )
}