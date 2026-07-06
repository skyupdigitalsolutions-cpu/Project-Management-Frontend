/**
 * src/components/excel/ExcelTaskTable.jsx
 * ─────────────────────────────────────────────────────────
 * Filterable, inline-editable table of tasks for a project.
 * Supports filters: role, department, status, priority, search.
 * Inline status editing (no page refresh needed).
 *
 * PLACE AT: src/components/excel/ExcelTaskTable.jsx
 *
 * PROPS:
 *   projectId   {string}   required
 *   tasks       {Object[]} optional — if provided, skips internal fetch
 *   onTasksChange {Function} optional — called after any task update
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Filter, RefreshCw, Edit2, Check, X,
  AlertTriangle, ChevronDown, Loader2, ExternalLink
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// ── Status options ────────────────────────────────────────────────────────────
const STATUSES = ['todo', 'in-progress', 'completed', 'on-hold', 'blocked', 'unassigned', 'cancelled']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

const STATUS_STYLES = {
  todo:         'bg-blue-50   text-blue-700   border-blue-200',
  'in-progress':'bg-purple-50 text-purple-700 border-purple-200',
  completed:    'bg-green-50  text-green-700  border-green-200',
  'on-hold':    'bg-yellow-50 text-yellow-700 border-yellow-200',
  blocked:      'bg-red-50    text-red-600    border-red-200',
  unassigned:   'bg-gray-100  text-gray-500   border-gray-200',
  cancelled:    'bg-gray-100  text-gray-400   border-gray-200',
}

const PRIORITY_STYLES = {
  critical: 'text-red-600 font-bold',
  high:     'text-orange-500 font-semibold',
  medium:   'text-yellow-600',
  low:      'text-gray-400',
}

const PRIORITY_DOT = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-yellow-400',
  low:      'bg-emerald-400',
}

export default function ExcelTaskTable({ projectId, tasks: externalTasks, onTasksChange }) {
  const [tasks,     setTasks]     = useState(externalTasks || [])
  const [loading,   setLoading]   = useState(!externalTasks)
  const [search,    setSearch]    = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [editingId, setEditingId] = useState(null)  // task._id currently being inline-edited
  const [editValues, setEditValues] = useState({})
  const [saving,    setSaving]    = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Derive unique options from loaded tasks
  const roles  = [...new Set(tasks.map(t => t.required_role).filter(Boolean))].sort()
  const depts  = [...new Set(tasks.map(t => t.required_department).filter(Boolean))].sort()

  // ── Load tasks ─────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const params = { project_id: projectId, limit: 200 }
      if (filterRole)     params.required_role       = filterRole
      if (filterDept)     params.required_department = filterDept
      if (filterStatus)   params.status              = filterStatus
      if (filterPriority) params.priority             = filterPriority

      const { data } = await api.get('/tasks', { params })
      setTasks(data.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [projectId, filterRole, filterDept, filterStatus, filterPriority])

  useEffect(() => {
    if (!externalTasks) loadTasks()
  }, [loadTasks, externalTasks])

  // Update tasks when external prop changes
  useEffect(() => {
    if (externalTasks) setTasks(externalTasks)
  }, [externalTasks])

  // ── Client-side search filter ──────────────────────────────────────────────
  const visible = tasks.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.title?.toLowerCase().includes(q) ||
      t.subtask?.toLowerCase().includes(q) ||
      t.assigned_to?.name?.toLowerCase().includes(q) ||
      t.module_name?.toLowerCase().includes(q)
    )
  })

  // ── Inline edit handlers ───────────────────────────────────────────────────
  const startEdit = (task) => {
    setEditingId(task._id)
    setEditValues({
      status:   task.status,
      priority: task.priority,
      title:    task.title,
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditValues({}) }

  const saveEdit = async (taskId) => {
    setSaving(true)
    try {
      const { data } = await api.patch(`/tasks/${taskId}`, editValues)
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, ...data.data } : t))
      onTasksChange?.()
      toast.success('Task updated')
      cancelEdit()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="input pl-9 py-2 text-sm w-full"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`btn-secondary text-xs py-2 px-3 gap-1.5 ${showFilters ? 'bg-primary text-white' : ''}`}
        >
          <Filter size={13} /> Filters
          {(filterRole || filterDept || filterStatus || filterPriority) && (
            <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
          )}
        </button>

        {/* Refresh */}
        <button onClick={loadTasks} disabled={loading} className="btn-secondary text-xs py-2 px-3">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>

        <span className="text-xs text-neutral ml-auto">{visible.length} task{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in">
          <FilterSelect label="Role"       value={filterRole}     onChange={setFilterRole}     options={roles} placeholder="All roles" />
          <FilterSelect label="Department" value={filterDept}     onChange={setFilterDept}     options={depts} placeholder="All depts" />
          <FilterSelect label="Status"     value={filterStatus}   onChange={setFilterStatus}   options={STATUSES} placeholder="All statuses" />
          <FilterSelect label="Priority"   value={filterPriority} onChange={setFilterPriority} options={PRIORITIES} placeholder="All priorities" />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-neutral text-sm">No tasks found matching your filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Task / Subtask','Module','Role & Dept','Priority','Status','Assigned To','Due Date',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((task) => {
                const isEditing = editingId === task._id
                const overdue   = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'

                return (
                  <tr key={task._id} className={`hover:bg-gray-50 transition-colors ${isEditing ? 'bg-purple-50' : ''}`}>

                    {/* Title / Subtask */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {isEditing ? (
                        <input
                          value={editValues.title}
                          onChange={e => setEditValues(v => ({ ...v, title: e.target.value }))}
                          className="input py-1 text-sm w-full"
                        />
                      ) : (
                        <div>
                          <p className="font-medium text-gray-800 truncate">{task.title}</p>
                          {task.subtask && (
                            <p className="text-xs text-neutral mt-0.5 truncate">↳ {task.subtask}</p>
                          )}
                          {task.dependency_task_id && (
                            <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={10} /> Depends on: {task.dependency_task_id?.title || 'another task'}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Module */}
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {task.module_name || '—'}
                      </span>
                    </td>

                    {/* Role & Dept */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-700">{task.required_role || '—'}</p>
                      <p className="text-xs text-neutral">{task.required_department || '—'}</p>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editValues.priority}
                          onChange={e => setEditValues(v => ({ ...v, priority: e.target.value }))}
                          className="input py-1 text-xs"
                        >
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <span className={`flex items-center gap-1.5 text-xs ${PRIORITY_STYLES[task.priority]}`}>
                          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                          {task.priority}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editValues.status}
                          onChange={e => setEditValues(v => ({ ...v, status: e.target.value }))}
                          className="input py-1 text-xs"
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLES[task.status] || STATUS_STYLES.todo}`}>
                          {task.status}
                        </span>
                      )}
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-3">
                      {task.assigned_to ? (
                        <div>
                          <p className="text-xs font-medium text-gray-700">{task.assigned_to.name}</p>
                          <p className="text-xs text-neutral">{task.assigned_to.designation}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={10} /> Unassigned
                        </span>
                      )}
                    </td>

                    {/* Due Date */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${overdue ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                        {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '—'}
                        {overdue && ' ⚠'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => saveEdit(task._id)}
                            disabled={saving}
                            className="w-7 h-7 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 flex items-center justify-center transition-colors"
                          >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(task)}
                          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-primary text-gray-400 flex items-center justify-center transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Reusable filter select ────────────────────────────────────────────────────
function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input py-1.5 text-xs w-full">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}