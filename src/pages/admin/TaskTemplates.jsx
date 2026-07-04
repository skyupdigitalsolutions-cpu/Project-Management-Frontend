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
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, RefreshCw, LayoutTemplate,
  ChevronDown, ChevronRight, X, ListChecks,
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
  { value: 'role_based_dashboards',  label: 'Role Based Dashboards' },
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

  // ── Load employees (for per-task pre-assignment) ──────────────────────────────
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
      <PageHeader
        title="Task Templates"
        subtitle="Define the tasks created automatically when a project of each service type is added. A template fully replaces AI task generation for that service."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load}>
              <RefreshCw size={16} /> Refresh
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
          description="Create a template for a service type. When a project of that type is created, these tasks are generated automatically."
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
              <Button variant="secondary" onClick={addTask}>
                <Plus size={14} /> Add Task
              </Button>
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