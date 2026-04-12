import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  ArrowLeft, Users, CheckSquare, Clock, Calendar, Building2,
  ChevronDown, ChevronRight, Mail, Phone, Globe, DollarSign,
  FileText, Edit, Trash2
} from 'lucide-react'
import { StatusBadge, PriorityBadge, Spinner, EmptyState } from '../../components/common/UI'

const PRIORITY_BAR = {
  critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-emerald-500'
}

export default function ProjectDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project,     setProject]     = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [openPanels,  setOpenPanels]  = useState({})

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [p, a] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get(`/assignments?project_id=${id}`),
        ])
        setProject(p.data.data)
        const aList = a.data.data ?? []
        setAssignments(aList)
        // Open first panel by default
        if (aList.length > 0) setOpenPanels({ [aList[0]._id]: true })
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to load project')
        navigate(-1)
      } finally { setLoading(false) }
    }
    load()
  }, [id])

  const togglePanel = (aid) =>
    setOpenPanels(p => ({ ...p, [aid]: !p[aid] }))

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  )
  if (!project) return null

  const ci = project.client_info || {}
  const hasClient = ci.name || ci.company || ci.email
  const role = user?.role

  // Task summary
  const totalTasks = assignments.reduce((s, a) => s + (a.task_count ?? 0), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Back + Edit */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        {(role === 'admin' || role === 'manager') && (
          <Link to={`/${role}/projects/edit/${id}`} className="btn-secondary">
            <Edit size={15} /> Edit Project
          </Link>
        )}
      </div>

      {/* Project header */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            <h1 className="text-2xl font-bold text-white">{project.title}</h1>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">{project.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-white/5">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Manager</p>
            <p className="text-sm font-medium text-white">{project.manager_id?.name ?? '—'}</p>
            <p className="text-xs text-slate-500">{project.manager_id?.designation}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Timeline</p>
            <p className="text-sm text-white font-mono">
              {project.start_date ? format(new Date(project.start_date), 'MMM d') : '—'}
              {' → '}
              {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Assignments</p>
            <p className="text-2xl font-bold text-white">{assignments.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Tasks</p>
            <p className="text-2xl font-bold text-white">{totalTasks}</p>
          </div>
        </div>
      </div>

      {/* Client info */}
      {hasClient && (
        <div className="card">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-brand-400" /> Client Information
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ci.name    && <InfoItem icon={Users}    label="Client"  value={ci.name} />}
            {ci.company && <InfoItem icon={Building2} label="Company" value={ci.company} />}
            {ci.email   && <InfoItem icon={Mail}     label="Email"   value={ci.email} />}
            {ci.phone   && <InfoItem icon={Phone}    label="Phone"   value={ci.phone} />}
            {ci.website && <InfoItem icon={Globe}    label="Website" value={ci.website} />}
            {ci.budget  && <InfoItem icon={DollarSign} label="Budget" value={ci.budget} />}
          </div>
          {ci.requirements && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Requirements / Brief
              </p>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{ci.requirements}</p>
            </div>
          )}
        </div>
      )}

      {/* Assignments */}
      <div>
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          Department Assignments
          <span className="text-xs text-slate-500 font-normal bg-white/5 px-2 py-0.5 rounded-full">{assignments.length}</span>
        </h2>

        {assignments.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No assignments" description="No department assignments were created for this project." />
        ) : (
          <div className="space-y-3">
            {assignments.map((a, idx) => {
              const isOpen = !!openPanels[a._id]
              return (
                <div key={a._id} className="bg-surface-50 border border-white/8 rounded-2xl overflow-hidden">
                  {/* Assignment header */}
                  <button
                    onClick={() => togglePanel(a._id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-300 text-sm font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white text-sm">{a.title}</p>
                          <span className="text-xs bg-white/5 text-slate-400 px-2 py-0.5 rounded-full">{a.department}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 text-xs text-slate-500">
                          <span className="font-mono">
                            {a.start_date ? format(new Date(a.start_date), 'MMM d') : '—'}
                            {' → '}
                            {a.end_date ? format(new Date(a.end_date), 'MMM d, yyyy') : '—'}
                          </span>
                          <span>{a.members?.length ?? 0} member{(a.members?.length ?? 0) !== 1 ? 's' : ''}</span>
                          <span>{a.task_count ?? 0} task{(a.task_count ?? 0) !== 1 ? 's' : ''}</span>
                          {a.estimated_hours && <span>{a.estimated_hours}h estimated</span>}
                        </div>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-white/5">
                      <AssignmentDetail assignmentId={a._id} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Lazy-loaded assignment detail ────────────────────────────────────────────
function AssignmentDetail({ assignmentId }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/assignments/${assignmentId}`)
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load assignment details'))
      .finally(() => setLoading(false))
  }, [assignmentId])

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>
  if (!data) return null

  const { members = [], tasks = [] } = data

  return (
    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Members */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Users size={12} /> Team Members ({members.length})
        </p>
        {members.length === 0 ? (
          <p className="text-slate-600 text-sm">No members assigned</p>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m._id} className="flex items-center gap-3 px-3 py-2 bg-surface-200 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {(m.user_id?.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.user_id?.name ?? '—'}</p>
                  <p className="text-xs text-slate-500">{m.user_id?.department}</p>
                </div>
                {m.allocated_hours && (
                  <span className="text-xs text-slate-500 font-mono">{m.allocated_hours}h</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <CheckSquare size={12} /> Tasks ({tasks.length})
        </p>
        {tasks.length === 0 ? (
          <p className="text-slate-600 text-sm">No tasks created</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => {
              const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
              return (
                <div key={t._id} className="px-3 py-2.5 bg-surface-200 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-1.5 h-6 rounded-full flex-shrink-0 ${PRIORITY_BAR[t.priority] ?? 'bg-slate-500'}`} />
                      <p className="text-sm font-medium text-white truncate">{t.title}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 ml-3.5">
                    {t.assigned_to && (
                      <span className="flex items-center gap-1">
                        <Users size={10} /> {t.assigned_to.name}
                      </span>
                    )}
                    {t.due_date && (
                      <span className={`font-mono ${overdue ? 'text-red-400' : ''}`}>
                        {format(new Date(t.due_date), 'MMM d, yyyy')}
                        {overdue && ' ⚠'}
                      </span>
                    )}
                    {t.estimated_hours && <span><Clock size={10} className="inline mr-0.5" />{t.estimated_hours}h</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-white font-medium break-all">{value}</p>
      </div>
    </div>
  )
}
