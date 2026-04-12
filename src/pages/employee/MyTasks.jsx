import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckSquare } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, SelectInput, StatusBadge, PriorityBadge, Spinner, EmptyState, StatCard
} from '../../components/common/UI'

const STATUSES = ['todo', 'in-progress', 'completed', 'on-hold', 'cancelled']

export default function EmployeeMyTasks() {
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')
  const [updating, setUpdating] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      // NOTE: /tasks/stats is admin/manager only — compute stats from the
      // tasks list instead to avoid a 403 that would crash the whole page.
      const { data } = await api.get('/tasks', { params })
      setTasks(data.data ?? [])
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [statusF])

  useEffect(() => { load() }, [load])

  // Compute stats locally — no extra API call needed
  const stats = {
    total:         tasks.length,
    todo:          tasks.filter(t => t.status === 'todo').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    completed:     tasks.filter(t => t.status === 'completed').length,
    overdue:       tasks.filter(t =>
      t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
    ).length,
  }

  const updateStatus = async (taskId, newStatus) => {
    setUpdating(taskId)
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus })
      toast.success('Status updated')
      // Optimistically update local state — no full reload needed
      setTasks(prev =>
        prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t)
      )
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="My Tasks"
        subtitle="View and update the status of your assigned tasks"
      />

      {/* Stats — computed from tasks array, no restricted API call */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total"       value={stats.total}           icon={CheckSquare} color="brand" />
        <StatCard label="Todo"        value={stats.todo}            icon={CheckSquare} color="blue" />
        <StatCard label="In Progress" value={stats['in-progress']}  icon={CheckSquare} color="amber" />
        <StatCard label="Completed"   value={stats.completed}       icon={CheckSquare} color="emerald" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <SelectInput
          value={statusF}
          onChange={setStatusF}
          placeholder="All statuses"
          options={STATUSES.map(s => ({ value: s, label: s }))}
          className="w-44"
        />
        <button onClick={load} className="btn-secondary px-3">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description={statusF ? 'No tasks match this filter' : 'No tasks have been assigned to you yet'}
        />
      ) : (
        <div className="space-y-3">
          {tasks.map(t => {
            const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
            return (
              <div key={t._id} className="card hover:border-white/10 transition-all">
                <div className="flex items-start justify-between gap-4 flex-wrap">

                  {/* Left — task info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Priority colour bar */}
                    <div className={`w-1.5 h-10 rounded-full flex-shrink-0 mt-1 ${
                      t.priority === 'critical' ? 'bg-red-500'     :
                      t.priority === 'high'     ? 'bg-orange-500'  :
                      t.priority === 'medium'   ? 'bg-yellow-500'  : 'bg-emerald-500'
                    }`} />

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{t.title}</p>
                      {t.description && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500">
                          Project: <span className="text-slate-300">{t.project_id?.title ?? '—'}</span>
                        </span>
                        <span className={`text-xs font-mono ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                          {t.due_date
                            ? `Due: ${format(new Date(t.due_date), 'MMM d, yyyy')}`
                            : 'No deadline'}
                          {overdue && ' ⚠ Overdue'}
                        </span>
                        {t.assigned_by && (
                          <span className="text-xs text-slate-500">
                            By: <span className="text-slate-300">{t.assigned_by?.name}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right — priority badge + status selector */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <PriorityBadge priority={t.priority} />

                    <div className="relative">
                      <select
                        value={t.status}
                        onChange={e => updateStatus(t._id, e.target.value)}
                        disabled={updating === t._id}
                        className="input text-xs py-1.5 pr-8 pl-2 w-36 appearance-none cursor-pointer"
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>

                      {/* Inline spinner while saving */}
                      {updating === t._id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface-200/80 rounded-xl">
                          <div className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
