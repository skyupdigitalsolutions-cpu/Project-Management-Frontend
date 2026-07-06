// new project management

import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Eye, RefreshCw,
  FolderKanban, FolderCheck, FolderClock, Users, ChevronLeft,
  ChevronDown, ChevronUp, ClipboardList, AlertCircle,
  Calendar, Hash, Building2,
  CheckCircle2, Loader2, ListTree,
  Save, X, FileText, Upload, Zap,
  UserCheck, UserX, Shuffle, Info, BadgeAlert,
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
  low:      { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#059669', dot: '#10b981', weight: 1 },
  medium:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#d97706', dot: '#f59e0b', weight: 2 },
  high:     { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  text: '#dc2626', dot: '#ef4444', weight: 3 },
  critical: { bg: 'rgba(220,38,38,0.18)',  border: 'rgba(220,38,38,0.35)',  text: '#ef4444', dot: '#dc2626', weight: 4 },
}

const ASSIGN_MODES = [
  { key: 'manual',        icon: ClipboardList, label: 'Manual Assignment',           desc: 'Add assignments & tasks yourself, optionally pick employees' },
  { key: 'auto_template', icon: Zap,           label: 'Auto-Generate from Template', desc: 'Generate tasks from a template, then optionally auto-assign them to employees' },
]

const CREATE_STEPS = [
  { n: 1, key: 'project_info', label: 'Project Info', icon: Hash },
  { n: 2, key: 'client',       label: 'Client',       icon: Building2 },
  { n: 3, key: 'team_tasks',   label: 'Team & Tasks', icon: Users },
  { n: 4, key: 'review',       label: 'Review',       icon: CheckCircle2 },
]

const PROJECT_TYPES = [
  { value: 'social_media_marketing', label: 'Social Media Marketing' },
  { value: 'mobile_app', label: 'Mobile App' },
  { value: 'graphic_design',  label: 'Graphic Design' },
  { value: 'ui_ux_design', label: 'UI UX Design' },
  { value: 'automation',  label: 'Automation' },
  { value: 'website_development',  label: 'Website Development' },
  { value: 'seo', label: 'Search Engine Optimization' },
  { value: 'email_marketing', label: 'Email Marketing' },
  { value: 'branding', label: 'Branding' },
  { value: 'machine_learning', label: 'Machine Learning' },
  { value: 'google_ads', label:'Google Ads' },
  { value: 'meta_ads', label:'Meta Ads' },
  { value: 'video_editing', label: 'Video Editing' },
  { value: 'role_based_dashboards', label: 'Role Based Dashboards' },
]

// ─── ID helpers ───────────────────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

const emptySubTask = () => ({
  id: uid(), title: '', description: '', priority: 'medium',
  due_date: '', estimated_hours: '', required_role: '', assignee_id: '',
})

const emptyTask = () => ({
  id: uid(), title: '', description: '', priority: 'medium',
  due_date: '', estimated_hours: '', required_role: '', assignee_id: '',
  requires_permission: false, permission_description: '',
  subTasks: [],
})

const emptyAssignment = () => ({
  id: uid(), department: '', title: '', description: '',
  start_date: '', end_date: '', estimated_hours: '', assignee_id: '',
  tasks: [emptyTask()],
})

const emptyProject = () => ({
  title: '', description: '', manager_id: '',
  priority: 'medium', project_types: [],
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

// ═══════════════════════════════════════════════════════════════════════════════
// SMART ASSIGNMENT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function normalize(str = '') {
  return str.toLowerCase().replace(/[\s_\-\/]+/g, ' ').trim()
}

function matchScore(a = '', b = '') {
  const na = normalize(a), nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 3
  if (na.includes(nb) || nb.includes(na)) return 2
  const wa = new Set(na.split(' '))
  const overlap = nb.split(' ').filter(w => w.length > 2 && wa.has(w)).length
  return overlap > 0 ? 1 : 0
}

// ─── Designation family gate ──────────────────────────────────────────────────
// Kept in sync with backend/services/roleMatching.js. Plain matchScore() above
// is fine for comparing two departments, but for designation-vs-required-role
// it's too loose on its own — e.g. "AI Developer" and "Full Stack Web
// Developer" would tie via the shared word "developer", letting an AI
// Developer show up as a suggested match for a backend/frontend web task.
// This gate restricts each required_role to its real designation family
// (backend/frontend web work → Backend/Frontend/Full-Stack titles only,
// never AI/ML, marketing, etc.) before matchScore is allowed to count.
const FAMILY_PATTERNS = {
  frontend:   [/frontend/, /front[\s-]?end/],
  backend:    [/backend/, /back[\s-]?end/, /server\s*developer/],
  fullstack:  [/full[\s-]?stack/],
  mobile:     [/mobile\s*developer/, /android\s*developer/, /ios\s*developer/, /app\s*developer/],
  design:     [/designer/, /\bux\b/, /ui\/ux/, /ui\s*designer/],
  qa:         [/\bqa\b/, /quality\s*assurance/, /quality\s*analyst/, /\btester\b/],
  seo:        [/\bseo\b/],
  marketing:  [/marketing/],
  content:    [/content\s*writer/, /content\s*specialist/, /content\s*creator/],
  ai_ml:      [/\bai\b/, /machine\s*learning/, /\bml\b/, /data\s*scientist/],
  automation: [/automation/],
  data:       [/data\s*analyst/, /data\s*engineer/],
  devops:     [/devops/],
  brand:      [/brand/],
  pm:         [/project\s*manager/, /program\s*manager/],
}
const ROLE_FAMILY_RULES = [
  { test: /full[\s-]?stack/,                  families: ['fullstack'] },
  { test: /backend|server|api|database/,      families: ['backend', 'fullstack'] },
  { test: /frontend|front[\s-]?end/,          families: ['frontend', 'fullstack'] },
  { test: /mobile|android|ios|app\s*dev/,     families: ['mobile', 'fullstack'] },
  { test: /devops/,                           families: ['devops', 'backend', 'fullstack'] },
  { test: /ui\/ux|ux|ui\s*design|designer/,   families: ['design'] },
  { test: /graphic/,                          families: ['design'] },
  { test: /brand/,                            families: ['brand', 'design'] },
  { test: /qa|quality|test/,                  families: ['qa'] },
  { test: /seo/,                              families: ['seo'] },
  { test: /google\s*ads/,                     families: ['marketing'] },
  { test: /email\s*marketing/,                families: ['marketing'] },
  { test: /marketing/,                        families: ['marketing'] },
  { test: /content/,                          families: ['content'] },
  { test: /automation/,                       families: ['automation'] },
  { test: /machine\s*learning|\bml\b|\bai\b/, families: ['ai_ml'] },
  { test: /data\s*analy|data\s*engineer/,     families: ['data'] },
  { test: /project\s*manager/,                families: ['pm'] },
]
function getEligibleFamilies(requiredRole = '') {
  const role = String(requiredRole || '').toLowerCase()
  if (!role) return []
  const matched = new Set()
  for (const rule of ROLE_FAMILY_RULES) if (rule.test.test(role)) rule.families.forEach(f => matched.add(f))
  return Array.from(matched)
}
function roleFamilyMatch(designation, requiredRole) {
  const families = getEligibleFamilies(requiredRole)
  const desig = String(designation || '').toLowerCase()
  if (families.length === 0) {
    // No explicit rule for this role string — fall back to permissive
    // matchScore so unusual/manually-typed roles still get a chance.
    return matchScore(designation, requiredRole) > 0
  }
  if (!desig) return false
  return families.some(fam => (FAMILY_PATTERNS[fam] || []).some(p => p.test(desig)))
}

function datesOverlap(s1, e1, s2, e2) {
  if (!s1 || !e1 || !s2 || !e2) return false
  return new Date(s1) <= new Date(e2) && new Date(s2) <= new Date(e1)
}

function scoreEmployee({ emp, requiredRole, requiredDept, priority, taskStart, taskEnd, workloads, inProjectCount }) {
  const wl         = workloads[emp._id] || { active_tasks: 0, date_ranges: [] }
  const pWeight    = PRIORITY_META[priority]?.weight ?? 2
  const totalLoad  = (wl.active_tasks || 0) + (inProjectCount || 0)
  const isBusy     = (wl.date_ranges || []).some(dr => datesOverlap(taskStart, taskEnd, dr.start, dr.end))
  const roleScore  = roleFamilyMatch(emp.designation, requiredRole) ? matchScore(emp.designation, requiredRole) : 0
  const deptScore  = matchScore(emp.department, requiredDept)
  const availScore = Math.max(0, 10 - totalLoad)
  const priorityBonus = pWeight >= 3 ? availScore * 0.5 : 0
  const busyPenalty   = isBusy ? 20 : 0
  const total = roleScore * 4 + deptScore * 2 + availScore + priorityBonus - busyPenalty
  return { emp, total, roleScore, deptScore, availScore, isBusy, totalLoad }
}

function pickBest({ candidates, requiredRole = '', requiredDept = '', priority = 'medium', taskStart = '', taskEnd = '', workloads = {}, inProjectAssigned = {} }) {
  if (!candidates.length) return null
  const scored = candidates.map(emp =>
    scoreEmployee({ emp, requiredRole, requiredDept, priority, taskStart, taskEnd, workloads, inProjectCount: inProjectAssigned[emp._id] || 0 })
  )
  scored.sort((a, b) => b.total - a.total)
  return scored[0]
}

function runAutoAssign({ assignments, employees, workloads, projectStart, projectEnd }) {
  const tracker = {}
  const bump = id => { tracker[id] = (tracker[id] || 0) + 1 }

  return assignments.map(asgn => {
    const deptPool  = employees.filter(e => matchScore(e.department, asgn.department) > 0)
    const asgnPool  = deptPool.length ? deptPool : employees
    const asgnStart = asgn.start_date || projectStart
    const asgnEnd   = asgn.end_date   || projectEnd

    const asgnResult = pickBest({ candidates: asgnPool, requiredDept: asgn.department, priority: 'medium', taskStart: asgnStart, taskEnd: asgnEnd, workloads, inProjectAssigned: tracker })
    if (asgnResult?.emp) bump(asgnResult.emp._id)

    const taskResults = asgn.tasks.map(task => {
      const roleAll   = employees.filter(e => roleFamilyMatch(e.designation, task.required_role))
      const roleDept  = roleAll.filter(e => matchScore(e.department, asgn.department) > 0)
      const pool      = roleDept.length ? roleDept : roleAll.length ? roleAll : deptPool.length ? deptPool : employees

      const taskResult = pickBest({ candidates: pool, requiredRole: task.required_role, requiredDept: asgn.department, priority: task.priority || 'medium', taskStart: task.due_date || asgnStart, taskEnd: task.due_date || asgnEnd, workloads, inProjectAssigned: tracker })
      if (taskResult?.emp) bump(taskResult.emp._id)

      const subResults = (task.subTasks || []).map(sub => {
        const subRoleAll  = employees.filter(e => roleFamilyMatch(e.designation, sub.required_role))
        const subPool     = subRoleAll.length ? subRoleAll : pool
        const subResult   = pickBest({ candidates: subPool, requiredRole: sub.required_role, requiredDept: asgn.department, priority: sub.priority || task.priority || 'medium', taskStart: sub.due_date || task.due_date, taskEnd: sub.due_date || task.due_date, workloads, inProjectAssigned: tracker })
        if (subResult?.emp) bump(subResult.emp._id)
        return { sub, result: subResult }
      })

      return { task, result: taskResult, subResults }
    })

    return { asgn, asgnResult, taskResults }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE UI
// ═══════════════════════════════════════════════════════════════════════════════

function SectionCard({ children, className = '' }) {
  return <div className={`rounded-xl ${className}`} style={cardStyle}>{children}</div>
}

function SectionHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.15)' }}>
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
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.text }}>
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
      style={ok ? { backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' } : { backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626' }}>
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{msg.text}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 text-xs">✕</button>
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

// ─── Workload bar ─────────────────────────────────────────────────────────────
function WorkloadBar({ count, max = 10 }) {
  const pct   = Math.min(100, (count / max) * 100)
  const color = pct < 40 ? '#10b981' : pct < 70 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] text-gray-400 w-12 text-right">{count} tasks</span>
    </div>
  )
}

