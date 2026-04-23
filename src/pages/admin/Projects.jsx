import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Eye, RefreshCw,
  FolderKanban, FolderCheck, FolderClock, Users, ChevronLeft,
  ChevronDown, ChevronUp, Sparkles, ClipboardList, AlertCircle,
  Calendar, Hash, Layers, Target, Clock, Building2,
  CheckCircle2, Zap, Loader2,
} from 'lucide-react'
import api from '../../api/axios'
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
  { value: 'website',        label: ' Website',        hint: 'Frontend, Backend, Full Stack, Designer' },
  { value: 'mobile_app',     label: ' Mobile App',      hint: 'Mobile Dev, Backend, Designer' },
  { value: 'ecommerce',      label: ' E-Commerce',      hint: 'Full Stack, Backend, SEO, Designer' },
  { value: 'api_service',    label: ' API Service',     hint: 'Backend, Full Stack' },
  { value: 'data_analytics', label: ' Data Analytics',  hint: 'Data Analyst, Backend' },
  { value: 'design',         label: ' Design',          hint: 'Designer' },
  { value: 'content',        label: ' Content',         hint: 'Content Writer' },
  { value: 'seo',            label: ' SEO',             hint: 'SEO Specialist, Content Writer' },
  { value: 'marketing',      label: ' Marketing',       hint: 'Marketing Specialist, Content Writer' },
  { value: 'other',          label: ' Other',           hint: 'General assignment' },
]

const COMPLEXITIES = [
  { value: 'small',  label: 'Small',  hint: 'Core features only, fewer tasks' },
  { value: 'medium', label: 'Medium', hint: 'Standard scope (recommended)' },
  { value: 'large',  label: 'Large',  hint: 'Full feature set, all modules' },
]

const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical']

const ASSIGNMENT_TYPES = ['Design', 'Development', 'Testing', 'Marketing']

const PRIORITY_META = {
  low:      { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#059669', dot: '#10b981' },
  medium:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#d97706', dot: '#f59e0b' },
  high:     { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  text: '#dc2626', dot: '#ef4444' },
  critical: { bg: 'rgba(220,38,38,0.18)',  border: 'rgba(220,38,38,0.35)',  text: '#ef4444', dot: '#dc2626' },
}

const ASSIGN_MODES = [
  {
    key: 'manual',
    icon: ClipboardList,
    label: 'Manual Assignment',
    desc: 'Add assignments & tasks yourself',
  },
  {
    key: 'auto',
    icon: Target,
    label: 'Smart Auto-Assignment',
    desc: 'Auto-assign tasks to best-fit employees',
  },
  {
    key: 'smart_plan',
    icon: Sparkles,
    label: 'Smart Plan',
    desc: 'AI generates full task plan from description',
  },
  {
    key: 'smart_type',
    icon: Zap,
    label: 'Type-Based Generation',
    desc: 'Pick assignment type, auto-generate & assign tasks',
  },
]

// ─── Wizard steps ─────────────────────────────────────────────────────────────
const CREATE_STEPS = [
  { n: 1, key: 'project_info',   label: 'Project Info',   icon: Hash },
  { n: 2, key: 'client_details', label: 'Client Details', icon: Building2 },
  { n: 3, key: 'team_tasks',     label: 'Team & Tasks',   icon: Users },
  { n: 4, key: 'review',         label: 'Review',         icon: CheckCircle2 },
]

// ─── Empty state factories ────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

const emptyTask = () => ({
  id: uid(),
  title: '', description: '', priority: 'medium',
  due_date: '', estimated_hours: '', required_role: '',
  requires_permission: false, permission_description: '',
})

const emptyAssignment = () => ({
  id: uid(),
  department: '', title: '', description: '',
  start_date: '', end_date: '', estimated_hours: '',
  tasks: [emptyTask()],
})

const emptySmartAssignment = () => ({
  _tempId:     uid(),
  _savedId:    null,
  title:       '',
  description: '',
  type:        '',
  priority:    'medium',
  start_date:  '',
  end_date:    '',
  _preview:    null,
  _previewing: false,
  _assigning:  false,
  _tasks:      [],
  _assigned:   false,
})

const emptyProject = () => ({
  title:        '',
  description:  '',
  manager_id:   '',
  priority:     'medium',
  project_types: ['website'],
  complexity:   'medium',
  start_date:   '',
  end_date:     '',
  status:       'planning',
})

const emptyClient = () => ({
  name:         '',
  company:      '',
  email:        '',
  phone:        '',
  website:      '',
  budget:       '',
  requirements: '',
})

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  card:        '#ffffff',
  cardBorder:  'rgba(0,0,0,0.08)',
  input:       '#ffffff',
  inputBorder: 'rgba(0,0,0,0.15)',
  accent:      '#3b82f6',
}

const inputCls = [
  'w-full rounded-lg px-3.5 py-2.5 text-sm text-gray-800 outline-none transition-all',
  'border border-gray-200 bg-white',
  'focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60',
  'placeholder:text-gray-400',
].join(' ')

const inputStyle = {
  colorScheme: 'light',
}

const cardStyle = { backgroundColor: T.card, border: `1px solid ${T.cardBorder}` }

// ─── Primitive UI ─────────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }) {
  return (
    <div className={`rounded-xl ${className}`} style={cardStyle}>
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between px-5 py-4"
      style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <Icon size={15} className="text-blue-500" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-[16px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-[16px] font-medium text-gray-600">
        {label}
        {required && <span className="text-blue-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[16px] text-gray-400">{hint}</p>}
    </div>
  )
}

function PriorityDot({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium
  return (
    <span className="inline-flex items-center gap-1.5 text-[16px] px-2.5 py-1 rounded-full font-medium"
      style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.dot }} />
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  )
}

function FormAlert({ msg, onClose }) {
  if (!msg?.text) return null
  const ok = msg.type === 'success'
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3.5 text-sm"
      style={ok
        ? { backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }
        : { backgroundColor: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.2)',  color: '#dc2626' }
      }>
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{msg.text}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity text-[16px]">✕</button>
    </div>
  )
}

