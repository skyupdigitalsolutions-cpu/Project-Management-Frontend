import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Briefcase, User, Building2, LayoutList, Users, ClipboardList, Eye,
  Clock, Calendar, AlertCircle, X, Pencil, Save, RefreshCw, RefreshCcw,
  Layers, Zap, GitBranch, ChevronDown, ChevronUp,
} from 'lucide-react'
import { FormField, SelectInput, Spinner } from '../../components/common/UI'
import { format } from 'date-fns'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  'SEO',
  'Performance Marketing',
  'Social Media Marketing',
  'Content Marketing',
  'Email Marketing',
  'Web Design & Development',
  'Graphic Design',
  'Video & Creative Production',
  'Analytics & Reporting',
  'Business Development',
  'Account Management',
  'HR & Admin',
]
const PRIORITIES    = ['low', 'medium', 'high', 'critical']
const STATUSES      = ['planning', 'active', 'on-hold', 'completed', 'cancelled']
const TASK_STATUSES = ['todo', 'in-progress', 'on-hold', 'completed']

const PROJECT_TYPES = [
  { value: 'website',         label: 'Website' },
  { value: 'mobile_app',      label: 'Mobile App' },
  { value: 'ecommerce',       label: 'E-Commerce' },
  { value: 'admin_dashboard', label: 'Admin Dashboard'},
  { value: 'api_service',     label: 'API / Backend' },
  { value: 'ai_features',     label: 'AI Features' },
  { value: 'design',          label: 'Design' },
  { value: 'marketing',       label: 'Marketing'},
  { value: 'seo',             label: 'SEO' },
  { value: 'content',         label: 'Content'},
  { value: 'data_analytics',  label: 'Data Analytics' },
  { value: 'other',           label: 'Other'},
]

