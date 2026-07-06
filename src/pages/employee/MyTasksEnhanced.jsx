import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CheckSquare, FileText, ExternalLink, Clock,
  Calendar, ShieldAlert, ShieldCheck, ShieldX, ShieldQuestion,
  Send, AlertTriangle, Lock, X, Loader2
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, SelectInput, StatusBadge, PriorityBadge,
  Spinner, EmptyState, StatCard
} from '../../components/common/UI'

const STATUSES = ['todo', 'in-progress', 'completed', 'on-hold', 'cancelled']

const PERM_CONFIG = {
  not_required: null,
  pending:  { label: 'Awaiting Approval',  color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200',  icon: ShieldQuestion },
  granted:  { label: 'Permission Granted', color: 'text-green-600',  bg: 'bg-green-50 border-green-200',    icon: ShieldCheck    },
  denied:   { label: 'Permission Denied',  color: 'text-red-600',    bg: 'bg-red-50 border-red-200',        icon: ShieldX        },
}

function PermissionBadge({ status }) {
  const cfg = PERM_CONFIG[status]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}

function RequestPermissionModal({ task, onClose, onSuccess }) {
  const [reason,     setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (reason.trim().length < 5) { toast.error('Please describe why you need permission (min 5 characters)'); return }
    setSubmitting(true)
    try {
      await api.post(`/tasks/${task._id}/request-permission`, { reason: reason.trim() })
      toast.success('Permission request sent to admin!')
      onSuccess(); onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send request')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-yellow-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-yellow-100 border border-yellow-200 flex items-center justify-center">
              <ShieldAlert size={15} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Request Permission</p>
              <p className="text-[11px] text-neutral truncate max-w-[240px]">{task.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <Lock size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[16px] font-semibold text-red-600">Task is blocked</p>
              <p className="text-[16px] text-neutral mt-0.5 leading-relaxed">
                This task requires admin approval before you can start.
                {task.permission_description && <span className="block mt-1 text-gray-500 italic">"{task.permission_description}"</span>}
              </p>
            </div>
          </div>
          <div>
            <label className="label">Why do you need permission?</label>
            <textarea
              autoFocus rows={4} value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. I need access to the production database to complete this migration task..."
              className="input resize-none"
            />
            <p className="mt-1 text-[11px] text-neutral text-right">{reason.length} chars</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary text-[16px]">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || reason.trim().length < 5}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[16px] font-semibold bg-warning text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? <><Loader2 size={12} className="animate-spin" /> Sending…</> : <><Send size={12} /> Send Request</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function PermissionStatusBanner({ task, onRequestClick }) {
  const status = task.permission_status
  if (status === 'not_required' || !task.requires_permission) return null

  if (status === 'granted') return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
      <ShieldCheck size={15} className="text-green-600 flex-shrink-0" />
      <div>
        <p className="text-[16px] font-semibold text-green-700">Permission Granted</p>
        <p className="text-[16px] text-neutral mt-0.5">
          You have been approved to work on this task.
          {task.permission_granted_by?.name && <span className="text-gray-500"> Approved by {task.permission_granted_by.name}.</span>}
        </p>
      </div>
    </div>
  )

  if (status === 'denied') return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
      <ShieldX size={15} className="text-red-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-semibold text-red-600">Permission Denied</p>
        <p className="text-[16px] text-neutral mt-0.5">Contact your manager or admin for clarification.</p>
      </div>
      <button onClick={onRequestClick} className="flex-shrink-0 text-[16px] px-3 py-1.5 rounded-lg text-yellow-600 border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors font-medium">
        Re-request
      </button>
    </div>
  )

  if (status === 'pending') return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
      <ShieldQuestion size={15} className="text-yellow-600 flex-shrink-0 animate-pulse" />
      <div>
        <p className="text-[16px] font-semibold text-yellow-700">Awaiting Admin Approval</p>
        <p className="text-[16px] text-neutral mt-0.5">
          Your permission request has been sent.
          {task.permission_description && <span className="text-gray-500 italic"> Reason: "{task.permission_description}"</span>}
        </p>
      </div>
    </div>
  )

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
      <Lock size={15} className="text-red-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-semibold text-red-600">Permission Required</p>
        <p className="text-[16px] text-neutral mt-0.5">
          This task is blocked until an admin grants permission.
          {task.permission_description && <span className="text-gray-500 italic block mt-0.5">"{task.permission_description}"</span>}
        </p>
      </div>
      <button onClick={onRequestClick} className="flex-shrink-0 flex items-center gap-1.5 text-[16px] px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-600 border border-yellow-200 hover:bg-yellow-100 transition-colors font-semibold">
        <ShieldAlert size={11} /> Request
      </button>
    </div>
  )
}