// ─── Match reason chip ────────────────────────────────────────────────────────
function MatchChip({ roleScore, deptScore, isBusy, isFallback }) {
  if (isFallback)
    return <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.3)' }}>↩ Fallback</span>
  if (isBusy)
    return <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>⚠ Busy (best avail)</span>
  const label =
    roleScore === 3 ? '✓ Exact role' : roleScore === 2 ? '~ Role match' :
    roleScore === 1 ? '~ Partial role' : deptScore >= 2 ? '✓ Dept match' :
    deptScore === 1 ? '~ Dept partial' : '↩ Best available'
  const c = roleScore >= 2 ? { bg: 'rgba(16,185,129,0.09)', tx: '#059669', bd: 'rgba(16,185,129,0.3)' } :
            deptScore >= 1 ? { bg: 'rgba(59,130,246,0.08)', tx: '#2563eb', bd: 'rgba(59,130,246,0.25)' } :
                             { bg: 'rgba(107,114,128,0.08)', tx: '#6b7280', bd: 'rgba(107,114,128,0.2)' }
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.bg, color: c.tx, border: `1px solid ${c.bd}` }}>{label}</span>
}

// ─── Employee avatar ──────────────────────────────────────────────────────────
function EmpAvatar({ emp, size = 'sm' }) {
  if (!emp) return null
  const initials = (emp.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const cls = size === 'lg' ? 'w-8 h-8 text-xs' : 'w-5 h-5 text-[9px]'
  return <span className={`${cls} rounded-full bg-blue-500 text-white font-bold flex items-center justify-center flex-shrink-0`}>{initials}</span>
}

// ─── Availability badge ───────────────────────────────────────────────────────
function AvailBadge({ load }) {
  return load >= 8
    ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>Busy</span>
    : load >= 5
    ? <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.2)' }}>Moderate</span>
    : <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>Available</span>
}

