import { useEffect, useRef, useState } from 'react'
import {
  CheckSquare, Clock, FolderKanban, TrendingUp, LogIn, LogOut,
  CalendarOff, AlertCircle, CheckCircle2, XCircle,
  ShieldAlert, ShieldCheck, ShieldX, ShieldQuestion,
  Send, Lock, Loader2, Paperclip, X, FileText, Image as ImageIcon,
  Archive, MessageSquarePlus, Bell
} from 'lucide-react'
import api, { fetchMyLeaves } from '../../api/axios'
import toast from 'react-hot-toast'
import { StatCard, Spinner, StatusBadge, PriorityBadge } from '../../components/common/UI'
import { useAuth } from '../../context/AuthContext'
import { format, parseISO } from 'date-fns'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return ImageIcon
  if (['zip', 'rar', '7z'].includes(ext)) return Archive
  return FileText
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Permission badge ─────────────────────────────────────────────────────────

const PERM_CONFIG = {
  not_required: null,
  pending:  { label: 'Awaiting Approval', color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/30',    icon: ShieldQuestion },
  granted:  { label: 'Approved',          color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', icon: ShieldCheck    },
  denied:   { label: 'Denied',            color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/30',         icon: ShieldX        },
}

function PermissionBadge({ status }) {
  const cfg = PERM_CONFIG[status]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}



function AskApprovalModal({ item, type, onClose, onSuccess }) {
  const [message,    setMessage]    = useState('')
  const [files,      setFiles]      = useState([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef()

  const handleFileChange = (e) => {
    const MAX_SIZE = 10 * 1024 * 1024
    const valid = Array.from(e.target.files).filter(f => {
      if (f.size > MAX_SIZE) { toast.error(`"${f.name}" exceeds 10 MB`); return false }
      return true
    })
    setFiles(prev => [...prev, ...valid])
    e.target.value = ''
  }

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (trimmed.length < 5) { toast.error('Please write a message (min 5 characters)'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('attachments', f))

      if (type === 'task') {
        fd.append('reason', trimmed)
        await api.post(`/tasks/${item._id}/request-permission`, fd)
      } else {
        fd.append('message',  trimmed)
        fd.append('subject',  `Approval Request: ${item.title}`)
        fd.append('ref_type', 'Project')
        fd.append('ref_id',   item._id)
        await api.post('/email/send-approval-request', fd)
      }

      toast.success('Approval request sent to admin ')
      onSuccess(item._id, type)
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send request')
    } finally {
      setSubmitting(false)
    }
  }

  const needsPerm = type === 'task' && item.requires_permission && item.permission_status !== 'granted'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden bg-white"
        style={{ border: '1px solid #e5e7eb' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={{ background: 'rgba(245,158,11,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <MessageSquarePlus size={16} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Ask for Approval</p>
              <p className="text-[11px] text-gray-500 truncate max-w-[280px]">
                {type === 'task' ? ' Task' : ' Project'}: {item.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 bg-white">

          {/* Blocked notice */}
          {needsPerm && (
            <div
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
            >
              <Lock size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-500">This task requires admin approval before you can start</p>
                {item.permission_description && (
                  <p className="text-xs text-gray-500 mt-0.5 italic">"{item.permission_description}"</p>
                )}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Your Message <span className="text-red-400">*</span>
            </label>
            <textarea
              autoFocus
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                type === 'task'
                  ? 'Explain why you need access or what you plan to do for this task...'
                  : 'Describe your request, progress update, or what you need approval for...'
              }
              className="w-full px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400
                         bg-gray-50 border border-gray-200 rounded-xl outline-none resize-none
                         focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all"
            />
            <p className="mt-1 text-[11px] text-gray-400 text-right">{message.length} chars</p>
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Attach Documents <span className="text-gray-400">(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg
                           text-violet-600 border border-violet-200
                           hover:bg-violet-50 transition-colors font-medium"
              >
                <Paperclip size={11} /> Attach File
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,.svg,.xls,.xlsx,.csv,.ppt,.pptx,.zip"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {files.length === 0 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center py-5 rounded-xl
                           border border-dashed border-gray-200 bg-gray-50
                           hover:border-violet-300 hover:bg-violet-50/50 transition-all group"
              >
                <Paperclip size={20} className="text-gray-300 group-hover:text-violet-400 mb-1.5 transition-colors" />
                <p className="text-xs text-gray-400 group-hover:text-gray-500 transition-colors">
                  Click to attach PDF, Word, images, spreadsheets, or ZIP files
                </p>
                <p className="text-[11px] text-gray-300 mt-0.5">Max 10 MB per file</p>
              </button>
            ) : (
              <div className="space-y-2">
                {files.map((f, i) => {
                  const FileIcon = getFileIcon(f.name)
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <FileIcon size={14} className="text-violet-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 truncate">{f.name}</p>
                        <p className="text-[11px] text-gray-400">{formatBytes(f.size)}</p>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-violet-500 transition-colors mt-1"
                >
                  <Paperclip size={11} /> Add another file
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/70">
          <p className="text-[11px] text-gray-400">
            {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} attached` : 'No attachments'}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || message.trim().length < 5}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                         bg-amber-500 hover:bg-amber-400 text-white
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {submitting
                ? <><Loader2 size={12} className="animate-spin" /> Sending…</>
                : <><Send size={12} /> Send Request</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user }    = useAuth()
  const [tasks,     setTasks]     = useState([])
  const [today,     setToday]     = useState(null)
  const [stats,     setStats]     = useState(null)
  const [leaves,    setLeaves]    = useState([])
  const [projects,  setProjects]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [clocking,  setClocking]  = useState(false)
  const [approvalModal, setApprovalModal] = useState(null) // { item, type }

  const load = async () => {
    setLoading(true)
    try {
      const [t, att, ts, p] = await Promise.allSettled([
        api.get('/tasks?limit=100&sort=-createdAt'),
        api.get('/attendance/today'),
        api.get('/tasks/stats'),
        api.get('/projects?limit=6'),
      ])

      const allTasks = t.status === 'fulfilled' ? (t.value.data.data ?? []) : []
      setTasks(allTasks.slice(0, 5))

      if (att.status === 'fulfilled') setToday(att.value.data.data)

      // Build project list: start with API result, then fill gaps from task data
      let fetchedProjects = p.status === 'fulfilled' ? (p.value.data.data ?? []) : []

      if (allTasks.length > 0) {
        const knownIds = new Set(fetchedProjects.map(proj => String(proj._id)))
        const taskProjectIds = [...new Set(
          allTasks.map(t => t.project_id?._id ?? t.project_id).filter(Boolean).map(String)
        )]
        const missingIds = taskProjectIds.filter(id => !knownIds.has(id))

        if (missingIds.length > 0) {
          const extras = await Promise.allSettled(
            missingIds.map(id => api.get(`/projects/${id}`))
          )
          extras.forEach(r => {
            if (r.status === 'fulfilled') {
              const proj = r.value.data.data
              if (proj) fetchedProjects.push(proj)
            }
          })
        }
      }

      setProjects(fetchedProjects.slice(0, 3))

      if (ts.status === 'fulfilled') {
        const raw = ts.value.data.data ?? ts.value.data ?? {}
        const normalized = {
          total:         raw.total          ?? raw.totalTasks   ?? raw.count       ?? null,
          'in-progress': raw['in-progress'] ?? raw.inProgress   ?? raw.in_progress ?? null,
          completed:     raw.completed      ?? raw.done         ?? null,
          todo:          raw.todo           ?? raw.pending      ?? raw.open        ?? null,
        }
        const derived = {
          total:         allTasks.length,
          'in-progress': allTasks.filter(t => t.status === 'in-progress').length,
          completed:     allTasks.filter(t => t.status === 'completed').length,
          todo:          allTasks.filter(t => t.status === 'todo').length,
        }
        setStats({
          total:         normalized.total         ?? derived.total,
          'in-progress': normalized['in-progress'] ?? derived['in-progress'],
          completed:     normalized.completed      ?? derived.completed,
          todo:          normalized.todo           ?? derived.todo,
        })
      } else {
        setStats({
          total:         allTasks.length,
          'in-progress': allTasks.filter(t => t.status === 'in-progress').length,
          completed:     allTasks.filter(t => t.status === 'completed').length,
          todo:          allTasks.filter(t => t.status === 'todo').length,
        })
      }

      const myLeaves = await fetchMyLeaves()
      setLeaves(myLeaves)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleClockIn = async () => {
    setClocking(true)
    try { await api.post('/attendance/clock-in'); toast.success('Clocked in successfully!'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed to clock in') }
    finally { setClocking(false) }
  }

  const handleClockOut = async () => {
    setClocking(true)
    try { await api.patch('/attendance/clock-out'); toast.success('Clocked out. Have a great day!'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed to clock out') }
    finally { setClocking(false) }
  }

  const handleApprovalSuccess = (itemId, type) => {
    if (type === 'task') {
      setTasks(prev => prev.map(t =>
        t._id === itemId ? { ...t, requires_permission: true, permission_status: 'pending' } : t
      ))
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const s = stats || {}
  const pendingLeaves  = leaves.filter(l => l.status === 'pending')
  const approvedLeaves = leaves.filter(l => l.status === 'approved')

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Welcome row */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{getGreeting()}, {user?.name?.split(' ')[0]} </h1>
          <p className="text-neutral text-sm mt-1">{user?.designation} · {user?.department}</p>
        </div>

        {/* Attendance clock */}
        <div className="card !p-4 flex items-center gap-4 min-w-64">
          <div className="flex-1">
            <p className="text-xs font-semibold text-neutral uppercase tracking-wider">Today's Attendance</p>
            {today ? (
              <div className="mt-1">
                <div className="flex items-center gap-3">
                  {today.clock_in  && <p className="text-xs text-neutral font-mono">In: <span className="text-emerald-400">{format(new Date(today.clock_in),  'HH:mm')}</span></p>}
                  {today.clock_out && <p className="text-xs text-neutral font-mono">Out: <span className="text-amber-400">{format(new Date(today.clock_out), 'HH:mm')}</span></p>}
                </div>
                {today.status && <StatusBadge status={today.status} />}
              </div>
            ) : (
              <p className="text-xs text-neutral mt-1">Not clocked in yet</p>
            )}
          </div>
          {!today?.clock_in ? (
            <button onClick={handleClockIn} disabled={clocking} className="btn-primary py-2">
              {clocking ? <Spinner size="sm" /> : <LogIn size={15} />} Clock In
            </button>
          ) : !today?.clock_out ? (
            <button onClick={handleClockOut} disabled={clocking} className="btn-secondary py-2">
              {clocking ? <Spinner size="sm" /> : <LogOut size={15} />} Clock Out
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-semibold">Done </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Tasks"    value={s.total         ?? 0} icon={CheckSquare} color="primary"   />
        <StatCard label="In Progress" value={s['in-progress'] ?? 0} icon={TrendingUp}  color="amber"   />
        <StatCard label="Completed"   value={s.completed     ?? 0} icon={CheckSquare} color="emerald" />
        <StatCard label="Pending"     value={s.todo          ?? 0} icon={Clock}       color="info"    />
      </div>

      {/* Leave alerts */}
      {leaves.length > 0 && (
        <div className="space-y-2">
          {pendingLeaves.map(leave => (
            <div key={leave._id} className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">
                Your <span className="font-semibold">{leave.leave_type}</span> leave request ({leave.days ?? '?'} day{leave.days !== 1 ? 's' : ''}) is pending approval
              </p>
            </div>
          ))}
          {approvedLeaves.slice(0,1).map(leave => (
            <div key={leave._id} className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-300">
                Your <span className="font-semibold">{leave.leave_type}</span> leave ({leave.from_date ? format(parseISO(leave.from_date.slice(0,10)), 'MMM d') : ''}–{leave.to_date ? format(parseISO(leave.to_date.slice(0,10)), 'MMM d') : ''}) has been approved
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Recent Tasks with Approval Buttons ── */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckSquare size={14} className="text-primary" /> Recent Tasks
          </h3>
          {tasks.length === 0 ? (
            <p className="text-neutral text-sm text-center py-6">No tasks assigned yet</p>
          ) : (
            <div className="space-y-3">
              {tasks.map(t => {
                const overdue   = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
                const needsPerm = t.requires_permission && t.permission_status !== 'granted'
                const isPending = t.permission_status === 'pending'
                const isGranted = t.permission_status === 'granted'
                const isDenied  = t.permission_status === 'denied'

                return (
                  <div
                    key={t._id}
                    className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Priority bar */}
                      <div className={`w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5 ${
                        t.priority === 'critical' ? 'bg-red-500'    :
                        t.priority === 'high'     ? 'bg-orange-500' :
                        t.priority === 'medium'   ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                          {t.permission_status && t.permission_status !== 'not_required' && (
                            <PermissionBadge status={t.permission_status} />
                          )}
                        </div>
                        <p className="text-xs text-neutral mt-0.5">
                          {t.project_id?.title ?? 'No project'} ·
                          <span className={overdue ? ' text-red-400' : ''}>
                            {t.due_date ? ` Due ${format(new Date(t.due_date), 'MMM d')}` : ''}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Right controls */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge   status={t.status}    />
                      </div>

                      {/* ── Approval action area ── */}
                      {needsPerm && !isPending && (
                        /* Blocked task — primary CTA */
                        <button
                          onClick={() => setApprovalModal({ item: t, type: 'task' })}
                          title="Request permission to work on this task"
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold
                                     bg-amber-500/15 border border-amber-500/40 text-amber-400
                                     hover:bg-amber-500/25 transition-all whitespace-nowrap"
                        >
                          <ShieldAlert size={11} /> Ask Approval
                        </button>
                      )}

                      {isPending && (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg
                                         bg-amber-500/10 border border-amber-500/20 text-amber-400 whitespace-nowrap">
                          <ShieldQuestion size={10} className="animate-pulse" /> Pending…
                        </span>
                      )}

                      {isDenied && (
                        <button
                          onClick={() => setApprovalModal({ item: t, type: 'task' })}
                          title="Re-request permission"
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold
                                     bg-red-500/10 border border-red-500/25 text-red-400
                                     hover:bg-red-500/20 transition-all whitespace-nowrap"
                        >
                          <ShieldAlert size={11} /> Re-request
                        </button>
                      )}

                      {/* General message/send-file icon for non-blocked tasks */}
                      {!needsPerm && !isPending && !isDenied && t.permission_status !== 'granted' && (
                        <button
                          onClick={() => setApprovalModal({ item: t, type: 'task' })}
                          title="Send message or file to admin about this task"
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg
                                     text-neutral hover:text-primary border border-transparent
                                     hover:border-primary/30 hover:bg-purple-50 transition-all"
                        >
                          <MessageSquarePlus size={11} /> Message
                        </button>
                      )}

                      {isGranted && (
                        <button
                          onClick={() => setApprovalModal({ item: t, type: 'task' })}
                          title="Send update or files about this task"
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg
                                     text-emerald-600 hover:text-emerald-400 border border-transparent
                                     hover:border-emerald-500/25 hover:bg-emerald-500/8 transition-all"
                        >
                          <MessageSquarePlus size={11} /> Send Update
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Leave summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <CalendarOff size={14} className="text-primary" /> My Leave Requests
            </h3>
            <a href="/employee/attendance" className="text-xs text-primary hover:text-primary transition-colors">View all →</a>
          </div>
          {leaves.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CalendarOff size={32} className="text-neutral mb-3" />
              <p className="text-neutral text-sm">No leave requests</p>
              <a href="/employee/attendance" className="text-xs text-primary mt-2 hover:text-primary transition-colors">Apply for leave →</a>
            </div>
          ) : (
            <div className="space-y-2">
              {leaves.slice(0,4).map(leave => {
                const statusConfig = {
                  pending:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',    icon: AlertCircle  },
                  approved: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
                  rejected: { color: 'text-red-400 bg-red-500/10 border-red-500/20',          icon: XCircle      },
                }[leave.status] ?? {}
                const StatusIcon = statusConfig.icon ?? AlertCircle
                return (
                  <div key={leave._id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800 capitalize">{leave.leave_type} leave</p>
                      <p className="text-xs text-neutral">
                        {leave.from_date ? format(parseISO(leave.from_date.slice(0,10)), 'MMM d') : '—'} – {leave.to_date ? format(parseISO(leave.to_date.slice(0,10)), 'MMM d, yyyy') : '—'}
                        {leave.days && ` · ${leave.days}d`}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusConfig.color}`}>
                      <StatusIcon size={11} /> {leave.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Projects with Ask Approval ── */}
      {projects.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FolderKanban size={14} className="text-primary" /> My Projects
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {projects.map(p => (
              <div
                key={p._id}
                className="p-4 bg-white/[0.02] border border-gray-100 rounded-xl hover:border-gray-200 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                  <StatusBadge status={p.status} />
                </div>
                {p.description && (
                  <p className="text-xs text-neutral mt-1 line-clamp-2">{p.description}</p>
                )}
                {p.due_date && (
                  <p className={`text-xs mt-2 ${new Date(p.due_date) < new Date() && p.status !== 'completed' ? 'text-red-400' : 'text-neutral'}`}>
                    Due {format(new Date(p.due_date), 'MMM d, yyyy')}
                  </p>
                )}

                {/* ── Ask Approval / Send Message button on project ── */}
                <button
                  onClick={() => setApprovalModal({ item: p, type: 'project' })}
                  title="Request approval or send a message about this project"
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium
                             text-neutral border border-gray-100
                             hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5
                             transition-all"
                >
                  <Bell size={11} />
                  Ask for Approval / Send Message
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvalModal && (
        <AskApprovalModal
          item={approvalModal.item}
          type={approvalModal.type}
          onClose={() => setApprovalModal(null)}
          onSuccess={handleApprovalSuccess}
        />
      )}
    </div>
  )
}