const PRIORITY_DOT = {
  critical: 'bg-danger',
  high:     'bg-orange-500',
  medium:   'bg-warning',
  low:      'bg-success',
}

export default function EmployeeMyTasksEnhanced() {
  const [tasks,      setTasks]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [statusF,    setStatusF]    = useState('')
  const [updating,   setUpdating]   = useState(null)
  const [expanded,   setExpanded]   = useState(null)
  const [permModal,  setPermModal]  = useState(null)
  const [docLoading, setDocLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      const { data } = await api.get('/tasks', { params })
      setTasks(data.data ?? [])
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load tasks')
    } finally { setLoading(false) }
  }, [statusF])

  useEffect(() => { load() }, [load])

  const updateStatus = async (taskId, newStatus) => {
    const task = tasks.find(t => t._id === taskId)
    if (task?.is_locked) {
      toast.error(task.lock_reason || 'This task is locked until earlier phases are completed.'); return
    }
    if (task?.requires_permission && task.permission_status !== 'granted' && newStatus !== task.status) {
      toast.error('This task is blocked. Request permission from admin first.'); return
    }
    setUpdating(taskId)
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus })
      toast.success('Status updated')
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t))
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update')
    } finally { setUpdating(null) }
  }

  const openDocument = async (taskId, projectId) => {
    setDocLoading(taskId)
    try {
      const { data } = await api.get(`/projects/${projectId}/document`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {
      toast.error(e.response?.data?.message || 'No document attached to this project')
    } finally { setDocLoading(null) }
  }

  const stats = {
    total:      tasks.length,
    todo:       tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed:  tasks.filter(t => t.status === 'completed').length,
    blocked:    tasks.filter(t => t.requires_permission && t.permission_status !== 'granted').length,
  }

  return (
    <div className="space-y-5 animate-fade-in font-poppins">
      <PageHeader title="My Tasks" subtitle="View and update your assigned tasks" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total"          value={stats.total}      icon={CheckSquare} color="primary" />
        <StatCard label="Todo"           value={stats.todo}       icon={CheckSquare} color="info"    />
        <StatCard label="In Progress"    value={stats.inProgress} icon={CheckSquare} color="amber"   />
        <StatCard label="Completed"      value={stats.completed}  icon={CheckSquare} color="emerald" />
        <StatCard label="Needs Approval" value={stats.blocked}    icon={ShieldAlert} color="danger"  />
      </div>

      {/* Pending banner */}
      {stats.blocked > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200">
          <AlertTriangle size={15} className="text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-700 font-medium">
            {stats.blocked} task{stats.blocked > 1 ? 's' : ''} pending admin approval.{' '}
            <span className="font-normal text-yellow-600">Expand each task and click "Request" to ask for permission.</span>
          </p>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        <SelectInput
          value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40"
        />
        <button onClick={load} className="px-3 py-2 rounded-lg border border-gray-200 text-neutral hover:text-primary hover:border-primary bg-white transition-all">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks found" description={statusF ? 'No tasks match this filter' : 'No tasks assigned yet'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tasks.map(t => {
            const overdue      = !t.is_locked && t.status !== 'completed' && t.status !== 'cancelled' &&
                                 (t.is_delayed || (() => { const d = t.effective_due_date || t.due_date; return d && new Date(d) < new Date() })())
            const isOpen       = expanded === t._id
            const project      = t.project_id
            const needsPerm    = t.requires_permission && t.permission_status !== 'granted'
            const isBlocked    = t.status === 'blocked' || needsPerm
            const deliverables = project?.extracted_deliverables || []

            return (
              <div
                key={t._id}
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden
                  ${isBlocked
                    ? 'border-yellow-200 shadow-sm'
                    : 'border-gray-200 shadow-sm hover:border-primary/40 hover:shadow-md'}`}
              >
                {/* Card column layout */}
                <div className="flex flex-col gap-2 px-4 py-3">
                  {/* Row 1: priority dot + title + badges */}
                  <div className="flex items-start gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${PRIORITY_DOT[t.priority] ?? 'bg-neutral'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{t.title}</span>
                        <PriorityBadge priority={t.priority} />
                        <PermissionBadge status={t.permission_status} />
                        {isBlocked && t.permission_status === 'not_required' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-50 border-red-200 text-red-600">
                            <Lock size={9} /> Blocked
                          </span>
                        )}
                        {t.is_locked && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-50 border-amber-200 text-amber-700"
                            title={t.lock_reason || 'Locked until earlier phases are completed'}
                          >
                            <Lock size={9} /> {t.phase_name ? `${t.phase_name} locked` : 'Locked'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: project / module / due date meta */}
                  <div className="flex items-center gap-2 flex-wrap pl-4">
                    <span className="text-[16px] text-neutral">{project?.title ?? '—'}</span>
                    {t.module_name && <span className="text-[16px] text-neutral">· {t.module_name}</span>}
                    {t.due_date && (
                      <span className={`text-[16px] font-medium ${overdue ? 'text-danger' : 'text-neutral'}`}>
                        · Due {format(new Date(t.due_date), 'MMM d')}{overdue && ' ⚠'}
                      </span>
                    )}
                  </div>

                  {/* Row 3: controls */}
                  <div className="flex items-center gap-2 flex-wrap pl-4">
                    {needsPerm && t.permission_status !== 'pending' && (
                      <button
                        onClick={() => setPermModal(t)}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold
                                   bg-yellow-50 border border-yellow-200 text-yellow-600 hover:bg-yellow-100 transition-all"
                      >
                        <ShieldAlert size={11} /> Request
                      </button>
                    )}

                    <div className="relative">
                      <select
                        value={t.status}
                        onChange={e => updateStatus(t._id, e.target.value)}
                        disabled={updating === t._id || isBlocked || t.is_locked}
                        title={t.is_locked ? (t.lock_reason || 'Locked until earlier phases are completed') : (isBlocked ? 'Task is blocked — get permission first' : undefined)}
                        className="text-[16px] py-1.5 pl-2 pr-7 w-32 appearance-none cursor-pointer rounded-lg
                                   border border-gray-200 bg-white text-gray-700 outline-none
                                   focus:border-primary focus:ring-1 focus:ring-primary
                                   disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {updating === t._id && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80">
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setExpanded(isOpen ? null : t._id)}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-neutral hover:text-primary hover:border-primary transition-all"
                    >
                      {isOpen ? 'Less' : 'Details'}
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100 space-y-3 pt-3">
                    {t.requires_permission && (
                      <PermissionStatusBanner task={t} onRequestClick={() => setPermModal(t)} />
                    )}

                    {t.description && (
                      <div>
                        <p className="text-[16px] font-semibold text-neutral uppercase tracking-wider mb-1">Task Details</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{t.description}</p>
                      </div>
                    )}

                    {project?.description && (
                      <div>
                        <p className="text-[16px] font-semibold text-neutral uppercase tracking-wider mb-1">Project Context</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{project.extracted_description || project.description}</p>
                      </div>
                    )}

                    {deliverables.length > 0 && (
                      <div>
                        <p className="text-[16px] font-semibold text-neutral uppercase tracking-wider mb-1.5">Expected Deliverables</p>
                        <ul className="space-y-1">
                          {deliverables.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="text-success flex-shrink-0 mt-0.5">✓</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4">
                      {t.start_date && (
                        <div className="flex items-center gap-1.5 text-[16px] text-neutral">
                          <Calendar size={11} />Start:
                          <span className="text-gray-700 ml-1">{format(new Date(t.start_date), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {t.end_date && (
                        <div className="flex items-center gap-1.5 text-[16px] text-neutral">
                          <Clock size={11} />End:
                          <span className="text-gray-700 ml-1">{format(new Date(t.end_date), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {t.estimated_days && <div className="text-[16px] text-neutral">Est: <span className="text-gray-700 ml-1">{t.estimated_days}d</span></div>}
                      {t.required_role   && <div className="text-[16px] text-neutral">Role: <span className="text-gray-700 ml-1">{t.required_role}</span></div>}
                    </div>

                    {project?._id && (
                      <button
                        onClick={() => openDocument(t._id, project._id)}
                        disabled={docLoading === t._id}
                        className="inline-flex items-center gap-2 text-[16px] px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-neutral hover:text-primary hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {docLoading === t._id
                          ? <><div className="w-3 h-3 border-2 border-neutral border-t-transparent rounded-full animate-spin" />Loading…</>
                          : <><FileText size={12} />View Reference Document<ExternalLink size={11} /></>
                        }
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {permModal && (
        <RequestPermissionModal
          task={permModal}
          onClose={() => setPermModal(null)}
          onSuccess={() => setTasks(prev => prev.map(t =>
            t._id === permModal._id ? { ...t, requires_permission: true, permission_status: 'pending' } : t
          ))}
        />
      )}
    </div>
  )
}