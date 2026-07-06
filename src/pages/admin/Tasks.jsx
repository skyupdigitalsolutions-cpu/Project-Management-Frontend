/**
 * pages/admin/Tasks.jsx  — UPDATED
 * Changes vs original:
 *  1. Subtask panel — add / update / delete subtasks inline
 *  2. Quick status update via dedicated PATCH /tasks/:id/status
 *  3. SubtaskPanel component embedded
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, RefreshCw, CheckSquare,
  ChevronDown, ChevronUp, ListTodo, Circle, CheckCircle2, Lock
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, StatCard, SearchInput, SelectInput, Modal, ConfirmModal,
  FormField, StatusBadge, PriorityBadge, Spinner, EmptyState
} from '../../components/common/UI'

const STATUSES   = ['todo','in-progress','completed','on-hold','cancelled','blocked','unassigned']
const PRIORITIES = ['low','medium','high','critical']
const emptyForm  = { title:'', description:'', project_id:'', assigned_to:'', status:'todo', priority:'medium', due_date:'' }
const emptySubtask = { title:'', assigned_to:'', priority:'medium', due_date:'' }

// ── Subtask Panel ─────────────────────────────────────────────────────────────
function SubtaskPanel({ task, users, onRefresh }) {
  const [open,     setOpen]     = useState(false)
  const [form,     setForm]     = useState(emptySubtask)
  const [adding,   setAdding]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  if (!task) return null

  const subtasks = task.subtasks ?? []

  const handleAddSubtask = async () => {
    if (!form.title.trim()) { toast.error('Subtask title is required'); return }
    setAdding(true)
    try {
      await api.post(`/tasks/${task._id}/subtasks`, form)
      toast.success('Subtask added')
      setForm(emptySubtask)
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add subtask')
    } finally { setAdding(false) }
  }

  const handleToggleSubtask = async (subtask) => {
    const newStatus = subtask.status === 'completed' ? 'todo' : 'completed'
    try {
      await api.patch(`/tasks/${task._id}/subtasks/${subtask._id}`, { status: newStatus })
      onRefresh()
    } catch { toast.error('Failed to update subtask') }
  }

  const handleDeleteSubtask = async (subtaskId) => {
    setDeleting(subtaskId)
    try {
      await api.delete(`/tasks/${task._id}/subtasks/${subtaskId}`)
      toast.success('Subtask deleted')
      onRefresh()
    } catch { toast.error('Failed to delete subtask') }
    finally { setDeleting(null) }
  }

  return (
    <div className="border-t border-gray-100 mt-3 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors w-full"
      >
        <ListTodo size={13} />
        Subtasks ({subtasks.length})
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Existing subtasks */}
          {subtasks.length > 0 ? (
            <div className="space-y-1.5">
              {subtasks.map(s => (
                <div key={s._id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 group">
                  <button onClick={() => handleToggleSubtask(s)} className="shrink-0">
                    {s.status === 'completed'
                      ? <CheckCircle2 size={15} className="text-green-500" />
                      : <Circle size={15} className="text-gray-300 hover:text-gray-400" />
                    }
                  </button>
                  <span className={`flex-1 text-xs ${s.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {s.title}
                  </span>
                  <PriorityBadge priority={s.priority} />
                  <button
                    onClick={() => handleDeleteSubtask(s._id)}
                    disabled={deleting === s._id}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 transition-all"
                  >
                    {deleting === s._id ? <Spinner size="sm" /> : <Trash2 size={11} />}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-1">No subtasks yet.</p>
          )}

          {/* Add subtask form */}
          <div className="space-y-2 p-2 rounded-lg bg-blue-50/50 border border-blue-100">
            <input
              className="input text-xs py-1.5"
              placeholder="New subtask title…"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
            />
            <div className="flex gap-2">
              <select
                className="input text-xs py-1.5 flex-1"
                value={form.assigned_to}
                onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
              <select
                className="input text-xs py-1.5 w-28"
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button className="btn-primary text-xs py-1.5 px-3 shrink-0" onClick={handleAddSubtask} disabled={adding}>
                {adding ? <Spinner size="sm" /> : <Plus size={12} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminTasks() {
  const [tasks,    setTasks]    = useState([])
  const [stats,    setStats]    = useState(null)
  const [projects, setProjects] = useState([])
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')
  const [priF,     setPriF]     = useState('')
  const [projF,    setProjF]    = useState('')
  const [modal,    setModal]    = useState(null)
  const [delModal, setDelModal] = useState(null)
  const [form,     setForm]     = useState(emptyForm)
  const [target,   setTarget]   = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedTask, setExpandedTask] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status     = statusF
      if (priF)    params.priority   = priF
      if (projF)   params.project_id = projF
      const [t, s, p, u] = await Promise.all([
        api.get('/tasks', { params }),
        api.get('/tasks/stats'),
        api.get('/projects'),
        api.get('/users'),
      ])
      setTasks(t.data.data ?? [])
      setStats(s.data.data)
      setProjects(p.data.data ?? [])
      setUsers(u.data.data ?? [])
    } catch { toast.error('Failed to load tasks') }
    finally { setLoading(false) }
  }, [statusF, priF, projF])

  useEffect(() => { load() }, [load] )

  const openCreate = () => { setForm(emptyForm); setTarget(null); setModal('form') }
  const openEdit   = (t) => {
    setForm({
      title: t.title, description: t.description ?? '',
      project_id:  t.project_id?._id ?? t.project_id,
      assigned_to: t.assigned_to?._id ?? t.assigned_to,
      status: t.status, priority: t.priority,
      due_date: t.due_date?.slice(0,10) ?? '',
    })
    setTarget(t); setModal('form')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (target) await api.patch(`/tasks/${target._id}`, form)
      else        await api.post('/tasks', form)
      toast.success(target ? 'Task updated' : 'Task created')
      setModal(null); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/tasks/${delModal._id}`)
      toast.success('Task deleted'); setDelModal(null); load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  const handleQuickStatus = async (task, status) => {
    try {
      await api.patch(`/tasks/${task._id}/status`, { status })
      toast.success(`Marked as ${status}`)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Update failed') }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const s = stats || {}
  const total = s.total ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tasks"
        subtitle="Create and manage tasks across all projects"
        action={<button className="btn-primary" onClick={openCreate}><Plus size={16}/> New Task</button>}
      />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total"       value={total}                              icon={CheckSquare} color="primary" />
          <StatCard label="To Do"       value={s.by_status?.todo ?? 0}            icon={CheckSquare} color="info" />
          <StatCard label="In Progress" value={s.by_status?.['in-progress'] ?? 0} icon={CheckSquare} color="amber" />
          <StatCard label="Completed"   value={s.by_status?.completed ?? 0}       icon={CheckSquare} color="emerald" />
          <StatCard label="Delayed"     value={s.delayed ?? 0}                    icon={CheckSquare} color="red" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"  options={STATUSES.map(s => ({ value: s, label: s }))}   className="w-40" />
        <SelectInput value={priF}    onChange={setPriF}    placeholder="All priorities" options={PRIORITIES.map(p => ({ value: p, label: p }))} className="w-40" />
        <SelectInput value={projF}   onChange={setProjF}   placeholder="All projects"   options={projects.map(p => ({ value: p._id, label: p.title }))} className="w-52" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15}/></button>
      </div>

      {/* Task Cards */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks found" description="Try adjusting your filters or create a new task" />
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task._id} className="card transition-all hover:shadow-md">
              <div className="flex items-start gap-4">
                {/* Status toggle */}
                <button
                  onClick={() => handleQuickStatus(task, task.status === 'completed' ? 'todo' : 'completed')}
                  className="mt-0.5 shrink-0"
                  title={task.status === 'completed' ? 'Mark as todo' : 'Mark as completed'}
                >
                  {task.status === 'completed'
                    ? <CheckCircle2 size={20} className="text-green-500" />
                    : <Circle size={20} className="text-gray-300 hover:text-green-400 transition-colors" />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 flex-wrap">
                    <h3 className={`font-semibold text-gray-800 ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      {task.phase_name && (
                        <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                          {task.phase_name}
                        </span>
                      )}
                      {task.is_locked && (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
                          title={task.lock_reason || 'Locked until earlier phases are completed'}
                        >
                          <Lock size={11} /> Locked
                        </span>
                      )}
                      {(task.subtasks?.length > 0) && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {task.subtasks.filter(s => s.status === 'completed').length}/{task.subtasks.length} subtasks
                        </span>
                      )}
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-sm text-gray-500 mt-1 truncate">{task.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-400">
                    {task.project_id?.title && <span>📁 {task.project_id.title}</span>}
                    {task.assigned_to?.name && <span>👤 {task.assigned_to.name}</span>}
                    {task.due_date && <span>📅 {format(new Date(task.due_date), 'dd MMM yyyy')}</span>}
                  </div>

                  {/* Quick status selector */}
                  <div className="mt-2">
                    <select
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      value={task.status}
                      onChange={e => handleQuickStatus(task, e.target.value)}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Subtask panel */}
                  <SubtaskPanel
                    task={expandedTask?._id === task._id ? task : null}
                    users={users}
                    onRefresh={load}
                  />
                  <button
                    onClick={() => setExpandedTask(prev => prev?._id === task._id ? null : task)}
                    className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ListTodo size={12} />
                    {expandedTask?._id === task._id ? 'Hide subtasks' : `Manage subtasks (${task.subtasks?.length ?? 0})`}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(task)} className="p-1.5 rounded hover:bg-amber-50 text-amber-500" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDelModal(task)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Task Modal */}
      <Modal
        open={modal === 'form'}
        onClose={() => setModal(null)}
        title={target ? 'Edit Task' : 'Create New Task'}
        footer={
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : (target ? 'Save Changes' : 'Create Task')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Title *">
            <input className="input" value={form.title} onChange={e => f('title', e.target.value)} placeholder="Task title" />
          </FormField>
          <FormField label="Description">
            <textarea className="input resize-none" rows={3} value={form.description} onChange={e => f('description', e.target.value)} placeholder="Task description…" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project">
              <select className="input" value={form.project_id} onChange={e => f('project_id', e.target.value)}>
                <option value="">Select project</option>
                {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
              </select>
            </FormField>
            <FormField label="Assign To">
              <select className="input" value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Status">
              <select className="input" value={form.status} onChange={e => f('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Priority">
              <select className="input" value={form.priority} onChange={e => f('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Due Date *">
              <input className="input" type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Task"
        message={`Delete "${delModal?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}