function PrimaryBtn({ children, disabled, onClick, type = 'button', className = '', style = {} }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] ${className}`}
      style={{ backgroundColor: T.accent, ...style }}>
      {children}
    </button>
  )
}

function GhostBtn({ children, onClick, type = 'button', className = '' }) {
  return (
    <button type={type} onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors ${className}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)' }}>
      {children}
    </button>
  )
}

function DangerBtn({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1 text-[16px] font-medium text-red-400/60 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
      {children}
    </button>
  )
}

// ─── Wizard Tab Bar ───────────────────────────────────────────────────────────

function WizardTabs({ steps, currentStep, onStepClick, completedSteps }) {
  return (
    <div className="flex items-stretch rounded-xl overflow-hidden"
      style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: `1px solid ${T.cardBorder}` }}>
      {steps.map((step, idx) => {
        const Icon        = step.icon
        const isActive    = currentStep === step.n
        const isCompleted = completedSteps.includes(step.n)
        const isClickable = isCompleted || step.n < currentStep

        return (
          <button
            key={step.key}
            type="button"
            onClick={() => isClickable && onStepClick(step.n)}
            disabled={!isClickable && !isActive}
            className={[
              'flex items-center gap-2 px-4 py-3 text-[16px] font-semibold transition-all flex-1 justify-center relative',
              isActive                      ? 'text-white'                                          : '',
              isCompleted && !isActive      ? 'text-emerald-600 hover:text-gray-900 cursor-pointer' : '',
              !isCompleted && !isActive     ? 'text-gray-400 cursor-not-allowed'                   : '',
            ].join(' ')}
            style={
              isActive    ? { backgroundColor: T.accent }
              : isCompleted ? { backgroundColor: 'rgba(16,185,129,0.08)' }
              : {}
            }
          >
            {idx > 0 && (
              <span className="absolute left-0 top-1/4 h-1/2 w-px"
                style={{ backgroundColor: 'rgba(0,0,0,0.07)' }} />
            )}
            {isCompleted && !isActive
              ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
              : <Icon size={13} className="flex-shrink-0" />
            }
            <span className="hidden sm:inline truncate">{step.label}</span>
            <span className="sm:hidden font-bold">{step.n}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 1: Project Info ─────────────────────────────────────────────────────

function ProjectInfoStep({ project, updateProject, managers }) {
  const firstSelectedType = PROJECT_TYPES.find(t => project.project_types?.includes(t.value))

  return (
    <SectionCard>
      <SectionHeader icon={Hash} title="Project Info" subtitle="Core details about this project" />
      <div className="p-5 space-y-5">
        <Field label="Project Title" required>
          <input
            value={project.title}
            onChange={e => updateProject('title', e.target.value)}
            placeholder="e.g. Company Website Redesign"
            className={inputCls}
            style={inputStyle}
          />
        </Field>

        <Field label="Description" required
          hint="Be specific — mention features like payments, search, chat, admin panel.">
          <textarea
            value={project.description}
            onChange={e => updateProject('description', e.target.value)}
            rows={3}
            placeholder="Brief project overview..."
            className={inputCls}
            style={inputStyle}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Project Type" required hint={firstSelectedType ? `Roles: ${firstSelectedType.hint}` : undefined}>
            <div
              className="rounded-lg p-3 flex flex-wrap gap-x-4 gap-y-2 bg-white border border-gray-200"
            >
              {PROJECT_TYPES.map(pt => {
                const checked = project.project_types?.includes(pt.value) ?? false
                return (
                  <label
                    key={pt.value}
                    className="flex items-center gap-2 cursor-pointer group select-none"
                  >
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        backgroundColor: checked ? T.accent : 'rgba(0,0,0,0.05)',
                        border: checked ? `1px solid ${T.accent}` : '1px solid rgba(0,0,0,0.2)',
                      }}
                    >
                      {checked && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={e => {
                        const current = project.project_types || []
                        updateProject(
                          'project_types',
                          e.target.checked
                            ? [...current, pt.value]
                            : current.filter(v => v !== pt.value)
                        )
                      }}
                    />
                    <span className={`text-[16px] transition-colors ${checked ? 'text-gray-900' : 'text-gray-500'}`}>
                      {pt.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </Field>

          <Field label="Priority" required>
            <select
              value={project.priority}
              onChange={e => updateProject('priority', e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Assign Manager" required hint="Required — manager will be auto-enrolled as a project member">
          <select
            value={project.manager_id}
            onChange={e => updateProject('manager_id', e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            <option value="" style={{ color: '#94a3b8' }}>— Select a manager —</option>
            {managers.map(m => (
              <option key={m._id} value={m._id}>
                {m.name} ({m.designation})
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date" required>
            <input
              type="date"
              value={project.start_date}
              onChange={e => updateProject('start_date', e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="End Date" required>
            <input
              type="date"
              value={project.end_date}
              onChange={e => updateProject('end_date', e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </Field>
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Step 2: Client Details ───────────────────────────────────────────────────

function ClientDetailsStep({ client, updateClient }) {
  return (
    <SectionCard>
      <SectionHeader icon={Building2} title="Client Details"
        subtitle="Optional — add client contact information" />
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company Name">
            <input
              value={client.company}
              onChange={e => updateClient('company', e.target.value)}
              placeholder="e.g. Acme Corp"
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Contact Person">
            <input
              value={client.name}
              onChange={e => updateClient('name', e.target.value)}
              placeholder="e.g. John Smith"
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={client.email}
              onChange={e => updateClient('email', e.target.value)}
              placeholder="e.g. john@acme.com"
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Phone">
            <input
              value={client.phone}
              onChange={e => updateClient('phone', e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Website">
            <input
              value={client.website}
              onChange={e => updateClient('website', e.target.value)}
              placeholder="https://example.com (optional)"
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Budget">
            <input
              value={client.budget}
              onChange={e => updateClient('budget', e.target.value)}
              placeholder="e.g. ₹2,00,000 (optional)"
              className={inputCls}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Project Requirements / Scope">
          <textarea
            value={client.requirements}
            onChange={e => updateClient('requirements', e.target.value)}
            rows={3}
            placeholder="Describe the client's requirements and project scope..."
            className={inputCls}
            style={inputStyle}
          />
        </Field>

        <div className="flex items-center gap-3 rounded-lg px-4 py-3"
          style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <AlertCircle size={14} className="text-blue-500 flex-shrink-0" />
          <p className="text-[16px] text-gray-500">
            Client details are optional. You can skip this step and add them later.
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Smart Type Assignment Card ───────────────────────────────────────────────

function SmartTypeAssignmentCard({ a, index, savedProject, onUpdate, onRemove }) {
  const updateField = (field, val) => onUpdate(field, val)

  const handlePreview = async () => {
    if (!a.title || !a.type || !a.start_date || !a.end_date) {
      toast.error('Fill title, type, start date and end date first')
      return
    }
    onUpdate('_previewing', true)
    try {
      const res = await api.post('/assignments', {
        project_id:  savedProject._id,
        title:       a.title,
        description: a.description,
        department:  a.type,
        priority:    a.priority,
        start_date:  a.start_date,
        end_date:    a.end_date,
      })
      const savedId = res.data.data._id
      const prev = await api.post(`/assignments/${savedId}/generate-tasks/preview`, {
        assignmentType: a.type,
      })
      onUpdate('_savedId', savedId)
      onUpdate('_preview', prev.data.data)
      onUpdate('_previewing', false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Preview failed')
      onUpdate('_previewing', false)
    }
  }

  const handleGenerate = async () => {
    if (!a._savedId) return toast.error('Preview first')
    onUpdate('_assigning', true)
    try {
      const res = await api.post(`/assignments/${a._savedId}/generate-tasks/confirm`, {
        assignmentType: a.type,
      })
      onUpdate('_tasks', res.data.data.tasks)
      onUpdate('_assigned', true)
      onUpdate('_assigning', false)
      toast.success(`${res.data.data.tasks.length} tasks generated and smart-assigned!`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed')
      onUpdate('_assigning', false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden"
      style={{
        border: a._assigned
          ? '1px solid rgba(16,185,129,0.4)'
          : `1px solid ${T.cardBorder}`,
        backgroundColor: T.card,
      }}>

      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md flex items-center justify-center text-[16px] font-bold text-blue-600"
            style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
            {index}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {a.title || <span className="text-gray-400 italic font-normal">Untitled Assignment</span>}
          </span>
          {a._assigned && <CheckCircle2 size={14} className="text-emerald-500" />}
        </div>
        <DangerBtn onClick={onRemove}><Trash2 size={10} /> Remove</DangerBtn>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Assignment Title" required>
            <input value={a.title} onChange={e => updateField('title', e.target.value)}
              placeholder="e.g. UI Design Phase"
              className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Assignment Type" required
            hint="Determines which subtasks are generated">
            <select value={a.type} onChange={e => updateField('type', e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="" style={{ color: '#94a3b8' }}>Select type…</option>
              {ASSIGNMENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <textarea value={a.description} onChange={e => updateField('description', e.target.value)}
            rows={2} placeholder="What does this assignment cover?"
            className={inputCls} style={inputStyle} />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Priority">
            <select value={a.priority} onChange={e => updateField('priority', e.target.value)}
              className={inputCls} style={inputStyle}>
              {TASK_PRIORITIES.map(p => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start Date" required>
            <input type="date" value={a.start_date} onChange={e => updateField('start_date', e.target.value)}
              className={inputCls} style={inputStyle} />
          </Field>
          <Field label="End Date" required>
            <input type="date" value={a.end_date} onChange={e => updateField('end_date', e.target.value)}
              className={inputCls} style={inputStyle} />
          </Field>
        </div>

        {!a._assigned && (
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handlePreview}
              disabled={a._previewing || !a.type}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 bg-white">
              {a._previewing
                ? <Loader2 size={13} className="animate-spin" />
                : <Eye size={13} />}
              Preview Tasks
            </button>

            {a._preview && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={a._assigning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 hover:opacity-90"
                style={{ backgroundColor: T.accent }}>
                {a._assigning
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Zap size={13} />}
                Generate &amp; Smart Assign
              </button>
            )}
          </div>
        )}

        {a._preview && !a._assigned && (
          <SmartTypePreviewPanel preview={a._preview} />
        )}

        {a._assigned && a._tasks.length > 0 && (
          <div className="rounded-lg overflow-hidden"
            style={{ backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="px-4 py-2.5 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span className="text-[16px] font-semibold text-emerald-600">
                {a._tasks.length} tasks generated and smart-assigned
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {a._tasks.map(task => (
                <div key={task._id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{task.title}</span>
                  <span className="text-[16px] text-gray-500 mx-3 whitespace-nowrap flex items-center gap-1">
                    <Users size={10} /> {task.assigned_to?.name || '—'}
                  </span>
                  <span className="text-[16px] text-gray-500 whitespace-nowrap flex items-center gap-1">
                    <Clock size={10} /> {task.estimated_hours}h
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Task preview panel ───────────────────────────────────────────────────────

function SmartTypePreviewPanel({ preview }) {
  const { tasks = [], summary = {}, candidateEmployees = [] } = preview
  return (
    <div className="rounded-lg overflow-hidden"
      style={{ backgroundColor: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.2)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
        <Eye size={13} className="text-blue-500" />
        <span className="text-[16px] font-semibold text-blue-600">
          Preview — {summary.taskCount} tasks · {summary.totalEstimatedHours}h total
        </span>
        <div className="ml-auto flex gap-2">
          {summary.priorityBreakdown?.high > 0 && (
            <span className="text-[16px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
              {summary.priorityBreakdown.high} high
            </span>
          )}
          {summary.priorityBreakdown?.medium > 0 && (
            <span className="text-[16px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}>
              {summary.priorityBreakdown.medium} medium
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2">
            <span className="text-[16px] text-gray-800 flex-1 min-w-0 truncate">{task.title}</span>
            <span className="text-[16px] text-gray-500 mx-2 whitespace-nowrap">{task.required_role}</span>
            <span className="text-[16px] font-medium text-blue-600 whitespace-nowrap">{task.estimatedHours}h</span>
          </div>
        ))}
      </div>

      {candidateEmployees.length > 0 && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(59,130,246,0.15)' }}>
          <p className="text-[16px] text-gray-500 mb-2">Eligible employees ({candidateEmployees.length}):</p>
          <div className="flex flex-wrap gap-2">
            {candidateEmployees.slice(0, 5).map(emp => (
              <div key={emp._id} className="flex items-center gap-1.5 text-[16px] px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  emp.activeTaskCount === 0 ? 'bg-emerald-500' :
                  emp.activeTaskCount < 5  ? 'bg-amber-400'   : 'bg-red-400'
                }`} />
                <span className="text-gray-700">{emp.name}</span>
                <span className="text-gray-400">{emp.activeTaskCount} tasks</span>
              </div>
            ))}
            {candidateEmployees.length > 5 && (
              <span className="text-[16px] text-gray-400 py-1">+{candidateEmployees.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {candidateEmployees.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 text-[16px] text-amber-600"
          style={{ borderTop: '1px solid rgba(59,130,246,0.15)' }}>
          <AlertCircle size={13} />
          No eligible employees found. Add employees with matching roles/departments.
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Team & Tasks ─────────────────────────────────────────────────────

function TeamAndTasksStep({
  assignMode, setAssignMode,
  assignments,
  addAssignment, removeAssignment, updateAssignment,
  addTask, removeTask, updateTask,
  project,
  updateProject,
  generating,
  onGenerate,
  plan,
  confirming,
  onConfirmPlan,
  planMsg,
  savedProject,
  smartAssignments,
  addSmartAssignment,
  removeSmartAssignment,
  updateSmartAssignment,
}) {
  return (
    <div className="space-y-4">

      {/* ── Mode selector card ── */}
      <SectionCard>
        <SectionHeader icon={Users} title="Team & Tasks" subtitle="Choose how to assign work for this project" />
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ASSIGN_MODES.map(m => {
              const Icon   = m.icon
              const active = assignMode === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setAssignMode(m.key)}
                  className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-left transition-all"
                  style={active
                    ? { backgroundColor: 'rgba(59,130,246,0.08)', border: '2px solid rgba(59,130,246,0.4)' }
                    : { backgroundColor: 'rgba(0,0,0,0.02)', border: '2px solid rgba(0,0,0,0.08)' }
                  }>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: active ? 'rgba(59,130,246,0.12)' : 'rgba(0,0,0,0.05)' }}>
                    <Icon size={13} className={active ? 'text-blue-500' : 'text-gray-400'} />
                  </div>
                  <div>
                    <p className={`text-[16px] font-semibold ${active ? 'text-gray-900' : 'text-gray-500'}`}>{m.label}</p>
                    <p className={`text-[16px] mt-0.5 leading-tight text-gray-400`}>{m.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {assignMode === 'manual' && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5"
              style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
              <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[16px] text-gray-500">
                <span className="text-amber-600 font-semibold">Manual — </span>
                You will assign tasks to employees manually after the project is created.
              </p>
            </div>
          )}
          {assignMode === 'auto' && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5"
              style={{ backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-[16px] text-gray-500">
                <span className="text-emerald-600 font-semibold">Smart Auto-Assignment ON — </span>
                Tasks will be matched to employees automatically when the project is created.
              </p>
            </div>
          )}
          {assignMode === 'smart_plan' && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5"
              style={{ backgroundColor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
              <Sparkles size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[16px] text-gray-500">
                <span className="text-blue-600 font-semibold">Smart Plan — </span>
                AI generates a complete task plan with day-wise scheduling from your project description.
              </p>
            </div>
          )}
          {assignMode === 'smart_type' && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5"
              style={{ backgroundColor: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Zap size={13} className="text-violet-500 flex-shrink-0 mt-0.5" />
              <p className="text-[16px] text-gray-500">
                <span className="text-violet-600 font-semibold">Type-Based Generation — </span>
                Select an assignment type (Design / Development / Testing / Marketing), preview the generated tasks, then smart-assign in one click.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Manual / Auto: assignment list ── */}
      {(assignMode === 'manual' || assignMode === 'auto') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Assignments &amp; Tasks</h2>
              <p className="text-[16px] text-gray-400 mt-0.5">
                {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} ·{' '}
                {assignments.reduce((n, a) => n + a.tasks.length, 0)} tasks total
              </p>
            </div>
            <PrimaryBtn onClick={addAssignment}>
              <Plus size={13} /> Add Assignment
            </PrimaryBtn>
          </div>

          {assignments.map((asgn, aIdx) => (
            <AssignmentCard
              key={asgn.id}
              asgn={asgn}
              aIdx={aIdx}
              total={assignments.length}
              autoAssign={assignMode === 'auto'}
              onUpdate={(field, val) => updateAssignment(aIdx, field, val)}
              onRemove={() => removeAssignment(aIdx)}
              onAddTask={() => addTask(aIdx)}
              onRemoveTask={tIdx => removeTask(aIdx, tIdx)}
              onUpdateTask={(tIdx, field, val) => updateTask(aIdx, tIdx, field, val)}
            />
          ))}
        </div>
      )}

      {/* ── Smart Plan ── */}
      {assignMode === 'smart_plan' && (
        <div className="space-y-4">
          {!plan ? (
            <SectionCard>
              <SectionHeader icon={Sparkles} title="Smart Plan Settings"
                subtitle="Adjust complexity and let AI generate the full task structure" />
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Complexity" hint="Controls how many tasks are generated">
                    <select value={project.complexity}
                      onChange={e => updateProject('complexity', e.target.value)}
                      className={inputCls} style={inputStyle}>
                      {COMPLEXITIES.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label} — {c.hint}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Project Types">
                    <div className="rounded-lg p-3 flex flex-wrap gap-x-3 gap-y-1.5 bg-white border border-gray-200">
                      {PROJECT_TYPES.map(pt => {
                        const checked = project.project_types?.includes(pt.value) ?? false
                        return (
                          <label key={pt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              className="w-3 h-3 accent-blue-500"
                              onChange={e => {
                                const current = project.project_types || []
                                updateProject(
                                  'project_types',
                                  e.target.checked
                                    ? [...current, pt.value]
                                    : current.filter(v => v !== pt.value)
                                )
                              }}
                            />
                            <span className={`text-[16px] ${checked ? 'text-gray-900' : 'text-gray-500'}`}>{pt.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </Field>
                </div>
                {planMsg?.text && <FormAlert msg={planMsg} onClose={() => {}} />}
                <PrimaryBtn onClick={onGenerate} disabled={generating} className="w-full">
                  {generating
                    ? <><RefreshCw size={13} className="animate-spin" /> Generating plan…</>
                    : <><Sparkles size={13} /> Generate Smart Plan</>
                  }
                </PrimaryBtn>
              </div>
            </SectionCard>
          ) : (
            <SmartPlanPreview plan={plan} onReset={() => {}} onConfirm={onConfirmPlan} confirming={confirming} />
          )}
        </div>
      )}

      {/* ── Smart Type Generation ── */}
      {assignMode === 'smart_type' && (
        <div className="space-y-4">
          {!savedProject ? (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
              style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-[16px] text-gray-500">
                The project must be saved before you can generate tasks.
                Go back to Step 1 and complete the project info, then the project will be saved automatically when you reach this step.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Type-Based Assignments</h2>
                  <p className="text-[16px] text-gray-400 mt-0.5">
                    {smartAssignments.length} assignment{smartAssignments.length !== 1 ? 's' : ''} ·{' '}
                    {smartAssignments.filter(a => a._assigned).length} assigned
                  </p>
                </div>
                <PrimaryBtn onClick={addSmartAssignment} style={{ backgroundColor: '#7c3aed' }}>
                  <Plus size={13} /> Add Assignment
                </PrimaryBtn>
              </div>

              {smartAssignments.map((a, idx) => (
                <SmartTypeAssignmentCard
                  key={a._tempId}
                  a={a}
                  index={idx + 1}
                  savedProject={savedProject}
                  onUpdate={(field, val) => updateSmartAssignment(idx, field, val)}
                  onRemove={() => removeSmartAssignment(idx)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Smart Plan Preview ───────────────────────────────────────────────────────

function SmartPlanPreview({ plan, onReset, onConfirm, confirming }) {
  const { modules = [], total_tasks = 0 } = plan || {}
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl px-5 py-4"
        style={{ backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
          <Layers size={16} className="text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-600">Plan generated successfully</p>
          <p className="text-[16px] text-gray-500 mt-0.5">
            {modules.length} module{modules.length !== 1 ? 's' : ''} · {total_tasks} task{total_tasks !== 1 ? 's' : ''} · Scheduled day-wise per role
          </p>
        </div>
        <button type="button" onClick={onReset}
          className="text-[16px] text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1 flex-shrink-0">
          <RefreshCw size={11} /> Regenerate
        </button>
      </div>

      {modules.map((mod, mi) => (
        <SectionCard key={mi}>
          <SectionHeader
            title={mod.name}
            subtitle={`${mod.tasks.length} task${mod.tasks.length !== 1 ? 's' : ''}`}
            right={
              <span className="w-7 h-7 rounded-md flex items-center justify-center text-[16px] font-bold text-blue-600"
                style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                {mi + 1}
              </span>
            }
          />
          <div className="divide-y divide-gray-100">
            {mod.tasks.map((task, ti) => (
              <div key={ti} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[16px] text-gray-500">{task.required_role}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-[16px] text-gray-500 flex items-center gap-1">
                      <Clock size={10} /> {task.estimated_days} day{task.estimated_days !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <PriorityDot priority={task.priority} />
                  {task.start_date && (
                    <span className="text-[16px] text-gray-400 flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(task.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {' – '}
                      {new Date(task.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                  {task.suggested_assignee ? (
                    <span className="text-[16px] px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ backgroundColor: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <Users size={10} /> {task.suggested_assignee.name}
                    </span>
                  ) : (
                    <span className="text-[16px] text-amber-500 flex items-center gap-1">
                      <AlertCircle size={10} /> No match
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, tIdx, aIdx, total, autoAssign, onRemove, onUpdate }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <span className="text-[16px] font-semibold text-gray-400 uppercase tracking-wider">
          Task {tIdx + 1}
        </span>
        {total > 1 && (
          <DangerBtn onClick={onRemove}><Trash2 size={10} /> Remove</DangerBtn>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Task Title" required>
          <input value={task.title}
            onChange={e => onUpdate('title', e.target.value)}
            placeholder="e.g. Design Homepage"
            className={inputCls} style={inputStyle} />
        </Field>

        <Field label="Required Role"
          hint={autoAssign ? 'Used for smart employee matching' : undefined}>
          <input value={task.required_role}
            onChange={e => onUpdate('required_role', e.target.value)}
            placeholder="e.g. frontend developer"
            className={inputCls} style={inputStyle} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Task Description">
            <textarea value={task.description}
              onChange={e => onUpdate('description', e.target.value)}
              rows={2} placeholder="Describe what this task involves..."
              className={inputCls} style={inputStyle} />
          </Field>
        </div>

        <Field label="Priority">
          <select value={task.priority}
            onChange={e => onUpdate('priority', e.target.value)}
            className={inputCls} style={inputStyle}>
            {TASK_PRIORITIES.map(p => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Due Date" required>
          <input type="date" value={task.due_date}
            onChange={e => onUpdate('due_date', e.target.value)}
            className={inputCls} style={inputStyle} />
        </Field>

        <Field label="Estimated Hours">
          <input type="number" min="0" value={task.estimated_hours}
            onChange={e => onUpdate('estimated_hours', e.target.value)}
            placeholder="e.g. 8" className={inputCls} style={inputStyle} />
        </Field>

        <Field label="Admin Permission Required">
          <div className="flex items-center gap-3 h-[42px] px-3.5 rounded-lg cursor-pointer bg-white border border-gray-200">
            <input type="checkbox" id={`perm-${aIdx}-${tIdx}`}
              checked={task.requires_permission}
              onChange={e => onUpdate('requires_permission', e.target.checked)}
              className="w-4 h-4 accent-blue-500 flex-shrink-0 cursor-pointer" />
            <label htmlFor={`perm-${aIdx}-${tIdx}`}
              className="text-[16px] text-gray-500 cursor-pointer select-none leading-tight">
              Requires admin approval to start
            </label>
          </div>
        </Field>

        {task.requires_permission && (
          <div className="sm:col-span-2">
            <Field label="Permission Details">
              <input value={task.permission_description}
                onChange={e => onUpdate('permission_description', e.target.value)}
                placeholder="Describe what access or approval is needed..."
                className={inputCls} style={inputStyle} />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Assignment Card ──────────────────────────────────────────────────────────

function AssignmentCard({ asgn, aIdx, total, autoAssign, onUpdate, onRemove, onAddTask, onRemoveTask, onUpdateTask }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SectionCard>
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none"
        style={{ borderBottom: collapsed ? 'none' : `1px solid ${T.cardBorder}` }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[16px] font-bold text-blue-600"
            style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
            {aIdx + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {asgn.title || <span className="text-gray-400 font-normal italic">Untitled Assignment</span>}
            </p>
            <p className="text-[16px] text-gray-400 mt-0.5">
              {asgn.tasks.length} task{asgn.tasks.length !== 1 ? 's' : ''}
              {asgn.department ? ` · ${asgn.department}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {total > 1 && (
            <DangerBtn onClick={onRemove}><Trash2 size={11} /> Remove</DangerBtn>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 bg-gray-50">
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Assignment Title" required>
              <input value={asgn.title}
                onChange={e => onUpdate('title', e.target.value)}
                placeholder="e.g. Frontend Development Phase"
                className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Department" required>
              <input value={asgn.department}
                onChange={e => onUpdate('department', e.target.value)}
                placeholder="e.g. Web Development"
                className={inputCls} style={inputStyle} />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Assignment Description">
                <textarea value={asgn.description}
                  onChange={e => onUpdate('description', e.target.value)}
                  rows={2} placeholder="Brief description of this assignment's scope..."
                  className={inputCls} style={inputStyle} />
              </Field>
            </div>

            <Field label="Start Date" required>
              <input type="date" value={asgn.start_date}
                onChange={e => onUpdate('start_date', e.target.value)}
                className={inputCls} style={inputStyle} />
            </Field>
            <Field label="End Date" required>
              <input type="date" value={asgn.end_date}
                onChange={e => onUpdate('end_date', e.target.value)}
                className={inputCls} style={inputStyle} />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[16px] font-semibold text-gray-400 uppercase tracking-wider">
                Tasks ({asgn.tasks.length})
              </p>
              <button type="button" onClick={onAddTask}
                className="text-[16px] px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>
                + Add Task
              </button>
            </div>

            <div className="space-y-3">
              {asgn.tasks.map((task, tIdx) => (
                <TaskCard
                  key={task.id}
                  task={task} tIdx={tIdx} aIdx={aIdx}
                  total={asgn.tasks.length}
                  autoAssign={autoAssign}
                  onRemove={() => onRemoveTask(tIdx)}
                  onUpdate={(field, val) => onUpdateTask(tIdx, field, val)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function ReviewStep({ project, client, assignments, assignMode, plan, smartAssignments }) {
  const totalTasks = assignments.reduce((n, a) => n + a.tasks.length, 0)
  const smartTotal = smartAssignments.reduce((n, a) => n + a._tasks.length, 0)

  const Row = ({ label, value }) => value ? (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100">
      <span className="text-[16px] text-gray-400 flex-shrink-0 w-32">{label}</span>
      <span className="text-[16px] text-gray-700 text-right">{value}</span>
    </div>
  ) : null

  const assignLabel =
    assignMode === 'smart_plan' ? '✨ Smart Plan (AI generated)'
    : assignMode === 'smart_type' ? '⚡ Type-Based Generation'
    : assignMode === 'auto'      ? '⚡ Smart Auto-Assignment ON'
    : '✋ Manual Assignment'

  const typesLabel = PROJECT_TYPES
    .filter(t => project.project_types?.includes(t.value))
    .map(t => t.label)
    .join(', ') || '—'

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader icon={Hash} title="Project Summary" subtitle="Review all details before creating" />
        <div className="px-5 py-1">
          <Row label="Title"        value={project.title} />
          <Row label="Types"        value={typesLabel} />
          <Row label="Priority"     value={project.priority?.charAt(0).toUpperCase() + project.priority?.slice(1)} />
          <Row label="Start Date"   value={project.start_date} />
          <Row label="End Date"     value={project.end_date} />
          <Row label="Assignment"   value={assignLabel} />
        </div>
      </SectionCard>

      {(client.company || client.name || client.email) && (
        <SectionCard>
          <SectionHeader icon={Building2} title="Client Details" />
          <div className="px-5 py-1">
            <Row label="Company" value={client.company} />
            <Row label="Contact" value={client.name} />
            <Row label="Email"   value={client.email} />
            <Row label="Phone"   value={client.phone} />
            <Row label="Website" value={client.website} />
            <Row label="Budget"  value={client.budget} />
          </div>
        </SectionCard>
      )}

      {(assignMode === 'manual' || assignMode === 'auto') && (
        <SectionCard>
          <SectionHeader
            icon={Users} title="Team & Tasks"
            subtitle={`${assignments.length} assignment${assignments.length !== 1 ? 's' : ''} · ${totalTasks} task${totalTasks !== 1 ? 's' : ''} total`}
          />
          <div className="divide-y divide-gray-100">
            {assignments.map((a, i) => (
              <div key={a.id} className="px-5 py-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {i + 1}. {a.title || <span className="text-gray-400 italic">Untitled</span>}
                </p>
                <p className="text-[16px] text-gray-400 mb-2">
                  {a.department} · {a.tasks.length} task{a.tasks.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1">
                  {a.tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-[16px] text-gray-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                      <span className="flex-1">{t.title || 'Untitled task'}</span>
                      <PriorityDot priority={t.priority} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {assignMode === 'smart_type' && (
        <SectionCard>
          <SectionHeader
            icon={Zap} title="Type-Based Assignments"
            subtitle={`${smartAssignments.length} assignment${smartAssignments.length !== 1 ? 's' : ''} · ${smartTotal} tasks assigned`}
          />
          <div className="divide-y divide-gray-100">
            {smartAssignments.map((a, i) => (
              <div key={a._tempId} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {i + 1}. {a.title || <span className="text-gray-400 italic">Untitled</span>}
                  </p>
                  {a._assigned
                    ? <CheckCircle2 size={13} className="text-emerald-500" />
                    : <span className="text-[16px] text-amber-500">Not yet assigned</span>
                  }
                </div>
                <p className="text-[16px] text-gray-400 mb-1">
                  {a.type} · {a.priority} priority · {a._tasks.length} tasks generated
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {assignMode === 'smart_plan' && plan && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <Layers size={15} className="text-emerald-500 flex-shrink-0" />
          <p className="text-[16px] text-gray-500">
            Smart Plan with <span className="text-gray-900 font-semibold">{plan.total_tasks} tasks</span> across{' '}
            <span className="text-gray-900 font-semibold">{plan.modules?.length} modules</span> is ready to be created.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
        style={{ backgroundColor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <CheckCircle2 size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-[16px] text-gray-500">
          Everything looks good? Click{' '}
          <span className="text-gray-900 font-semibold">Create Project</span> to finalize.
        </p>
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

  const [view, setView] = useState('list')

  const [managers, setManagers] = useState([])
  const [project,  setProject]  = useState(emptyProject())
  const [client,   setClient]   = useState(emptyClient())
  const [formMsg,  setFormMsg]  = useState({ type: '', text: '' })

  const [currentStep,    setCurrentStep]    = useState(1)
  const [completedSteps, setCompletedSteps] = useState([])

  const [assignMode,  setAssignMode]  = useState('manual')
  const [assignments, setAssignments] = useState([emptyAssignment()])
  const [creating,    setCreating]    = useState(false)

  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [plan,       setPlan]       = useState(null)
  const [planMsg,    setPlanMsg]    = useState({ type: '', text: '' })

  const [savedProject,     setSavedProject]     = useState(null)
  const [smartAssignments, setSmartAssignments] = useState([emptySmartAssignment()])

  const searchDebounceRef = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(searchDebounceRef.current)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF)         params.status   = statusF
      if (priF)            params.priority = priF
      if (debouncedSearch) params.search   = debouncedSearch
      const [p, s] = await Promise.all([
        api.get('/projects', { params }),
        api.get('/projects/stats'),
      ])
      setProjects(p.data.data ?? [])
      setStats(s.data.data)
    } catch { toast.error('Failed to load projects') }
    finally   { setLoading(false) }
  }, [statusF, priF, debouncedSearch])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/users?role=manager')
      .then(r => setManagers(r.data.data || []))
      .catch(console.error)
  }, [])

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

  function openCreate() {
    setProject(emptyProject())
    setClient(emptyClient())
    setAssignments([emptyAssignment()])
    setFormMsg({ type: '', text: '' })
    setPlanMsg({ type: '', text: '' })
    setAssignMode('manual')
    setCurrentStep(1)
    setCompletedSteps([])
    setPlan(null)
    setSavedProject(null)
    setSmartAssignments([emptySmartAssignment()])
    setView('create')
  }

  const updateProject    = (f, v) => setProject(p => ({ ...p, [f]: v }))
  const updateClient     = (f, v) => setClient(c  => ({ ...c, [f]: v }))
  const updateAssignment = (idx, f, v) =>
    setAssignments(prev => prev.map((a, i) => i === idx ? { ...a, [f]: v } : a))
  const addAssignment    = () => setAssignments(prev => [...prev, emptyAssignment()])
  const removeAssignment = idx => setAssignments(prev => prev.filter((_, i) => i !== idx))
  const addTask          = aIdx =>
    setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: [...a.tasks, emptyTask()] } : a))
  const removeTask = (aIdx, tIdx) =>
    setAssignments(prev => prev.map((a, i) =>
      i === aIdx ? { ...a, tasks: a.tasks.filter((_, ti) => ti !== tIdx) } : a))
  const updateTask = (aIdx, tIdx, f, v) =>
    setAssignments(prev => prev.map((a, i) =>
      i === aIdx
        ? { ...a, tasks: a.tasks.map((t, ti) => ti === tIdx ? { ...t, [f]: v } : t) }
        : a))

  const addSmartAssignment = () =>
    setSmartAssignments(prev => [...prev, emptySmartAssignment()])
  const removeSmartAssignment = idx =>
    setSmartAssignments(prev => prev.filter((_, i) => i !== idx))
  const updateSmartAssignment = (idx, field, val) =>
    setSmartAssignments(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a))

  function validateStep(step) {
    if (step === 1) {
      if (!project.title)                          return 'Project title is required.'
      if (!project.description)                    return 'Project description is required.'
      if (!project.project_types?.length)          return 'Select at least one project type.'
      if (!project.manager_id)                     return 'Please assign a manager to the project.'
      if (!project.start_date)                     return 'Start date is required.'
      if (!project.end_date)                       return 'End date is required.'
      if (new Date(project.end_date) <= new Date(project.start_date))
                                                   return 'End date must be after start date.'
    }
    if (step === 3 && (assignMode === 'manual' || assignMode === 'auto')) {
      for (const [ai, a] of assignments.entries()) {
        if (!a.title)      return `Assignment ${ai + 1}: title is required.`
        if (!a.department) return `Assignment ${ai + 1}: department is required.`
        if (!a.start_date) return `Assignment ${ai + 1}: start date is required.`
        if (!a.end_date)   return `Assignment ${ai + 1}: end date is required.`
        for (const [ti, t] of a.tasks.entries()) {
          if (!t.title)    return `Assignment ${ai + 1}, Task ${ti + 1}: title is required.`
          if (!t.due_date) return `Assignment ${ai + 1}, Task ${ti + 1}: due date is required.`
        }
      }
    }
    if (step === 3 && assignMode === 'smart_plan' && !plan) {
      return 'Please generate a Smart Plan before continuing.'
    }
    if (step === 3 && assignMode === 'smart_type') {
      if (!savedProject) return 'Project must be saved. Go back to Step 1 and complete the project info.'
      const unassigned = smartAssignments.filter(a => !a._assigned)
      if (unassigned.length > 0)
        return `${unassigned.length} assignment(s) not yet generated. Use "Generate & Smart Assign" on each.`
    }
    return null
  }

  function goToStep(n) {
    setCurrentStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function serializeProject(extra = {}) {
    const { project_types = [], ...rest } = project
    return {
      ...rest,
      project_type: project_types[0] ?? 'other',
      client_info:  client,
      ...extra,
    }
  }

  async function ensureProjectSaved() {
    if (savedProject) return savedProject
    try {
      const res = await api.post('/projects', serializeProject())
      const saved = res.data.data
      setSavedProject(saved)
      return saved
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save project')
      return null
    }
  }

  async function handleNext() {
    const err = validateStep(currentStep)
    if (err) { setFormMsg({ type: 'error', text: err }); return }
    setFormMsg({ type: '', text: '' })

    if (currentStep === 2 && assignMode === 'smart_type') {
      const saved = await ensureProjectSaved()
      if (!saved) return
    }

    setCompletedSteps(prev => prev.includes(currentStep) ? prev : [...prev, currentStep])
    goToStep(currentStep + 1)
  }

  function handleBack() {
    setFormMsg({ type: '', text: '' })
    goToStep(currentStep - 1)
  }

  async function handleGenerate() {
    setPlanMsg({ type: '', text: '' })
    setGenerating(true)
    try {
      const res = await api.post('/assignments/auto-plan-preview', {
        description:  project.description,
        project_type: project.project_types?.[0] ?? 'other',
        complexity:   project.complexity,
        start_date:   project.start_date,
      })
      setPlan(res.data.data)
    } catch (err) {
      setPlanMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to generate plan.' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleCreate() {
    setCreating(true)
    setFormMsg({ type: '', text: '' })
    try {
      if (assignMode === 'smart_type') {
        toast.success(`"${project.title}" created with ${smartAssignments.reduce((n, a) => n + a._tasks.length, 0)} smart-assigned tasks!`)
        setView('list')
        load()
        return
      }

      if (assignMode === 'smart_plan') {
        await api.post('/assignments/wizard', {
          project:    serializeProject(),
          auto_plan:  true,
          plan,
        })
        toast.success(`"${project.title}" created! Tasks assigned via Smart Plan.`)
      } else {
        const payload = {
          project:     serializeProject({ auto_assign: assignMode === 'auto' }),
          assignments: assignments.map(({ id, tasks, ...a }) => ({
            ...a,
            tasks: tasks.map(({ id: _id, ...t }) => ({
              ...t,
              estimated_hours: t.estimated_hours !== '' ? Number(t.estimated_hours) : null,
            })),
          })),
          auto_assign: assignMode === 'auto',
        }
        const res = await api.post('/assignments/wizard', payload)
        toast.success(res.data.message || 'Project created successfully!')
      }
      setView('list')
      load()
    } catch (err) {
      setFormMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to create project.' })
    } finally {
      setCreating(false)
    }
  }

  function renderStepContent() {
    switch (currentStep) {
      case 1: return (
        <ProjectInfoStep project={project} updateProject={updateProject} managers={managers} />
      )
      case 2: return (
        <ClientDetailsStep client={client} updateClient={updateClient} />
      )
      case 3: return (
        <TeamAndTasksStep
          assignMode={assignMode}
          setAssignMode={mode => { setAssignMode(mode); setPlan(null) }}
          assignments={assignments}
          addAssignment={addAssignment}
          removeAssignment={removeAssignment}
          updateAssignment={updateAssignment}
          addTask={addTask}
          removeTask={removeTask}
          updateTask={updateTask}
          project={project}
          updateProject={updateProject}
          generating={generating}
          onGenerate={handleGenerate}
          plan={plan}
          confirming={confirming}
          onConfirmPlan={handleCreate}
          planMsg={planMsg}
          savedProject={savedProject}
          smartAssignments={smartAssignments}
          addSmartAssignment={addSmartAssignment}
          removeSmartAssignment={removeSmartAssignment}
          updateSmartAssignment={updateSmartAssignment}
        />
      )
      case 4: return (
        <ReviewStep
          project={project}
          client={client}
          assignments={assignments}
          assignMode={assignMode}
          plan={plan}
          smartAssignments={smartAssignments}
        />
      )
      default: return null
    }
  }

  // ── Create view ───────────────────────────────────────────────────────────────
  if (view === 'create') {
    const createBtnLabel = () => {
      if (creating) return 'Creating…'
      if (assignMode === 'smart_type') return <><Zap size={14} /> Finish &amp; Go to Project</>
      if (assignMode === 'smart_plan') return <><Sparkles size={14} /> Create with Smart Plan</>
      if (assignMode === 'auto')       return <><Sparkles size={14} /> Create &amp; Auto-Assign</>
      return <><Plus size={14} /> Create Project</>
    }

    return (
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div>
          <button onClick={() => setView('list')}
            className="flex items-center gap-1.5 text-[16px] text-gray-400 hover:text-gray-700 transition-colors mb-3">
            <ChevronLeft size={13} /> Back to Projects
          </button>
          <h1 className="text-xl font-bold text-gray-900">Create New Project</h1>
          <p className="text-sm text-gray-400 mt-1">
            Fill in the project details across the steps below.
          </p>
        </div>

        <FormAlert msg={formMsg} onClose={() => setFormMsg({ type: '', text: '' })} />

        <div className="space-y-5">
          <WizardTabs
            steps={CREATE_STEPS}
            currentStep={currentStep}
            onStepClick={goToStep}
            completedSteps={completedSteps}
          />

          {renderStepContent()}

          <div className="flex gap-3 pt-1">
            {currentStep === 1
              ? <GhostBtn onClick={() => setView('list')}>Cancel</GhostBtn>
              : <GhostBtn onClick={handleBack}><ChevronLeft size={14} /> Back</GhostBtn>
            }

            {currentStep < CREATE_STEPS.length ? (
              <PrimaryBtn onClick={handleNext} className="flex-1">
                Continue <span className="opacity-60 text-[16px] ml-1">→</span>
              </PrimaryBtn>
            ) : (
              <PrimaryBtn
                onClick={handleCreate}
                disabled={creating}
                className="flex-1"
                style={
                  assignMode === 'smart_plan' ? { backgroundColor: '#16a34a' }
                  : assignMode === 'smart_type' ? { backgroundColor: '#7c3aed' }
                  : {}
                }
              >
                {createBtnLabel()}
              </PrimaryBtn>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Project list ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage all projects across the organization"
        action={
          <PrimaryBtn onClick={openCreate}>
            <Plus size={14} /> New Project
          </PrimaryBtn>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"     value={stats.total}                       icon={FolderKanban} color="primary"   />
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
        <button onClick={load} title="Refresh"
          className="px-3 rounded-lg text-gray-500 hover:text-gray-800 transition-colors border border-gray-200 bg-gray-50">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Create your first project to get started"
          action={
            <PrimaryBtn onClick={openCreate} className="mt-3 mx-auto">
              <Plus size={14} /> Create Project
            </PrimaryBtn>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p._id}
              className="rounded-xl p-4 flex flex-col group transition-all hover:translate-y-[-1px] hover:shadow-md"
              style={cardStyle}>

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={p.status} />
                  <PriorityBadge priority={p.priority} />
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/admin/projects/${p._id}`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                    title="View project"><Eye size={13} /></Link>
                  <Link to={`/admin/projects/edit/${p._id}`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="Edit project"><Pencil size={13} /></Link>
                  <button onClick={() => setDelModal(p)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete project"><Trash2 size={13} /></button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{p.title}</h3>
              {p.client_info?.company && (
                <p className="text-[16px] text-blue-500 mb-1">Client: {p.client_info.company}</p>
              )}
              <p className="text-[16px] text-gray-400 line-clamp-2 mb-4 flex-1 leading-relaxed">{p.description}</p>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-[16px] text-gray-500 min-w-0">
                  <div className="w-5 h-5 rounded bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Users size={9} className="text-emerald-500" />
                  </div>
                  <span className="truncate">{p.manager_id?.name ?? 'No manager'}</span>
                </div>
                <span className="text-[16px] text-gray-400 font-mono flex items-center gap-1 flex-shrink-0">
                  <Calendar size={10} />
                  {p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Project"
        message={`Permanently delete "${delModal?.title}"? This will also remove all assignments, tasks, and team members associated with this project.`}
      />
    </div>
  )
}