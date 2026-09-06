/**
 * pages/admin/TaskTemplates.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin UI to create/edit per-service task templates.
 *
 * When a project is created whose project type matches a template here, the
 * backend turns this template's tasks (with subtasks) into real tasks and
 * SKIPS the automatic AI generation for that project.
 *
 * Backend: /api/task-templates  (GET list/one, POST, PUT, DELETE)
 *
 * CSV IMPORT
 * ──────────
 * Tasks can be imported from a CSV instead of typing them in the form.
 * Expected columns (header row required, case-insensitive, extra columns ignored):
 *
 *   task_name*, description, designation, department, assigned_to,
 *   estimated_hours, priority, subtasks
 *
 * Aliases accepted: name/task → task_name, role → designation,
 * assignee/employee → assigned_to, hours → estimated_hours.
 *
 * - assigned_to matches an employee by exact name or email (case-insensitive).
 *   Unmatched values fall back to role-based auto-match with a warning.
 * - subtasks are separated by "|" (or ";") within the cell,
 *   e.g.  "Setup repo|Install deps|Configure CI"
 * - priority: low | medium | high | critical (defaults to medium)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, RefreshCw, LayoutTemplate,
  ChevronDown, ChevronRight, X, ListChecks, Upload, FileDown,
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  PageHeader, Modal, ConfirmModal, FormField,
  Spinner, EmptyState, Button, PriorityBadge,
} from '../../components/common/UI'

// Must stay in sync with PROJECT_TYPES in Projects.jsx / CreateProject.jsx.
// `value` is the slug stored on the project's project_type and on the template.
const PROJECT_TYPES = [
  { value: 'social_media_marketing', label: 'Social Media Marketing' },
  { value: 'mobile_app',             label: 'Mobile App' },
  { value: 'graphic_design',         label: 'Graphic Design' },
  { value: 'ui_ux_design',           label: 'UI UX Design' },
  { value: 'automation',             label: 'Automation' },
  { value: 'website_development',    label: 'Website Development' },
  { value: 'seo',                    label: 'Search Engine Optimization' },
  { value: 'email_marketing',        label: 'Email Marketing' },
  { value: 'branding',               label: 'Branding' },
  { value: 'machine_learning',       label: 'Machine Learning' },
  { value: 'google_ads',             label: 'Google Ads' },
  { value: 'meta_ads',               label: 'Meta Ads' },
  { value: 'video_editing',          label: 'Video Editing' },
  { value: 'role_based_dashboards',  label: 'Role Based Dashboards' },
  { value: 'gmb',                    label: 'GMB (Google My Business)' },
]

const PRIORITIES = ['low', 'medium', 'high', 'critical']

const labelForType = (v) =>
  PROJECT_TYPES.find((t) => t.value === v)?.label || v

// ─── ID helper for stable React keys on unsaved rows ──────────────────────────
const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

const emptyTask = () => ({
  _key: uid(),
  name: '', description: '', designation: '', department: '',
  assignedTo: '',
  estimatedHours: 8, priority: 'medium',
  subtasks: [],
})

const emptyForm = () => ({
  name: '', projectType: '', description: '', isActive: true,
  tasks: [emptyTask()],
})

// ─── CSV parsing ──────────────────────────────────────────────────────────────
// Minimal RFC-4180 parser: handles quoted cells, escaped quotes (""),
// commas/newlines inside quotes, and CRLF line endings. No dependencies.
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(cell); cell = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') {
      row.push(cell); cell = ''
      rows.push(row); row = []
      continue
    }
    cell += ch
  }
  // trailing cell/row (file may not end with newline)
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  // drop fully-empty rows
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// Map header names (with aliases) → canonical keys
const HEADER_ALIASES = {
  task_name: 'name', task: 'name', name: 'name', title: 'name',
  description: 'description', details: 'description',
  designation: 'designation', role: 'designation',
  department: 'department', dept: 'department',
  assigned_to: 'assignedTo', assignee: 'assignedTo', employee: 'assignedTo',
  estimated_hours: 'estimatedHours', hours: 'estimatedHours', estimate: 'estimatedHours',
  priority: 'priority',
  subtasks: 'subtasks', subtask: 'subtasks',
}

const normalizeHeader = (h) =>
  h.trim().toLowerCase().replace(/\s+/g, '_')

/**
 * Turns raw CSV text into form-shaped tasks.
 * Returns { tasks, warnings, error }.
 */
