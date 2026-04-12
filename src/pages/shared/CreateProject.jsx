import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Briefcase, User, Building2, LayoutList, Users, ClipboardList, Eye,
  Clock, Calendar, AlertCircle, X, UserPlus
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
const PRIORITIES  = ['low', 'medium', 'high', 'critical']
const STATUSES    = ['planning', 'active', 'on-hold', 'completed', 'cancelled']
const TASK_STATUSES = ['todo', 'in-progress', 'on-hold']

const STEPS = [
  { id: 1, label: 'Project Info',    icon: Briefcase },
  { id: 2, label: 'Client Details',  icon: Building2 },
  { id: 3, label: 'Assignments',     icon: LayoutList },
  { id: 4, label: 'Team & Tasks',    icon: Users },
  { id: 5, label: 'Review',          icon: Eye },
]

// ─── Initial state ────────────────────────────────────────────────────────────
const initProject = {
  title: '', description: '', manager_id: '', priority: 'medium',
  status: 'planning', start_date: '', end_date: '',
}
const initClient = {
  name: '', email: '', phone: '', company: '', website: '', requirements: '', budget: '',
}
const newAssignment = () => ({
  _tempId: Date.now() + Math.random(),
  department: '', title: '', description: '',
  start_date: '', end_date: '', estimated_hours: '',
  members: [],
  tasks: [],
})
const newTask = (assignedTo = '') => ({
  _tempId: Date.now() + Math.random(),
  title: '', description: '', assigned_to: assignedTo,
  priority: 'medium', status: 'todo', due_date: '', estimated_hours: '',
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDateForInput = (dateStr) => {
  if (!dateStr) return ''
  try { return format(new Date(dateStr), 'yyyy-MM-dd') } catch { return '' }
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ current }) {
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto gap-1">
      {STEPS.map((s, i) => {
        const done    = current > s.id
        const active  = current === s.id
        const Icon    = s.icon
        return (
          <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm font-medium ${
              active ? 'bg-brand-600 text-white' :
              done   ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                       'bg-surface-200 text-slate-500'
            }`}>
              {done
                ? <Check size={14} />
                : <Icon size={14} />}
              <span className="hidden sm:block">{s.label}</span>
              <span className="sm:hidden">{s.id}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── STEP 1 — Project Info ────────────────────────────────────────────────────
function Step1({ data, onChange, managers }) {
  const f = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white">Project Information</h2>
        <p className="text-sm text-slate-400 mt-1">Core details about the project scope and timeline.</p>
      </div>
      <FormField label="Project Title *">
        <input className="input" value={data.title} onChange={e => f('title', e.target.value)} placeholder="e.g. Novara E-Commerce Website" />
      </FormField>
      <FormField label="Project Description *">
        <textarea className="input resize-none" rows={3} value={data.description} onChange={e => f('description', e.target.value)} placeholder="Brief overview of what needs to be delivered…" />
      </FormField>
      <FormField label="Assign Manager *">
        <SelectInput value={data.manager_id} onChange={v => f('manager_id', v)} placeholder="Select a manager"
          options={managers.map(m => ({ value: m._id, label: `${m.name} — ${m.department}` }))} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Priority">
          <SelectInput value={data.priority} onChange={v => f('priority', v)} options={PRIORITIES.map(p => ({ value: p, label: p }))} />
        </FormField>
        <FormField label="Status">
          <SelectInput value={data.status} onChange={v => f('status', v)} options={STATUSES.map(s => ({ value: s, label: s }))} />
        </FormField>
        <FormField label="Start Date *">
          <input className="input" type="date" value={data.start_date} onChange={e => f('start_date', e.target.value)} />
        </FormField>
        <FormField label="End Date *">
          <input className="input" type="date" value={data.end_date} onChange={e => f('end_date', e.target.value)} />
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
        <h2 className="text-lg font-bold text-white">Client Details</h2>
        <p className="text-sm text-slate-400 mt-1">Collect the client's contact info and project requirements.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Client Name">
          <input className="input" value={data.name} onChange={e => f('name', e.target.value)} placeholder="John Smith" />
        </FormField>
        <FormField label="Company / Brand">
          <input className="input" value={data.company} onChange={e => f('company', e.target.value)} placeholder="Acme Corp" />
        </FormField>
        <FormField label="Email">
          <input className="input" type="email" value={data.email} onChange={e => f('email', e.target.value)} placeholder="client@company.com" />
        </FormField>
        <FormField label="Phone">
          <input className="input" value={data.phone} onChange={e => f('phone', e.target.value)} placeholder="+1 555 000 0000" />
        </FormField>
        <FormField label="Website / URL">
          <input className="input" value={data.website} onChange={e => f('website', e.target.value)} placeholder="https://client.com" />
        </FormField>
        <FormField label="Budget">
          <input className="input" value={data.budget} onChange={e => f('budget', e.target.value)} placeholder="e.g. $5,000 – $10,000" />
        </FormField>
      </div>
      <FormField label="Project Requirements / Brief">
        <textarea className="input resize-none" rows={5} value={data.requirements}
          onChange={e => f('requirements', e.target.value)}
          placeholder="Describe what the client needs: goals, deliverables, target audience, technical requirements, tone of voice, competitors, special notes…" />
      </FormField>
    </div>
  )
}

// ─── STEP 3 — Assignments ─────────────────────────────────────────────────────
function Step3({ assignments, onChange }) {
  const add = () => onChange([...assignments, newAssignment()])
  const remove = (tid) => onChange(assignments.filter(a => a._tempId !== tid))
  const update = (tid, key, val) =>
    onChange(assignments.map(a => a._tempId === tid ? { ...a, [key]: val } : a))

  // When department changes, clear members (they belonged to old dept)
  const updateDept = (tid, val) =>
    onChange(assignments.map(a =>
      a._tempId === tid ? { ...a, department: val, members: [], tasks: [] } : a
    ))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Department Assignments</h2>
          <p className="text-sm text-slate-400 mt-1">Define which departments will work on this project and their time windows.</p>
        </div>
        <button onClick={add} className="btn-primary flex-shrink-0">
          <Plus size={15} /> Add Assignment
        </button>
      </div>

      {assignments.length === 0 && (
        <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 text-center">
          <LayoutList size={36} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No assignments yet</p>
          <p className="text-slate-600 text-sm mt-1">Click "Add Assignment" to define department workstreams</p>
        </div>
      )}

      <div className="space-y-4">
        {assignments.map((a, idx) => (
          <div key={a._tempId} className="bg-surface-50 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-bold">{idx + 1}</div>
                <span className="text-sm font-semibold text-white">{a.department || 'New Assignment'}</span>
              </div>
              <button onClick={() => remove(a._tempId)} className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors">
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
                <input className="input" value={a.title} onChange={e => update(a._tempId, 'title', e.target.value)} placeholder="e.g. SEO Campaign Phase 1" />
              </FormField>
              <FormField label="Start Date *">
                <input className="input" type="date" value={a.start_date} onChange={e => update(a._tempId, 'start_date', e.target.value)} />
              </FormField>
              <FormField label="End Date *">
                <input className="input" type="date" value={a.end_date} onChange={e => update(a._tempId, 'end_date', e.target.value)} />
              </FormField>
              <FormField label="Estimated Hours">
                <input className="input" type="number" min="0" value={a.estimated_hours} onChange={e => update(a._tempId, 'estimated_hours', e.target.value)} placeholder="e.g. 40" />
              </FormField>
              <FormField label="Description">
                <input className="input" value={a.description} onChange={e => update(a._tempId, 'description', e.target.value)} placeholder="What this department will deliver…" />
              </FormField>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── STEP 4 — Team & Tasks per Assignment ─────────────────────────────────────
// KEY CHANGE: departmentUsers filters allUsers by assignment's department,
// so only relevant employees appear in the member checklist and task assignee dropdown.
function Step4({ assignments, onChange, allUsers }) {
  const [openPanel, setOpenPanel] = useState(assignments[0]?._tempId ?? null)

  const updateAssignment = (tid, key, val) =>
    onChange(assignments.map(a => a._tempId === tid ? { ...a, [key]: val } : a))

  const toggleMember = (tid, userId) => {
    const a = assignments.find(x => x._tempId === tid)
    const next = a.members.includes(userId)
      ? a.members.filter(id => id !== userId)
      : [...a.members, userId]
    // Also clear any tasks assigned to this user if they're being removed
    const tasks = a.members.includes(userId)
      ? a.tasks.map(t => t.assigned_to === userId ? { ...t, assigned_to: '' } : t)
      : a.tasks
    onChange(assignments.map(x =>
      x._tempId === tid ? { ...x, members: next, tasks } : x
    ))
  }

  const addTask = (tid) => {
    const a = assignments.find(x => x._tempId === tid)
    updateAssignment(tid, 'tasks', [...a.tasks, newTask()])
  }

  const updateTask = (tid, taskTid, key, val) => {
    const a = assignments.find(x => x._tempId === tid)
    const tasks = a.tasks.map(t => t._tempId === taskTid ? { ...t, [key]: val } : t)
    updateAssignment(tid, 'tasks', tasks)
  }

  const removeTask = (tid, taskTid) => {
    const a = assignments.find(x => x._tempId === tid)
    updateAssignment(tid, 'tasks', a.tasks.filter(t => t._tempId !== taskTid))
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={36} className="text-amber-400 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">No assignments defined</p>
        <p className="text-slate-500 text-sm mt-1">Go back to Step 3 and add at least one assignment first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white">Team Members & Tasks</h2>
        <p className="text-sm text-slate-400 mt-1">Assign team members and define tasks for each department.</p>
      </div>

      {assignments.map((a, idx) => {
        const isOpen = openPanel === a._tempId

        // ── CORE CHANGE: only show employees from this assignment's department ──
        const departmentUsers = a.department
          ? allUsers.filter(u =>
              u.department === a.department && u.role === 'employee'
            )
          : []

        // For task assignee dropdown: show selected members (subset of dept users)
        const assignedUsers = allUsers.filter(u => a.members.includes(u._id))

        return (
          <div key={a._tempId} className="bg-surface-50 border border-white/8 rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpenPanel(isOpen ? null : a._tempId)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-300 text-xs font-bold">{idx + 1}</div>
                <div className="text-left">
                  <p className="font-semibold text-white text-sm">{a.title || 'Untitled'}</p>
                  <p className="text-xs text-slate-500">
                    {a.department
                      ? `${a.department} · ${a.members.length} member${a.members.length !== 1 ? 's' : ''} · ${a.tasks.length} task${a.tasks.length !== 1 ? 's' : ''}`
                      : <span className="text-amber-400/80">⚠ No department selected</span>
                    }
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>

            {isOpen && (
              <div className="border-t border-white/5 p-5 space-y-6">

                {/* ── Members: filtered to this department only ── */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Users size={13} /> Team Members
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    Showing employees from <span className="text-brand-400 font-medium">{a.department || '—'}</span>
                    {a.department && departmentUsers.length === 0 && (
                      <span className="text-amber-400 ml-2">· No employees found in this department</span>
                    )}
                    {!a.department && (
                      <span className="text-amber-400 ml-2">· Select a department in Step 3 first</span>
                    )}
                  </p>

                  {departmentUsers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                      {departmentUsers.map(u => {
                        const checked = a.members.includes(u._id)
                        return (
                          <label
                            key={u._id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                              checked
                                ? 'bg-brand-600/15 border-brand-500/40'
                                : 'bg-surface-200 border-white/5 hover:border-white/10'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMember(a._tempId, u._id)}
                              className="w-4 h-4 accent-brand-500 flex-shrink-0"
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">{u.name}</p>
                                <p className="text-xs text-slate-500 truncate">{u.designation || u.department}</p>
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="border border-dashed border-white/10 rounded-xl p-5 text-center">
                      <Users size={24} className="text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">
                        {a.department
                          ? `No employees found in "${a.department}"`
                          : 'Select a department first to see available team members'}
                      </p>
                    </div>
                  )}

                  {departmentUsers.length > 0 && a.members.length === 0 && (
                    <p className="text-xs text-amber-400/70 mt-2 flex items-center gap-1">
                      <AlertCircle size={12} /> Select at least one team member for this assignment
                    </p>
                  )}
                </div>

                {/* ── Tasks ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <ClipboardList size={13} /> Tasks
                    </p>
                    <button
                      onClick={() => addTask(a._tempId)}
                      disabled={a.members.length === 0}
                      title={a.members.length === 0 ? 'Select team members first' : ''}
                      className="btn-secondary !py-1.5 !px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={12} /> Add Task
                    </button>
                  </div>

                  {a.members.length === 0 && (
                    <div className="border border-dashed border-white/10 rounded-xl p-5 text-center">
                      <p className="text-slate-600 text-sm">Select team members above before adding tasks</p>
                    </div>
                  )}

                  {a.members.length > 0 && a.tasks.length === 0 && (
                    <div className="border border-dashed border-white/10 rounded-xl p-5 text-center">
                      <p className="text-slate-600 text-sm">No tasks yet — click "Add Task" to create work items</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {a.tasks.map((t, ti) => (
                      <div key={t._tempId} className="bg-surface-200 border border-white/5 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Task {ti + 1}</span>
                          <button onClick={() => removeTask(a._tempId, t._tempId)} className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors">
                            <X size={13} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <FormField label="Task Title *">
                              <input className="input" value={t.title} onChange={e => updateTask(a._tempId, t._tempId, 'title', e.target.value)} placeholder="e.g. Keyword Research for Homepage" />
                            </FormField>
                          </div>

                          {/* Assign To: only members selected for this assignment */}
                          <FormField label="Assign To *">
                            <SelectInput
                              value={t.assigned_to}
                              onChange={v => updateTask(a._tempId, t._tempId, 'assigned_to', v)}
                              placeholder="Select member"
                              options={assignedUsers.map(u => ({ value: u._id, label: u.name }))}
                            />
                          </FormField>

                          <FormField label="Priority">
                            <SelectInput value={t.priority} onChange={v => updateTask(a._tempId, t._tempId, 'priority', v)}
                              options={PRIORITIES.map(p => ({ value: p, label: p }))} />
                          </FormField>
                          <FormField label="Due Date *">
                            <input className="input" type="date" value={t.due_date}
                              onChange={e => updateTask(a._tempId, t._tempId, 'due_date', e.target.value)} />
                          </FormField>
                          <FormField label="Estimated Hours">
                            <input className="input" type="number" min="0" value={t.estimated_hours}
                              onChange={e => updateTask(a._tempId, t._tempId, 'estimated_hours', e.target.value)} placeholder="e.g. 4" />
                          </FormField>
                          <div className="col-span-2">
                            <FormField label="Description">
                              <input className="input" value={t.description}
                                onChange={e => updateTask(a._tempId, t._tempId, 'description', e.target.value)} placeholder="What exactly needs to be done…" />
                            </FormField>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
function Step5({ project, client, assignments, allUsers, managers, editMode }) {
  const managerObj = managers.find(m => m._id === project.manager_id)

  const Section = ({ title, children }) => (
    <div className="card mb-4">
      <h3 className="text-sm font-bold text-white mb-4 pb-3 border-b border-white/5">{title}</h3>
      {children}
    </div>
  )

  const Row = ({ label, value }) => value ? (
    <div className="flex justify-between py-1.5">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className="text-xs text-slate-200 text-right max-w-xs">{value}</span>
    </div>
  ) : null

  const PriorityDot = ({ p }) => {
    const c = p === 'critical' ? 'bg-red-500' : p === 'high' ? 'bg-orange-500' : p === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
    return <span className={`inline-block w-2 h-2 rounded-full ${c} mr-1.5`} />
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-white">Review & Confirm</h2>
        <p className="text-sm text-slate-400 mt-1">{editMode ? 'Review your changes before saving.' : 'Review all details before creating the project.'}</p>
      </div>

      <Section title="📁 Project">
        <Row label="Title"    value={project.title} />
        <Row label="Manager"  value={managerObj?.name} />
        <Row label="Priority" value={project.priority} />
        <Row label="Status"   value={project.status} />
        <Row label="Timeline" value={project.start_date && project.end_date ? `${project.start_date} → ${project.end_date}` : null} />
        <Row label="Description" value={project.description} />
      </Section>

      {(client.name || client.company || client.requirements) && (
        <Section title="👤 Client">
          <Row label="Name"    value={client.name} />
          <Row label="Company" value={client.company} />
          <Row label="Email"   value={client.email} />
          <Row label="Phone"   value={client.phone} />
          <Row label="Website" value={client.website} />
          <Row label="Budget"  value={client.budget} />
          {client.requirements && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs text-slate-500 mb-1 font-medium">Requirements / Brief</p>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{client.requirements}</p>
            </div>
          )}
        </Section>
      )}

      {assignments.length > 0 && (
        <Section title={`📋 Assignments (${assignments.length})`}>
          <div className="space-y-4">
            {assignments.map((a, i) => {
              const memberNames = allUsers.filter(u => a.members.includes(u._id)).map(u => u.name)
              return (
                <div key={a._tempId} className="bg-surface-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded bg-brand-600/30 text-brand-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <p className="font-semibold text-white text-sm">{a.title}</p>
                    <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{a.department}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3">
                    <Row label="Period" value={a.start_date && a.end_date ? `${a.start_date} → ${a.end_date}` : null} />
                    <Row label="Est. Hours" value={a.estimated_hours ? `${a.estimated_hours}h` : null} />
                  </div>
                  {memberNames.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-slate-500 mb-1">Team: <span className="text-slate-300">{memberNames.join(', ')}</span></p>
                    </div>
                  )}
                  {a.tasks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">Tasks ({a.tasks.length})</p>
                      <div className="space-y-1.5">
                        {a.tasks.map((t, ti) => {
                          const assignee = allUsers.find(u => u._id === t.assigned_to)
                          return (
                            <div key={t._tempId} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <PriorityDot p={t.priority} />
                                <span className="text-slate-300">{t.title || `Task ${ti + 1}`}</span>
                              </div>
                              <div className="flex items-center gap-3 text-slate-500">
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

      <div className="bg-brand-600/10 border border-brand-500/30 rounded-2xl p-4 flex items-start gap-3">
        <Check size={18} className="text-brand-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">{editMode ? 'Ready to save changes' : 'Ready to create'}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {editMode
              ? 'Project details will be updated immediately.'
              : `This will create 1 project, ${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}, ${assignments.reduce((s, a) => s + a.tasks.length, 0)} task${assignments.reduce((s, a) => s + a.tasks.length, 0) !== 1 ? 's' : ''} and notify all assigned team members.`
            }
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN WIZARD ──────────────────────────────────────────────────────────────
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
  const [loadingData, setLoadingData] = useState(editMode)

  useEffect(() => {
    const load = async () => {
      try {
        const [m, u] = await Promise.all([
          api.get('/users?role=manager'),
          api.get('/users'),
        ])
        setManagers(m.data.data ?? [])
        setAllUsers(u.data.data ?? [])
      } catch { toast.error('Failed to load users') }
    }
    load()
  }, [])

  useEffect(() => {
    if (!editMode || !id) return
    const fetchProject = async () => {
      setLoadingData(true)
      try {
        const res = await api.get(`/projects/${id}`)
        const p = res.data.data
        setProject({
          title:       p.title       ?? '',
          description: p.description ?? '',
          manager_id:  p.manager_id?._id ?? p.manager_id ?? '',
          priority:    p.priority    ?? 'medium',
          status:      p.status      ?? 'planning',
          start_date:  formatDateForInput(p.start_date),
          end_date:    formatDateForInput(p.end_date),
        })
        setClient({
          name:         p.client_info?.name         ?? '',
          email:        p.client_info?.email        ?? '',
          phone:        p.client_info?.phone        ?? '',
          company:      p.client_info?.company      ?? '',
          website:      p.client_info?.website      ?? '',
          requirements: p.client_info?.requirements ?? '',
          budget:       p.client_info?.budget       ?? '',
        })
      } catch {
        toast.error('Failed to load project data')
      } finally {
        setLoadingData(false)
      }
    }
    fetchProject()
  }, [editMode, id])

  useEffect(() => {
    if (!editMode && user?.role === 'manager' && !project.manager_id) {
      setProject(p => ({ ...p, manager_id: user._id }))
    }
  }, [user])

  const validateStep = () => {
    if (step === 1) {
      if (!project.title.trim())       { toast.error('Project title is required');   return false }
      if (!project.description.trim()) { toast.error('Description is required');      return false }
      if (!project.manager_id)         { toast.error('Please assign a manager');      return false }
      if (!project.start_date)         { toast.error('Start date is required');        return false }
      if (!project.end_date)           { toast.error('End date is required');          return false }
      if (project.end_date <= project.start_date) { toast.error('End date must be after start date'); return false }
    }
    if (!editMode && step === 3) {
      for (const a of assignments) {
        if (!a.department)   { toast.error(`Department is required for assignment "${a.title || 'Untitled'}"`); return false }
        if (!a.title.trim()) { toast.error('Assignment title is required');            return false }
        if (!a.start_date)   { toast.error(`Start date missing for "${a.title}"`);    return false }
        if (!a.end_date)     { toast.error(`End date missing for "${a.title}"`);      return false }
        if (a.end_date <= a.start_date) { toast.error(`End date must be after start for "${a.title}"`); return false }
      }
    }
    if (!editMode && step === 4) {
      for (const a of assignments) {
        if (a.members.length === 0) { toast.error(`Select at least one member for "${a.title}"`); return false }
        for (const t of a.tasks) {
          if (!t.title.trim()) { toast.error(`Task title missing in "${a.title}"`);          return false }
          if (!t.assigned_to)  { toast.error(`Assign a user to each task in "${a.title}"`);  return false }
          if (!t.due_date)     { toast.error(`Due date missing for a task in "${a.title}"`); return false }
        }
      }
    }
    return true
  }

  const editSteps = editMode ? [1, 2, 5] : [1, 2, 3, 4, 5]
  const currentStepIndex = editSteps.indexOf(step)
  const isLastStep = step === 5

  const goNext = () => {
    if (!validateStep()) return
    if (editMode) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < editSteps.length) setStep(editSteps[nextIndex])
    } else {
      setStep(s => s + 1)
    }
  }

  const goBack = () => {
    if (editMode) {
      const prevIndex = currentStepIndex - 1
      if (prevIndex >= 0) setStep(editSteps[prevIndex])
    } else {
      setStep(s => s - 1)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep()) return
    setSubmitting(true)
    try {
      if (editMode) {
        await api.patch(`/projects/${id}`, {
          title:       project.title,
          description: project.description,
          manager_id:  project.manager_id,
          priority:    project.priority,
          status:      project.status,
          start_date:  project.start_date,
          end_date:    project.end_date,
          client_info: client,
        })
        toast.success('Project updated successfully!')
      } else {
        const cleanAssignments = assignments.map(({ _tempId, ...a }) => ({
          ...a,
          estimated_hours: a.estimated_hours ? Number(a.estimated_hours) : undefined,
          tasks: a.tasks.map(({ _tempId: _, ...t }) => ({
            ...t,
            estimated_hours: t.estimated_hours ? Number(t.estimated_hours) : undefined,
          })),
        }))
        await api.post('/assignments/wizard', {
          project: { ...project, client_info: client },
          assignments: cleanAssignments,
        })
        toast.success('Project created successfully!')
      }
      navigate(`/${user?.role}/projects`)
    } catch (e) {
      toast.error(e.response?.data?.message || (editMode ? 'Failed to update project' : 'Failed to create project'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {editMode ? 'Edit Project' : 'Create New Project'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {editMode
            ? 'Update the project details and client information.'
            : 'Complete all steps to set up the project, departments, team, and tasks.'}
        </p>
      </div>

      <StepBar current={step} />

      <div className="card min-h-96">
        {step === 1 && <Step1 data={project}     onChange={setProject}     managers={managers} />}
        {step === 2 && <Step2 data={client}      onChange={setClient} />}
        {!editMode && step === 3 && <Step3 assignments={assignments} onChange={setAssignments} />}
        {!editMode && step === 4 && <Step4 assignments={assignments} onChange={setAssignments} allUsers={allUsers} />}
        {step === 5 && <Step5 project={project} client={client} assignments={assignments} allUsers={allUsers} managers={managers} editMode={editMode} />}
      </div>

      <div className="flex items-center justify-between mt-5">
        <div>
          {currentStepIndex > 0 && (
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
              {submitting ? <Spinner size="sm" /> : <Check size={16} />}
              {submitting ? (editMode ? 'Saving…' : 'Creating…') : (editMode ? 'Save Changes' : 'Create Project')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