// ─── Plan Preview Component ────────────────────────────────────────────────────
function PlanPreview({ plan, onClose }) {
  const [openPhases, setOpenPhases] = useState({})
  const togglePhase = (name) => setOpenPhases(p => ({ ...p, [name]: !p[name] }))

  const priorityColor = {
    High:   'text-red-400 bg-red-400/10 border-red-400/20',
    Medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    Low:    'text-neutral bg-slate-400/10 border-slate-400/20',
  }

  const phaseColors = [
    'border-blue-500/40 bg-blue-500/5',
    'border-violet-500/40 bg-violet-500/5',
    'border-emerald-500/40 bg-emerald-500/5',
    'border-orange-500/40 bg-orange-500/5',
    'border-rose-500/40 bg-rose-500/5',
  ]

  const totalTasks    = plan.phases.reduce((s, p) => s + p.tasks.length, 0)
  const parallelTasks = plan.phases.reduce((s, p) => s + p.tasks.filter(t => t.canRunParallel).length, 0)

  return (
    <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden"
      style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <GitBranch size={16} className="text-primary" />
          <span className="text-sm font-semibold text-gray-800">Generated Project Plan</span>
          <span className="text-[16px] text-neutral px-2 py-0.5 rounded-full border border-gray-200">
            {plan.phases.length} phases · {totalTasks} tasks · {parallelTasks} parallel
          </span>
        </div>
        <button onClick={onClose} className="text-neutral hover:text-gray-600 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {plan.phases.map((phase, pi) => {
          const isOpen = openPhases[phase.name] !== false
          const parallelCount = phase.tasks.filter(t => t.canRunParallel).length
          return (
            <div key={phase.name} className={`rounded-lg border ${phaseColors[pi % phaseColors.length]}`}>
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                onClick={() => togglePhase(phase.name)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-semibold text-gray-800">{phase.name}</span>
                  <span className="text-[16px] text-neutral">
                    {phase.tasks.length} tasks · {parallelCount} parallel
                  </span>
                </div>
                {isOpen ? <ChevronUp size={12} className="text-neutral" /> : <ChevronDown size={12} className="text-neutral" />}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  {phase.tasks.map((task, ti) => (
                    <div key={ti} className="flex items-start gap-2 rounded-md px-2.5 py-2"
                      style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[16px] font-medium text-gray-700 truncate">{task.title}</span>
                          {task.canRunParallel && (
                            <span className="flex items-center gap-1 text-[16px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              <Zap size={9} />parallel
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[16px] text-neutral">{task.role}</span>
                          <span className="text-[16px] text-neutral">·</span>
                          <span className="flex items-center gap-1 text-[16px] text-neutral">
                            <Clock size={9} />{task.duration}
                          </span>
                          {task.dependency && (
                            <>
                              <span className="text-[16px] text-neutral">·</span>
                              <span className="text-[16px] text-neutral italic truncate max-w-32">after: {task.dependency}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`text-[16px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${priorityColor[task.priority] ?? priorityColor.Medium}`}>
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

const STEPS = [
  { id: 1, label: 'Project Info',   icon: Briefcase },
  { id: 2, label: 'Client Details', icon: Building2 },
  { id: 3, label: 'Assignments',    icon: LayoutList },
  { id: 4, label: 'Team & Tasks',   icon: Users },
  { id: 5, label: 'Review',         icon: Eye },
]

// ─── Factories ────────────────────────────────────────────────────────────────

const tempId = () => `tmp_${Date.now()}_${Math.random()}`

const newAssignment = () => ({
  _tempId:         tempId(),
  _id:             null,
  _deleted:        false,
  department:      '',
  title:           '',
  description:     '',
  start_date:      '',
  end_date:        '',
  estimated_hours: '',
  members:         [],
  tasks:           [],
})

const newTask = () => ({
  _tempId:         tempId(),
  _id:             null,
  _deleted:        false,
  title:           '',
  description:     '',
  assigned_to:     '',
  priority:        'medium',
  status:          'todo',
  due_date:        '',
  estimated_hours: '',
})

const initProject = {
  title: '', description: '', manager_id: '',
  priority: 'medium', status: 'planning',
  start_date: '', end_date: '',
  project_types: [],
}

const initClient = {
  clientName:   '',
  companyName:  '',
  email:        '',
  phone:        '',
  website:      '',
  address:      '',
  budget:       '',
  requirements: '',
  notes:        '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const deptMatches = (userDept, assignmentDept) => {
  if (!userDept || !assignmentDept) return false
  const u = userDept.toLowerCase()
  const a = assignmentDept.toLowerCase()
  if (u === a) return true
  if (u.includes(a) || a.includes(u)) return true
  const stopWords = new Set(['&', 'and', 'the', 'of', 'for', 'in'])
  const uTokens = u.split(/[\s&,]+/).filter(t => t.length > 2 && !stopWords.has(t))
  const aTokens = a.split(/[\s&,]+/).filter(t => t.length > 2 && !stopWords.has(t))
  return uTokens.some(t => aTokens.includes(t))
}

const toDateInput = (d) => {
  if (!d) return ''
  try { return format(new Date(d), 'yyyy-MM-dd') } catch { return '' }
}

// Validate MongoDB ObjectId — must be exactly 24 hex characters
const isValidObjectId = (id) =>
  typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)

function normalizeAssignment(a) {
  const rawMembers = a.members ?? []
  const memberIds = rawMembers.map(m => {
    if (typeof m === 'string') return m
    if (m.user_id && typeof m.user_id === 'object') return m.user_id._id ?? m.user_id
    if (m.user_id && typeof m.user_id === 'string') return m.user_id
    return m._id ?? m
  }).filter(Boolean)

  return {
    _tempId:         tempId(),
    _id:             a._id,
    _deleted:        false,
    department:      a.department      ?? '',
    title:           a.title           ?? '',
    description:     a.description     ?? '',
    start_date:      toDateInput(a.start_date),
    end_date:        toDateInput(a.end_date),
    estimated_hours: a.estimated_hours != null ? String(a.estimated_hours) : '',
    members: memberIds,
    tasks: (a.tasks ?? []).map(normalizeTask),
  }
}

function normalizeTask(t) {
  return {
    _tempId:         tempId(),
    _id:             t._id,
    _deleted:        false,
    title:           t.title           ?? '',
    description:     t.description     ?? '',
    assigned_to:     typeof t.assigned_to === 'object'
                       ? (t.assigned_to?._id ?? '')
                       : (t.assigned_to ?? ''),
    priority:        t.priority        ?? 'medium',
    status:          t.status          ?? 'todo',
    due_date:        toDateInput(t.due_date),
    estimated_hours: t.estimated_hours != null ? String(t.estimated_hours) : '',
  }
}

// ─── Step Bar ─────────────────────────────────────────────────────────────────

function StepBar({ current, editMode }) {
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto gap-1">
      {STEPS.map((s, i) => {
        const done   = current > s.id
        const active = current === s.id
        const Icon   = s.icon
        return (
          <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm font-medium ${
              active ? 'bg-brand-600 text-gray-800' :
              done   ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                       'bg-gray-100 text-neutral'
            }`}>
              {done ? <Check size={14} /> : <Icon size={14} />}
              <span className="hidden sm:block">{s.label}</span>
              <span className="sm:hidden">{s.id}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className="text-neutral flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── STEP 1 — Project Info ────────────────────────────────────────────────────

function Step1({ data, onChange, managers, editMode = false, onRegeneratePlan, regenerating = false }) {
  const f = (k, v) => onChange({ ...data, [k]: v })
  const [docFile, setDocFile] = useState(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planPreview, setPlanPreview] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setDocFile(file)
    onChange({ ...data, _documentFile: file })
  }

  const toggleProjectType = (value) => {
    onChange(prev => {
      const current = prev.project_types ?? []
      const next = current.includes(value)
        ? current.filter(t => t !== value)
        : [...current, value]
      return { ...prev, project_types: next }
    })
    setPlanPreview(null)
  }

  const handleGeneratePlan = async () => {
    const types = data.project_types ?? []
    if (types.length === 0) {
      toast.error('Select at least one project type first')
      return
    }
    setGeneratingPlan(true)
    try {
      const res = await api.post('/projects/generate-plan', {
        projectTypes: types,
        description: data.description || '',
      })
      setPlanPreview(res.data.data)
    } catch (e) {
      console.error('Plan generation failed:', e)
      toast.error('Failed to generate plan. Please try again.')
    } finally {
      setGeneratingPlan(false)
    }
  }

  const selectedTypes = data.project_types ?? []

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Project Information</h2>
        <p className="text-sm text-neutral mt-1">Core details about the project scope and timeline.</p>
      </div>

      {!data._id && (
        <div className="rounded-xl p-4 border border-dashed border-white/20 space-y-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
          <p className="text-sm font-medium text-gray-600">
            Upload Project Document <span className="text-neutral font-normal">(optional)</span>
          </p>
          <p className="text-[16px] text-neutral">
            Upload a PDF, DOCX, or TXT file. We'll extract the project description and generate tasks automatically.
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              {docFile ? '📄 ' + docFile.name : 'Choose file'}
            </div>
            <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileChange} />
          </label>
          {docFile && (
            <p className="text-[16px] text-emerald-400">
              ✓ Document selected — description and tasks will be generated on submit
            </p>
          )}
        </div>
      )}

      <FormField label="Project Title *">
        <input className="input" value={data.title}
          onChange={e => f('title', e.target.value)}
          placeholder="e.g. Novara E-Commerce Website" />
      </FormField>

      <FormField label="Project Description *">
        <textarea className="input resize-none" rows={3}
          value={data.description}
          onChange={e => f('description', e.target.value)}
          placeholder={docFile ? 'Will be auto-generated from document…' : 'Brief overview of what needs to be delivered…'} />
      </FormField>

      {/* Project Types multi-select */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Layers size={13} className="text-neutral" />
          <label className="text-sm font-medium text-gray-600">Project Types</label>
          <span className="text-[16px] text-neutral">(select all that apply)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROJECT_TYPES.map(pt => {
            const selected = selectedTypes.includes(pt.value)
            return (
              <button
                key={pt.value}
                type="button"
                onClick={() => toggleProjectType(pt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[16px] font-medium border transition-all ${
                  selected
                    ? 'bg-brand-600 border-brand-500 text-gray-800'
                    : 'bg-gray-100 border-gray-200 text-neutral hover:border-white/20 hover:text-gray-600'
                }`}
              >
                
                <span>{pt.label}</span>
                {selected && <Check size={10} />}
              </button>
            )
          })}
        </div>

        {selectedTypes.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={generatingPlan}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)',
                border: '1px solid rgba(139,92,246,0.35)',
                color: '#a78bfa',
              }}
            >
              {generatingPlan ? (
                <><RefreshCw size={13} className="animate-spin" />Generating plan…</>
              ) : (
                <><Zap size={13} />Preview AI Project Plan</>
              )}
            </button>
            <p className="text-[16px] text-neutral mt-1">
              Generates a phase-based parallel execution plan for: {selectedTypes.map(t => PROJECT_TYPES.find(p => p.value === t)?.label).join(', ')}
            </p>
          </div>
        )}

        {planPreview && (
          <PlanPreview plan={planPreview} onClose={() => setPlanPreview(null)} />
        )}

        {editMode && selectedTypes.length > 0 && onRegeneratePlan && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <p className="text-[16px] text-red-400 mb-2">
              You changed the project types. Click below to regenerate and auto-assign a fresh plan.
            </p>
            <button
              type="button"
              onClick={onRegeneratePlan}
              disabled={regenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(220,38,38,0.2) 100%)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#f87171',
              }}
            >
              <RefreshCw size={13} />
              Regenerate &amp; Auto-Assign Plan
            </button>
          </div>
        )}
      </div>

      <FormField label="Assign Manager *">
        <SelectInput value={data.manager_id} onChange={v => f('manager_id', v)}
          placeholder="Select a manager"
          options={managers.map(m => ({ value: m._id, label: `${m.name} — ${m.department ?? m.designation ?? ''}` }))} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Priority">
          <SelectInput value={data.priority} onChange={v => f('priority', v)}
            options={PRIORITIES.map(p => ({ value: p, label: p }))} />
        </FormField>
        <FormField label="Status">
          <SelectInput value={data.status} onChange={v => f('status', v)}
            options={STATUSES.map(s => ({ value: s, label: s }))} />
        </FormField>
        <FormField label="Start Date *">
          <input className="input" type="date" value={data.start_date}
            onChange={e => f('start_date', e.target.value)} />
        </FormField>
        <FormField label="End Date *">
          <input className="input" type="date" value={data.end_date}
            onChange={e => f('end_date', e.target.value)} />
        </FormField>
      </div>
    </div>
  )
}

