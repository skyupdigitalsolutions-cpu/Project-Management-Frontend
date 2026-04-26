import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Eye, RefreshCw,
  FolderKanban, FolderCheck, FolderClock, Users, ChevronLeft,
  ChevronDown, ChevronUp, ClipboardList, AlertCircle,
  Calendar, Hash, Building2,
  CheckCircle2, Loader2, FileSpreadsheet, ListTree,
  Save, X, ChevronRight, FileText, Upload, Database, Sparkles, Download,
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
const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical']

const PRIORITY_META = {
  low:      { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#059669', dot: '#10b981' },
  medium:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#d97706', dot: '#f59e0b' },
  high:     { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  text: '#dc2626', dot: '#ef4444' },
  critical: { bg: 'rgba(220,38,38,0.18)',  border: 'rgba(220,38,38,0.35)',  text: '#ef4444', dot: '#dc2626' },
}

const ASSIGN_MODES = [
  { key: 'manual',     icon: ClipboardList,   label: 'Manual Assignment',        desc: 'Add assignments & tasks yourself' },
  { key: 'auto_excel', icon: FileSpreadsheet, label: 'Auto-Generate from Excel', desc: 'Use globally stored Excel template to assign tasks' },
]

const CREATE_STEPS = [
  { n: 1, key: 'project_info', label: 'Project Info', icon: Hash },
  { n: 2, key: 'client',       label: 'Client',       icon: Building2 },
  { n: 3, key: 'team_tasks',   label: 'Team & Tasks', icon: Users },
  { n: 4, key: 'review',       label: 'Review',       icon: CheckCircle2 },
]

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

// ─── ID helpers ───────────────────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

const emptySubTask = () => ({
  id: uid(), title: '', description: '', priority: 'medium',
  due_date: '', estimated_hours: '', required_role: '',
})

const emptyTask = () => ({
  id: uid(), title: '', description: '', priority: 'medium',
  due_date: '', estimated_hours: '', required_role: '',
  requires_permission: false, permission_description: '',
  subTasks: [],
})

const emptyAssignment = () => ({
  id: uid(), department: '', title: '', description: '',
  start_date: '', end_date: '', estimated_hours: '',
  tasks: [emptyTask()],
})

const emptyProject = () => ({
  title: '', description: '', manager_id: '',
  priority: 'medium', project_types: ['website'],
  start_date: '', end_date: '', status: 'planning',
})

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = { card: '#ffffff', cardBorder: 'rgba(0,0,0,0.08)', accent: '#3b82f6' }
const cardStyle = { backgroundColor: T.card, border: `1px solid ${T.cardBorder}` }

const inputCls = [
  'w-full rounded-lg px-3.5 py-2.5 text-sm text-gray-800 outline-none transition-all',
  'border border-gray-200 bg-white',
  'focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60',
  'placeholder:text-gray-400',
].join(' ')
const inputStyle = { colorScheme: 'light' }

// ─── Primitive UI ─────────────────────────────────────────────────────────────
function SectionCard({ children, className = '' }) {
  return <div className={`rounded-xl ${className}`} style={cardStyle}>{children}</div>
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
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-medium text-gray-600">
        {label}{required && <span className="text-blue-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function PriorityDot({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
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
        : { backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626' }
      }>
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{msg.text}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity text-xs">✕</button>
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
      className="inline-flex items-center gap-1 text-xs font-medium text-red-400/60 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
      {children}
    </button>
  )
}

// ─── Global Excel Upload Modal ─────────────────────────────────────────────────
function ExcelImportModal({ open, onClose, onUploaded }) {
  const [excelFile, setExcelFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)
  const [existing,  setExisting]  = useState(null)
  const [loadingEx, setLoadingEx] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setExcelFile(null)
    setLoadingEx(true)
    api.get('/excel-template')
      .then(r => setExisting(r.data.data ?? null))
      .catch(() => setExisting(null))
      .finally(() => setLoadingEx(false))
  }, [open])

  if (!open) return null

  const handleFile = (f) => {
    if (!f) return
    const extOk = /\.(xlsx|xls|csv)$/i.test(f.name)
    if (!extOk) { toast.error('Only Excel (.xlsx, .xls) or CSV files are allowed'); return }
    if (f.size > 20 * 1024 * 1024) { toast.error('File must be under 20 MB'); return }
    setExcelFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const handleSubmit = async () => {
    if (!excelFile) { toast.error('Please select an Excel file'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', excelFile)
      const res = await api.post('/excel-template', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Excel template stored globally! It can now be used for any project.')
      onUploaded?.(res.data.data)
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed. Please check your file format.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
          style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(59,130,246,0.05) 100%)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <Database size={17} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Global Excel Template</h2>
                <p className="text-xs text-gray-400 mt-0.5">Upload once — reuse across all projects automatically</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {loadingEx ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                <Loader2 size={13} className="animate-spin" /> Checking stored template…
              </div>
            ) : existing ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">Currently stored template</p>
                  <p className="text-xs text-emerald-600 truncate mt-0.5">{existing.originalName || existing.filename || 'excel-template'}</p>
                  {existing.uploadedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Uploaded {format(new Date(existing.uploadedAt), 'MMM d, yyyy · h:mm a')}
                    </p>
                  )}
                </div>
                <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-gray-500">No template stored yet. Upload one below to enable auto-task generation.</p>
              </div>
            )}

            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
              style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <Sparkles size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-700">How global templates work</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Upload your Excel sheet <strong>once</strong> here. When creating any project and selecting
                  <strong> "Auto-Generate from Excel"</strong>, tasks from this stored template will be
                  automatically loaded — no re-uploading needed.
                </p>
              </div>
            </div>

            <Field label={existing ? 'Replace Template' : 'Upload Template'} required>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed transition-all"
                style={excelFile
                  ? { borderColor: 'rgba(16,185,129,0.5)', backgroundColor: 'rgba(16,185,129,0.04)' }
                  : dragOver
                    ? { borderColor: 'rgba(59,130,246,0.5)', backgroundColor: 'rgba(59,130,246,0.04)' }
                    : { borderColor: 'rgba(0,0,0,0.12)', backgroundColor: 'rgba(0,0,0,0.01)' }
                }>
                {excelFile ? (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <FileSpreadsheet size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{excelFile.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(excelFile.size / 1024).toFixed(0)} KB · Click to replace
                      </p>
                    </div>
                    <button type="button"
                      onClick={e => { e.stopPropagation(); setExcelFile(null); if (fileRef.current) fileRef.current.value = '' }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5 py-7 px-4 text-center">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: dragOver ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <Upload size={18} className={dragOver ? 'text-blue-500' : 'text-gray-400'} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        {dragOver ? 'Drop your file here' : 'Click or drag & drop'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv · Max 20 MB</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => handleFile(e.target.files?.[0])} />
            </Field>

            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
              style={{ backgroundColor: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.18)' }}>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800">Download Template</p>
                <p className="text-xs text-gray-400 mt-0.5" style={{ fontSize: '10px' }}>
                  Columns: Task, Subtask, Role, Department, Priority, Duration, Dependency, Description, Module
                </p>
              </div>
              <a
                href="/task_template.xlsx"
                download="task_template.xlsx"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold flex-shrink-0 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.25)', color: '#4f46e5' }}>
                <Download size={13} />
                Template
              </a>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3"
              style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
              <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">
                Fill in the template and upload it above. Tasks will be available
                for auto-assignment on any project.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4"
            style={{ borderTop: '1px solid rgba(0,0,0,0.07)', backgroundColor: 'rgba(0,0,0,0.01)' }}>
            <GhostBtn onClick={onClose}>Cancel</GhostBtn>
            <button onClick={handleSubmit} disabled={uploading || !excelFile}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: '#16a34a' }}>
              {uploading
                ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                : <><Database size={14} /> {existing ? 'Replace Template' : 'Store Template'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Wizard Tab Bar ───────────────────────────────────────────────────────────
function WizardTabs({ steps, currentStep, onStepClick, completedSteps }) {
  return (
    <div className="flex items-stretch rounded-xl overflow-hidden"
      style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: `1px solid ${T.cardBorder}` }}>
      {steps.map((step, idx) => {
        const Icon = step.icon
        const done = completedSteps.includes(step.n)
        const active = currentStep === step.n
        const clickable = done || step.n < currentStep
        return (
          <button key={step.key} type="button"
            onClick={() => clickable && onStepClick(step.n)}
            disabled={!clickable && !active}
            className={[
              'flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all flex-1 justify-center relative',
              active ? 'text-white' : '',
              done && !active ? 'text-emerald-600 hover:text-gray-900 cursor-pointer' : '',
              !done && !active ? 'text-gray-400 cursor-not-allowed' : '',
            ].join(' ')}
            style={active ? { backgroundColor: T.accent } : done ? { backgroundColor: 'rgba(16,185,129,0.08)' } : {}}>
            {idx > 0 && <span className="absolute left-0 top-1/4 h-1/2 w-px" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }} />}
            {done && !active ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" /> : <Icon size={13} className="flex-shrink-0" />}
            <span className="hidden sm:inline truncate">{step.label}</span>
            <span className="sm:hidden font-bold">{step.n}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Reference Document Upload ────────────────────────────────────────────────
function ReferenceDocField({ docFile, setDocFile }) {
  const fileRef = useRef(null)
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-medium text-gray-600">
        Reference Document
        <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <div onClick={() => fileRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed transition-all"
        style={docFile
          ? { borderColor: 'rgba(59,130,246,0.4)', backgroundColor: 'rgba(59,130,246,0.04)' }
          : { borderColor: 'rgba(0,0,0,0.12)', backgroundColor: 'rgba(0,0,0,0.01)' }}>
        {docFile ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <FileText size={16} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{docFile.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{(docFile.size / 1024).toFixed(0)} KB · Click to replace</p>
            </div>
            <button type="button"
              onClick={e => { e.stopPropagation(); setDocFile(null); if (fileRef.current) fileRef.current.value = '' }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-5 px-4 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}>
              <Upload size={16} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Click to upload reference document</p>
              <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, DOCX, TXT · Max 10 MB</p>
            </div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (!f) return
          if (f.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB'); return }
          setDocFile(f)
        }} />
      <p className="text-xs text-gray-400">
        Employees will see a "View Reference Document" button on their tasks once uploaded.
      </p>
    </div>
  )
}

// ─── Step 1: Project Info ─────────────────────────────────────────────────────
function ProjectInfoStep({ project, updateProject, managers, docFile, setDocFile }) {
  return (
    <SectionCard>
      <SectionHeader icon={Hash} title="Project Info" subtitle="Core details about this project" />
      <div className="p-5 space-y-5">
        <Field label="Project Title" required>
          <input value={project.title} onChange={e => updateProject('title', e.target.value)}
            placeholder="e.g. Company Website Redesign" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Description" required>
          <textarea value={project.description} onChange={e => updateProject('description', e.target.value)}
            rows={3} placeholder="Brief project overview..." className={inputCls} style={inputStyle} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Project Type" required>
            <div className="rounded-lg p-3 flex flex-wrap gap-x-4 gap-y-2 bg-white border border-gray-200">
              {PROJECT_TYPES.map(pt => {
                const checked = project.project_types?.includes(pt.value) ?? false
                return (
                  <label key={pt.value} className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ backgroundColor: checked ? T.accent : 'rgba(0,0,0,0.05)', border: checked ? `1px solid ${T.accent}` : '1px solid rgba(0,0,0,0.2)' }}>
                      {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <input type="checkbox" className="sr-only" checked={checked}
                      onChange={e => {
                        const current = project.project_types || []
                        updateProject('project_types', e.target.checked ? [...current, pt.value] : current.filter(v => v !== pt.value))
                      }} />
                    <span className={`text-xs transition-colors ${checked ? 'text-gray-900' : 'text-gray-500'}`}>{pt.label}</span>
                  </label>
                )
              })}
            </div>
          </Field>
          <Field label="Priority" required>
            <select value={project.priority} onChange={e => updateProject('priority', e.target.value)} className={inputCls} style={inputStyle}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Assign Manager" required>
          <select value={project.manager_id} onChange={e => updateProject('manager_id', e.target.value)} className={inputCls} style={inputStyle}>
            <option value="">— Select a manager —</option>
            {managers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.designation})</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date" required>
            <input type="date" value={project.start_date} onChange={e => updateProject('start_date', e.target.value)} className={inputCls} style={inputStyle} />
          </Field>
          <Field label="End Date" required>
            <input type="date" value={project.end_date} onChange={e => updateProject('end_date', e.target.value)} className={inputCls} style={inputStyle} />
          </Field>
        </div>
        <div className="pt-1 border-t border-gray-100">
          <ReferenceDocField docFile={docFile} setDocFile={setDocFile} />
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Step 2: Client Selection ─────────────────────────────────────────────────
function ClientStep({ clientId, setClientId, clients, clientsLoading }) {
  const selected = clients.find(c => c._id === clientId) || null
  return (
    <SectionCard>
      <SectionHeader icon={Building2} title="Link Client" subtitle="Select the client this project belongs to" />
      <div className="p-5 space-y-5">
        <Field label="Client" required hint="Select the company this project is being built for">
          {clientsLoading ? (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Loading clients…
            </div>
          ) : clients.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg px-4 py-3"
              style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-gray-500">No clients found. <a href="/admin/clients/create" className="text-blue-500 underline">Create a client</a> first.</p>
            </div>
          ) : (
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">— Select a client —</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.companyName}{c.industry ? ` (${c.industry})` : ''}</option>)}
            </select>
          )}
        </Field>
        {selected && (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-blue-600 flex-shrink-0"
                style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                {(selected.companyName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{selected.companyName}</p>
                {selected.industry && <p className="text-xs text-blue-500 mt-0.5">{selected.industry}</p>}
              </div>
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">
              {selected.name  && <div className="px-4 py-2.5"><p className="text-xs text-gray-400 mb-0.5">Contact</p><p className="text-xs text-gray-700 font-medium">{selected.name}</p></div>}
              {selected.email && <div className="px-4 py-2.5"><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="text-xs text-gray-700 font-medium truncate">{selected.email}</p></div>}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-lg px-4 py-3"
          style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <AlertCircle size={14} className="text-blue-500 flex-shrink-0" />
          <p className="text-xs text-gray-500">A client must be selected to proceed. All client contact details live in the Clients module.</p>
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Sub-Task Card ────────────────────────────────────────────────────────────
function SubTaskCard({ sub, subIdx, total, onRemove, onUpdate }) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Sub-Task {subIdx + 1}</span>
        {total > 0 && <DangerBtn onClick={onRemove}><X size={10} /> Remove</DangerBtn>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Sub-Task Title" required>
          <input value={sub.title} onChange={e => onUpdate('title', e.target.value)}
            placeholder="e.g. Write copy for hero section" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Required Role">
          <input value={sub.required_role} onChange={e => onUpdate('required_role', e.target.value)}
            placeholder="e.g. copywriter" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Priority">
          <select value={sub.priority} onChange={e => onUpdate('priority', e.target.value)} className={inputCls} style={inputStyle}>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Due Date">
          <input type="date" value={sub.due_date} onChange={e => onUpdate('due_date', e.target.value)} className={inputCls} style={inputStyle} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea value={sub.description} onChange={e => onUpdate('description', e.target.value)}
              rows={2} placeholder="What does this sub-task involve?" className={inputCls} style={inputStyle} />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, tIdx, aIdx, total, onRemove, onUpdate, onAddSubTask, onRemoveSubTask, onUpdateSubTask }) {
  const [showSubs, setShowSubs] = useState(false)
  const subCount = (task.subTasks || []).length

  return (
    <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Task {tIdx + 1}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowSubs(s => !s)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-all"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1' }}>
            <ListTree size={11} />
            {subCount > 0 ? `${subCount} Sub-Task${subCount > 1 ? 's' : ''}` : 'Sub-Tasks'}
            {showSubs ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {total > 1 && <DangerBtn onClick={onRemove}><Trash2 size={10} /> Remove</DangerBtn>}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Task Title" required>
          <input value={task.title} onChange={e => onUpdate('title', e.target.value)}
            placeholder="e.g. Design Homepage" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Required Role">
          <input value={task.required_role} onChange={e => onUpdate('required_role', e.target.value)}
            placeholder="e.g. frontend developer" className={inputCls} style={inputStyle} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Task Description">
            <textarea value={task.description} onChange={e => onUpdate('description', e.target.value)}
              rows={2} placeholder="Describe what this task involves..." className={inputCls} style={inputStyle} />
          </Field>
        </div>
        <Field label="Priority">
          <select value={task.priority} onChange={e => onUpdate('priority', e.target.value)} className={inputCls} style={inputStyle}>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Due Date" required>
          <input type="date" value={task.due_date} onChange={e => onUpdate('due_date', e.target.value)} className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Estimated Hours">
          <input type="number" min="0" value={task.estimated_hours} onChange={e => onUpdate('estimated_hours', e.target.value)}
            placeholder="e.g. 8" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Admin Permission Required">
          <div className="flex items-center gap-3 h-[42px] px-3.5 rounded-lg cursor-pointer bg-white border border-gray-200">
            <input type="checkbox" id={`perm-${aIdx}-${tIdx}`} checked={task.requires_permission}
              onChange={e => onUpdate('requires_permission', e.target.checked)}
              className="w-4 h-4 accent-blue-500 flex-shrink-0 cursor-pointer" />
            <label htmlFor={`perm-${aIdx}-${tIdx}`} className="text-xs text-gray-500 cursor-pointer select-none leading-tight">
              Requires admin approval to start
            </label>
          </div>
        </Field>
        {task.requires_permission && (
          <div className="sm:col-span-2">
            <Field label="Permission Details">
              <input value={task.permission_description} onChange={e => onUpdate('permission_description', e.target.value)}
                placeholder="Describe what access or approval is needed..." className={inputCls} style={inputStyle} />
            </Field>
          </div>
        )}
      </div>
      {showSubs && (
        <div className="px-4 pb-4 space-y-3 border-t border-indigo-100">
          <div className="flex items-center justify-between pt-3">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
              <ListTree size={12} /> Sub-Tasks ({subCount})
            </p>
            <button type="button" onClick={onAddSubTask}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366f1' }}>
              + Add Sub-Task
            </button>
          </div>
          {subCount === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-3">No sub-tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {(task.subTasks || []).map((sub, si) => (
                <SubTaskCard key={sub.id} sub={sub} subIdx={si} total={subCount}
                  onRemove={() => onRemoveSubTask(si)}
                  onUpdate={(f, v) => onUpdateSubTask(si, f, v)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Assignment Card ──────────────────────────────────────────────────────────
function AssignmentCard({ asgn, aIdx, total, onUpdate, onRemove, onAddTask, onRemoveTask, onUpdateTask, onAddSubTask, onRemoveSubTask, onUpdateSubTask }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <SectionCard>
      <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none"
        style={{ borderBottom: collapsed ? 'none' : `1px solid ${T.cardBorder}` }}
        onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-blue-600"
            style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
            {aIdx + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {asgn.title || <span className="text-gray-400 font-normal italic">Untitled Assignment</span>}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {asgn.tasks.length} task{asgn.tasks.length !== 1 ? 's' : ''}
              {' · '}{asgn.tasks.reduce((n, t) => n + (t.subTasks?.length || 0), 0)} sub-tasks
              {asgn.department ? ` · ${asgn.department}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {total > 1 && <DangerBtn onClick={onRemove}><Trash2 size={11} /> Remove</DangerBtn>}
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
              <input value={asgn.title} onChange={e => onUpdate('title', e.target.value)}
                placeholder="e.g. Frontend Development Phase" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Department" required>
              <input value={asgn.department} onChange={e => onUpdate('department', e.target.value)}
                placeholder="e.g. Web Development" className={inputCls} style={inputStyle} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Assignment Description">
                <textarea value={asgn.description} onChange={e => onUpdate('description', e.target.value)}
                  rows={2} placeholder="Brief description of this assignment's scope..." className={inputCls} style={inputStyle} />
              </Field>
            </div>
            <Field label="Start Date" required>
              <input type="date" value={asgn.start_date} onChange={e => onUpdate('start_date', e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
            <Field label="End Date" required>
              <input type="date" value={asgn.end_date} onChange={e => onUpdate('end_date', e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tasks ({asgn.tasks.length})</p>
              <button type="button" onClick={onAddTask}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>
                + Add Task
              </button>
            </div>
            <div className="space-y-3">
              {asgn.tasks.map((task, tIdx) => (
                <TaskCard key={task.id} task={task} tIdx={tIdx} aIdx={aIdx} total={asgn.tasks.length}
                  onRemove={() => onRemoveTask(tIdx)}
                  onUpdate={(f, v) => onUpdateTask(tIdx, f, v)}
                  onAddSubTask={() => onAddSubTask(tIdx)}
                  onRemoveSubTask={si => onRemoveSubTask(tIdx, si)}
                  onUpdateSubTask={(si, f, v) => onUpdateSubTask(tIdx, si, f, v)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Global Excel Auto-Generate Panel ─────────────────────────────────────────
function ExcelAutoGenerateStep({ excelTasks, excelLoading, templateInfo, onReload, onSave, saving }) {
  const [selectedTasks, setSelectedTasks] = useState([])
  const [subTaskMap,    setSubTaskMap]    = useState({})
  const [expandedTask,  setExpandedTask]  = useState(null)

  useEffect(() => {
    if (excelTasks.length > 0) setSelectedTasks(excelTasks.map(t => t._id || t.id))
  }, [excelTasks])

  const toggleTask    = id => setSelectedTasks(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  const addSubTask    = taskId => { setSubTaskMap(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), emptySubTask()] })); setExpandedTask(taskId) }
  const updateSubTask = (taskId, si, f, v) => setSubTaskMap(prev => ({ ...prev, [taskId]: (prev[taskId] || []).map((s, i) => i === si ? { ...s, [f]: v } : s) }))
  const removeSubTask = (taskId, si) => setSubTaskMap(prev => ({ ...prev, [taskId]: (prev[taskId] || []).filter((_, i) => i !== si) }))

  const handleSave = () => {
    const payload = excelTasks
      .filter(t => selectedTasks.includes(t._id || t.id))
      .map(t => ({ ...t, subTasks: subTaskMap[t._id || t.id] || [] }))
    onSave(payload)
  }

  return (
    <SectionCard>
      <SectionHeader
        icon={Database}
        title="Auto-Generate from Global Template"
        subtitle="Tasks loaded from the globally stored Excel template"
        right={
          <button type="button" onClick={onReload} disabled={excelLoading}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#059669' }}>
            {excelLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Reload
          </button>
        }
      />
      <div className="p-5 space-y-4">
        {templateInfo && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <Database size={14} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">
                {templateInfo.originalName || templateInfo.filename || 'Global Template'}
              </p>
              {templateInfo.uploadedAt && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Stored on {format(new Date(templateInfo.uploadedAt), 'MMM d, yyyy')}
                </p>
              )}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669' }}>
              Global
            </span>
          </div>
        )}

        {excelLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : excelTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Database size={22} className="text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">No global template tasks found</p>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Go to the Projects list and click <strong>"Import Excel"</strong> to upload a global template.
              Tasks from that template will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{selectedTasks.length} of {excelTasks.length} tasks selected</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSelectedTasks(excelTasks.map(t => t._id || t.id))} className="text-xs text-blue-500 hover:underline">Select all</button>
                <span className="text-gray-300">·</span>
                <button type="button" onClick={() => setSelectedTasks([])} className="text-xs text-gray-400 hover:underline">Clear</button>
              </div>
            </div>
            <div className="space-y-2">
              {excelTasks.map(task => {
                const taskId = task._id || task.id
                const isSelected = selectedTasks.includes(taskId)
                const subs = subTaskMap[taskId] || []
                const isExpanded = expandedTask === taskId
                return (
                  <div key={taskId} className="rounded-xl overflow-hidden transition-all"
                    style={{ border: isSelected ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(0,0,0,0.07)', backgroundColor: isSelected ? 'rgba(59,130,246,0.03)' : '#fff' }}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleTask(taskId)} className="w-4 h-4 accent-blue-500 flex-shrink-0 cursor-pointer rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                          {task.department && <span>{task.department}</span>}
                          {task.priority && <PriorityDot priority={task.priority} />}
                        </div>
                      </div>
                      {isSelected && (
                        <button type="button" onClick={() => addSubTask(taskId)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0"
                          style={{ backgroundColor: 'rgba(99,102,241,0.09)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1' }}>
                          <ListTree size={11} /> + Sub-Task
                        </button>
                      )}
                    </div>
                    {isExpanded && subs.length > 0 && (
                      <div className="px-4 pb-4 space-y-2 border-t border-indigo-100">
                        {subs.map((sub, si) => (
                          <SubTaskCard key={sub.id} sub={sub} subIdx={si} total={subs.length}
                            onRemove={() => removeSubTask(taskId, si)}
                            onUpdate={(f, v) => updateSubTask(taskId, si, f, v)} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="pt-2 flex items-center gap-3">
              <PrimaryBtn onClick={handleSave} disabled={saving || selectedTasks.length === 0} style={{ backgroundColor: '#16a34a' }}>
                {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save Selected Tasks</>}
              </PrimaryBtn>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Step 3: Team & Tasks ─────────────────────────────────────────────────────
function TeamAndTasksStep({ assignMode, setAssignMode, assignments, addAssignment, removeAssignment, updateAssignment, addTask, removeTask, updateTask, addSubTask, removeSubTask, updateSubTask, excelTasks, excelLoading, templateInfo, onReloadExcel, onSaveExcelTasks, savingExcel }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader icon={Users} title="Team & Tasks" subtitle="Choose how to assign work for this project" />
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ASSIGN_MODES.map(m => {
              const Icon = m.icon
              const active = assignMode === m.key
              return (
                <button key={m.key} type="button" onClick={() => setAssignMode(m.key)}
                  className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-left transition-all"
                  style={active ? { backgroundColor: 'rgba(59,130,246,0.08)', border: '2px solid rgba(59,130,246,0.4)' } : { backgroundColor: 'rgba(0,0,0,0.02)', border: '2px solid rgba(0,0,0,0.08)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: active ? 'rgba(59,130,246,0.12)' : 'rgba(0,0,0,0.05)' }}>
                    <Icon size={13} className={active ? 'text-blue-500' : 'text-gray-400'} />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${active ? 'text-gray-900' : 'text-gray-500'}`}>{m.label}</p>
                    <p className="text-xs mt-0.5 leading-tight text-gray-400">{m.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </SectionCard>

      {assignMode === 'manual' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Assignments & Tasks</h2>
              <p className="text-xs text-gray-400 mt-0.5">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''} · {assignments.reduce((n, a) => n + a.tasks.length, 0)} tasks total</p>
            </div>
            <PrimaryBtn onClick={addAssignment}><Plus size={13} /> Add Assignment</PrimaryBtn>
          </div>
          {assignments.map((asgn, aIdx) => (
            <AssignmentCard key={asgn.id} asgn={asgn} aIdx={aIdx} total={assignments.length}
              onUpdate={(f, v) => updateAssignment(aIdx, f, v)}
              onRemove={() => removeAssignment(aIdx)}
              onAddTask={() => addTask(aIdx)}
              onRemoveTask={tIdx => removeTask(aIdx, tIdx)}
              onUpdateTask={(tIdx, f, v) => updateTask(aIdx, tIdx, f, v)}
              onAddSubTask={tIdx => addSubTask(aIdx, tIdx)}
              onRemoveSubTask={(tIdx, si) => removeSubTask(aIdx, tIdx, si)}
              onUpdateSubTask={(tIdx, si, f, v) => updateSubTask(aIdx, tIdx, si, f, v)} />
          ))}
        </div>
      )}

      {assignMode === 'auto_excel' && (
        <ExcelAutoGenerateStep
          excelTasks={excelTasks} excelLoading={excelLoading}
          templateInfo={templateInfo}
          onReload={onReloadExcel}
          onSave={onSaveExcelTasks}
          saving={savingExcel}
        />
      )}
    </div>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────
function ReviewStep({ project, clientId, clients, assignments, assignMode, docFile }) {
  const totalTasks = assignments.reduce((n, a) => n + a.tasks.length, 0)
  const totalSubs  = assignments.reduce((n, a) => n + a.tasks.reduce((m, t) => m + (t.subTasks?.length || 0), 0), 0)
  const selectedClient = clients.find(c => c._id === clientId)
  const typesLabel = PROJECT_TYPES.filter(t => project.project_types?.includes(t.value)).map(t => t.label).join(', ') || '—'

  const Row = ({ label, value }) => value ? (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100">
      <span className="text-xs text-gray-400 flex-shrink-0 w-32">{label}</span>
      <span className="text-xs text-gray-700 text-right">{value}</span>
    </div>
  ) : null

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader icon={Hash} title="Project Summary" subtitle="Review all details before creating" />
        <div className="px-5 py-1">
          <Row label="Title"       value={project.title} />
          <Row label="Types"       value={typesLabel} />
          <Row label="Priority"    value={project.priority?.charAt(0).toUpperCase() + project.priority?.slice(1)} />
          <Row label="Start Date"  value={project.start_date} />
          <Row label="End Date"    value={project.end_date} />
          <Row label="Assign Mode" value={assignMode === 'auto_excel' ? '📊 Auto-Generate from Global Template' : '✋ Manual Assignment'} />
          <Row label="Reference Doc" value={docFile ? `📎 ${docFile.name}` : null} />
        </div>
      </SectionCard>

      {selectedClient ? (
        <SectionCard>
          <SectionHeader icon={Building2} title="Client" />
          <div className="px-5 py-1">
            <Row label="Company"  value={selectedClient.companyName} />
            {selectedClient.industry && <Row label="Industry" value={selectedClient.industry} />}
            {selectedClient.name     && <Row label="Contact"  value={selectedClient.name} />}
          </div>
        </SectionCard>
      ) : (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 font-medium">No client selected — go back to Step 2.</p>
        </div>
      )}

      {assignMode === 'manual' && (
        <SectionCard>
          <SectionHeader icon={Users} title="Team & Tasks"
            subtitle={`${assignments.length} assignment${assignments.length !== 1 ? 's' : ''} · ${totalTasks} tasks · ${totalSubs} sub-tasks`} />
          <div className="divide-y divide-gray-100">
            {assignments.map((a, i) => (
              <div key={a.id} className="px-5 py-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">{i + 1}. {a.title || <span className="text-gray-400 italic">Untitled</span>}</p>
                <p className="text-xs text-gray-400 mb-2">{a.department} · {a.tasks.length} task{a.tasks.length !== 1 ? 's' : ''}</p>
                <div className="space-y-1">
                  {a.tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-gray-500">
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

      <div className="flex items-center gap-3 rounded-xl px-4 py-3.5"
        style={{ backgroundColor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <CheckCircle2 size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-gray-500">Everything looks good? Click <span className="text-gray-900 font-semibold">Create Project</span> to finalize.</p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminProjects() {
  const [projects, setProjects] = useState([])
  const [stats,    setStats]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')
  const [priF,     setPriF]     = useState('')
  const [search,   setSearch]   = useState('')
  const [delModal, setDelModal] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [view,     setView]     = useState('list')

  const [excelModalOpen, setExcelModalOpen] = useState(false)

  const [managers,       setManagers]       = useState([])
  const [clients,        setClients]        = useState([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientId,       setClientId]       = useState('')

  const [project,        setProject]        = useState(emptyProject())
  const [formMsg,        setFormMsg]        = useState({ type: '', text: '' })
  const [currentStep,    setCurrentStep]    = useState(1)
  const [completedSteps, setCompletedSteps] = useState([])
  const [assignMode,     setAssignMode]     = useState('manual')
  const [assignments,    setAssignments]    = useState([emptyAssignment()])
  const [creating,       setCreating]       = useState(false)
  const [docFile,        setDocFile]        = useState(null)

  const [excelTasks,   setExcelTasks]   = useState([])
  const [excelLoading, setExcelLoading] = useState(false)
  const [savingExcel,  setSavingExcel]  = useState(false)
  const [templateInfo, setTemplateInfo] = useState(null)
  const [savedProject, setSavedProject] = useState(null)
  const savedProjectRef = useRef(null)

  const searchRef = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(searchRef.current)
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
    finally { setLoading(false) }
  }, [statusF, priF, debouncedSearch])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/users?role=manager').then(r => setManagers(r.data.data || [])).catch(console.error)
  }, [])

  useEffect(() => {
    if (view !== 'create') return
    setClientsLoading(true)
    api.get('/clients')
      .then(r => setClients(r.data.data ?? []))
      .catch(() => toast.error('Failed to load clients'))
      .finally(() => setClientsLoading(false))
  }, [view])

  const loadGlobalExcelTasks = useCallback(async () => {
    setExcelLoading(true)
    try {
      const { data } = await api.get('/excel-template/tasks')
      setExcelTasks(data.data ?? [])
      setTemplateInfo(data.template ?? null)
    } catch { toast.error('Failed to load global template tasks') }
    finally  { setExcelLoading(false) }
  }, [])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/projects/${delModal._id}`)
      toast.success('Project deleted')
      setDelModal(null); load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  function openCreate() {
    setProject(emptyProject())
    setClientId('')
    setAssignments([emptyAssignment()])
    setFormMsg({ type: '', text: '' })
    setAssignMode('manual')
    setCurrentStep(1)
    setCompletedSteps([])
    setSavedProject(null)
    setExcelTasks([])
    setTemplateInfo(null)
    setDocFile(null)
    setView('create')
  }

  const updateProject    = (f, v) => setProject(p => ({ ...p, [f]: v }))
  const updateAssignment = (idx, f, v) => setAssignments(prev => prev.map((a, i) => i === idx ? { ...a, [f]: v } : a))
  const addAssignment    = () => setAssignments(prev => [...prev, emptyAssignment()])
  const removeAssignment = idx => setAssignments(prev => prev.filter((_, i) => i !== idx))
  const addTask          = aIdx => setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: [...a.tasks, emptyTask()] } : a))
  const removeTask       = (aIdx, tIdx) => setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: a.tasks.filter((_, ti) => ti !== tIdx) } : a))
  const updateTask       = (aIdx, tIdx, f, v) => setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: a.tasks.map((t, ti) => ti === tIdx ? { ...t, [f]: v } : t) } : a))

  const addSubTask    = (aIdx, tIdx) => setAssignments(prev => prev.map((a, i) => i === aIdx
    ? { ...a, tasks: a.tasks.map((t, ti) => ti === tIdx ? { ...t, subTasks: [...(t.subTasks || []), emptySubTask()] } : t) } : a))
  const removeSubTask = (aIdx, tIdx, si) => setAssignments(prev => prev.map((a, i) => i === aIdx
    ? { ...a, tasks: a.tasks.map((t, ti) => ti === tIdx ? { ...t, subTasks: (t.subTasks || []).filter((_, s) => s !== si) } : t) } : a))
  const updateSubTask = (aIdx, tIdx, si, f, v) => setAssignments(prev => prev.map((a, i) => i === aIdx
    ? { ...a, tasks: a.tasks.map((t, ti) => ti === tIdx ? { ...t, subTasks: (t.subTasks || []).map((s, sIdx) => sIdx === si ? { ...s, [f]: v } : s) } : t) } : a))

  const handleSaveExcelTasks = async (tasksWithSubs) => {
    setSavingExcel(true)
    try {
      const pId = savedProject?._id
      if (!pId) { toast.error('Project not saved yet'); return }
      await api.post(`/projects/${pId}/excel-tasks/save`, { tasks: tasksWithSubs })
      toast.success(`${tasksWithSubs.length} tasks saved to project!`)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save tasks')
    } finally { setSavingExcel(false) }
  }

  function validateStep(step) {
    if (step === 1) {
      if (!project.title)                 return 'Project title is required.'
      if (!project.description)           return 'Project description is required.'
      if (!project.project_types?.length) return 'Select at least one project type.'
      if (!project.manager_id)            return 'Please assign a manager to the project.'
      if (!project.start_date)            return 'Start date is required.'
      if (!project.end_date)              return 'End date is required.'
      if (new Date(project.end_date) <= new Date(project.start_date)) return 'End date must be after start date.'
    }
    if (step === 2 && !clientId) return 'Please select a client before continuing.'
    if (step === 3 && assignMode === 'manual') {
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
    return null
  }

  function goToStep(n) { setCurrentStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function ensureProjectSaved() {
    if (savedProjectRef.current) return savedProjectRef.current
    if (savedProject) return savedProject
    try {
      const { project_types = [], ...rest } = project

      // POST /projects uses multer — must be multipart/form-data
      // Use native fetch so we fully control headers (axios default Content-Type interferes)
      const fd = new FormData()
      const payload = { ...rest, project_type: project_types[0] ?? 'other', client_id: clientId }
      Object.entries(payload).forEach(([k, v]) => {
        if (v === null || v === undefined) return
        fd.append(k, String(v))
      })
      project_types.forEach(t => fd.append('project_types[]', t))
      if (docFile) fd.append('document', docFile)

      const token = localStorage.getItem('token')
      const baseURL = import.meta.env.VITE_API_BASE_URL
      const response = await fetch(`${baseURL}/api/projects`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }, // NO Content-Type — browser sets multipart boundary
        body: fd,
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.message || 'Failed to save project')

      const saved = json.data
      setSavedProject(saved)
      savedProjectRef.current = saved
      return saved
    } catch (err) {
      toast.error(err.message || 'Failed to save project')
      return null
    }
  }

  async function handleNext() {
    const err = validateStep(currentStep)
    if (err) { setFormMsg({ type: 'error', text: err }); return }
    setFormMsg({ type: '', text: '' })

    if (currentStep === 2 && assignMode === 'auto_excel') {
      const saved = await ensureProjectSaved()
      if (!saved) return
      await loadGlobalExcelTasks()
    }

    setCompletedSteps(prev => prev.includes(currentStep) ? prev : [...prev, currentStep])
    goToStep(currentStep + 1)
  }

  function handleBack() {
    setFormMsg({ type: '', text: '' })
    goToStep(currentStep - 1)
  }

  async function handleCreate() {
    if (!clientId) { setFormMsg({ type: 'error', text: 'Please go back to Step 2 and select a client.' }); return }
    setCreating(true)
    setFormMsg({ type: '', text: '' })
    try {
      const { project_types = [], ...rest } = project

      if (assignMode === 'auto_excel') {
        // Ensure project is saved first — use ref to avoid stale closure
        const excelProject = savedProjectRef.current || savedProject || await ensureProjectSaved()
        if (!excelProject) return

        if (docFile) {
          const fd = new FormData()
          fd.append('document', docFile)
          await api.patch(`/projects/${excelProject._id}/document`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          }).catch(() => {})
        }
        toast.success(`"${project.title}" created! Excel tasks already saved.`)
        setView('list'); load(); return
      }

      // ─── FIX: payload shape must match what the controller expects ───────
      // Backend reads: req.body.project, req.body.assignments, req.body.auto_assign
      // auto_assign must be at ROOT level — NOT inside project object
      // project_types array must be included so backend saves it correctly
      const payload = {
        project: {
          ...rest,
          project_type:  project_types[0] ?? 'other',  // single (for backward compat)
          project_types,                                 // full array (for autoAssignForProject)
          clientId,                                      // client reference
          // ← REMOVED: auto_assign was incorrectly here before — caused schema validation error
        },
        auto_assign: false,   // ← FIX: moved to root level where backend reads it
        auto_plan:   false,   // ← FIX: explicit, prevents accidental MODE A trigger
        assignments: assignments.map(({ id, tasks, ...a }) => ({
          ...a,
          tasks: tasks.map(({ id: _id, subTasks, ...t }) => ({
            ...t,
            estimated_hours: t.estimated_hours !== '' ? Number(t.estimated_hours) : null,
            subTasks: (subTasks || []).map(({ id: sid, ...s }) => ({
              ...s,
              estimated_hours: s.estimated_hours !== '' ? Number(s.estimated_hours) : null,
            })),
          })),
        })),
      }

      const res = await api.post('/assignments/wizard', payload)
      const createdProject = res.data.data?.project ?? res.data.data

      if (docFile && createdProject?._id) {
        const fd = new FormData()
        fd.append('document', docFile)
        await api.patch(`/projects/${createdProject._id}/document`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch(() => toast.error('Project created, but document upload failed.'))
      }

      toast.success(res.data.message || 'Project created successfully!')
      setView('list'); load()
    } catch (err) {
      setFormMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to create project.' })
    } finally {
      setCreating(false)
    }
  }

  function renderStepContent() {
    switch (currentStep) {
      case 1: return <ProjectInfoStep project={project} updateProject={updateProject} managers={managers} docFile={docFile} setDocFile={setDocFile} />
      case 2: return <ClientStep clientId={clientId} setClientId={setClientId} clients={clients} clientsLoading={clientsLoading} />
      case 3: return (
        <TeamAndTasksStep
          assignMode={assignMode} setAssignMode={setAssignMode}
          assignments={assignments} addAssignment={addAssignment}
          removeAssignment={removeAssignment} updateAssignment={updateAssignment}
          addTask={addTask} removeTask={removeTask} updateTask={updateTask}
          addSubTask={addSubTask} removeSubTask={removeSubTask} updateSubTask={updateSubTask}
          excelTasks={excelTasks} excelLoading={excelLoading}
          templateInfo={templateInfo}
          onReloadExcel={loadGlobalExcelTasks}
          onSaveExcelTasks={handleSaveExcelTasks}
          savingExcel={savingExcel}
        />
      )
      case 4: return (
        <ReviewStep
          project={project} clientId={clientId} clients={clients}
          assignments={assignments} assignMode={assignMode}
          docFile={docFile}
        />
      )
      default: return null
    }
  }

  // ─── Create view ──────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div>
          <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-3">
            <ChevronLeft size={13} /> Back to Projects
          </button>
          <h1 className="text-xl font-bold text-gray-900">Create New Project</h1>
          <p className="text-sm text-gray-400 mt-1">Fill in the project details across the steps below.</p>
        </div>

        <FormAlert msg={formMsg} onClose={() => setFormMsg({ type: '', text: '' })} />

        <div className="space-y-5">
          <WizardTabs steps={CREATE_STEPS} currentStep={currentStep} onStepClick={goToStep} completedSteps={completedSteps} />
          {renderStepContent()}
          <div className="flex gap-3 pt-1">
            {currentStep === 1
              ? <GhostBtn onClick={() => setView('list')}>Cancel</GhostBtn>
              : <GhostBtn onClick={handleBack}><ChevronLeft size={14} /> Back</GhostBtn>
            }
            {currentStep < CREATE_STEPS.length ? (
              <PrimaryBtn onClick={handleNext} className="flex-1">
                Continue <span className="opacity-60 text-xs ml-1">→</span>
              </PrimaryBtn>
            ) : (
              <PrimaryBtn onClick={handleCreate} disabled={creating} className="flex-1">
                {creating ? 'Creating…' : <><Plus size={14} /> Create Project</>}
              </PrimaryBtn>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Project list ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage all projects across the organization"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExcelModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                backgroundColor: 'rgba(16,185,129,0.10)',
                border: '1px solid rgba(16,185,129,0.30)',
                color: '#059669',
              }}
            >
              <Database size={15} />
              Excel Template
            </button>
            <PrimaryBtn onClick={openCreate}>
              <Plus size={14} /> New Project
            </PrimaryBtn>
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"     value={stats.total}                       icon={FolderKanban} color="primary"  />
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
        <SelectInput value={priF} onChange={setPriF} placeholder="All priorities"
          options={PRIORITIES.map(p => ({ value: p, label: p }))} className="w-40" />
        <button onClick={load} title="Refresh"
          className="px-3 rounded-lg text-gray-500 hover:text-gray-800 transition-colors border border-gray-200 bg-gray-50">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects found" description="Create your first project to get started"
          action={<PrimaryBtn onClick={openCreate} className="mt-3 mx-auto"><Plus size={14} /> Create Project</PrimaryBtn>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => {
            const clientName = p.clientId?.companyName || p.client_info?.company || p.client_info?.companyName
            return (
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
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="View project">
                      <Eye size={13} />
                    </Link>
                    <Link to={`/admin/projects/edit/${p._id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit project">
                      <Pencil size={13} />
                    </Link>
                    <button onClick={() => setDelModal(p)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete project">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{p.title}</h3>
                {clientName && (
                  <p className="text-xs text-blue-500 mb-1 flex items-center gap-1">
                    <Building2 size={10} /> {clientName}
                    {p.clientId?.industry && <span className="text-gray-400">· {p.clientId.industry}</span>}
                  </p>
                )}
                <p className="text-xs text-gray-400 line-clamp-2 mb-4 flex-1 leading-relaxed">{p.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
                    <div className="w-5 h-5 rounded bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Users size={9} className="text-emerald-500" />
                    </div>
                    <span className="truncate">{p.manager_id?.name ?? 'No manager'}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono flex items-center gap-1 flex-shrink-0">
                    <Calendar size={10} />
                    {p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ExcelImportModal
        open={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        onUploaded={(info) => setTemplateInfo(info)}
      />

      <ConfirmModal open={!!delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Project"
        message={`Permanently delete "${delModal?.title}"? This will also remove all assignments, tasks, and team members associated with this project.`} />
    </div>
  )
}