function csvToTasks(text, employees) {
  const rows = parseCsv(text)
  if (rows.length === 0) return { tasks: [], warnings: [], error: 'The file is empty.' }

  const headers = rows[0].map((h) => HEADER_ALIASES[normalizeHeader(h)] || null)
  if (!headers.includes('name')) {
    return {
      tasks: [], warnings: [],
      error: 'Missing a "task_name" (or "name"/"task") column in the header row.',
    }
  }

  // Employee lookup by lowercase name/email
  const empIndex = new Map()
  employees.forEach((e) => {
    if (e.name)  empIndex.set(String(e.name).trim().toLowerCase(), e._id)
    if (e.email) empIndex.set(String(e.email).trim().toLowerCase(), e._id)
  })

  const tasks = []
  const warnings = []

  rows.slice(1).forEach((cells, i) => {
    const rowNum = i + 2 // 1-based, after header
    const rec = {}
    headers.forEach((key, ci) => {
      if (key) rec[key] = (cells[ci] ?? '').trim()
    })

    if (!rec.name) {
      warnings.push(`Row ${rowNum}: skipped (no task name).`)
      return
    }

    // Priority
    let priority = (rec.priority || 'medium').toLowerCase()
    if (!PRIORITIES.includes(priority)) {
      warnings.push(`Row ${rowNum}: unknown priority "${rec.priority}", using "medium".`)
      priority = 'medium'
    }

    // Hours
    let estimatedHours = Number(rec.estimatedHours)
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) estimatedHours = 8

    // Assignee: match by name or email; fall back to role auto-match
    let assignedTo = ''
    if (rec.assignedTo) {
      const match = empIndex.get(rec.assignedTo.toLowerCase())
      if (match) assignedTo = String(match)
      else warnings.push(
        `Row ${rowNum}: employee "${rec.assignedTo}" not found — will auto-match by role.`
      )
    }

    // Subtasks: split on | or ;
    const subtasks = (rec.subtasks || '')
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ _key: uid(), name }))

    tasks.push({
      _key: uid(),
      name:        rec.name,
      description: rec.description || '',
      designation: rec.designation || '',
      department:  rec.department || '',
      assignedTo,
      estimatedHours,
      priority,
      subtasks,
    })
  })

  if (tasks.length === 0) {
    return { tasks: [], warnings, error: 'No valid task rows found in the file.' }
  }
  return { tasks, warnings, error: null }
}