// ─── STEP 2 — Client Details ──────────────────────────────────────────────────

function Step2({ data, onChange }) {
  const f = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Client Details</h2>
        <p className="text-sm text-neutral mt-1">Collect the client's contact info and project requirements.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Client Name">
          <input className="input" value={data.clientName}
            onChange={e => f('clientName', e.target.value)}
            placeholder="e.g. John Smith" />
        </FormField>

        <FormField label="Company / Brand">
          <input className="input" value={data.companyName}
            onChange={e => f('companyName', e.target.value)}
            placeholder="e.g. Acme Corp" />
        </FormField>

        <FormField label="Email">
          <input className="input" type="email" value={data.email}
            onChange={e => f('email', e.target.value)}
            placeholder="client@company.com" />
        </FormField>

        <FormField label="Phone">
          <input className="input" value={data.phone}
            onChange={e => f('phone', e.target.value)}
            placeholder="+1 555 000 0000" />
        </FormField>

        <FormField label="Website / URL">
          <input className="input" value={data.website}
            onChange={e => f('website', e.target.value)}
            placeholder="https://client.com" />
        </FormField>

        <FormField label="Budget">
          <input className="input" value={data.budget}
            onChange={e => f('budget', e.target.value)}
            placeholder="e.g. $5,000 – $10,000" />
        </FormField>
      </div>

      <FormField label="Address">
        <input className="input" value={data.address}
          onChange={e => f('address', e.target.value)}
          placeholder="Client address (optional)" />
      </FormField>

      <FormField label="Project Requirements / Brief">
        <textarea className="input resize-none" rows={4}
          value={data.requirements}
          onChange={e => f('requirements', e.target.value)}
          placeholder="Describe what the client needs: goals, deliverables, target audience, tone, competitors…" />
      </FormField>

      <FormField label="Notes">
        <textarea className="input resize-none" rows={3}
          value={data.notes}
          onChange={e => f('notes', e.target.value)}
          placeholder="Any additional notes about the client…" />
      </FormField>

      <div className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <AlertCircle size={14} className="text-blue-400 flex-shrink-0" />
        <p className="text-[16px] text-neutral">
          Client details are optional. You can skip this step and add them later.
        </p>
      </div>
    </div>
  )
}

// ─── STEP 3 — Assignments ─────────────────────────────────────────────────────

