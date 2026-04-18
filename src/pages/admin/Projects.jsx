import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Eye, RefreshCw,
  FolderKanban, FolderCheck, FolderClock, Users, ChevronLeft,
} from 'lucide-react'
import api from '../../api/axios'
import axiosInstance from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, StatCard, SearchInput, SelectInput, ConfirmModal,
  StatusBadge, PriorityBadge, Spinner, EmptyState,
} from '../../components/common/UI'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES   = ['planning', 'active', 'on-hold', 'completed', 'cancelled']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

const PROJECT_TYPES = [
  { value: 'website',        label: '🌐 Website',        hint: 'Frontend, Backend, Full Stack, Designer' },
  { value: 'mobile_app',     label: '📱 Mobile App',      hint: 'Mobile Dev, Backend, Designer' },
  { value: 'ecommerce',      label: '🛒 E-Commerce',      hint: 'Full Stack, Backend, SEO, Designer' },
  { value: 'api_service',    label: '⚙️ API Service',     hint: 'Backend, Full Stack' },
  { value: 'data_analytics', label: '📊 Data Analytics',  hint: 'Data Analyst, Backend' },
  { value: 'design',         label: '🎨 Design',          hint: 'Designer' },
  { value: 'content',        label: '✍️ Content',         hint: 'Content Writer' },
  { value: 'seo',            label: '🔍 SEO',             hint: 'SEO Specialist, Content Writer' },
  { value: 'marketing',      label: '📣 Marketing',       hint: 'Marketing Specialist, Content Writer' },
  { value: 'other',          label: '📁 Other',           hint: 'General assignment' },
]

const COMPLEXITIES = [
  { value: 'small',  label: 'Small',  hint: 'Core features only, fewer tasks' },
  { value: 'medium', label: 'Medium', hint: 'Standard scope (recommended)' },
  { value: 'large',  label: 'Large',  hint: 'Full feature set, all modules' },
]

const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical']