const SAMPLE_CSV = [
  'task_name,description,designation,department,assigned_to,estimated_hours,priority,subtasks',
  'Requirement gathering,Collect client requirements and sitemap,Project Manager,Management,,6,high,Kickoff call|Prepare sitemap|Client sign-off',
  'UI design,Design homepage and inner pages,UI UX Designer,Design,,16,high,Wireframes|High-fidelity mockups|Design review',
  'Frontend development,Build responsive pages from approved designs,Frontend Developer,Engineering,,24,medium,Setup project|Build components|Responsive testing',
  'Backend development,APIs and database schema,Backend Developer,Engineering,,24,medium,Schema design|Auth APIs|CRUD APIs',
  'QA & launch,Cross-browser testing and go-live,Frontend Developer,Engineering,,8,critical,Test checklist|Bug fixes|Deploy',
].join('\n')

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'task-template-sample.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function TaskTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm]           = useState(emptyForm())

  const [confirm, setConfirm]     = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting]   = useState(false)

  const [employees, setEmployees] = useState([])

  // CSV import: 'new' opens a fresh template from the file,
  // 'tasks' imports into the currently open editor.
  const fileInputRef = useRef(null)
  const importModeRef = useRef('new')

  // ── Load employees (for per-task pre-assignment + CSV assignee matching) ─────
  useEffect(() => {
    api.get('/users?role=employee&limit=500')
      .then((r) => setEmployees(r.data.data || []))
      .catch(() => {/* non-fatal; picker just shows "role fallback" */})
  }, [])

  // ── Load templates ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/task-templates')
      setTemplates(data.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Open create / edit ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (tpl) => {
    setEditingId(tpl._id)
    setForm({
      name:        tpl.name || '',
      projectType: tpl.projectType || '',
      description: tpl.description || '',
      isActive:    tpl.isActive !== false,
      tasks: (tpl.tasks || []).map((t) => ({
        _key: uid(),
        name:           t.name || '',
        description:    t.description || '',
        designation:    t.designation || '',
        department:     t.department || '',
        assignedTo:     t.assignedTo ? String(t.assignedTo) : '',
        estimatedHours: t.estimatedHours || 8,
        priority:       t.priority || 'medium',
        subtasks: (t.subtasks || []).map((s) => ({ _key: uid(), name: s.name || '' })),
      })),
    })
    if (!tpl.tasks || tpl.tasks.length === 0) {
      setForm((f) => ({ ...f, tasks: [emptyTask()] }))
    }
    setModalOpen(true)
  }

  // ── CSV import ────────────────────────────────────────────────────────────────
  const triggerImport = (mode) => {
    importModeRef.current = mode
    // reset so picking the same file twice still fires onChange
    if (fileInputRef.current) fileInputRef.current.value = ''
    fileInputRef.current?.click()
  }

  const onCsvFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onerror = () => toast.error('Could not read the file')
    reader.onload = () => {
      const { tasks, warnings, error } = csvToTasks(String(reader.result || ''), employees)
      if (error) return toast.error(error)

      warnings.slice(0, 3).forEach((w) => toast(w, { icon: '⚠️' }))
      if (warnings.length > 3) toast(`…and ${warnings.length - 3} more warnings`, { icon: '⚠️' })

      if (importModeRef.current === 'new') {
        // Fresh template pre-filled from the CSV; admin picks name + type.
        setEditingId(null)
        setForm({ ...emptyForm(), tasks })
        setModalOpen(true)
      } else {
        // Import into the open editor: replace a single blank task, else append.
        setForm((f) => {
          const onlyBlank =
            f.tasks.length === 1 && !f.tasks[0].name.trim() && f.tasks[0].subtasks.length === 0
          return { ...f, tasks: onlyBlank ? tasks : [...f.tasks, ...tasks] }
        })
      }
      toast.success(`Imported ${tasks.length} task${tasks.length === 1 ? '' : 's'} from CSV`)
    }
    reader.readAsText(file)
  }

  // ── Form field helpers ──────────────────────────────────────────────────────
  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const setTask = (idx, key, val) =>
    setForm((f) => {
      const tasks = [...f.tasks]
      tasks[idx] = { ...tasks[idx], [key]: val }
      return { ...f, tasks }
    })

  const addTask = () =>
    setForm((f) => ({ ...f, tasks: [...f.tasks, emptyTask()] }))

  const removeTask = (idx) =>
    setForm((f) => ({ ...f, tasks: f.tasks.filter((_, i) => i !== idx) }))

  const addSubtask = (tIdx) =>
    setForm((f) => {
      const tasks = [...f.tasks]
      tasks[tIdx] = {
        ...tasks[tIdx],
        subtasks: [...tasks[tIdx].subtasks, { _key: uid(), name: '' }],
      }
      return { ...f, tasks }
    })

  const setSubtask = (tIdx, sIdx, val) =>
    setForm((f) => {
      const tasks = [...f.tasks]
      const subtasks = [...tasks[tIdx].subtasks]
      subtasks[sIdx] = { ...subtasks[sIdx], name: val }
      tasks[tIdx] = { ...tasks[tIdx], subtasks }
      return { ...f, tasks }
    })

  const removeSubtask = (tIdx, sIdx) =>
    setForm((f) => {
      const tasks = [...f.tasks]
      tasks[tIdx] = {
        ...tasks[tIdx],
        subtasks: tasks[tIdx].subtasks.filter((_, i) => i !== sIdx),
      }
      return { ...f, tasks }
    })

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.name.trim())        return toast.error('Template name is required')
    if (!form.projectType)        return toast.error('Please select a project type')
    const validTasks = form.tasks.filter((t) => t.name.trim())
    if (validTasks.length === 0)  return toast.error('Add at least one task')

    const payload = {
      name:        form.name.trim(),
      projectType: form.projectType,
      description: form.description.trim() || null,
      isActive:    form.isActive,
      tasks: validTasks.map((t) => ({
        name:           t.name.trim(),
        description:    t.description?.trim() || null,
        designation:    t.designation?.trim() || null,
        department:     t.department?.trim() || null,
        assignedTo:     t.assignedTo || null,
        estimatedHours: Number(t.estimatedHours) > 0 ? Number(t.estimatedHours) : 8,
        priority:       t.priority,
        subtasks: (t.subtasks || [])
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name.trim() })),
      })),
    }

    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/task-templates/${editingId}`, payload)
        toast.success('Template updated')
      } else {
        await api.post('/task-templates', payload)
        toast.success('Template created')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const doDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/task-templates/${confirm.id}`)
      toast.success('Template deleted')
      setConfirm({ open: false, id: null, name: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete template')
    } finally {
      setDeleting(false)
    }
  }

  // Project types that don't yet have a template (for the create dropdown).
  const usedTypes = new Set(
    templates.filter((t) => t._id !== editingId).map((t) => t.projectType)
  )

  return (
    <div className="space-y-6">
      {/* Hidden file input shared by both import entry points */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onCsvFile}
      />

      <PageHeader
        title="Task Templates"
        subtitle="Define the tasks created automatically when a project of each service type is added. A template fully replaces AI task generation for that service."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load}>
              <RefreshCw size={16} /> Refresh
            </Button>
            <Button variant="secondary" onClick={() => triggerImport('new')}>
              <Upload size={16} /> Import CSV
            </Button>
            <Button variant="primary" onClick={openCreate}>
              <Plus size={16} /> New Template
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          description="Create a template for a service type, or import its tasks from a CSV. When a project of that type is created, these tasks are generated automatically."
        />
      ) : (
        <div className="grid gap-4">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl._id}
              tpl={tpl}
              onEdit={() => openEdit(tpl)}
              onDelete={() => setConfirm({ open: true, id: tpl._id, name: tpl.name })}
            />
          ))}
        </div>
      )}

      {/* ── Editor modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Template' : 'New Template'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Template meta */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Template Name *">
              <input
                className="input"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Website Development"
              />
            </FormField>

            <FormField label="Project Type *">
              <select
                className="input"
                value={form.projectType}
                onChange={(e) => setField('projectType', e.target.value)}
              >
                <option value="">Select a project type…</option>
                {PROJECT_TYPES.map((t) => {
                  const taken = usedTypes.has(t.value)
                  return (
                    <option key={t.value} value={t.value} disabled={taken}>
                      {t.label}{taken ? ' (has template)' : ''}
                    </option>
                  )
                })}
              </select>
            </FormField>
          </div>

          <FormField label="Description">
            <input
              className="input"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Optional note about this template"
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
            />
            Active (inactive templates are ignored during project creation)
          </label>

          {/* Tasks builder */}
          <div className="border-t border-slate-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ListChecks size={16} /> Tasks ({form.tasks.length})
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadSampleCsv}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                  title="Download a sample CSV showing the expected columns"
                >
                  <FileDown size={13} /> Sample CSV
                </button>
                <Button variant="secondary" onClick={() => triggerImport('tasks')}>
                  <Upload size={14} /> Import CSV
                </Button>
                <Button variant="secondary" onClick={addTask}>
                  <Plus size={14} /> Add Task
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {form.tasks.map((task, tIdx) => (
                <TaskEditor
                  key={task._key}
                  task={task}
                  index={tIdx}
                  employees={employees}
                  canRemove={form.tasks.length > 1}
                  onChange={(key, val) => setTask(tIdx, key, val)}
                  onRemove={() => removeTask(tIdx)}
                  onAddSubtask={() => addSubtask(tIdx)}
                  onSetSubtask={(sIdx, val) => setSubtask(tIdx, sIdx, val)}
                  onRemoveSubtask={(sIdx) => removeSubtask(tIdx, sIdx)}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirm.open}
        onClose={() => setConfirm({ open: false, id: null, name: '' })}
        onConfirm={doDelete}
        loading={deleting}
        title="Delete template?"
        message={`"${confirm.name}" will be removed. Existing projects and their tasks are not affected.`}
      />
    </div>
  )
}