function Step3({ assignments, onChange, editMode }) {
  const visible = assignments.filter(a => !a._deleted)

  const add = () => onChange([...assignments, newAssignment()])

  const remove = (tid) => {
    onChange(assignments.map(a => {
      if (a._tempId !== tid) return a
      return a._id ? { ...a, _deleted: true } : null
    }).filter(Boolean))
  }

  const update = (tid, key, val) =>
    onChange(assignments.map(a =>
      a._tempId === tid ? { ...a, [key]: val } : a
    ))

  const updateDept = (tid, val) =>
    onChange(assignments.map(a =>
      a._tempId === tid
        ? { ...a, department: val, members: [], tasks: a.tasks.map(t => ({ ...t, assigned_to: '' })) }
        : a
    ))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Department Assignments</h2>
          <p className="text-sm text-neutral mt-1">
            {editMode
              ? 'Edit existing assignments or add new ones (e.g. SEO, PPC, Web Development).'
              : 'Define which departments will work on this project.'}
          </p>
        </div>
        <button onClick={add} className="btn-primary flex-shrink-0">
          <Plus size={15} /> Add Assignment
        </button>
      </div>

      {visible.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <LayoutList size={36} className="text-neutral mx-auto mb-3" />
          <p className="text-neutral font-medium">No assignments yet</p>
          <p className="text-neutral text-sm mt-1">Click "Add Assignment" to define department workstreams</p>
        </div>
      )}

      <div className="space-y-4">
        {visible.map((a, idx) => (
          <div key={a._tempId}
            className={`border rounded-2xl p-5 transition-all ${
              a._id ? 'bg-white border-gray-200' : 'bg-emerald-500/5 border-emerald-500/20'
            }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center text-gray-800 text-[16px] font-bold">
                  {idx + 1}
                </div>
                <span className="text-sm font-semibold text-gray-800">
                  {a.department || 'New Assignment'}
                </span>
                {!a._id && (
                  <span className="text-[16px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                    New
                  </span>
                )}
              </div>
              <button onClick={() => remove(a._tempId)}
                className="text-neutral hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                title={a._id ? 'Remove assignment (will delete on save)' : 'Remove'}>
                <Trash2 size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Department *">
                <SelectInput value={a.department} onChange={v => updateDept(a._tempId, v)}
                  placeholder="Select department"
                  options={DEPARTMENTS.map(d => ({ value: d, label: d }))} />
              </FormField>
              <FormField label="Assignment Title *">
                <input className="input" value={a.title}
                  onChange={e => update(a._tempId, 'title', e.target.value)}
                  placeholder="e.g. SEO Campaign Phase 1" />
              </FormField>
              <FormField label="Start Date *">
                <input className="input" type="date" value={a.start_date}
                  onChange={e => update(a._tempId, 'start_date', e.target.value)} />
              </FormField>
              <FormField label="End Date *">
                <input className="input" type="date" value={a.end_date}
                  onChange={e => update(a._tempId, 'end_date', e.target.value)} />
              </FormField>
              <FormField label="Estimated Hours">
                <input className="input" type="number" min="0"
                  value={a.estimated_hours}
                  onChange={e => update(a._tempId, 'estimated_hours', e.target.value)}
                  placeholder="e.g. 40" />
              </FormField>
              <FormField label="Description">
                <input className="input" value={a.description}
                  onChange={e => update(a._tempId, 'description', e.target.value)}
                  placeholder="What this department will deliver…" />
              </FormField>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── STEP 4 — Team & Tasks ────────────────────────────────────────────────────

function autoPickAssignee(taskTitle, members, allUsers) {
  if (!members || members.length === 0) return ''
  const memberUsers = allUsers.filter(u => members.includes(u._id))
  if (memberUsers.length === 0) return ''

  const title = taskTitle.toLowerCase()

  const roleKeywords = [
    { words: ['design', 'ui', 'ux', 'wireframe', 'prototype', 'figma', 'style guide'], role: 'design' },
    { words: ['backend', 'api', 'database', 'schema', 'server', 'auth', 'deploy', 'devops', 'ci/cd'], role: 'backend' },
    { words: ['frontend', 'react', 'vue', 'html', 'css', 'integration', 'landing page'], role: 'frontend' },
    { words: ['test', 'qa', 'quality', 'bug', 'uat', 'regression', 'performance'], role: 'qa' },
    { words: ['seo', 'keyword', 'on-page', 'technical seo', 'audit'], role: 'seo' },
    { words: ['marketing', 'campaign', 'social media', 'ad', 'analytics', 'content'], role: 'marketing' },
    { words: ['content', 'copy', 'write', 'blog', 'editorial'], role: 'content' },
  ]

  for (const { words, role } of roleKeywords) {
    if (words.some(w => title.includes(w))) {
      const match = memberUsers.find(u =>
        u.designation?.toLowerCase().includes(role) ||
        u.department?.toLowerCase().includes(role)
      )
      if (match) return match._id
    }
  }

  return memberUsers[0]._id
}

function Step4({ assignments, onChange, allUsers, projectId, editMode }) {
  const visible = assignments.filter(a => !a._deleted)
  const [openPanel, setOpenPanel] = useState(visible[0]?._tempId ?? null)

  useEffect(() => {
    if (!openPanel && visible.length > 0) setOpenPanel(visible[0]._tempId)
  }, [visible.length])

  const updateAssignment = (tid, key, val) =>
    onChange(assignments.map(a => a._tempId === tid ? { ...a, [key]: val } : a))

  const autoSelectDeptMembers = (tid) => {
    const a = assignments.find(x => x._tempId === tid)
    if (!a || !a.department || a.members.length > 0) return
    const deptUsers = allUsers.filter(
      u => deptMatches(u.department, a.department) && u.role === 'employee'
    )
    if (deptUsers.length === 0) return
    const memberIds = deptUsers.map(u => u._id)
    onChange(assignments.map(x =>
      x._tempId === tid ? { ...x, members: memberIds } : x
    ))
  }

  const toggleMember = (tid, userId) => {
    const a = assignments.find(x => x._tempId === tid)
    const has = a.members.includes(userId)
    const nextMembers = has
      ? a.members.filter(id => id !== userId)
      : [...a.members, userId]
    const nextTasks = has
      ? a.tasks.map(t => t.assigned_to === userId ? { ...t, assigned_to: '' } : t)
      : a.tasks
    onChange(assignments.map(x =>
      x._tempId === tid ? { ...x, members: nextMembers, tasks: nextTasks } : x
    ))
  }

  const addTask = (tid) => {
    const a = assignments.find(x => x._tempId === tid)
    const newT = newTask()
    const autoAssignee = a.members.length > 0
      ? allUsers.find(u => u._id === a.members[0])?._id ?? ''
      : ''
    onChange(assignments.map(x =>
      x._tempId === tid
        ? { ...x, tasks: [...x.tasks, { ...newT, assigned_to: autoAssignee }] }
        : x
    ))
  }

  const removeTask = (aTid, tTid) => {
    const a = assignments.find(x => x._tempId === aTid)
    const nextTasks = a.tasks.map(t => {
      if (t._tempId !== tTid) return t
      return t._id ? { ...t, _deleted: true } : null
    }).filter(Boolean)
    updateAssignment(aTid, 'tasks', nextTasks)
  }

  const updateTask = (aTid, tTid, key, val) => {
    const a = assignments.find(x => x._tempId === aTid)
    const nextTasks = a.tasks.map(t => {
      if (t._tempId !== tTid) return t
      const updated = { ...t, [key]: val }
      if (key === 'title' && val.trim().length > 3) {
        updated.assigned_to = autoPickAssignee(val, a.members, allUsers) || t.assigned_to
      }
      return updated
    })
    updateAssignment(aTid, 'tasks', nextTasks)
  }

  if (visible.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <AlertCircle size={36} className="text-amber-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No assignments defined</p>
        <p className="text-neutral text-sm mt-1">Go back to Step 3 and add at least one assignment first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Team Members & Tasks</h2>
        <p className="text-sm text-neutral mt-1">
          {editMode
            ? 'Edit team members and tasks for each assignment. Members are auto-selected by department.'
            : 'Team members are auto-selected by department. Tasks are auto-assigned by role — you can adjust manually.'}
        </p>
      </div>

      {visible.map((a, idx) => {
        const isOpen = openPanel === a._tempId
        const departmentUsers = a.department
          ? allUsers.filter(u => deptMatches(u.department, a.department) && u.role === 'employee')
          : []
        const assignedUsers = allUsers.filter(u => a.members.includes(u._id))
        const visibleTasks = a.tasks.filter(t => !t._deleted)

        return (
          <div key={a._tempId}
            className={`border rounded-2xl overflow-hidden ${
              a._id ? 'bg-white border-gray-200' : 'bg-emerald-500/5 border-emerald-500/20'
            }`}>
            <button
              onClick={() => {
                setOpenPanel(isOpen ? null : a._tempId)
                if (!isOpen) autoSelectDeptMembers(a._tempId)
              }}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-50 border border-primary/30 flex items-center justify-center text-primary text-[16px] font-bold">
                  {idx + 1}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 text-sm">{a.title || 'Untitled'}</p>
                    {!a._id && (
                      <span className="text-[16px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-[16px] text-neutral">
                    {a.department
                      ? `${a.department} · ${a.members.length} member${a.members.length !== 1 ? 's' : ''} · ${visibleTasks.length} task${visibleTasks.length !== 1 ? 's' : ''}`
                      : <span className="text-amber-400/80">⚠ No department selected</span>
                    }
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className={`text-neutral transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 p-5 space-y-6">
                {/* Members */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[16px] font-semibold text-neutral uppercase tracking-wider flex items-center gap-2">
                      <Users size={13} /> Team Members
                    </p>
                    {departmentUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = departmentUsers.map(u => u._id)
                          const allSelected = allIds.every(id => a.members.includes(id))
                          onChange(assignments.map(x =>
                            x._tempId === a._tempId
                              ? { ...x, members: allSelected ? [] : allIds }
                              : x
                          ))
                        }}
                        className="text-[16px] text-primary hover:text-primary transition-colors">
                        {departmentUsers.every(u => a.members.includes(u._id)) ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <p className="text-[16px] text-neutral mb-3">
                    Showing employees from{' '}
                    <span className="text-primary font-medium">{a.department || '—'}</span>
                    {a.department && departmentUsers.length === 0 && (
                      <span className="text-amber-400 ml-2">· No employees found in this department</span>
                    )}
                    {!a.department && (
                      <span className="text-amber-400 ml-2">· Select a department in Step 3 first</span>
                    )}
                  </p>

                  {departmentUsers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {departmentUsers.map(u => {
                        const checked = a.members.includes(u._id)
                        return (
                          <label key={u._id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                              checked
                                ? 'bg-purple-50 border-primary/30'
                                : 'bg-gray-100 border-gray-100 hover:border-gray-200'
                            }`}>
                            <input type="checkbox" checked={checked}
                              onChange={() => toggleMember(a._tempId, u._id)}
                              className="w-4 h-4 accent-brand-500 flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                                <p className="text-[16px] text-neutral truncate">{u.designation || u.department}</p>
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-xl p-5 text-center">
                      <Users size={24} className="text-neutral mx-auto mb-2" />
                      <p className="text-neutral text-sm">
                        {a.department
                          ? `No employees found in "${a.department}"`
                          : 'Select a department first'}
                      </p>
                    </div>
                  )}

                  {departmentUsers.length > 0 && a.members.length === 0 && (
                    <p className="text-[16px] text-amber-400/70 mt-2 flex items-center gap-1">
                      <AlertCircle size={12} /> Select at least one team member
                    </p>
                  )}
                </div>

                {/* Tasks */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[16px] font-semibold text-neutral uppercase tracking-wider flex items-center gap-2">
                      <ClipboardList size={13} /> Tasks
                      <span className="normal-case font-normal text-neutral">({visibleTasks.length})</span>
                    </p>
                    <button
                      onClick={() => addTask(a._tempId)}
                      disabled={a.members.length === 0}
                      title={a.members.length === 0 ? 'Select team members first' : 'Add a new task'}
                      className="btn-secondary !py-1.5 !px-3 text-[16px] disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus size={12} /> Add Task
                    </button>
                  </div>

                  {a.members.length === 0 ? (
                    <div className="border border-dashed border-gray-200 rounded-xl p-5 text-center">
                      <p className="text-neutral text-sm">Select team members above before adding tasks</p>
                    </div>
                  ) : visibleTasks.length === 0 ? (
                    <div className="border border-dashed border-gray-200 rounded-xl p-5 text-center">
                      <p className="text-neutral text-sm">No tasks yet — click "Add Task" to create work items</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visibleTasks.map((t, ti) => (
                        <div key={t._tempId}
                          className={`border rounded-xl p-4 ${
                            t._id
                              ? 'bg-gray-100 border-gray-100'
                              : 'bg-emerald-500/5 border-emerald-500/20'
                          }`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[16px] font-semibold text-neutral uppercase tracking-wider">
                                Task {ti + 1}
                              </span>
                              {!t._id && (
                                <span className="text-[16px] px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                                  New
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => removeTask(a._tempId, t._tempId)}
                              className="text-neutral hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                              title={t._id ? 'Delete task on save' : 'Remove task'}>
                              <X size={13} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <FormField label="Task Title *">
                                <input className="input" value={t.title}
                                  onChange={e => updateTask(a._tempId, t._tempId, 'title', e.target.value)}
                                  placeholder="e.g. Keyword Research for Homepage" />
                              </FormField>
                            </div>

                            <FormField label="Assign To *">
                              <SelectInput value={t.assigned_to}
                                onChange={v => updateTask(a._tempId, t._tempId, 'assigned_to', v)}
                                placeholder="Select member"
                                options={assignedUsers.map(u => ({
                                  value: u._id,
                                  label: `${u.name}${u.designation ? ` — ${u.designation}` : ''}`
                                }))} />
                            </FormField>

                            <FormField label="Priority">
                              <SelectInput value={t.priority}
                                onChange={v => updateTask(a._tempId, t._tempId, 'priority', v)}
                                options={PRIORITIES.map(p => ({ value: p, label: p }))} />
                            </FormField>

                            {t._id && (
                              <FormField label="Status">
                                <SelectInput value={t.status}
                                  onChange={v => updateTask(a._tempId, t._tempId, 'status', v)}
                                  options={TASK_STATUSES.map(s => ({ value: s, label: s }))} />
                              </FormField>
                            )}

                            <FormField label="Due Date *">
                              <input className="input" type="date" value={t.due_date}
                                onChange={e => updateTask(a._tempId, t._tempId, 'due_date', e.target.value)} />
                            </FormField>

                            <FormField label="Estimated Hours">
                              <input className="input" type="number" min="0" value={t.estimated_hours}
                                onChange={e => updateTask(a._tempId, t._tempId, 'estimated_hours', e.target.value)}
                                placeholder="e.g. 4" />
                            </FormField>

                            <div className="col-span-2">
                              <FormField label="Description">
                                <input className="input" value={t.description}
                                  onChange={e => updateTask(a._tempId, t._tempId, 'description', e.target.value)}
                                  placeholder="What exactly needs to be done…" />
                              </FormField>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── STEP 5 — Review ──────────────────────────────────────────────────────────

function Step5({ project, client, assignments, allUsers, managers, editMode, onRegeneratePlan, regenerating = false }) {
  const managerObj  = managers.find(m => m._id === project.manager_id)
  const visible     = assignments.filter(a => !a._deleted)
  const toDelete    = assignments.filter(a => a._deleted && a._id)

  const Section = ({ title, children }) => (
    <div className="card mb-4">
      <h3 className="text-sm font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">{title}</h3>
      {children}
    </div>
  )

  const Row = ({ label, value }) => value ? (
    <div className="flex justify-between py-1.5">
      <span className="text-[16px] text-neutral font-medium">{label}</span>
      <span className="text-[16px] text-gray-700 text-right max-w-xs">{value}</span>
    </div>
  ) : null

  const PriDot = ({ p }) => {
    const c = p === 'critical' ? 'bg-red-500' : p === 'high' ? 'bg-orange-500' : p === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
    return <span className={`inline-block w-2 h-2 rounded-full ${c} mr-1.5 flex-shrink-0`} />
  }

  const totalNewTasks = visible.reduce((sum, a) =>
    sum + a.tasks.filter(t => !t._deleted && !t._id).length, 0)
  const totalEditedTasks = visible.reduce((sum, a) =>
    sum + a.tasks.filter(t => !t._deleted && t._id).length, 0)
  const totalDeletedTasks = assignments.reduce((sum, a) =>
    sum + a.tasks.filter(t => t._deleted && t._id).length, 0)

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-800">Review & Confirm</h2>
        <p className="text-sm text-neutral mt-1">
          {editMode ? 'Review your changes before saving.' : 'Review all details before creating the project.'}
        </p>
      </div>

      {editMode && (
        <div className="mb-5 rounded-2xl p-4 flex items-center justify-between gap-4"
          style={{ backgroundColor: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <div className="flex items-start gap-3">
            <RefreshCw size={16} className="text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className=" flex items-center gap-2 text-sm font-semibold text-gray-800"><RefreshCcw /> Regenerate Plan</p>
              <p className="text-[16px] text-neutral mt-0.5">
                Changed project types or requirements? Rebuild the task plan — choose to replace or merge.
              </p>
            </div>
          </div>
          <button
            onClick={onRegeneratePlan}
            disabled={regenerating}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-800 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#7c3aed', border: '1px solid rgba(139,92,246,0.4)' }}>
            <RefreshCw size={13} /> {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      )}

      {editMode && (
        <div className="mb-4 rounded-xl p-4 space-y-2"
          style={{ backgroundColor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <p className="text-sm font-semibold text-gray-800 mb-2">📝 Changes Summary</p>
          <div className="grid grid-cols-2 gap-2 text-[16px]">
            <div className="flex items-center gap-2 text-neutral">
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              {assignments.filter(a => !a._id && !a._deleted).length} new assignment{assignments.filter(a => !a._id && !a._deleted).length !== 1 ? 's' : ''} to create
            </div>
            <div className="flex items-center gap-2 text-neutral">
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              {totalNewTasks} new task{totalNewTasks !== 1 ? 's' : ''} to create
            </div>
            <div className="flex items-center gap-2 text-neutral">
              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              {visible.filter(a => a._id).length} assignment{visible.filter(a => a._id).length !== 1 ? 's' : ''} to update
            </div>
            <div className="flex items-center gap-2 text-neutral">
              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              {totalEditedTasks} existing task{totalEditedTasks !== 1 ? 's' : ''} to update
            </div>
            {toDelete.length > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                {toDelete.length} assignment{toDelete.length !== 1 ? 's' : ''} to delete
              </div>
            )}
            {totalDeletedTasks > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                {totalDeletedTasks} task{totalDeletedTasks !== 1 ? 's' : ''} to delete
              </div>
            )}
          </div>
        </div>
      )}

      <Section title="📁 Project">
        <Row label="Title"       value={project.title} />
        <Row label="Manager"     value={managerObj?.name} />
        <Row label="Priority"    value={project.priority} />
        <Row label="Status"      value={project.status} />
        <Row label="Timeline"    value={project.start_date && project.end_date ? `${project.start_date} → ${project.end_date}` : null} />
        <Row label="Description" value={project.description} />
      </Section>

      {(client.clientName || client.companyName || client.email || client.requirements) && (
        <Section title="👤 Client">
          <Row label="Name"         value={client.clientName} />
          <Row label="Company"      value={client.companyName} />
          <Row label="Email"        value={client.email} />
          <Row label="Phone"        value={client.phone} />
          <Row label="Website"      value={client.website} />
          <Row label="Address"      value={client.address} />
          <Row label="Budget"       value={client.budget} />
          {client.requirements && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[16px] text-neutral mb-1 font-medium">Requirements / Brief</p>
              <p className="text-[16px] text-gray-600 leading-relaxed whitespace-pre-wrap">{client.requirements}</p>
            </div>
          )}
          {client.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[16px] text-neutral mb-1 font-medium">Notes</p>
              <p className="text-[16px] text-gray-600 leading-relaxed whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </Section>
      )}

      {visible.length > 0 && (
        <Section title={`📋 Assignments (${visible.length})`}>
          <div className="space-y-4">
            {visible.map((a, i) => {
              const memberNames  = allUsers.filter(u => a.members.includes(u._id)).map(u => u.name)
              const visibleTasks = a.tasks.filter(t => !t._deleted)
              return (
                <div key={a._tempId} className={`rounded-xl p-4 ${a._id ? 'bg-gray-100' : 'bg-emerald-500/5 border border-emerald-500/20'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded bg-purple-50 text-primary text-[16px] font-bold flex items-center justify-center">{i + 1}</span>
                    <p className="font-semibold text-gray-800 text-sm">{a.title}</p>
                    <span className="text-[16px] text-neutral bg-gray-50 px-2 py-0.5 rounded-full">{a.department}</span>
                    {!a._id && (
                      <span className="text-[16px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                        New
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-2">
                    <Row label="Period"     value={a.start_date && a.end_date ? `${a.start_date} → ${a.end_date}` : null} />
                    <Row label="Est. Hours" value={a.estimated_hours ? `${a.estimated_hours}h` : null} />
                  </div>
                  {memberNames.length > 0 && (
                    <p className="text-[16px] text-neutral mb-2">
                      Team: <span className="text-gray-600">{memberNames.join(', ')}</span>
                    </p>
                  )}
                  {visibleTasks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[16px] text-neutral mb-2 font-semibold uppercase tracking-wider">Tasks ({visibleTasks.length})</p>
                      <div className="space-y-1.5">
                        {visibleTasks.map((t, ti) => {
                          const assignee = allUsers.find(u => u._id === t.assigned_to)
                          return (
                            <div key={t._tempId} className="flex items-center justify-between text-[16px]">
                              <div className="flex items-center gap-2">
                                <PriDot p={t.priority} />
                                <span className="text-gray-600">{t.title || `Task ${ti + 1}`}</span>
                                {!t._id && <span className="text-emerald-400 text-[16px]">New</span>}
                              </div>
                              <div className="flex items-center gap-3 text-neutral">
                                {assignee && <span>{assignee.name}</span>}
                                {t.due_date && <span className="font-mono">Due {t.due_date}</span>}
                                {t.estimated_hours && <span>{t.estimated_hours}h</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {toDelete.length > 0 && (
        <div className="mb-4 rounded-xl p-4"
          style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-sm font-semibold text-red-400 mb-2">🗑 Assignments to delete ({toDelete.length})</p>
          {toDelete.map(a => (
            <p key={a._tempId} className="text-[16px] text-neutral">• {a.title} ({a.department})</p>
          ))}
        </div>
      )}

      <div className="bg-purple-50 border border-primary/30 rounded-2xl p-4 flex items-start gap-3">
        <Check size={18} className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-gray-800">{editMode ? 'Ready to save changes' : 'Ready to create'}</p>
          <p className="text-[16px] text-neutral mt-0.5">
            {editMode
              ? 'All changes will be applied immediately.'
              : `This will create 1 project, ${visible.length} assignment${visible.length !== 1 ? 's' : ''}, ${visible.reduce((s, a) => s + a.tasks.filter(t => !t._deleted).length, 0)} task${visible.reduce((s, a) => s + a.tasks.filter(t => !t._deleted).length, 0) !== 1 ? 's' : ''} and notify assigned team members.`
            }
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function CreateProject({ editMode = false }) {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const { id }     = useParams()

  const [step,        setStep]        = useState(1)
  const [project,     setProject]     = useState(initProject)
  const [client,      setClient]      = useState(initClient)
  const [assignments, setAssignments] = useState([])
  const [managers,    setManagers]    = useState([])
  const [allUsers,    setAllUsers]    = useState([])
  const [submitting,  setSubmitting]  = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [loadingData, setLoadingData] = useState(editMode)

  // ── Load managers + users ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [m, u] = await Promise.all([
          api.get('/users?role=manager&limit=200'),
          api.get('/users?limit=500&status=active'),
        ])
        setManagers(m.data.data ?? [])
        setAllUsers(u.data.data ?? [])
      } catch { toast.error('Failed to load users') }
    }
    load()
  }, [])

  // ── Auto-set manager for manager role ─────────────────────────────────────
  useEffect(() => {
    if (!editMode && user?.role === 'manager' && !project.manager_id) {
      setProject(p => ({ ...p, manager_id: user._id }))
    }
  }, [user])

  // ── Load existing project + assignments in edit mode ──────────────────────
  useEffect(() => {
    if (!editMode || !id) return

    // Validate ObjectId format before hitting the server
    if (!isValidObjectId(id)) {
      toast.error('Invalid project ID — redirecting back')
      navigate(-1)
      return
    }

    const fetchData = async () => {
      setLoadingData(true)
      try {
        // Step 1: load project
        const pRes = await api.get(`/projects/${id}`)

        if (!pRes.data.success) {
          toast.error('Project not found')
          navigate(-1)
          return
        }

        const p = pRes.data.data

        setProject({
          _id:           p._id,
          title:         p.title        ?? '',
          description:   p.description  ?? '',
          manager_id:    p.manager_id?._id ?? p.manager_id ?? '',
          priority:      p.priority     ?? 'medium',
          status:        p.status       ?? 'planning',
          start_date:    toDateInput(p.start_date),
          end_date:      toDateInput(p.end_date),
          // Always coerce to array — backend now guarantees this but guard anyway
          project_types: Array.isArray(p.project_types) && p.project_types.length > 0
                           ? p.project_types
                           : p.project_type ? [p.project_type] : [],
        })

        // Map every possible old field name → unified client model
        const ci = p.client_info ?? {}
        setClient({
          clientName:   ci.clientName   ?? ci.name    ?? '',
          companyName:  ci.companyName  ?? ci.company ?? '',
          email:        ci.email        ?? '',
          phone:        ci.phone        ?? '',
          website:      ci.website      ?? '',
          address:      ci.address      ?? '',
          budget:       ci.budget       ?? '',
          requirements: ci.requirements ?? '',
          notes:        ci.notes        ?? '',
        })

        // Step 2: load assignments only after project confirmed to exist
        const aRes = await api.get(`/assignments?project_id=${id}`)
        const raw  = aRes.data.data ?? []

        const enriched = await Promise.all(raw.map(async (a) => {
          if (a.tasks && a.tasks.length > 0) {
            return normalizeAssignment(a)
          }
          try {
            const tRes = await api.get(`/tasks?assignment_id=${a._id}`)
            return normalizeAssignment({ ...a, tasks: tRes.data.data ?? [] })
          } catch {
            return normalizeAssignment(a)
          }
        }))

        setAssignments(enriched)
      } catch (e) {
        const status = e.response?.status
        if (status === 404) {
          toast.error('Project not found')
          navigate(-1)
        } else if (status === 403) {
          toast.error('You do not have access to this project')
          navigate(-1)
        } else if (status === 400) {
          toast.error('Invalid project ID')
          navigate(-1)
        } else {
          toast.error(e.response?.data?.message || 'Failed to load project data')
        }
      } finally {
        setLoadingData(false)
      }
    }

    fetchData()
  }, [editMode, id])

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep = () => {
    if (step === 1) {
      if (!project.title.trim())       { toast.error('Project title is required');     return false }
      if (!project.description.trim() && !project._documentFile) {
        toast.error('Description is required (or upload a document)');                  return false
      }
      if (!project.manager_id)         { toast.error('Please assign a manager');       return false }
      if (!project.start_date)         { toast.error('Start date is required');         return false }
      if (!project.end_date)           { toast.error('End date is required');           return false }
      if (project.end_date <= project.start_date) {
        toast.error('End date must be after start date');                               return false
      }
    }
    if (step === 3) {
      const visible = assignments.filter(a => !a._deleted)
      for (const a of visible) {
        if (!a.department)   { toast.error(`Department is required for "${a.title || 'Untitled'}"`); return false }
        if (!a.title.trim()) { toast.error('Assignment title is required');                           return false }
        if (!a.start_date)   { toast.error(`Start date missing for "${a.title}"`);                   return false }
        if (!a.end_date)     { toast.error(`End date missing for "${a.title}"`);                     return false }
        if (a.end_date <= a.start_date) {
          toast.error(`End date must be after start for "${a.title}"`);                             return false
        }
      }
    }
    if (step === 4) {
      const visible = assignments.filter(a => !a._deleted)
      for (const a of visible) {
        if (a.members.length === 0) {
          toast.error(`Select at least one member for "${a.title}"`);                   return false
        }
        for (const t of a.tasks.filter(x => !x._deleted)) {
          if (!t.title.trim()) { toast.error(`Task title missing in "${a.title}"`);    return false }
          if (!t._id && !t.assigned_to)  { toast.error(`Assign a user to each task in "${a.title}"`); return false }
          if (!t.due_date)     { toast.error(`Due date missing for a task in "${a.title}"`); return false }
        }
      }
    }
    return true
  }

  const goNext = () => {
    if (!validateStep()) return
    const nextStep = step + 1
    if (nextStep === 4) {
      setAssignments(prev => prev.map(a => {
        if (a._deleted || a.members.length > 0 || !a.department) return a
        const deptUserIds = allUsers
          .filter(u => deptMatches(u.department, a.department) && u.role === 'employee')
          .map(u => u._id)
        return deptUserIds.length > 0 ? { ...a, members: deptUserIds } : a
      }))
    }
    setStep(nextStep)
  }
  const goBack = () => setStep(s => s - 1)

  // ── Regenerate Plan — edit mode only ────────────────────────────────────
  async function handleRegeneratePlan() {
    if (regenerating) return

    const types = project.project_types ?? (project.project_type ? [project.project_type] : [])
    if (types.length === 0) {
      toast.error('Select at least one project type before regenerating the plan')
      return
    }

    const confirmed = window.confirm(
      `This will DELETE all existing tasks & assignments for this project and regenerate a fresh plan for: ${types.join(', ')}.\n\nOK to proceed, Cancel to abort.`
    )
    if (!confirmed) return

    setRegenerating(true)
    try {
      await api.patch(`/projects/${id}`, {
        title:         project.title,
        description:   project.description,
        manager_id:    project.manager_id,
        priority:      project.priority,
        status:        project.status,
        start_date:    project.start_date,
        end_date:      project.end_date,
        project_types: types,
      })

      const regenRes = await api.post(`/assignments/auto-assign/${id}`)
      const { phases_count, tasks_created } = regenRes.data?.data ?? {}

      toast.success(`Plan regenerated! ${tasks_created ?? 0} tasks across ${phases_count ?? 0} phases.`)
      navigate(`/${user?.role}/projects/${id}`)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to regenerate plan')
    } finally {
      setRegenerating(false)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep()) return
    setSubmitting(true)

    try {
      if (editMode) {
        // 1. Update project core + client
        await api.patch(`/projects/${id}`, {
          title:         project.title,
          description:   project.description,
          manager_id:    project.manager_id,
          priority:      project.priority,
          status:        project.status,
          start_date:    project.start_date,
          end_date:      project.end_date,
          project_types: project.project_types ?? [],
          client_info:   client,
        })

        // 2. Delete removed assignments
        const toDeleteAssignments = assignments.filter(a => a._deleted && a._id)
        await Promise.all(
          toDeleteAssignments.map(a => api.delete(`/assignments/${a._id}`).catch(() => {}))
        )

        // 3. Update existing assignments + their tasks
        const existing = assignments.filter(a => a._id && !a._deleted)
        await Promise.all(existing.map(async (a) => {
          await api.patch(`/assignments/${a._id}`, {
            title:           a.title,
            department:      a.department,
            description:     a.description,
            start_date:      a.start_date,
            end_date:        a.end_date,
            estimated_hours: a.estimated_hours ? Number(a.estimated_hours) : undefined,
            members:         a.members,
          }).catch(() => {})

          const deletedTasks = a.tasks.filter(t => t._deleted && t._id)
          await Promise.all(
            deletedTasks.map(t => api.delete(`/tasks/${t._id}`).catch(() => {}))
          )

          const existingTasks = a.tasks.filter(t => t._id && !t._deleted)
          await Promise.all(existingTasks.map(t =>
            api.patch(`/tasks/${t._id}`, {
              title:           t.title,
              description:     t.description,
              assigned_to:     t.assigned_to,
              priority:        t.priority,
              status:          t.status,
              due_date:        t.due_date,
              estimated_hours: t.estimated_hours ? Number(t.estimated_hours) : undefined,
            }).catch(() => {})
          ))

          const newTasks = a.tasks.filter(t => !t._id && !t._deleted)
          if (newTasks.length > 0) {
            await Promise.all(newTasks.map(t =>
              api.post('/tasks', {
                assignment_id:   a._id,
                project_id:      id,
                title:           t.title,
                description:     t.description,
                assigned_to:     t.assigned_to || undefined,
                priority:        t.priority,
                status:          t.status,
                due_date:        t.due_date,
                estimated_hours: t.estimated_hours ? Number(t.estimated_hours) : undefined,
              }).catch(() => {})
            ))
          }
        }))

        // 4. Create brand-new assignments
        const brandNew = assignments.filter(a => !a._id && !a._deleted)
        if (brandNew.length > 0) {
          await api.post('/assignments/wizard', {
            project: { _id: id },
            project_id: id,
            assignments: brandNew.map(a => ({
              department:      a.department,
              title:           a.title,
              description:     a.description,
              start_date:      a.start_date,
              end_date:        a.end_date,
              estimated_hours: a.estimated_hours ? Number(a.estimated_hours) : undefined,
              members:         a.members,
              tasks: a.tasks.filter(t => !t._deleted).map(t => ({
                title:           t.title,
                description:     t.description,
                assigned_to:     t.assigned_to || undefined,
                priority:        t.priority,
                status:          t.status,
                due_date:        t.due_date,
                estimated_hours: t.estimated_hours ? Number(t.estimated_hours) : undefined,
              })),
            })),
          })
        }

        toast.success('Project updated successfully!')
        navigate(`/${user?.role}/projects`)

      } else {
        // CREATE mode
        const cleanAssignments = assignments.filter(a => !a._deleted).map(({ _tempId, _id, _deleted, ...a }) => ({
          ...a,
          estimated_hours: a.estimated_hours ? Number(a.estimated_hours) : undefined,
          tasks: a.tasks.filter(t => !t._deleted).map(({ _tempId: _, _id: __, _deleted: ___, ...t }) => ({
            ...t,
            estimated_hours: t.estimated_hours ? Number(t.estimated_hours) : undefined,
          })),
        }))

        if (cleanAssignments.length > 0 && !project._documentFile) {
          await api.post('/assignments/wizard', {
            project: { ...project, client_info: client },
            assignments: cleanAssignments,
          })
          toast.success('Project created successfully!')
        } else {
          const formData = new FormData()
          const { _documentFile, project_types, ...pData } = project
          Object.entries(pData).forEach(([k, v]) => v && formData.append(k, v))
          if (project_types && project_types.length > 0) {
            project_types.forEach(pt => formData.append('project_types[]', pt))
          }
          if (_documentFile) formData.append('document', _documentFile)

          const { data: result } = await api.post('/projects', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          const extractedTasks = result.extracted_tasks || []
          if (extractedTasks.length > 0) {
            try {
              await api.post('/assignments/auto-assign-from-document', {
                project_id: result.data._id,
                tasks: extractedTasks,
              })
              toast.success(`Project created — ${extractedTasks.length} tasks auto-assigned from document`)
            } catch {
              toast.success('Project created')
              toast.error('Auto-assignment from document failed — assign tasks manually')
            }
          } else {
            toast.success('Project created successfully!')
          }
        }
        navigate(`/${user?.role}/projects`)
      }
    } catch (e) {
      toast.error(e.response?.data?.message || (editMode ? 'Failed to update project' : 'Failed to create project'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Spinner size="lg" />
      </div>
    )
  }

  const isLastStep = step === 5

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {editMode ? 'Edit Project' : 'Create New Project'}
        </h1>
        <p className="text-neutral text-sm mt-1">
          {editMode
            ? 'Update project details, add or remove assignments, and manage tasks.'
            : 'Complete all steps to set up the project, departments, team, and tasks.'}
        </p>
      </div>

      <StepBar current={step} editMode={editMode} />

      <div className="card min-h-96">
        {step === 1 && (
          <Step1
            data={project}
            onChange={setProject}
            managers={managers}
            editMode={editMode}
            onRegeneratePlan={handleRegeneratePlan}
            regenerating={regenerating}
          />
        )}
        {step === 2 && (
          <Step2 data={client} onChange={setClient} />
        )}
        {step === 3 && (
          <Step3
            assignments={assignments}
            onChange={setAssignments}
            editMode={editMode}
          />
        )}
        {step === 4 && (
          <Step4
            assignments={assignments}
            onChange={setAssignments}
            allUsers={allUsers}
            projectId={id}
            editMode={editMode}
          />
        )}
        {step === 5 && (
          <Step5
            project={project}
            client={client}
            assignments={assignments}
            allUsers={allUsers}
            managers={managers}
            editMode={editMode}
            onRegeneratePlan={handleRegeneratePlan}
            regenerating={regenerating}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-5">
        <div>
          {step > 1 && (
            <button onClick={goBack} className="btn-secondary">
              <ChevronLeft size={16} /> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          {!isLastStep ? (
            <button onClick={goNext} className="btn-primary">
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary px-6">
              {submitting
                ? <><Spinner size="sm" /> {editMode ? 'Saving…' : 'Creating…'}</>
                : <><Save size={16} /> {editMode ? 'Save Changes' : 'Create Project'}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}