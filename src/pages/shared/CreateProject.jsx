/**
 * pages/shared/CreateProject.jsx
 * Shared create/edit project wizard used by admin and manager roles.
 * - Step 2 "Client" requires a dropdown selection (no free-form fields)
 * - Sends clientId (ObjectId ref), not a client_info blob
 * - Edit mode: pre-selects existing clientId from project data
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Briefcase, Building2, LayoutList, Users, Eye,
  Clock, AlertCircle, X, Save,
  Zap, ChevronDown, ChevronUp, Loader2, CheckCircle2,
} from 'lucide-react'
import { FormField, Spinner } from '../../components/common/UI'
import { format } from 'date-fns'

// ─── Constants ────────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  'SEO', 'Performance Marketing', 'Social Media Marketing', 'Content Marketing',
  'Email Marketing', 'Web Design & Development', 'Graphic Design',
  'Video & Creative Production', 'Analytics & Reporting',
  'Business Development', 'Account Management', 'HR & Admin',
]
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES   = ['planning', 'active', 'on-hold', 'completed', 'cancelled']

const PROJECT_TYPES = [
  { value: 'website',         label: 'Website' },
  { value: 'mobile_app',      label: 'Mobile App' },
  { value: 'ecommerce',       label: 'E-Commerce' },
  { value: 'admin_dashboard', label: 'Admin Dashboard' },
  { value: 'api_service',     label: 'API / Backend' },
  { value: 'ai_features',     label: 'AI Features' },
  { value: 'design',          label: 'Design' },
  { value: 'marketing',       label: 'Marketing' },
  { value: 'seo',             label: 'SEO' },
  { value: 'content',         label: 'Content' },
  { value: 'data_analytics',  label: 'Data Analytics' },
  { value: 'other',           label: 'Other' },
]

const STEPS = [
  { id: 1, label: 'Project Info', icon: Briefcase },
  { id: 2, label: 'Client',       icon: Building2 },
  { id: 3, label: 'Assignments',  icon: LayoutList },
  { id: 4, label: 'Team & Tasks', icon: Users },
  { id: 5, label: 'Review',       icon: Eye },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const tempId    = () => `tmp_${Date.now()}_${Math.random()}`
const newAssign = () => ({
  _tempId: tempId(), _id: null, _deleted: false,
  department: '', title: '', description: '',
  start_date: '', end_date: '', estimated_hours: '',
  members: [], tasks: [],
})
const newTask = () => ({
  _tempId: tempId(), _id: null, _deleted: false,
  title: '', description: '', assigned_to: '',
  priority: 'medium', status: 'todo', due_date: '', estimated_hours: '',
})

const initProject = {
  title: '', description: '', manager_id: '',
  priority: 'medium', status: 'planning',
  start_date: '', end_date: '', project_types: [],
}

// ─── Plan Preview ─────────────────────────────────────────────────────────────
function PlanPreview({ plan, onClose }) {
  const [openPhases, setOpenPhases] = useState({})
  const toggle = (name) => setOpenPhases(p => ({ ...p, [name]: !p[name] }))

  const priorityColor = {
    High:   'text-red-400 bg-red-400/10 border-red-400/20',
    Medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    Low:    'text-gray-400 bg-slate-400/10 border-slate-400/20',
  }
  const phaseColors = [
    'border-blue-500/40 bg-blue-500/5', 'border-violet-500/40 bg-violet-500/5',
    'border-emerald-500/40 bg-emerald-500/5', 'border-orange-500/40 bg-orange-500/5',
  ]

  const totalTasks    = plan.phases.reduce((s, p) => s + p.tasks.length, 0)
  const parallelTasks = plan.phases.reduce((s, p) => s + p.tasks.filter(t => t.canRunParallel).length, 0)

  return (
    <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">Generated Project Plan</span>
          <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 bg-white">
            {plan.phases.length} phases · {totalTasks} tasks · {parallelTasks} parallel
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {plan.phases.map((phase, pi) => {
          const isOpen = openPhases[phase.name] !== false
          return (
            <div key={phase.name} className={`rounded-lg border ${phaseColors[pi % phaseColors.length]}`}>
              <button className="w-full flex items-center justify-between px-3 py-2.5"
                onClick={() => toggle(phase.name)}>
                <span className="text-sm font-semibold text-gray-800">{phase.name}</span>
                {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  {phase.tasks.map((task, ti) => (
                    <div key={ti} className="flex items-start gap-2 rounded-md px-2.5 py-2 bg-white/60 border border-white/40">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-700">{task.title}</span>
                          {task.canRunParallel && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                              <Zap size={9} /> parallel
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          <span>{task.role}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Clock size={9} />{task.duration}</span>
                        </div>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${priorityColor[task.priority] ?? priorityColor.Medium}`}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CreateProject({ editMode = false }) {
  const navigate = useNavigate()
  const { id }   = useParams()
  const { user } = useAuth()

  const [step,        setStep]        = useState(1)
  const [projectData, setProjectData] = useState(initProject)

  // Client selection
  const [clientId,       setClientId]       = useState('')
  const [clientList,     setClientList]     = useState([])
  const [clientsLoading, setClientsLoading] = useState(true)

  const [assignments, setAssignments] = useState([newAssign()])
  const [managers,    setManagers]    = useState([])
  const [employees,   setEmployees]   = useState([])
  const [submitting,  setSubmitting]  = useState(false)
  const [plan,        setPlan]        = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [docFile,     setDocFile]     = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(editMode)

  // Load managers, employees, clients
  useEffect(() => {
    Promise.all([
      api.get('/users?role=manager&limit=100'),
      api.get('/users?role=employee&limit=100'),
      api.get('/clients'),
    ]).then(([m, e, cl]) => {
      setManagers(m.data.data ?? [])
      setEmployees(e.data.data ?? [])
      setClientList(cl.data.data ?? [])
    }).catch(() => toast.error('Failed to load form data'))
    .finally(() => setClientsLoading(false))
  }, [])

  // Edit mode: load existing project
  useEffect(() => {
    if (!editMode || !id) return
    api.get(`/projects/${id}`).then(({ data }) => {
      const p = data.data
      setProjectData({
        title:         p.title,
        description:   p.description,
        manager_id:    p.manager_id?._id ?? p.manager_id ?? '',
        priority:      p.priority ?? 'medium',
        status:        p.status   ?? 'planning',
        start_date:    p.start_date?.slice(0, 10) ?? '',
        end_date:      p.end_date?.slice(0, 10)   ?? '',
        project_types: p.project_types ?? [],
      })
      if (p.clientId) setClientId(p.clientId._id ?? p.clientId)
    }).catch(() => toast.error('Failed to load project'))
    .finally(() => setLoadingEdit(false))
  }, [editMode, id])

  const pd = (k, v) => setProjectData(p => ({ ...p, [k]: v }))

  const selectedClient = clientList.find(c => c._id === clientId) ?? null

  const toggleType = (val) => {
    pd('project_types', projectData.project_types.includes(val)
      ? projectData.project_types.filter(t => t !== val)
      : [...projectData.project_types, val])
  }

  // Generate plan preview
  const handleGeneratePlan = async () => {
    if (!projectData.project_types.length) { toast.error('Select at least one project type'); return }
    setPlanLoading(true)
    try {
      const { data } = await api.post('/projects/generate-plan', {
        projectTypes: projectData.project_types,
        description:  projectData.description,
      })
      setPlan(data.data)
    } catch { toast.error('Plan generation failed') }
    finally { setPlanLoading(false) }
  }

  // Assignment helpers
  const addAssign    = () => setAssignments(a => [...a, newAssign()])
  const removeAssign = (tid) => setAssignments(a => a.map(x => x._tempId === tid ? { ...x, _deleted: true } : x))
  const updateAssign = (tid, k, v) => setAssignments(a => a.map(x => x._tempId === tid ? { ...x, [k]: v } : x))
  const addTask      = (aTid) => setAssignments(a => a.map(x => x._tempId === aTid ? { ...x, tasks: [...x.tasks, newTask()] } : x))
  const removeTask   = (aTid, tTid) => setAssignments(a => a.map(x => x._tempId === aTid ? { ...x, tasks: x.tasks.map(t => t._tempId === tTid ? { ...t, _deleted: true } : t) } : x))
  const updateTask   = (aTid, tTid, k, v) => setAssignments(a => a.map(x => x._tempId === aTid ? { ...x, tasks: x.tasks.map(t => t._tempId === tTid ? { ...t, [k]: v } : t) } : x))
  const addMember    = (aTid) => setAssignments(a => a.map(x => x._tempId === aTid ? { ...x, members: [...x.members, ''] } : x))
  const updateMember = (aTid, idx, val) => setAssignments(a => a.map(x => x._tempId === aTid ? { ...x, members: x.members.map((m, i) => i === idx ? val : m) } : x))
  const removeMember = (aTid, idx) => setAssignments(a => a.map(x => x._tempId === aTid ? { ...x, members: x.members.filter((_, i) => i !== idx) } : x))

  const activeAssigns = assignments.filter(a => !a._deleted)

  // Validate before advancing
  function validateStep(s) {
    if (s === 1) {
      if (!projectData.title)      return 'Project title is required.'
      if (!projectData.start_date) return 'Start date is required.'
      if (!projectData.end_date)   return 'End date is required.'
    }
    if (s === 2) {
      if (!clientId) return 'Please select a client before continuing.'
    }
    return null
  }

  const handleNext = () => {
    const err = validateStep(step)
    if (err) { toast.error(err); return }
    setStep(s => s + 1)
  }

  // Submit
  const handleSubmit = async () => {
    if (!projectData.title || !projectData.start_date || !projectData.end_date) {
      toast.error('Title, start date and end date are required')
      return
    }
    if (!clientId) {
      toast.error('Please go back to Step 2 and select a client.')
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      Object.entries(projectData).forEach(([k, v]) => {
        if (k === 'project_types') {
          v.forEach(t => form.append('project_types[]', t))
        } else {
          form.append(k, v)
        }
      })
      form.append('clientId', clientId)
      if (docFile) form.append('document', docFile)

      let projectRes
      if (editMode && id) {
        projectRes = await api.patch(`/projects/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        projectRes = await api.post('/projects', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      }

      const project = projectRes.data.data

      // Create assignments
      for (const assign of activeAssigns) {
        if (!assign.title) continue
        const aRes = await api.post('/assignments', {
          project_id:      project._id,
          department:      assign.department,
          title:           assign.title,
          description:     assign.description,
          start_date:      assign.start_date,
          end_date:        assign.end_date,
          estimated_hours: assign.estimated_hours,
          members:         assign.members.filter(Boolean),
        })
        const aId = aRes.data.data?._id
        for (const task of assign.tasks.filter(t => !t._deleted && t.title)) {
          await api.post('/tasks', {
            project_id:      project._id,
            assignment_id:   aId,
            title:           task.title,
            description:     task.description,
            assigned_to:     task.assigned_to || undefined,
            priority:        task.priority,
            status:          task.status,
            due_date:        task.due_date || project.end_date,
            estimated_hours: task.estimated_hours,
          }).catch(() => {})
        }
      }

      toast.success(editMode ? 'Project updated!' : 'Project created!')
      navigate(`/${user.role}/projects`)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingEdit) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Step header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon  = s.icon
          const done   = step > s.id
          const active = step === s.id
          return (
            <div key={s.id} className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => step > s.id && setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all
                  ${active ? 'bg-primary text-white shadow-md'
                    : done  ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                    :         'bg-gray-100 text-gray-400 cursor-default'}`}
              >
                {done ? <Check size={14} /> : <Icon size={14} />}
                {s.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
            </div>
          )
        })}
      </div>

      <div className="card">
        {/* ── Step 1: Project Info ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Briefcase size={18} /> Project Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Project Title *" className="col-span-2">
                <input className="input" value={projectData.title}
                  onChange={e => pd('title', e.target.value)} placeholder="e.g. Company Website Redesign" />
              </FormField>

              <FormField label="Description" className="col-span-2">
                <textarea className="input resize-none" rows={3} value={projectData.description}
                  onChange={e => pd('description', e.target.value)} placeholder="What is this project about?" />
              </FormField>

              <FormField label="Project Manager">
                <select className="input" value={projectData.manager_id}
                  onChange={e => pd('manager_id', e.target.value)}>
                  <option value="">Select manager</option>
                  {managers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </FormField>

              <FormField label="Priority">
                <select className="input" value={projectData.priority}
                  onChange={e => pd('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </FormField>

              {editMode && (
                <FormField label="Status">
                  <select className="input" value={projectData.status}
                    onChange={e => pd('status', e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </FormField>
              )}

              <FormField label="Start Date *">
                <input className="input" type="date" value={projectData.start_date}
                  onChange={e => pd('start_date', e.target.value)} />
              </FormField>

              <FormField label="End Date *">
                <input className="input" type="date" value={projectData.end_date}
                  onChange={e => pd('end_date', e.target.value)} />
              </FormField>
            </div>

            {/* Project Types */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Project Type(s)</p>
              <div className="flex flex-wrap gap-2">
                {PROJECT_TYPES.map(t => (
                  <button key={t.value} onClick={() => toggleType(t.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                      ${projectData.project_types.includes(t.value)
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan Preview */}
            {projectData.project_types.length > 0 && (
              <div>
                <button className="btn-secondary text-sm" onClick={handleGeneratePlan} disabled={planLoading}>
                  {planLoading ? <Spinner size="sm" /> : <><Zap size={14} /> Preview Auto-Generated Plan</>}
                </button>
                {plan && <PlanPreview plan={plan} onClose={() => setPlan(null)} />}
              </div>
            )}

            {/* Document upload */}
            <FormField label="Project Document (optional)">
              <input type="file" accept=".pdf,.doc,.docx"
                onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary" />
              {docFile && (
                <p className="text-xs text-gray-400 mt-1">{docFile.name} · {(docFile.size / 1024).toFixed(0)} KB</p>
              )}
            </FormField>
          </div>
        )}

        {/* ── Step 2: Client ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Building2 size={18} /> Link Client
            </h2>
            <p className="text-sm text-gray-500">
              Select the client this project belongs to. All client contact details are managed in the Clients module.
            </p>

            <FormField label="Client *">
              {clientsLoading ? (
                <div className="input flex items-center gap-2 text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> Loading clients…
                </div>
              ) : clientList.length === 0 ? (
                <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-gray-500">
                    No clients found.{' '}
                    <a href="/admin/clients/create" className="text-blue-500 underline">Create a client first.</a>
                  </p>
                </div>
              ) : (
                <select className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">— Select a client —</option>
                  {clientList.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.companyName}{c.industry ? ` (${c.industry})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {/* Selected client preview card */}
            {selectedClient && (
              <div className="rounded-xl overflow-hidden border border-blue-100"
                style={{ backgroundColor: 'rgba(59,130,246,0.04)' }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-blue-100">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-blue-600 flex-shrink-0 text-sm"
                    style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    {(selectedClient.companyName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{selectedClient.companyName}</p>
                    {selectedClient.industry && (
                      <p className="text-xs text-blue-500 mt-0.5">{selectedClient.industry}</p>
                    )}
                  </div>
                  <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                </div>
                <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:divide-x divide-blue-100">
                  {selectedClient.name && (
                    <div className="px-4 py-2.5">
                      <p className="text-xs text-gray-400 mb-0.5">Contact Person</p>
                      <p className="text-sm text-gray-700 font-medium">{selectedClient.name}</p>
                    </div>
                  )}
                  {selectedClient.email && (
                    <div className="px-4 py-2.5">
                      <p className="text-xs text-gray-400 mb-0.5">Email</p>
                      <p className="text-sm text-gray-700 font-medium truncate">{selectedClient.email}</p>
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="px-4 py-2.5">
                      <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                      <p className="text-sm text-gray-700 font-medium">{selectedClient.phone}</p>
                    </div>
                  )}
                  {selectedClient.website && (
                    <div className="px-4 py-2.5">
                      <p className="text-xs text-gray-400 mb-0.5">Website</p>
                      <a href={selectedClient.website} target="_blank" rel="noreferrer"
                        className="text-sm text-blue-500 hover:underline font-medium truncate block">
                        {selectedClient.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-blue-50 border border-blue-100">
              <AlertCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                A client selection is required. Contact details, billing, and legal info live in the{' '}
                <strong>Clients</strong> module — no duplication needed here.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Assignments ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <LayoutList size={18} /> Assignments
              </h2>
              <button className="btn-secondary text-sm" onClick={addAssign}>
                <Plus size={14} /> Add Assignment
              </button>
            </div>

            {activeAssigns.length === 0 ? (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <LayoutList size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No assignments yet. Click "Add Assignment" to start.</p>
              </div>
            ) : (
              activeAssigns.map(assign => (
                <div key={assign._tempId} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <input className="input flex-1" placeholder="Assignment title"
                      value={assign.title} onChange={e => updateAssign(assign._tempId, 'title', e.target.value)} />
                    <button onClick={() => removeAssign(assign._tempId)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select className="input" value={assign.department}
                      onChange={e => updateAssign(assign._tempId, 'department', e.target.value)}>
                      <option value="">Department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input className="input" type="number" placeholder="Est. hours"
                      value={assign.estimated_hours}
                      onChange={e => updateAssign(assign._tempId, 'estimated_hours', e.target.value)} />
                    <input className="input" type="date" value={assign.start_date}
                      onChange={e => updateAssign(assign._tempId, 'start_date', e.target.value)} />
                    <input className="input" type="date" value={assign.end_date}
                      onChange={e => updateAssign(assign._tempId, 'end_date', e.target.value)} />
                  </div>
                  <textarea className="input resize-none w-full" rows={2} placeholder="Description…"
                    value={assign.description}
                    onChange={e => updateAssign(assign._tempId, 'description', e.target.value)} />
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Step 4: Team & Tasks ─────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Users size={18} /> Team & Tasks
            </h2>

            {activeAssigns.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No assignments created. Go back to Step 3 to add assignments first.
              </p>
            ) : (
              activeAssigns.map(assign => (
                <div key={assign._tempId} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700 text-sm">{assign.title || 'Untitled Assignment'}</h3>
                    <button className="btn-secondary text-xs" onClick={() => addTask(assign._tempId)}>
                      <Plus size={12} /> Add Task
                    </button>
                  </div>

                  {/* Members */}
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Team Members</p>
                    <div className="flex flex-wrap gap-2">
                      {assign.members.map((m, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <select className="input text-xs py-1.5" value={m}
                            onChange={e => updateMember(assign._tempId, idx, e.target.value)}>
                            <option value="">Select employee</option>
                            {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                          </select>
                          <button onClick={() => removeMember(assign._tempId, idx)}
                            className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => addMember(assign._tempId)}
                        className="text-xs text-primary hover:bg-primary/5 px-2 py-1.5 rounded-lg border border-primary/20 transition-colors">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Tasks */}
                  {assign.tasks.filter(t => !t._deleted).map(task => (
                    <div key={task._tempId} className="px-4 py-2.5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 items-center">
                      <input className="input text-sm sm:col-span-2 py-1.5" placeholder="Task title"
                        value={task.title}
                        onChange={e => updateTask(assign._tempId, task._tempId, 'title', e.target.value)} />
                      <select className="input text-sm py-1.5" value={task.assigned_to}
                        onChange={e => updateTask(assign._tempId, task._tempId, 'assigned_to', e.target.value)}>
                        <option value="">Assign</option>
                        {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                      </select>
                      <select className="input text-sm py-1.5" value={task.priority}
                        onChange={e => updateTask(assign._tempId, task._tempId, 'priority', e.target.value)}>
                        {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                      </select>
                      <input className="input text-sm py-1.5" type="date" value={task.due_date}
                        onChange={e => updateTask(assign._tempId, task._tempId, 'due_date', e.target.value)} />
                      <button onClick={() => removeTask(assign._tempId, task._tempId)}
                        className="p-1 text-red-400 hover:bg-red-50 rounded justify-self-end transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Step 5: Review ───────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Eye size={18} /> Review & Submit
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Project summary */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Project</p>
                <p className="font-bold text-gray-800">{projectData.title}</p>
                <p className="text-sm text-gray-500 mt-1">{projectData.description}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {projectData.project_types.map(t => (
                    <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                  <span>📅 {projectData.start_date} → {projectData.end_date}</span>
                  <span className="capitalize">🔥 {projectData.priority}</span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Client summary */}
                {selectedClient ? (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Client</p>
                    <p className="font-bold text-gray-800">{selectedClient.companyName}</p>
                    {selectedClient.industry && (
                      <p className="text-xs text-blue-500 mt-0.5">{selectedClient.industry}</p>
                    )}
                    {selectedClient.name  && <p className="text-sm text-gray-500 mt-1">{selectedClient.name}</p>}
                    {selectedClient.email && <p className="text-xs text-gray-400">{selectedClient.email}</p>}
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full mt-2 inline-block">
                      ✓ Linked to client record
                    </span>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                    <p className="text-xs font-semibold text-red-500 uppercase mb-1">Client</p>
                    <p className="text-sm text-red-600">No client selected — go back to Step 2.</p>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Assignments</p>
                  <p className="text-2xl font-bold text-gray-800">{activeAssigns.length}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {activeAssigns.reduce((s, a) => s + a.tasks.filter(t => !t._deleted).length, 0)} tasks total
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Auto-task Generation</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Based on your selected project type(s), the system will automatically create and assign
                  tasks to relevant team members in the background after project creation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
          <button className="btn-secondary" onClick={() => step > 1 && setStep(s => s - 1)} disabled={step === 1}>
            <ChevronLeft size={16} /> Back
          </button>
          {step < 5 ? (
            <button className="btn-primary" onClick={handleNext}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : <><Save size={16} /> {editMode ? 'Update Project' : 'Create Project'}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}