// ─── Collapsible template summary card ────────────────────────────────────────
function TemplateCard({ tpl, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Toggle tasks"
        >
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">{tpl.name}</h3>
            {!tpl.isActive && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {labelForType(tpl.projectType)} · {tpl.tasks?.length || 0} tasks
          </p>
        </div>

        <button
          onClick={onEdit}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
          aria-label="Edit"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
          aria-label="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          {(tpl.tasks || []).length === 0 ? (
            <p className="text-sm text-slate-400">No tasks in this template.</p>
          ) : (
            <ol className="space-y-2">
              {tpl.tasks.map((t, i) => (
                <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{t.name}</span>
                    <PriorityBadge priority={t.priority} />
                    {t.designation && (
                      <span className="text-xs text-slate-500">· {t.designation}</span>
                    )}
                    {t.assignedTo && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600">
                        pinned
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-400">
                      {t.estimatedHours || 8}h
                    </span>
                  </div>
                  {t.subtasks?.length > 0 && (
                    <ul className="mt-1 ml-6 list-disc space-y-0.5 text-xs text-slate-500">
                      {t.subtasks.map((s, si) => <li key={si}>{s.name}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Single task editor (with subtasks) ───────────────────────────────────────
function TaskEditor({
  task, index, canRemove, employees = [],
  onChange, onRemove, onAddSubtask, onSetSubtask, onRemoveSubtask,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Task {index + 1}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Remove task"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <FormField label="Task Name *">
          <input
            className="input"
            value={task.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g. Frontend development"
          />
        </FormField>

        <FormField label="Description">
          <textarea
            className="input"
            rows={2}
            value={task.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Optional details for whoever picks this up"
          />
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Role / Designation">
            <input
              className="input"
              value={task.designation}
              onChange={(e) => onChange('designation', e.target.value)}
              placeholder="e.g. Frontend Developer"
            />
          </FormField>
          <FormField label="Department">
            <input
              className="input"
              value={task.department}
              onChange={(e) => onChange('department', e.target.value)}
              placeholder="e.g. Engineering"
            />
          </FormField>
        </div>

        <FormField label="Assign to (specific employee)">
          <select
            className="input"
            value={task.assignedTo}
            onChange={(e) => onChange('assignedTo', e.target.value)}
          >
            <option value="">— Auto-match by role above —</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.name}{emp.designation ? ` · ${emp.designation}` : ''}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Estimated Hours">
            <input
              type="number"
              min={1}
              className="input"
              value={task.estimatedHours}
              onChange={(e) => onChange('estimatedHours', e.target.value)}
            />
          </FormField>
          <FormField label="Priority">
            <select
              className="input"
              value={task.priority}
              onChange={(e) => onChange('priority', e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Subtasks */}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Subtasks ({task.subtasks.length})
            </span>
            <button
              onClick={onAddSubtask}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus size={13} /> Add subtask
            </button>
          </div>

          {task.subtasks.length === 0 ? (
            <p className="text-xs text-slate-400">No subtasks.</p>
          ) : (
            <div className="space-y-2">
              {task.subtasks.map((s, sIdx) => (
                <div key={s._key} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    value={s.name}
                    onChange={(e) => onSetSubtask(sIdx, e.target.value)}
                    placeholder={`Subtask ${sIdx + 1}`}
                  />
                  <button
                    onClick={() => onRemoveSubtask(sIdx)}
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove subtask"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}