const PRIORITY_COLORS = {
  low:      { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#34d399' },
  medium:   { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24' },
  high:     { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)',  text: '#f87171' },
  critical: { bg: 'rgba(220,38,38,0.2)',   border: 'rgba(220,38,38,0.4)',  text: '#ef4444' },
}

// ─── Empty helpers ────────────────────────────────────────────────────────────

const emptyTask = () => ({
  id: Date.now() + Math.random(),
  title: '', description: '', priority: 'medium',
  due_date: '', estimated_hours: '', required_role: '',
  requires_permission: false, permission_description: '',
})

const emptyAssignment = () => ({
  id: Date.now() + Math.random(),
  department: '', title: '', description: '',
  start_date: '', end_date: '', estimated_hours: '',
  tasks: [emptyTask()],
})

const emptyProject = () => ({
  title: '', description: '', manager_id: '',
  priority: 'medium', project_type: 'website',
  complexity: 'medium',
  start_date: '', end_date: '',
})

// ─── Shared input styles ──────────────────────────────────────────────────────

const INPUT = [
  'w-full rounded-lg px-3 py-2 text-sm text-white outline-none',
  'focus:ring-2 focus:ring-blue-500',
  'placeholder:text-slate-600',
].join(' ')

const IS = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(255,255,255,0.12)',
  colorScheme: 'dark',
}

const CARD_STYLE  = { backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }

// ─── Shared sub-components ────────────────────────────────────────────────────

function FormSection({ title, children }) {
  return (
    <div className="rounded-xl p-5 space-y-4" style={CARD_STYLE}>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

function PreviewPriorityBadge({ priority }) {
  const c = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {priority}
    </span>
  )
}

function FormMessageBanner({ msg, onClose }) {
  if (!msg.text) return null
  const isSuccess = msg.type === 'success'
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm flex justify-between items-start"
      style={
        isSuccess
          ? { backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
          : { backgroundColor: 'rgba(239,68,68,0.1)',  border: '1px solid rgba(239,68,68,0.25)',  color: '#f87171' }
      }
    >
      <span>{msg.text}</span>
      <button onClick={onClose} className="ml-4 opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}

// ─── Auto-Plan Preview step ───────────────────────────────────────────────────

function AutoPlanPreview({ plan, project, onBack, onConfirm, confirming }) {
  const { modules = [], total_tasks = 0 } = plan || {}

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
        <p className="text-emerald-400 font-semibold text-sm">
          ✅ Plan ready: {modules.length} modules · {total_tasks} tasks generated
        </p>
        <p className="text-slate-400 text-xs mt-1">
          Tasks are scheduled day-wise per role. Same-role tasks are sequential; different roles run in parallel.
          Review and confirm to create the project and assign everyone.
        </p>
      </div>

      {modules.map((mod, mi) => (
        <div key={mi} className="rounded-xl overflow-hidden" style={CARD_STYLE}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#3b82f6' }}>
                {mi + 1}
              </span>
              <span className="font-semibold text-white">{mod.name}</span>
            </div>
            <span className="text-xs text-slate-400">{mod.tasks.length} tasks</span>
          </div>

          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {mod.tasks.map((task, ti) => (
              <div key={ti} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{task.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {task.required_role} · {task.estimated_days} day{task.estimated_days !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <PreviewPriorityBadge priority={task.priority} />
                  {task.start_date && (
                    <span className="text-xs text-slate-400">
                      {new Date(task.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {' → '}
                      {new Date(task.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                  {task.suggested_assignee ? (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                      👤 {task.suggested_assignee.name}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400">⚠ No match found</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl font-medium text-slate-300 hover:text-white transition-colors"
          style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          ← Edit Details
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-[2] py-3 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
          style={{ backgroundColor: '#16a34a' }}
        >
          {confirming ? 'Creating project...' : '✅ Confirm & Create Project'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminProjects() {
  // List state
  const [projects, setProjects] = useState([])
  const [stats,    setStats]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')
  const [priF,     setPriF]     = useState('')
  const [search,   setSearch]   = useState('')
  const [delModal, setDelModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // view: 'list' | 'create'
  const [view, setView] = useState('list')

  // createMode: 'manual' | 'auto'
  const [createMode, setCreateMode] = useState('manual')

  // Shared form state
  const [managers,    setManagers]    = useState([])
  const [project,     setProject]     = useState(emptyProject())
  const [formMsg,     setFormMsg]     = useState({ type: '', text: '' })

  // Manual-mode state
  const [autoAssign,  setAutoAssign]  = useState(true)
  const [assignments, setAssignments] = useState([emptyAssignment()])
  const [creating,    setCreating]    = useState(false)

  // Auto-plan state
  const [autoStep,    setAutoStep]    = useState(1)   // 1 = input, 2 = preview
  const [generating,  setGenerating]  = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const [plan,        setPlan]        = useState(null)

  // ── Load project list ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status   = statusF
      if (priF)    params.priority = priF
      if (search)  params.search   = search
      const [p, s] = await Promise.all([
        api.get('/projects', { params }),
        api.get('/projects/stats'),
      ])
      setProjects(p.data.data ?? [])
      setStats(s.data.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [statusF, priF, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    axiosInstance.get('/users?role=manager')
      .then((r) => setManagers(r.data.data || []))
      .catch(console.error)
  }, [])

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/projects/${delModal._id}`)
      toast.success('Project deleted')
      setDelModal(null)
      load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  // ── Open create view ─────────────────────────────────────────────────────────

  function openCreate() {
    setProject(emptyProject())
    setAssignments([emptyAssignment()])
    setFormMsg({ type: '', text: '' })
    setAutoAssign(true)
    setCreateMode('manual')
    setAutoStep(1)
    setPlan(null)
    setView('create')
  }

  function updateProject(field, val) {
    setProject((p) => ({ ...p, [field]: val }))
  }

  // ── Manual mode helpers ──────────────────────────────────────────────────────

  function updateAssignment(idx, field, val) {
    setAssignments((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: val } : a)))
  }
  function addAssignment() { setAssignments((prev) => [...prev, emptyAssignment()]) }
  function removeAssignment(idx) { setAssignments((prev) => prev.filter((_, i) => i !== idx)) }
  function addTask(aIdx) {
    setAssignments((prev) =>
      prev.map((a, i) => (i === aIdx ? { ...a, tasks: [...a.tasks, emptyTask()] } : a))
    )
  }
  function removeTask(aIdx, tIdx) {
    setAssignments((prev) =>
      prev.map((a, i) =>
        i === aIdx ? { ...a, tasks: a.tasks.filter((_, ti) => ti !== tIdx) } : a
      )
    )
  }
  function updateTask(aIdx, tIdx, field, val) {
    setAssignments((prev) =>
      prev.map((a, i) =>
        i === aIdx
          ? { ...a, tasks: a.tasks.map((t, ti) => (ti === tIdx ? { ...t, [field]: val } : t)) }
          : a
      )
    )
  }

  async function handleManualCreate(e) {
    e.preventDefault()
    setCreating(true)
    setFormMsg({ type: '', text: '' })
    try {
      const payload = {
        project:     { ...project, auto_assign: autoAssign },
        assignments: assignments.map(({ id, tasks, ...a }) => ({
          ...a,
          tasks: tasks.map(({ id: _tid, ...t }) => ({
            ...t,
            estimated_hours: t.estimated_hours ? Number(t.estimated_hours) : null,
          })),
        })),
        auto_assign: autoAssign,
      }
      const res = await axiosInstance.post('/assignments/wizard', payload)
      toast.success(res.data.message || 'Project created!')
      setView('list')
      load()
    } catch (err) {
      setFormMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to create project' })
    } finally {
      setCreating(false)
    }
  }

  // ── Auto-plan handlers ───────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!project.title || !project.description || !project.start_date || !project.end_date) {
      setFormMsg({ type: 'error', text: 'Please fill in all required fields before generating.' })
      return
    }
    if (project.end_date <= project.start_date) {
      setFormMsg({ type: 'error', text: 'End date must be after start date.' })
      return
    }
    setGenerating(true)
    setFormMsg({ type: '', text: '' })
    try {
      const res = await axiosInstance.post('/assignments/auto-plan-preview', {
        description:  project.description,
        project_type: project.project_type,
        complexity:   project.complexity,
        start_date:   project.start_date,
      })
      setPlan(res.data.data)
      setAutoStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setFormMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to generate plan.' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleAutoConfirm() {
    setConfirming(true)
    setFormMsg({ type: '', text: '' })
    try {
      await axiosInstance.post('/assignments/wizard', {
        project:   project,
        auto_plan: true,
      })
      toast.success(`Project "${project.title}" created! Tasks assigned automatically.`)
      setView('list')
      load()
    } catch (err) {
      setFormMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to create project.' })
    } finally {
      setConfirming(false)
    }
  }

  const selectedType = PROJECT_TYPES.find((t) => t.value === project.project_type)

  // ── Shared project details fields ────────────────────────────────────────────

  function ProjectDetailsFields({ showComplexity = false }) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <FormField label="Project Title *">
            <input required value={project.title}
              onChange={(e) => updateProject('title', e.target.value)}
              placeholder="e.g. Company Website Redesign"
              className={INPUT} style={IS} />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label="Description *">
            <textarea required value={project.description}
              onChange={(e) => updateProject('description', e.target.value)}
              rows={showComplexity ? 4 : 2}
              placeholder={
                showComplexity
                  ? 'Describe what needs to be built. Mention key features like payments, search, chat, admin panel — the system will detect them and generate the right tasks.'
                  : 'Project overview...'
              }
              className={INPUT} style={IS} />
            {showComplexity && (
              <p className="text-xs text-blue-400 mt-1">💡 The more detail you add, the better the generated plan.</p>
            )}
          </FormField>
        </div>

        <FormField label="Project Type *">
          <select required value={project.project_type}
            onChange={(e) => updateProject('project_type', e.target.value)}
            className={INPUT} style={IS}>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                {t.label}
              </option>
            ))}
          </select>
          {selectedType && (
            <p className="text-xs text-blue-400 mt-1">
              🎯 {showComplexity ? 'Roles:' : 'Will auto-assign:'} <strong>{selectedType.hint}</strong>
            </p>
          )}
        </FormField>

        {showComplexity ? (
          <FormField label="Complexity">
            <select value={project.complexity}
              onChange={(e) => updateProject('complexity', e.target.value)}
              className={INPUT} style={IS}>
              {COMPLEXITIES.map((c) => (
                <option key={c.value} value={c.value} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                  {c.label} — {c.hint}
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <FormField label="Priority *">
            <select required value={project.priority}
              onChange={(e) => updateProject('priority', e.target.value)}
              className={INPUT} style={IS}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {showComplexity && (
          <FormField label="Priority *">
            <select required value={project.priority}
              onChange={(e) => updateProject('priority', e.target.value)}
              className={INPUT} style={IS}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </FormField>
        )}

        <FormField label="Manager">
          <select value={project.manager_id}
            onChange={(e) => updateProject('manager_id', e.target.value)}
            className={INPUT} style={IS}>
            <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>Select manager...</option>
            {managers.map((m) => (
              <option key={m._id} value={m._id} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                {m.name} ({m.designation})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Start Date *">
          <input type="date" required value={project.start_date}
            onChange={(e) => updateProject('start_date', e.target.value)}
            className={INPUT} style={IS} />
        </FormField>

        <FormField label="End Date *">
          <input type="date" required value={project.end_date}
            onChange={(e) => updateProject('end_date', e.target.value)}
            className={INPUT} style={IS} />
        </FormField>
      </div>
    )
  }

  // ── Render: Create form ──────────────────────────────────────────────────────

  if (view === 'create') {
    return (
      <div className="space-y-6 animate-fade-in">

        {/* Header */}
        <div>
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ChevronLeft size={15} /> Back to Projects
          </button>
          <h1 className="text-2xl font-bold text-white">Create Project</h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose manual setup or let the system auto-generate a full task plan.
          </p>
        </div>

        {/* Mode switcher */}
        <div className="flex rounded-xl overflow-hidden p-1 gap-1" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { key: 'manual', label: '📋 Manual Setup',   desc: 'Define assignments & tasks yourself' },
            { key: 'auto',   label: '🤖 Smart Auto-Plan', desc: 'AI generates tasks from description' },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setCreateMode(m.key)
                setFormMsg({ type: '', text: '' })
                setAutoStep(1)
                setPlan(null)
              }}
              className="flex-1 rounded-lg px-4 py-3 text-left transition-all"
              style={
                createMode === m.key
                  ? { backgroundColor: '#3b82f6' }
                  : { backgroundColor: 'transparent' }
              }
            >
              <p className={`text-sm font-semibold ${createMode === m.key ? 'text-white' : 'text-slate-400'}`}>{m.label}</p>
              <p className={`text-xs mt-0.5 ${createMode === m.key ? 'text-blue-100' : 'text-slate-600'}`}>{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Message banner */}
        <FormMessageBanner msg={formMsg} onClose={() => setFormMsg({ type: '', text: '' })} />

        {/* ── MANUAL MODE ── */}
        {createMode === 'manual' && (
          <form onSubmit={handleManualCreate} className="space-y-6">

            {/* Auto-Assign toggle */}
            <div
              className="rounded-xl p-5 transition-colors"
              style={
                autoAssign
                  ? { backgroundColor: 'rgba(59,130,246,0.1)', border: '2px solid rgba(59,130,246,0.5)' }
                  : { backgroundColor: '#1e293b', border: '2px solid rgba(255,255,255,0.08)' }
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Smart Auto-Assignment</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Automatically assign tasks to best-fit employees based on role, department, and workload.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input type="checkbox" checked={autoAssign} onChange={(e) => setAutoAssign(e.target.checked)} className="sr-only peer" />
                  <div
                    className="w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                    style={{ backgroundColor: autoAssign ? undefined : '#334155' }}
                  />
                </label>
              </div>
            </div>

            {/* Project Details */}
            <FormSection title="Project Details">
              <ProjectDetailsFields showComplexity={false} />
            </FormSection>

            {/* Assignments & Tasks */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Assignments &amp; Tasks</h2>
                <button type="button" onClick={addAssignment}
                  className="text-sm px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors"
                  style={{ backgroundColor: '#3b82f6' }}>
                  + Add Assignment
                </button>
              </div>

              {assignments.map((asgn, aIdx) => (
                <div key={asgn.id} className="rounded-xl p-5 space-y-4" style={CARD_STYLE}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-300">Assignment {aIdx + 1}</h3>
                    {assignments.length > 1 && (
                      <button type="button" onClick={() => removeAssignment(aIdx)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors">
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Title *">
                      <input required value={asgn.title}
                        onChange={(e) => updateAssignment(aIdx, 'title', e.target.value)}
                        placeholder="e.g. Frontend Development Phase"
                        className={INPUT} style={IS} />
                    </FormField>
                    <FormField label="Department *">
                      <input required value={asgn.department}
                        onChange={(e) => updateAssignment(aIdx, 'department', e.target.value)}
                        placeholder="e.g. Web Development"
                        className={INPUT} style={IS} />
                    </FormField>
                    <FormField label="Start Date *">
                      <input type="date" required value={asgn.start_date}
                        onChange={(e) => updateAssignment(aIdx, 'start_date', e.target.value)}
                        className={INPUT} style={IS} />
                    </FormField>
                    <FormField label="End Date *">
                      <input type="date" required value={asgn.end_date}
                        onChange={(e) => updateAssignment(aIdx, 'end_date', e.target.value)}
                        className={INPUT} style={IS} />
                    </FormField>
                  </div>

                  {/* Tasks */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-slate-400">Tasks</h4>
                      <button type="button" onClick={() => addTask(aIdx)}
                        className="text-xs px-2.5 py-1 rounded transition-colors hover:opacity-80"
                        style={{ border: '1px solid rgba(59,130,246,0.5)', color: '#60a5fa' }}>
                        + Add Task
                      </button>
                    </div>

                    <div className="space-y-3">
                      {asgn.tasks.map((task, tIdx) => (
                        <div key={task.id} className="rounded-lg p-3 space-y-3"
                          style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">Task {tIdx + 1}</span>
                            {asgn.tasks.length > 1 && (
                              <button type="button" onClick={() => removeTask(aIdx, tIdx)}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors">✕</button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField label="Title *">
                              <input required value={task.title}
                                onChange={(e) => updateTask(aIdx, tIdx, 'title', e.target.value)}
                                placeholder="e.g. Design Homepage"
                                className={INPUT} style={IS} />
                            </FormField>
                            <FormField label="Required Role">
                              <input value={task.required_role}
                                onChange={(e) => updateTask(aIdx, tIdx, 'required_role', e.target.value)}
                                placeholder="e.g. frontend developer"
                                className={INPUT} style={IS} />
                              {autoAssign && <p className="text-xs text-blue-400 mt-0.5">Used for auto-matching</p>}
                            </FormField>
                            <FormField label="Priority">
                              <select value={task.priority}
                                onChange={(e) => updateTask(aIdx, tIdx, 'priority', e.target.value)}
                                className={INPUT} style={IS}>
                                {TASK_PRIORITIES.map((p) => (
                                  <option key={p} value={p} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField label="Due Date *">
                              <input type="date" required value={task.due_date}
                                onChange={(e) => updateTask(aIdx, tIdx, 'due_date', e.target.value)}
                                className={INPUT} style={IS} />
                            </FormField>
                            <FormField label="Est. Hours">
                              <input type="number" min="0" value={task.estimated_hours}
                                onChange={(e) => updateTask(aIdx, tIdx, 'estimated_hours', e.target.value)}
                                placeholder="e.g. 8"
                                className={INPUT} style={IS} />
                            </FormField>
                            <FormField label="Requires Admin Permission">
                              <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" id={`perm-${aIdx}-${tIdx}`}
                                  checked={task.requires_permission}
                                  onChange={(e) => updateTask(aIdx, tIdx, 'requires_permission', e.target.checked)}
                                  className="w-4 h-4 accent-blue-500" />
                                <label htmlFor={`perm-${aIdx}-${tIdx}`} className="text-sm text-slate-400">
                                  Requires admin permission to start
                                </label>
                              </div>
                            </FormField>
                            {task.requires_permission && (
                              <div className="md:col-span-2">
                                <FormField label="Permission Description">
                                  <input value={task.permission_description}
                                    onChange={(e) => updateTask(aIdx, tIdx, 'permission_description', e.target.value)}
                                    placeholder="What access is needed?"
                                    className={INPUT} style={IS} />
                                </FormField>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button type="button" onClick={() => setView('list')}
                className="flex-1 py-3 rounded-xl font-semibold text-slate-400 hover:text-white transition-colors"
                style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel
              </button>
              <button type="submit" disabled={creating}
                className="flex-1 py-3 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#3b82f6' }}>
                {creating ? 'Creating...' : autoAssign ? '🤖 Create & Auto-Assign' : '📋 Create Project'}
              </button>
            </div>
          </form>
        )}

        {/* ── AUTO-PLAN MODE ── */}
        {createMode === 'auto' && (
          <div className="space-y-6">

            {/* Step indicator */}
            <div className="flex items-center gap-3">
              {[
                { n: 1, label: 'Project Details' },
                { n: 2, label: 'Review Plan' },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      autoStep === s.n ? 'text-white' : autoStep > s.n ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                    style={
                      autoStep === s.n
                        ? { backgroundColor: '#3b82f6' }
                        : autoStep > s.n
                        ? { backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }
                        : { backgroundColor: '#1e293b' }
                    }
                  >
                    <span>{autoStep > s.n ? '✓' : s.n}</span>
                    <span>{s.label}</span>
                  </div>
                  {i < 1 && <span className="text-slate-600">→</span>}
                </div>
              ))}
            </div>

            {/* Step 1: Input */}
            {autoStep === 1 && (
              <div className="space-y-6">
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '2px solid rgba(59,130,246,0.35)' }}>
                  <div className="flex items-start gap-3">
                    <span style={{ fontSize: 20 }}>🤖</span>
                    <div>
                      <p className="font-semibold text-white text-sm">Smart Auto-Plan</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Fill in the details below. The system will read your description, identify required modules,
                        generate all tasks, and assign them to the right team members — day by day, based on workload.
                      </p>
                    </div>
                  </div>
                </div>

                <FormSection title="Project Details">
                  <ProjectDetailsFields showComplexity={true} />
                </FormSection>

                <div className="flex gap-3">
                  <button
                    onClick={() => setView('list')}
                    className="flex-1 py-3 rounded-xl font-medium text-slate-400 hover:text-white transition-colors"
                    style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !project.title || !project.description || !project.start_date || !project.end_date}
                    className="flex-[2] py-3 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
                    style={{ backgroundColor: '#3b82f6' }}
                  >
                    {generating ? '⏳ Generating plan...' : '✨ Generate Auto-Plan →'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Preview */}
            {autoStep === 2 && plan && (
              <AutoPlanPreview
                plan={plan}
                project={project}
                onBack={() => setAutoStep(1)}
                onConfirm={handleAutoConfirm}
                confirming={confirming}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render: Project list ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage all projects across the organization"
        action={
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
            <Plus size={16} /> New Project
          </button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"     value={stats.total}                       icon={FolderKanban} color="brand"   />
          <StatCard label="Active"    value={stats.by_status?.active ?? 0}      icon={FolderCheck}  color="emerald" />
          <StatCard label="On Hold"   value={stats.by_status?.['on-hold'] ?? 0} icon={FolderClock}  color="amber"   />
          <StatCard label="Completed" value={stats.by_status?.completed ?? 0}   icon={FolderCheck}  color="purple"  />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />
        </div>
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />
        <SelectInput value={priF}    onChange={setPriF}    placeholder="All priorities"
          options={PRIORITIES.map(p => ({ value: p, label: p }))} className="w-40" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects found"
          description="Create your first project using the wizard"
          action={
            <button onClick={openCreate} className="btn-primary mt-3 flex items-center gap-1.5 mx-auto">
              <Plus size={15} /> Create Project
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p._id} className="card hover:border-white/10 transition-all group flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={p.status} />
                  <PriorityBadge priority={p.priority} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/admin/projects/${p._id}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors">
                    <Eye size={13} />
                  </Link>
                  <Link to={`/admin/projects/edit/${p._id}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                    <Pencil size={13} />
                  </Link>
                  <button onClick={() => setDelModal(p)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-white mb-1 line-clamp-1">{p.title}</h3>
              {p.client_info?.company && (
                <p className="text-xs text-brand-400 mb-1">Client: {p.client_info.company}</p>
              )}
              <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{p.description}</p>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
                    <Users size={10} className="text-emerald-400" />
                  </div>
                  <span>{p.manager_id?.name ?? 'No manager'}</span>
                </div>
                <span className="font-mono">
                  {p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!delModal} onClose={() => setDelModal(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Delete Project"
        message={`Permanently delete "${delModal?.title}"? This will also remove all assignments, tasks and members.`}
      />
    </div>
  )
}