// ─── Wizard Tabs ──────────────────────────────────────────────────────────────
function WizardTabs({ steps, currentStep, onStepClick, completedSteps }) {
  return (
    <div className="flex items-stretch rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: `1px solid ${T.cardBorder}` }}>
      {steps.map((step, idx) => {
        const Icon    = step.icon
        const done    = completedSteps.includes(step.n)
        const active  = currentStep === step.n
        const clickable = done || step.n < currentStep
        return (
          <button key={step.key} type="button" onClick={() => clickable && onStepClick(step.n)} disabled={!clickable && !active}
            className={['flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all flex-1 justify-center relative',
              active ? 'text-white' : done && !active ? 'text-emerald-600 hover:text-gray-900 cursor-pointer' : 'text-gray-400 cursor-not-allowed',
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
      <label className="flex items-center gap-1 text-xs font-medium text-gray-600">Reference Document <span className="text-gray-400 font-normal">(optional)</span></label>
      <div onClick={() => fileRef.current?.click()} className="cursor-pointer rounded-xl border-2 border-dashed transition-all"
        style={docFile ? { borderColor: 'rgba(59,130,246,0.4)', backgroundColor: 'rgba(59,130,246,0.04)' } : { borderColor: 'rgba(0,0,0,0.12)', backgroundColor: 'rgba(0,0,0,0.01)' }}>
        {docFile ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <FileText size={16} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{docFile.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{(docFile.size / 1024).toFixed(0)} KB · Click to replace</p>
            </div>
            <button type="button" onClick={e => { e.stopPropagation(); setDocFile(null); if (fileRef.current) fileRef.current.value = '' }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-5 px-4 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}>
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
          const f = e.target.files?.[0]; if (!f) return
          if (f.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB'); return }
          setDocFile(f)
        }} />
      <p className="text-xs text-gray-400">Employees will see a "View Reference Document" button on their tasks once uploaded.</p>
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
          <input value={project.title} onChange={e => updateProject('title', e.target.value)} placeholder="e.g. Company Website Redesign" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Description" required>
          <textarea value={project.description} onChange={e => updateProject('description', e.target.value)} rows={3} placeholder="Brief project overview..." className={inputCls} style={inputStyle} />
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
                      onChange={e => { const cur = project.project_types || []; updateProject('project_types', e.target.checked ? [...cur, pt.value] : cur.filter(v => v !== pt.value)) }} />
                    <span className={`text-xs ${checked ? 'text-gray-900' : 'text-gray-500'}`}>{pt.label}</span>
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

// ─── Step 2: Client ───────────────────────────────────────────────────────────
function ClientStep({ clientId, setClientId, clients, clientsLoading }) {
  const selected = clients.find(c => c._id === clientId) || null
  return (
    <SectionCard>
      <SectionHeader icon={Building2} title="Link Client" subtitle="Select the client this project belongs to" />
      <div className="p-5 space-y-5">
        <Field label="Client" required hint="Select the company this project is being built for">
          {clientsLoading ? (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading clients…</div>
          ) : clients.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
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
              <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-blue-600" style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                {(selected.companyName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{selected.companyName}</p>
                {selected.industry && <p className="text-xs text-blue-500 mt-0.5">{selected.industry}</p>}
              </div>
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
            </div>
            <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:divide-x divide-gray-100">
              {selected.name  && <div className="px-4 py-2.5"><p className="text-xs text-gray-400 mb-0.5">Contact</p><p className="text-xs text-gray-700 font-medium">{selected.name}</p></div>}
              {selected.email && <div className="px-4 py-2.5"><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="text-xs text-gray-700 font-medium truncate">{selected.email}</p></div>}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Sub-Task Card ────────────────────────────────────────────────────────────
function SubTaskCard({ sub, subIdx, total, onRemove, onUpdate, employees = [] }) {
  const roleMatches = sub.required_role ? employees.filter(e => roleFamilyMatch(e.designation, sub.required_role)) : []
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Sub-Task {subIdx + 1}</span>
        {total > 0 && <DangerBtn onClick={onRemove}><X size={10} /> Remove</DangerBtn>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Sub-Task Title" required><input value={sub.title} onChange={e => onUpdate('title', e.target.value)} placeholder="e.g. Write copy" className={inputCls} style={inputStyle} /></Field>
        <Field label="Required Role"><input value={sub.required_role} onChange={e => onUpdate('required_role', e.target.value)} placeholder="e.g. copywriter" className={inputCls} style={inputStyle} /></Field>
        <Field label="Priority">
          <select value={sub.priority} onChange={e => onUpdate('priority', e.target.value)} className={inputCls} style={inputStyle}>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Due Date"><input type="date" value={sub.due_date} onChange={e => onUpdate('due_date', e.target.value)} className={inputCls} style={inputStyle} /></Field>
        <div className="sm:col-span-2">
          <Field label="Assign Employee">
            <select value={sub.assignee_id} onChange={e => onUpdate('assignee_id', e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">— Unassigned —</option>
              {roleMatches.length > 0 && <optgroup label="✓ Role Match">{roleMatches.map(e => <option key={e._id} value={e._id}>{e.name} · {e.designation}</option>)}</optgroup>}
              {employees.filter(e => !roleMatches.find(r => r._id === e._id)).map(e => <option key={e._id} value={e._id}>{e.name} · {e.designation} ({e.department})</option>)}
            </select>
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, tIdx, aIdx, total, onRemove, onUpdate, onAddSubTask, onRemoveSubTask, onUpdateSubTask, employees = [], deptEmployees = [] }) {
  const [showSubs, setShowSubs] = useState(false)
  const subCount  = (task.subTasks || []).length
  const roleMatches = task.required_role ? employees.filter(e => roleFamilyMatch(e.designation, task.required_role)) : []
  const pool      = roleMatches.length > 0 ? roleMatches : deptEmployees.length > 0 ? deptEmployees : []
  const assigned  = employees.find(e => e._id === task.assignee_id)
  const mismatch  = assigned && task.required_role && !roleFamilyMatch(assigned.designation, task.required_role)

  return (
    <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Task {tIdx + 1}</span>
          {assigned && <span className="flex items-center gap-1 text-[10px] text-blue-600 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100"><EmpAvatar emp={assigned} /> {assigned.name}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowSubs(s => !s)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium" style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1' }}>
            <ListTree size={11} />{subCount > 0 ? `${subCount} Sub-Task${subCount > 1 ? 's' : ''}` : 'Sub-Tasks'}{showSubs ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {total > 1 && <DangerBtn onClick={onRemove}><Trash2 size={10} /> Remove</DangerBtn>}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Task Title" required><input value={task.title} onChange={e => onUpdate('title', e.target.value)} placeholder="e.g. Design Homepage" className={inputCls} style={inputStyle} /></Field>
        <Field label="Required Role"><input value={task.required_role} onChange={e => onUpdate('required_role', e.target.value)} placeholder="e.g. frontend developer" className={inputCls} style={inputStyle} /></Field>
        <div className="sm:col-span-2"><Field label="Task Description"><textarea value={task.description} onChange={e => onUpdate('description', e.target.value)} rows={2} placeholder="Describe what this task involves..." className={inputCls} style={inputStyle} /></Field></div>
        <Field label="Priority">
          <select value={task.priority} onChange={e => onUpdate('priority', e.target.value)} className={inputCls} style={inputStyle}>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Due Date" required><input type="date" value={task.due_date} onChange={e => onUpdate('due_date', e.target.value)} className={inputCls} style={inputStyle} /></Field>
        <Field label="Estimated Hours"><input type="number" min="0" value={task.estimated_hours} onChange={e => onUpdate('estimated_hours', e.target.value)} placeholder="e.g. 8" className={inputCls} style={inputStyle} /></Field>
        <Field label="Admin Permission Required">
          <div className="flex items-center gap-3 h-[42px] px-3.5 rounded-lg cursor-pointer bg-white border border-gray-200">
            <input type="checkbox" id={`perm-${aIdx}-${tIdx}`} checked={task.requires_permission} onChange={e => onUpdate('requires_permission', e.target.checked)} className="w-4 h-4 accent-blue-500 flex-shrink-0 cursor-pointer" />
            <label htmlFor={`perm-${aIdx}-${tIdx}`} className="text-xs text-gray-500 cursor-pointer select-none">Requires admin approval to start</label>
          </div>
        </Field>
        {task.requires_permission && (
          <div className="sm:col-span-2"><Field label="Permission Details"><input value={task.permission_description} onChange={e => onUpdate('permission_description', e.target.value)} placeholder="Describe what access or approval is needed..." className={inputCls} style={inputStyle} /></Field></div>
        )}
        {employees.length > 0 && (
          <div className="sm:col-span-2">
            <Field label="Assign Employee">
              <select value={task.assignee_id} onChange={e => onUpdate('assignee_id', e.target.value)} className={inputCls} style={inputStyle}>
                <option value="">— Unassigned —</option>
                {pool.length > 0 && <optgroup label={roleMatches.length > 0 ? '✓ Role Match' : '✓ Department Match'}>{pool.map(e => <option key={e._id} value={e._id}>{e.name} · {e.designation}</option>)}</optgroup>}
                {employees.filter(e => !pool.find(p => p._id === e._id)).map(e => <option key={e._id} value={e._id}>{e.name} · {e.designation} ({e.department})</option>)}
              </select>
              {mismatch && <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1"><AlertCircle size={9} /> Designation doesn't match required role</p>}
            </Field>
          </div>
        )}
      </div>
      {showSubs && (
        <div className="px-4 pb-4 space-y-3 border-t border-indigo-100">
          <div className="flex items-center justify-between pt-3">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5"><ListTree size={12} /> Sub-Tasks ({subCount})</p>
            <button type="button" onClick={onAddSubTask} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366f1' }}>+ Add Sub-Task</button>
          </div>
          {subCount === 0 ? <p className="text-xs text-gray-400 italic text-center py-3">No sub-tasks yet.</p> : (
            <div className="space-y-2">
              {(task.subTasks || []).map((sub, si) => (
                <SubTaskCard key={sub.id} sub={sub} subIdx={si} total={subCount} employees={employees}
                  onRemove={() => onRemoveSubTask(si)} onUpdate={(f, v) => onUpdateSubTask(si, f, v)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Assignment Card ──────────────────────────────────────────────────────────
function AssignmentCard({ asgn, aIdx, total, onUpdate, onRemove, onAddTask, onRemoveTask, onUpdateTask, onAddSubTask, onRemoveSubTask, onUpdateSubTask, employees = [] }) {
  const [collapsed, setCollapsed] = useState(false)
  const deptEmployees = asgn.department ? employees.filter(e => matchScore(e.department, asgn.department) > 0) : []
  const assigned = employees.find(e => e._id === asgn.assignee_id)

  return (
    <SectionCard>
      <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none" style={{ borderBottom: collapsed ? 'none' : `1px solid ${T.cardBorder}` }} onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-blue-600" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>{aIdx + 1}</div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{asgn.title || <span className="text-gray-400 font-normal italic">Untitled Assignment</span>}</p>
            <p className="text-xs text-gray-400 mt-0.5">{asgn.tasks.length} task{asgn.tasks.length !== 1 ? 's' : ''}{asgn.department ? ` · ${asgn.department}` : ''}{assigned ? ` · 👤 ${assigned.name}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {total > 1 && <DangerBtn onClick={onRemove}><Trash2 size={11} /> Remove</DangerBtn>}
          <button onClick={() => setCollapsed(c => !c)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 bg-gray-50">{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Assignment Title" required><input value={asgn.title} onChange={e => onUpdate('title', e.target.value)} placeholder="e.g. Frontend Development Phase" className={inputCls} style={inputStyle} /></Field>
            <Field label="Department" required><input value={asgn.department} onChange={e => onUpdate('department', e.target.value)} placeholder="e.g. Web Development" className={inputCls} style={inputStyle} /></Field>
            <div className="sm:col-span-2"><Field label="Description"><textarea value={asgn.description} onChange={e => onUpdate('description', e.target.value)} rows={2} placeholder="Brief description of this assignment's scope..." className={inputCls} style={inputStyle} /></Field></div>
            <Field label="Start Date" required><input type="date" value={asgn.start_date} onChange={e => onUpdate('start_date', e.target.value)} className={inputCls} style={inputStyle} /></Field>
            <Field label="End Date" required><input type="date" value={asgn.end_date} onChange={e => onUpdate('end_date', e.target.value)} className={inputCls} style={inputStyle} /></Field>
            {employees.length > 0 && (
              <div className="sm:col-span-2">
                <Field label="Lead Employee" hint="Primary person responsible for this assignment">
                  <select value={asgn.assignee_id} onChange={e => onUpdate('assignee_id', e.target.value)} className={inputCls} style={inputStyle}>
                    <option value="">— Unassigned —</option>
                    {deptEmployees.length > 0 && <optgroup label="✓ Dept Match">{deptEmployees.map(e => <option key={e._id} value={e._id}>{e.name} · {e.designation}</option>)}</optgroup>}
                    {employees.filter(e => !deptEmployees.find(d => d._id === e._id)).map(e => <option key={e._id} value={e._id}>{e.name} · {e.designation} ({e.department})</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tasks ({asgn.tasks.length})</p>
              <button type="button" onClick={onAddTask} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>+ Add Task</button>
            </div>
            <div className="space-y-3">
              {asgn.tasks.map((task, tIdx) => (
                <TaskCard key={task.id} task={task} tIdx={tIdx} aIdx={aIdx} total={asgn.tasks.length}
                  employees={employees} deptEmployees={deptEmployees}
                  onRemove={() => onRemoveTask(tIdx)} onUpdate={(f, v) => onUpdateTask(tIdx, f, v)}
                  onAddSubTask={() => onAddSubTask(tIdx)} onRemoveSubTask={si => onRemoveSubTask(tIdx, si)}
                  onUpdateSubTask={(si, f, v) => onUpdateSubTask(tIdx, si, f, v)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Team Member Picker ────────────────────────────────────────────────────────
// Lets the admin choose the actual pool of employees eligible for this
// project before generating/auto-assigning tasks — without this, template
// auto-assign considers every active employee company-wide by role match,
// which isn't always what's wanted (e.g. only 2 of 5 Full Stack Web
// Developers are actually free for this project).
function TeamMemberPicker({ employees = [], selectedIds = [], onChange }) {
  const [search, setSearch] = useState('')
  const filtered = employees.filter(e =>
    !search || normalize(`${e.name} ${e.designation} ${e.department}`).includes(normalize(search))
  )
  const toggle = (id) => onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  const selectAll = () => onChange(employees.map(e => e._id))
  const clearAll  = () => onChange([])

  return (
    <SectionCard>
      <SectionHeader
        icon={Users}
        title="Select Team for This Project"
        subtitle="Only these people will be considered when tasks are auto-generated / auto-assigned"
        right={
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap" style={{ backgroundColor: selectedIds.length ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.05)', color: selectedIds.length ? '#059669' : '#9ca3af', border: `1px solid ${selectedIds.length ? 'rgba(16,185,129,0.25)' : 'rgba(0,0,0,0.1)'}` }}>
            {selectedIds.length} selected
          </span>
        }
      />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, or department…" className={inputCls} style={inputStyle} />
          <button type="button" onClick={selectAll}
            className="text-xs px-3 py-2.5 rounded-lg font-medium whitespace-nowrap" style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>
            Select All
          </button>
          <button type="button" onClick={clearAll}
            className="text-xs px-3 py-2.5 rounded-lg font-medium whitespace-nowrap" style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)', color: '#6b7280' }}>
            Clear
          </button>
        </div>

        {employees.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">No employees found.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">No matches for "{search}".</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {filtered.map(e => {
              const checked = selectedIds.includes(e._id)
              return (
                <div key={e._id} onClick={() => toggle(e._id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all select-none"
                  style={checked
                    ? { backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.3)' }
                    : { backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: checked ? T.accent : 'rgba(0,0,0,0.05)', border: checked ? `1px solid ${T.accent}` : '1px solid rgba(0,0,0,0.2)' }}>
                    {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <EmpAvatar emp={e} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{e.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{e.designation} · {e.department}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {selectedIds.length === 0 && (
          <p className="text-[11px] text-amber-600 flex items-center gap-1.5 pt-1">
            <AlertCircle size={11} className="flex-shrink-0" />
            No one selected yet — auto-assign will consider every active employee company-wide (matched by role) instead of just this project's team.
          </p>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Template Auto-Generate Panel ─────────────────────────────────────────────
function TemplateAutoGeneratePanel({ selectedTypes, onApplyTasks, assignments, projectStart, projectEnd, onApplyAutoAssign, employees = [], selectedTeamIds = [], onTeamChange }) {
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState(null)
  const [applied, setApplied] = useState(false)
  const [showAutoAssign, setShowAutoAssign] = useState(false)

  // Convert "2 days" / "3 day" → hours (8h per day). Falls back to blank.
  const durationToHours = (raw) => {
    if (!raw) return ''
    const n = parseFloat(String(raw))
    if (Number.isNaN(n)) return ''
    return /day/i.test(String(raw)) ? n * 8 : n
  }

  const handleGenerate = async () => {
    if (!selectedTypes?.length) { toast.error('Select at least one project type first'); return }
    setLoading(true)
    try {
      // 1. Try the admin-defined DB template for the FIRST selected type.
      //    This carries pre-assigned employees per task.
      try {
        const { data: tpl } = await api.get('/task-templates/for-project', {
          params: { projectType: selectedTypes[0] },
        })
        const tplTasks = tpl.data?.tasks || []
        if (tplTasks.length > 0) {
          const tasks = tplTasks.map(t => ({
            title:           t.title,
            description:     t.description || '',
            required_role:   t.required_role || '',
            assignee_id:     t.assignee_id || '',
            priority:        (t.priority || 'medium').toLowerCase(),
            estimated_hours: t.estimated_hours || '',
            subtasks:        (t.subTasks || []).map(s => ({ title: s.title })),
            phase:           tpl.data?.name || 'Template',
          }))
          setPlan(tasks); setApplied(false); setShowAutoAssign(false)
          toast.success(`Loaded "${tpl.data.name}" template`)
          return
        }
      } catch (tplErr) {
        // 404 = no template for this type → fall through to AI generator.
        if (tplErr.response && tplErr.response.status !== 404) throw tplErr
      }

      // 2. Fallback: built-in AI plan generator (no template defined yet).
      const { data } = await api.post('/projects/generate-plan', {
        projectTypes: selectedTypes,
        description: '',
      })
      const phases = data.data?.phases || []
      const tasks = phases.flatMap(ph => (ph.tasks || []).map(t => ({
        title: t.title,
        required_role: t.role || '',
        priority: (t.priority || 'medium').toLowerCase(),
        estimated_hours: durationToHours(t.duration),
        phase: ph.name,
      })))
      setPlan(tasks); setApplied(false); setShowAutoAssign(false)
      if (tasks.length === 0) toast('No tasks generated for these types', { icon: '⚠️' })
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to generate plan') }
    finally { setLoading(false) }
  }

  const handleApply = () => {
    if (!plan?.length) return
    const wizardTasks = plan.map(t => ({
      ...emptyTask(), title: t.title || t.name || '', description: t.description || '',
      priority: t.priority || 'medium', estimated_hours: t.estimated_hours || t.estimatedHours || '',
      required_role: t.required_role || t.designation || '',
      // Pre-assigned employee from the template (empty for AI-generated plans).
      assignee_id: t.assignee_id || '',
      subTasks: (t.subtasks || []).map(st => ({ ...emptySubTask(), title: st.title || st.name || '' })),
    }))
    onApplyTasks(wizardTasks); setApplied(true)
    toast.success(`${wizardTasks.length} tasks applied from template`)
  }

  return (
    <div className="space-y-4">
      <TeamMemberPicker employees={employees} selectedIds={selectedTeamIds} onChange={onTeamChange} />

      <SectionCard>
        <SectionHeader icon={Zap} title="Auto-Generate from Template" subtitle="Auto-fill tasks based on the selected project type(s)" />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={handleGenerate} disabled={loading || !selectedTypes?.length}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90" style={{ backgroundColor: '#6366f1' }}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}{loading ? 'Generating…' : 'Generate Task Plan'}
            </button>
            {plan && (
              <button type="button" onClick={handleApply} disabled={applied}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-90"
                style={applied ? { backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' } : { backgroundColor: '#10b981', color: '#fff' }}>
                {applied ? <><CheckCircle2 size={13} /> Applied!</> : <><Save size={13} /> Apply to Tasks</>}
              </button>
            )}
          </div>
          {plan?.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {plan.map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-white border border-gray-100">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{t.title || t.name}</p><p className="text-xs text-gray-400">{t.required_role || t.designation}</p></div>
                  <PriorityDot priority={t.priority || 'medium'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {applied && (
        <div className="rounded-xl overflow-hidden border border-indigo-200" style={{ backgroundColor: 'rgba(99,102,241,0.03)' }}>
          <button
            type="button"
            onClick={() => setShowAutoAssign(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-indigo-50/50"
            style={{ borderBottom: showAutoAssign ? '1px solid rgba(99,102,241,0.15)' : 'none' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <UserCheck size={13} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Auto-Assign Generated Tasks</p>
                <p className="text-xs text-gray-400 mt-0.5">Match employees to the generated tasks & sub-tasks by role, department & availability</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}>
                Optional
              </span>
              {showAutoAssign ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
            </div>
          </button>

          {showAutoAssign && (
            <div className="p-1">
              <SmartAutoAssignPanel
                assignments={assignments}
                projectStart={projectStart}
                projectEnd={projectEnd}
                onApply={onApplyAutoAssign}
                restrictToIds={selectedTeamIds}
                embedded
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART AUTO-ASSIGN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function SmartAutoAssignPanel({ assignments, projectStart, projectEnd, onApply, embedded = false, restrictToIds = [] }) {
  const [allPool,    setAllPool]    = useState([])
  const [workloads,  setWorkloads]  = useState({})
  const [loading,    setLoading]    = useState(false)
  const [results,    setResults]    = useState(null)
  const [overrides,  setOverrides]  = useState({})
  const [applied,    setApplied]    = useState(false)
  const [empSearch,  setEmpSearch]  = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/users?role=employee&limit=500'),
      api.get('/users?role=manager&limit=500'),
      api.get('/assignments/workload').catch(() => ({ data: { data: {} } })),
    ]).then(([eRes, mRes, wRes]) => {
      const pool = [...(eRes.data.data || []), ...(mRes.data.data || [])]
      const seen = new Set()
      setAllPool(pool.filter(u => u && !seen.has(u._id) && seen.add(u._id)))
      setWorkloads(wRes.data?.data || {})
    }).catch(() => toast.error('Failed to load employee data'))
      .finally(() => setLoading(false))
  }, [])

  // Restrict to the project's selected team, if one was picked. Derived (not
  // stored) so toggling the team-member checkboxes updates this instantly
  // without re-fetching from the API.
  const employees = restrictToIds.length > 0
    ? allPool.filter(u => restrictToIds.includes(u._id))
    : allPool

  const handleRun = () => {
    if (!employees.length) {
      toast.error(restrictToIds.length > 0 ? 'None of the selected team members were found — check the team selection above' : 'No employees loaded')
      return
    }
    const hasContent = assignments.some(a => a.title || a.tasks.some(t => t.title))
    if (!hasContent) { toast('Fill in at least one assignment title first', { icon: '⚠️' }); return }
    const res = runAutoAssign({ assignments, employees, workloads, projectStart, projectEnd })
    setResults(res); setOverrides({}); setApplied(false)
  }

  const resolve = (ai, ti, si) => {
    const key = si !== undefined ? `${ai}-${ti}-${si}` : ti !== undefined ? `${ai}-${ti}` : `${ai}`
    const ovId = overrides[key]
    if (ovId !== undefined) return employees.find(e => e._id === ovId) || null
    if (!results) return null
    const r = results[ai]
    if (!r) return null
    if (si !== undefined) return r.taskResults[ti]?.subResults[si]?.result?.emp || null
    if (ti !== undefined) return r.taskResults[ti]?.result?.emp || null
    return r.asgnResult?.emp || null
  }

  const setOv = (key, empId) => { setOverrides(p => ({ ...p, [key]: empId })); setApplied(false) }

  const handleApply = () => {
    if (!results) return
    const updated = assignments.map((asgn, ai) => ({
      ...asgn,
      assignee_id: resolve(ai)?._id || '',
      tasks: asgn.tasks.map((task, ti) => ({
        ...task,
        assignee_id: resolve(ai, ti)?._id || '',
        subTasks: (task.subTasks || []).map((sub, si) => ({ ...sub, assignee_id: resolve(ai, ti, si)?._id || '' })),
      })),
    }))
    onApply(updated); setApplied(true)
    toast.success('Smart assignments applied! Review in the assignments section below.')
  }

  const stats = results ? {
    asgnFilled: results.filter(r => r.asgnResult?.emp).length,
    taskTotal:  results.reduce((n, r) => n + r.taskResults.length, 0),
    taskFilled: results.reduce((n, r) => n + r.taskResults.filter(tr => tr.result?.emp).length, 0),
    busyCount:  results.reduce((n, r) => n + r.taskResults.filter(tr => tr.result?.isBusy).length, 0),
    fallback:   results.reduce((n, r) => n + r.taskResults.filter(tr => tr.result && tr.result.roleScore === 0 && tr.result.deptScore === 0).length, 0),
  } : null

  const filteredEmps = employees.filter(e => !empSearch || normalize(e.name + ' ' + e.designation).includes(normalize(empSearch)))

  const content = (
    <div>
      <SectionHeader
        icon={UserCheck}
        title={embedded ? undefined : 'Smart Auto-Assign'}
        subtitle={embedded ? undefined : 'Match employees by role, department, priority & live availability'}
        right={
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleRun} disabled={loading || !employees.length}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90" style={{ backgroundColor: '#6366f1' }}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Shuffle size={13} />}{loading ? 'Loading…' : 'Run Auto-Assign'}
            </button>
            {results && (
              <button type="button" onClick={handleApply} disabled={applied}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-90"
                style={applied ? { backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' } : { backgroundColor: '#10b981', color: '#fff' }}>
                {applied ? <><CheckCircle2 size={13} /> Applied!</> : <><Save size={13} /> Apply All</>}
              </button>
            )}
          </div>
        }
      />

      <div className="p-5 space-y-5">
        <div className="rounded-xl px-4 py-3.5 space-y-2" style={{ backgroundColor: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5"><Info size={12} /> Scoring algorithm</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {[
              ['Role match ×4',      'designation ↔ required_role (fuzzy, exact=3, substr=2, word=1)'],
              ['Dept match ×2',      'department ↔ assignment department (same fuzzy scale)'],
              ['Availability 0-10',  'inverse of total active task count — fewer tasks = higher score'],
              ['Priority boost',     'high/critical tasks give extra reward to least-loaded candidates'],
              ['Busy penalty −20',   'date-range overlap with existing tasks heavily penalises candidates'],
              ['Cascade fallback',   'if penalised candidate still wins, next best is always shown instead'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 text-[11px] text-gray-500">
                <span className="text-indigo-500 font-semibold flex-shrink-0 w-32">{k}</span>
                <span className="leading-tight">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {employees.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Users size={11} /> {employees.length} Employees</p>
              <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Filter…" className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 outline-none focus:ring-1 focus:ring-blue-400 w-36" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
              {filteredEmps.map(e => {
                const wl   = workloads[e._id] || {}
                const load = wl.active_tasks || 0
                return (
                  <div key={e._id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-gray-100">
                    <EmpAvatar emp={e} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{e.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{e.designation} · {e.department}</p>
                      <WorkloadBar count={load} />
                    </div>
                    <AvailBadge load={load} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {results && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Assignments',   value: `${stats.asgnFilled}/${results.length}`, color: '#6366f1' },
                { label: 'Tasks assigned', value: `${stats.taskFilled}/${stats.taskTotal}`, color: '#10b981' },
                { label: 'Busy fallback',  value: stats.busyCount,  color: '#f59e0b' },
                { label: 'Role fallback',  value: stats.fallback,   color: '#ef4444' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl px-3 py-2.5 text-center" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}30` }}>
                  <p className="text-base font-bold" style={{ color }}>{value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {results.map((r, ai) => (
              <div key={r.asgn.id} className="rounded-xl overflow-hidden border border-gray-200">
                <div className="flex items-center gap-3 px-4 py-2.5" style={{ backgroundColor: 'rgba(59,130,246,0.04)', borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
                  <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{ai + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{r.asgn.title || 'Untitled'}{r.asgn.department && <span className="text-gray-400 font-normal"> · {r.asgn.department}</span>}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => { const emp = resolve(ai); return emp
                      ? <span className="flex items-center gap-1 text-[10px] text-gray-700"><EmpAvatar emp={emp} /> {emp.name}</span>
                      : <span className="text-[10px] text-red-400 flex items-center gap-1"><UserX size={10} /> Unassigned</span>
                    })()}
                    <select value={overrides[`${ai}`] ?? (r.asgnResult?.emp?._id || '')} onChange={e => setOv(`${ai}`, e.target.value)}
                      className="text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white outline-none focus:ring-1 focus:ring-blue-400 max-w-[120px]">
                      <option value="">— Lead —</option>
                      {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {r.taskResults.map((tr, ti) => {
                    const taskEmp    = resolve(ai, ti)
                    const ovKey      = `${ai}-${ti}`
                    const isFallback = !overrides[ovKey] && tr.result && tr.result.roleScore === 0 && tr.result.deptScore === 0
                    const rs         = overrides[ovKey] ? { roleScore: 0, deptScore: 0, isBusy: false } : { roleScore: tr.result?.roleScore || 0, deptScore: tr.result?.deptScore || 0, isBusy: tr.result?.isBusy }

                    return (
                      <div key={tr.task.id}>
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0 ml-2" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{tr.task.title || 'Untitled'}</p>
                            {tr.task.required_role && <p className="text-[10px] text-gray-400">Role: {tr.task.required_role}</p>}
                          </div>
                          <PriorityDot priority={tr.task.priority || 'medium'} />
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {taskEmp ? (
                              <div className="flex items-center gap-1.5">
                                <EmpAvatar emp={taskEmp} />
                                <div>
                                  <p className="text-[10px] text-gray-700 font-medium max-w-[72px] truncate">{taskEmp.name}</p>
                                  <p className="text-[9px] text-gray-400 max-w-[72px] truncate">{taskEmp.designation}</p>
                                </div>
                                <MatchChip {...rs} isFallback={isFallback} />
                              </div>
                            ) : (
                              <span className="text-[10px] text-red-400 flex items-center gap-1"><UserX size={10} /> Unassigned</span>
                            )}
                            <select value={overrides[ovKey] ?? (tr.result?.emp?._id || '')} onChange={e => setOv(ovKey, e.target.value)}
                              className="text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white outline-none focus:ring-1 focus:ring-blue-400 max-w-[120px]">
                              <option value="">— Override —</option>
                              {tr.task.required_role && employees.filter(e => roleFamilyMatch(e.designation, tr.task.required_role)).length > 0 && (
                                <optgroup label="✓ Role Match">
                                  {employees.filter(e => roleFamilyMatch(e.designation, tr.task.required_role)).map(e => <option key={e._id} value={e._id}>{e.name} · {e.designation}</option>)}
                                </optgroup>
                              )}
                              <optgroup label="All Employees">
                                {employees.map(e => <option key={e._id} value={e._id}>{e.name} · {e.designation}</option>)}
                              </optgroup>
                            </select>
                          </div>
                        </div>

                        {(tr.subResults || []).map((sr, si) => {
                          const subKey = `${ai}-${ti}-${si}`
                          const subEmp = resolve(ai, ti, si)
                          return (
                            <div key={sr.sub.id} className="flex items-center gap-3 px-4 py-2" style={{ backgroundColor: 'rgba(99,102,241,0.02)', borderTop: '1px solid rgba(99,102,241,0.07)' }}>
                              <span className="w-1 h-1 rounded-full bg-indigo-200 flex-shrink-0 ml-6" />
                              <div className="flex-1 min-w-0"><p className="text-[10px] text-gray-500 truncate">{sr.sub.title || 'Untitled sub-task'}</p></div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {subEmp ? <span className="text-[10px] text-indigo-600 flex items-center gap-1"><EmpAvatar emp={subEmp} /> {subEmp.name}</span> : <span className="text-[9px] text-red-300">Unassigned</span>}
                                <select value={overrides[subKey] ?? (sr.result?.emp?._id || '')} onChange={e => setOv(subKey, e.target.value)}
                                  className="text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white outline-none max-w-[110px]">
                                  <option value="">— Override —</option>
                                  {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                                </select>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={handleRun} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-100">
                <Shuffle size={11} /> Re-run
              </button>
              <p className="flex-1 text-xs text-gray-400">Override individual picks above, then click <strong>Apply All</strong> to save.</p>
              <button type="button" onClick={handleApply} disabled={applied}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-90 text-white"
                style={{ backgroundColor: applied ? '#10b981' : T.accent }}>
                {applied ? <><CheckCircle2 size={13} /> Applied!</> : <><Save size={13} /> Apply All</>}
              </button>
            </div>
          </div>
        )}

        {!results && !loading && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <UserCheck size={20} className="text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">Click "Run Auto-Assign" to start matching</p>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              The engine scores every employee by role fit, department, current workload, and task priority —
              then cascades to the next best available person when someone is busy.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading employee data…
          </div>
        )}
      </div>
    </div>
  )

  return embedded ? content : <SectionCard>{content}</SectionCard>
}

// ─── Step 3: Team & Tasks ─────────────────────────────────────────────────────
function TeamAndTasksStep({
  assignMode, setAssignMode,
  assignments, addAssignment, removeAssignment, updateAssignment,
  addTask, removeTask, updateTask,
  addSubTask, removeSubTask, updateSubTask,
  selectedProjectTypes, onApplyTemplateTasks, onApplyAutoAssign,
  projectStart, projectEnd, employees,
  selectedTeamIds, setSelectedTeamIds,
}) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader icon={Users} title="Team & Tasks" subtitle="Choose how to assign work for this project" />
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ASSIGN_MODES.map(m => {
              const Icon = m.icon; const active = assignMode === m.key
              return (
                <button key={m.key} type="button" onClick={() => setAssignMode(m.key)}
                  className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-left transition-all"
                  style={active ? { backgroundColor: 'rgba(59,130,246,0.08)', border: '2px solid rgba(59,130,246,0.4)' } : { backgroundColor: 'rgba(0,0,0,0.02)', border: '2px solid rgba(0,0,0,0.08)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: active ? 'rgba(59,130,246,0.12)' : 'rgba(0,0,0,0.05)' }}>
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

      {assignMode === 'auto_template' && <TemplateAutoGeneratePanel
        selectedTypes={selectedProjectTypes}
        onApplyTasks={onApplyTemplateTasks}
        assignments={assignments}
        projectStart={projectStart}
        projectEnd={projectEnd}
        onApplyAutoAssign={onApplyAutoAssign}
        employees={employees}
        selectedTeamIds={selectedTeamIds}
        onTeamChange={setSelectedTeamIds}
      />}

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
            <AssignmentCard key={asgn.id} asgn={asgn} aIdx={aIdx} total={assignments.length} employees={employees}
              onUpdate={(f, v) => updateAssignment(aIdx, f, v)} onRemove={() => removeAssignment(aIdx)}
              onAddTask={() => addTask(aIdx)} onRemoveTask={tIdx => removeTask(aIdx, tIdx)} onUpdateTask={(tIdx, f, v) => updateTask(aIdx, tIdx, f, v)}
              onAddSubTask={tIdx => addSubTask(aIdx, tIdx)} onRemoveSubTask={(tIdx, si) => removeSubTask(aIdx, tIdx, si)} onUpdateSubTask={(tIdx, si, f, v) => updateSubTask(aIdx, tIdx, si, f, v)} />
          ))}
        </div>
      )}

      {assignMode === 'auto_template' && assignments.some(a => a.tasks.some(t => t.title)) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Generated Assignments & Tasks</h2>
              <p className="text-xs text-gray-400 mt-0.5">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''} · {assignments.reduce((n, a) => n + a.tasks.length, 0)} tasks total — review or edit before submitting</p>
            </div>
            <PrimaryBtn onClick={addAssignment}><Plus size={13} /> Add Assignment</PrimaryBtn>
          </div>
          {assignments.map((asgn, aIdx) => (
            <AssignmentCard key={asgn.id} asgn={asgn} aIdx={aIdx} total={assignments.length} employees={employees}
              onUpdate={(f, v) => updateAssignment(aIdx, f, v)} onRemove={() => removeAssignment(aIdx)}
              onAddTask={() => addTask(aIdx)} onRemoveTask={tIdx => removeTask(aIdx, tIdx)} onUpdateTask={(tIdx, f, v) => updateTask(aIdx, tIdx, f, v)}
              onAddSubTask={tIdx => addSubTask(aIdx, tIdx)} onRemoveSubTask={(tIdx, si) => removeSubTask(aIdx, tIdx, si)} onUpdateSubTask={(tIdx, si, f, v) => updateSubTask(aIdx, tIdx, si, f, v)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────
function ReviewStep({ project, clientId, clients, assignments, assignMode, docFile, employees }) {
  const totalTasks    = assignments.reduce((n, a) => n + a.tasks.length, 0)
  const totalSubs     = assignments.reduce((n, a) => n + a.tasks.reduce((m, t) => m + (t.subTasks?.length || 0), 0), 0)
  const assignedCount = assignments.reduce((n, a) => n + a.tasks.filter(t => t.assignee_id).length, 0)
  const client        = clients.find(c => c._id === clientId)
  const typesLabel    = PROJECT_TYPES.filter(t => project.project_types?.includes(t.value)).map(t => t.label).join(', ') || '—'

  const Row = ({ label, value }) => value ? (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100">
      <span className="text-xs text-gray-400 flex-shrink-0 w-36">{label}</span>
      <span className="text-xs text-gray-700 text-right">{value}</span>
    </div>
  ) : null

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader icon={Hash} title="Project Summary" />
        <div className="px-5 py-1">
          <Row label="Title"       value={project.title} />
          <Row label="Types"       value={typesLabel} />
          <Row label="Priority"    value={project.priority?.charAt(0).toUpperCase() + project.priority?.slice(1)} />
          <Row label="Start Date"  value={project.start_date} />
          <Row label="End Date"    value={project.end_date} />
          <Row label="Assign Mode" value={assignMode === 'auto_template' ? '⚡ Auto-Generate from Template' : '✋ Manual Assignment'} />
          <Row label="Reference Doc" value={docFile ? `📎 ${docFile.name}` : null} />
        </div>
      </SectionCard>

      {client ? (
        <SectionCard>
          <SectionHeader icon={Building2} title="Client" />
          <div className="px-5 py-1">
            <Row label="Company"  value={client.companyName} />
            {client.industry && <Row label="Industry" value={client.industry} />}
            {client.name     && <Row label="Contact"  value={client.name} />}
          </div>
        </SectionCard>
      ) : (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3.5" style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 font-medium">No client selected — go back to Step 2.</p>
        </div>
      )}

      {(assignMode === 'manual' || assignMode === 'auto_template') && (
        <SectionCard>
          <SectionHeader icon={Users} title="Team & Tasks" subtitle={`${assignments.length} assignments · ${totalTasks} tasks (${assignedCount} assigned) · ${totalSubs} sub-tasks`} />
          <div className="divide-y divide-gray-100">
            {assignments.map((a, i) => {
              const lead = a.assignee_id ? employees.find(e => e._id === a.assignee_id) : null
              return (
                <div key={a.id} className="px-5 py-3">
                  <div className="flex items-start gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 flex-1">{i + 1}. {a.title || <span className="text-gray-400 italic">Untitled</span>}</p>
                    {lead && <span className="flex items-center gap-1 text-[10px] text-blue-600 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100"><EmpAvatar emp={lead} /> Lead: {lead.name}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{a.department} · {a.tasks.length} task{a.tasks.length !== 1 ? 's' : ''}</p>
                  <div className="space-y-1">
                    {a.tasks.map(t => {
                      const emp = t.assignee_id ? employees.find(e => e._id === t.assignee_id) : null
                      return (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                          <span className="flex-1">{t.title || 'Untitled task'}</span>
                          {emp && <span className="flex items-center gap-1 text-[10px] text-blue-500"><EmpAvatar emp={emp} /> {emp.name}</span>}
                          <PriorityDot priority={t.priority || 'medium'} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {assignMode === 'auto_template' && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3.5" style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <Zap size={15} className="text-indigo-500 flex-shrink-0" />
          <p className="text-xs text-gray-500">Tasks auto-generated from <span className="font-semibold text-gray-900">project templates</span> after creation.</p>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl px-4 py-3.5" style={{ backgroundColor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <CheckCircle2 size={15} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-gray-500">Everything looks good? Click <span className="font-semibold text-gray-900">Create Project</span> to finalize.</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
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

  const [managers,       setManagers]       = useState([])
  const [clients,        setClients]        = useState([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientId,       setClientId]       = useState('')
  const [employees,      setEmployees]      = useState([])

  const [project,        setProject]        = useState(emptyProject())
  const [formMsg,        setFormMsg]        = useState({ type: '', text: '' })
  const [currentStep,    setCurrentStep]    = useState(1)
  const [completedSteps, setCompletedSteps] = useState([])
  const [assignMode,     setAssignMode]     = useState('manual')
  const [assignments,    setAssignments]    = useState([emptyAssignment()])
  const [creating,       setCreating]       = useState(false)
  const [docFile,        setDocFile]        = useState(null)
  const [selectedTeamIds, setSelectedTeamIds] = useState([])

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
      if (statusF) params.status = statusF
      if (priF) params.priority = priF
      if (debouncedSearch) params.search = debouncedSearch
      const [p, s] = await Promise.all([api.get('/projects', { params }), api.get('/projects/stats')])
      setProjects(p.data.data ?? []); setStats(s.data.data)
    } catch { toast.error('Failed to load projects') }
    finally { setLoading(false) }
  }, [statusF, priF, debouncedSearch])

  useEffect(() => { load() }, [load])
  useEffect(() => { api.get('/users?role=manager&limit=500').then(r => setManagers(r.data.data || [])).catch(console.error) }, [])

  useEffect(() => {
    if (view !== 'create') return
    setClientsLoading(true)
    // Assignable pool = employees AND managers (a manager can own tasks too).
    // limit=500 because the /users API returns only 20 by default.
    Promise.all([
      api.get('/clients'),
      api.get('/users?role=employee&limit=500'),
      api.get('/users?role=manager&limit=500'),
    ])
      .then(([cRes, eRes, mRes]) => {
        setClients(cRes.data.data ?? [])
        const pool = [...(eRes.data.data || []), ...(mRes.data.data || [])]
        const seen = new Set()
        setEmployees(pool.filter(u => u && !seen.has(u._id) && seen.add(u._id)))
      })
      .catch(() => toast.error('Failed to load clients or users'))
      .finally(() => setClientsLoading(false))
  }, [view])

  const handleDelete = async () => {
    setDeleting(true)
    try { await api.delete(`/projects/${delModal._id}`); toast.success('Project deleted'); setDelModal(null); load() }
    catch { toast.error('Delete failed') } finally { setDeleting(false) }
  }

  function openCreate() {
    setProject(emptyProject()); setClientId(''); setAssignments([emptyAssignment()])
    setFormMsg({ type: '', text: '' }); setAssignMode('manual'); setCurrentStep(1)
    setCompletedSteps([]); setDocFile(null); setSelectedTeamIds([]); setView('create')
  }

  const updateProject    = (f, v) => setProject(p => ({ ...p, [f]: v }))
  const updateAssignment = (idx, f, v) => setAssignments(prev => prev.map((a, i) => i === idx ? { ...a, [f]: v } : a))
  const addAssignment    = () => setAssignments(prev => [...prev, emptyAssignment()])
  const removeAssignment = idx => setAssignments(prev => prev.filter((_, i) => i !== idx))
  const addTask          = aIdx => setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: [...a.tasks, emptyTask()] } : a))
  const removeTask       = (aIdx, tIdx) => setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: a.tasks.filter((_, ti) => ti !== tIdx) } : a))
  const updateTask       = (aIdx, tIdx, f, v) => setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: a.tasks.map((t, ti) => ti === tIdx ? { ...t, [f]: v } : t) } : a))
  const addSubTask       = (aIdx, tIdx) => setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: a.tasks.map((t, ti) => ti === tIdx ? { ...t, subTasks: [...(t.subTasks || []), emptySubTask()] } : t) } : a))
  const removeSubTask    = (aIdx, tIdx, si) => setAssignments(prev => prev.map((a, i) => i === aIdx ? { ...a, tasks: a.tasks.map((t, ti) => ti === tIdx ? { ...t, subTasks: (t.subTasks || []).filter((_, sIdx) => sIdx !== si) } : t) } : a))

  const updateSubTask = (aIdx, tIdx, si, f, v) =>
    setAssignments(prev =>
      prev.map((a, i) =>
        i === aIdx
          ? {
              ...a,
              tasks: a.tasks.map((t, ti) =>
                ti === tIdx
                  ? {
                      ...t,
                      subTasks: (t.subTasks || []).map((subItem, sIdx) =>
                        sIdx === si ? { ...subItem, [f]: v } : subItem
                      ),
                    }
                  : t
              ),
            }
          : a
      )
    )

  const handleApplyTemplateTasks = (wizardTasks) => {
    setAssignments(prev => {
      const first = prev[0]
      const hasReal = first.tasks.some(t => t.title)
      return prev.map((a, i) =>
        i === 0 ? { ...a, tasks: hasReal ? [...first.tasks, ...wizardTasks] : wizardTasks } : a
      )
    })
  }

  const handleApplyAutoAssign = (updated) => setAssignments(updated)

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

  async function handleNext() {
    const err = validateStep(currentStep)
    if (err) { setFormMsg({ type: 'error', text: err }); return }
    setFormMsg({ type: '', text: '' })
    setCompletedSteps(prev => prev.includes(currentStep) ? prev : [...prev, currentStep])
    goToStep(currentStep + 1)
  }

  function handleBack() { setFormMsg({ type: '', text: '' }); goToStep(currentStep - 1) }

  async function handleCreate() {
    if (!clientId) { setFormMsg({ type: 'error', text: 'Please go back to Step 2 and select a client.' }); return }
    setCreating(true); setFormMsg({ type: '', text: '' })
    try {
      const { project_types = [], ...rest } = project
      const isAutoTemplate = assignMode === 'auto_template'

      const validAssignments = assignments.filter(a => a.tasks.some(t => t.title))

      const assignmentsPayload = validAssignments.map(({ id, tasks, assignee_id: leadId, ...a }) => {
        // Collect everyone chosen (assignment lead + task owners + sub-task owners)
        // into members[] so the backend enrolls them as project/assignment members.
        const memberSet = new Set()
        if (leadId) memberSet.add(leadId)

        const builtTasks = tasks
          .filter(t => t.title)
          .map(({ id: _tid, subTasks, assignee_id: taskOwner, ...t }) => {
            // A task is assigned to: its own picked person, otherwise the
            // assignment-level lead. This way assigning the group to someone
            // gives them every task under it (so it shows in their panel).
            const taskAssignee = taskOwner || leadId || null
            if (taskAssignee) memberSet.add(taskAssignee)

            const builtSubs = (subTasks || [])
              .filter(stItem => stItem.title)
              .map(({ id: _sid, assignee_id: subOwner, ...stItem }) => {
                // Sub-task → its own picked person, else inherit the task's owner.
                const subAssignee = subOwner || taskAssignee || null
                if (subAssignee) memberSet.add(subAssignee)
                return {
                  ...stItem,
                  // Backend schema key is `assigned_to` (NOT `assignee_id`)
                  assigned_to: subAssignee,
                  due_date: stItem.due_date || t.due_date || a.end_date || project.end_date,
                  estimated_hours: stItem.estimated_hours !== '' && stItem.estimated_hours != null
                    ? Number(stItem.estimated_hours)
                    : null,
                }
              })

            return {
              ...t,
              // Backend schema key is `assigned_to` (NOT `assignee_id`)
              assigned_to: taskAssignee,
              due_date: t.due_date || a.end_date || project.end_date,
              estimated_hours: t.estimated_hours !== '' && t.estimated_hours != null
                ? Number(t.estimated_hours)
                : null,
              // Backend schema key is `subtasks` (lowercase, NOT `subTasks`)
              subtasks: builtSubs,
            }
          })

        return {
          title:      a.title      || project.title,
          department: a.department || 'General',
          description: a.description || '',
          start_date: a.start_date || project.start_date,
          end_date:   a.end_date   || project.end_date,
          estimated_hours: a.estimated_hours || '',
          members: Array.from(memberSet),
          tasks: builtTasks,
        }
      })

      const payload = {
        project: {
          ...rest,
          project_type: project_types[0] ?? 'other',
          project_types,
          clientId,
          // Persist the selected team so backend auto-generation/assignment
          // only considers these people (fixes tasks leaking to everyone).
          team_members: selectedTeamIds,
        },
        auto_assign: false,
        auto_plan: isAutoTemplate && assignmentsPayload.length === 0,
        assignments: assignmentsPayload,
      }

      const res = await api.post('/assignments/wizard', payload)
      const createdProject = res.data.data?.project ?? res.data.data

      if (docFile && createdProject?._id) {
        const fd = new FormData()
        fd.append('document', docFile)
        await api.patch(
          `/projects/${createdProject._id}/document`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        ).catch(() => toast.error('Project created, but document upload failed.'))
      }

      toast.success(res.data.message || 'Project created successfully!')
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
      case 1: return <ProjectInfoStep project={project} updateProject={updateProject} managers={managers} docFile={docFile} setDocFile={setDocFile} />
      case 2: return <ClientStep clientId={clientId} setClientId={setClientId} clients={clients} clientsLoading={clientsLoading} />
      case 3: return (
        <TeamAndTasksStep
          assignMode={assignMode} setAssignMode={setAssignMode}
          assignments={assignments} addAssignment={addAssignment} removeAssignment={removeAssignment} updateAssignment={updateAssignment}
          addTask={addTask} removeTask={removeTask} updateTask={updateTask}
          addSubTask={addSubTask} removeSubTask={removeSubTask} updateSubTask={updateSubTask}
          selectedProjectTypes={project.project_types}
          onApplyTemplateTasks={handleApplyTemplateTasks}
          onApplyAutoAssign={handleApplyAutoAssign}
          projectStart={project.start_date} projectEnd={project.end_date}
          employees={employees}
          selectedTeamIds={selectedTeamIds} setSelectedTeamIds={setSelectedTeamIds}
        />
      )
      case 4: return <ReviewStep project={project} clientId={clientId} clients={clients} assignments={assignments} assignMode={assignMode} docFile={docFile} employees={employees} />
      default: return null
    }
  }

  // ─── Create view ───────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div>
          <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 mb-3"><ChevronLeft size={13} /> Back to Projects</button>
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
            {currentStep < CREATE_STEPS.length
              ? <PrimaryBtn onClick={handleNext} className="flex-1">Continue <span className="opacity-60 text-xs ml-1">→</span></PrimaryBtn>
              : <PrimaryBtn onClick={handleCreate} disabled={creating} className="flex-1">{creating ? 'Creating…' : <><Plus size={14} /> Create Project</>}</PrimaryBtn>
            }
          </div>
        </div>
      </div>
    )
  }

  // ─── Project list ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Projects" subtitle="Manage all projects across the organization"
        action={<PrimaryBtn onClick={openCreate}><Plus size={14} /> New Project</PrimaryBtn>} />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"     value={stats.total}                       icon={FolderKanban} color="primary"  />
          <StatCard label="Active"    value={stats.by_status?.active ?? 0}      icon={FolderCheck}  color="emerald" />
          <StatCard label="On Hold"   value={stats.by_status?.['on-hold'] ?? 0} icon={FolderClock}  color="amber"   />
          <StatCard label="Completed" value={stats.by_status?.completed ?? 0}   icon={FolderCheck}  color="purple"  />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="Search projects…" /></div>
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses" options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />
        <SelectInput value={priF} onChange={setPriF} placeholder="All priorities" options={PRIORITIES.map(p => ({ value: p, label: p }))} className="w-40" />
        <button onClick={load} title="Refresh" className="px-3 rounded-lg text-gray-500 hover:text-gray-800 border border-gray-200 bg-gray-50"><RefreshCw size={14} /></button>
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
              <div key={p._id} className="rounded-xl p-4 flex flex-col group transition-all hover:translate-y-[-1px] hover:shadow-md" style={cardStyle}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap"><StatusBadge status={p.status} /><PriorityBadge priority={p.priority} /></div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/admin/projects/${p._id}`} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"><Eye size={13} /></Link>
                    <Link to={`/admin/projects/edit/${p._id}`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><Pencil size={13} /></Link>
                    <button onClick={() => setDelModal(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{p.title}</h3>
                {clientName && (
                  <p className="text-xs text-blue-500 mb-1 flex items-center gap-1">
                    <Building2 size={10} /> {clientName}{p.clientId?.industry && <span className="text-gray-400">· {p.clientId.industry}</span>}
                  </p>
                )}
                <p className="text-xs text-gray-400 line-clamp-2 mb-4 flex-1 leading-relaxed">{p.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
                    <div className="w-5 h-5 rounded bg-emerald-50 flex items-center justify-center flex-shrink-0"><Users size={9} className="text-emerald-500" /></div>
                    <span className="truncate">{p.manager_id?.name ?? 'No manager'}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono flex items-center gap-1 flex-shrink-0">
                    <Calendar size={10} />{p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal open={!!delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Project"
        message={`Permanently delete "${delModal?.title}"? This will also remove all assignments, tasks, and team members associated with this project.`} />
    </div>
  )
}