import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import ExcelUpload    from '../../components/excel/ExcelUpload'
import ExcelTaskTable from '../../components/excel/ExcelTaskTable'
import {
  ArrowLeft, Users, CheckSquare, Clock, Calendar, Building2,
  ChevronDown, ChevronRight, Mail, Phone, Globe, DollarSign, Check,
  FileText, Edit, Trash2, Upload, Download, Briefcase,
} from 'lucide-react'
import { StatusBadge, PriorityBadge, Spinner, EmptyState } from '../../components/common/UI'

const PRIORITY_BAR = {
  critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-emerald-500'
}

export default function ProjectDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project,       setProject]       = useState(null)
  const [assignments,   setAssignments]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [openPanels,    setOpenPanels]    = useState({})
  const [docUploading,  setDocUploading]  = useState(false)
  const [docDownloading,setDocDownloading]= useState(false)
  const [taskRefreshKey,setTaskRefreshKey]= useState(0)
  const fileInputRef = useRef(null)

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
        if (aList.length > 0) setOpenPanels({ [aList[0]._id]: true })
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to load project')
        navigate(-1)
      } finally { setLoading(false) }
    }
    load()
  }, [id])

  const togglePanel = (aid) => setOpenPanels(p => ({ ...p, [aid]: !p[aid] }))

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDocUploading(true)
    try {
      const form = new FormData()
      form.append('document', file)
      const { data } = await api.patch(`/projects/${id}/document`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProject(prev => ({
        ...prev,
        document_path:          data.data.document_path,
        extracted_deliverables: data.data.extracted_deliverables,
      }))
      toast.success('Document uploaded successfully')
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed')
    } finally {
      setDocUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDocView = async () => {
    setDocDownloading(true)
    try {
      const { data } = await api.get(`/projects/${id}/document`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) {
      toast.error(e.response?.data?.message || 'No document attached')
    } finally {
      setDocDownloading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  )
  if (!project) return null

  // ── Resolve client — prefer populated clientId, fall back to legacy client_info ──
  const client    = project.clientId || null            // populated ObjectRef from backend
  const legacyCi  = project.client_info || {}           // backward-compat blob
  const hasClient = client || legacyCi.clientName || legacyCi.companyName || legacyCi.name || legacyCi.email

  const role = user?.role ?? ''
  const totalTasks = assignments.reduce((s, a) => s + (a.task_count ?? 0), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Back + Edit */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        {role && (role === 'admin' || role === 'manager') && (
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
            <h1 className="text-2xl font-bold text-gray-800">{project.title}</h1>
            <p className="text-neutral text-sm mt-2 leading-relaxed">{project.description}</p>

            {/* Inline client chip beneath title */}
            {hasClient && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', color: '#3b82f6' }}>
                  <Building2 size={13} />
                  <span>{client?.companyName ?? legacyCi.companyName ?? legacyCi.company ?? legacyCi.name}</span>
                  {client?.industry && (
                    <span className="text-blue-400 text-xs">· {client.industry}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-neutral uppercase tracking-wider font-semibold mb-1">Manager</p>
            <p className="text-sm font-medium text-gray-800">{project.manager_id?.name ?? '—'}</p>
            <p className="text-xs text-neutral">{project.manager_id?.designation}</p>
          </div>
          <div>
            <p className="text-xs text-neutral uppercase tracking-wider font-semibold mb-1">Timeline</p>
            <p className="text-sm text-gray-800 font-mono">
              {project.start_date ? format(new Date(project.start_date), 'MMM d') : '—'}
              {' → '}
              {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral uppercase tracking-wider font-semibold mb-1">Assignments</p>
            <p className="text-2xl font-bold text-gray-800">{assignments.length}</p>
          </div>
          <div>
            <p className="text-xs text-neutral uppercase tracking-wider font-semibold mb-1">Total Tasks</p>
            <p className="text-2xl font-bold text-gray-800">{totalTasks}</p>
          </div>
        </div>
      </div>

      {/* ── Reference Document (admin / manager only) ── */}
      {(role === 'admin' || role === 'manager') && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Reference Document
            </h3>
            <div className="flex items-center gap-2">
              {project.document_path && (
                <button onClick={handleDocView} disabled={docDownloading}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                  {docDownloading
                    ? <><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> Opening…</>
                    : <><Download size={12} /> View Document</>}
                </button>
              )}
              <button onClick={() => fileInputRef.current?.click()} disabled={docUploading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                {docUploading
                  ? <><div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> Uploading…</>
                  : <><Upload size={12} /> {project.document_path ? 'Replace' : 'Upload'} Document</>}
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleDocUpload} />
            </div>
          </div>

          {project.document_path ? (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <FileText size={16} className="text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-800 font-medium">Document attached</p>
                <p className="text-xs text-neutral mt-0.5">
                  Click "View Document" to open · Employees see a "View Reference Document" button on their tasks
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-dashed border-gray-200">
              <Upload size={16} className="text-neutral flex-shrink-0" />
              <div>
                <p className="text-sm text-neutral">No document attached yet</p>
                <p className="text-xs text-neutral mt-0.5">
                  Upload a PDF, DOCX, or TXT — employees will see a "View Reference Document" button on their tasks
                </p>
              </div>
            </div>
          )}

          {project.extracted_deliverables?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-neutral uppercase tracking-wider font-semibold mb-2">Extracted Deliverables</p>
              <ul className="space-y-1">
                {project.extracted_deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-emerald-400 flex-shrink-0 mt-0.5"><Check size={14} /></span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Excel upload / task table */}
      {(role === 'admin' || role === 'manager') && (
        <>
          <ExcelUpload projectId={id} projectName={project.title} onImported={() => setTaskRefreshKey(k => k + 1)} />
          <div className="card">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Project Tasks</h3>
            <ExcelTaskTable key={taskRefreshKey} projectId={id} />
          </div>
        </>
      )}

      {/* ── Client info ─────────────────────────────────────────────────────── */}
      {hasClient && (
        <div className="card">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-primary" /> Client Information
          </h3>

          {client ? (
            /* ── New: populated clientId ── */
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-blue-600 flex-shrink-0"
                  style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  {(client.companyName || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">{client.companyName}</p>
                  {client.industry && <p className="text-sm text-blue-500 mt-0.5">{client.industry}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                {client.name    && <InfoItem icon={Users}    label="Contact" value={client.name} />}
                {client.email   && <InfoItem icon={Mail}     label="Email"   value={client.email} />}
                {client.phone   && <InfoItem icon={Phone}    label="Phone"   value={client.phone} />}
                {client.website && <InfoItem icon={Globe}    label="Website" value={client.website} />}
                {client.budget  && <InfoItem icon={DollarSign} label="Budget" value={client.budget} />}
                {client.address && <InfoItem icon={Building2} label="Address" value={client.address} />}
              </div>

              {client.requirements && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-neutral uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                    <FileText size={12} /> Requirements / Brief
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{client.requirements}</p>
                </div>
              )}

              {(role === 'admin' || role === 'manager') && (
                <div className="pt-2">
                  <Link to={`/${role}/clients/${client._id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 transition-colors">
                    <Briefcase size={12} /> View full client record →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            /* ── Legacy: client_info blob fallback ── */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {(legacyCi.clientName || legacyCi.name)    && <InfoItem icon={Users}    label="Client"  value={legacyCi.clientName ?? legacyCi.name} />}
              {(legacyCi.companyName || legacyCi.company) && <InfoItem icon={Building2} label="Company" value={legacyCi.companyName ?? legacyCi.company} />}
              {legacyCi.email   && <InfoItem icon={Mail}     label="Email"   value={legacyCi.email} />}
              {legacyCi.phone   && <InfoItem icon={Phone}    label="Phone"   value={legacyCi.phone} />}
              {legacyCi.website && <InfoItem icon={Globe}    label="Website" value={legacyCi.website} />}
              {legacyCi.budget  && <InfoItem icon={DollarSign} label="Budget" value={legacyCi.budget} />}
            </div>
          )}
        </div>
      )}

      {/* ── Assignments ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          Department Assignments
          <span className="text-xs text-neutral font-normal bg-gray-50 px-2 py-0.5 rounded-full">
            {assignments.length}
          </span>
        </h2>

        {assignments.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No assignments"
            description="No department assignments were created for this project." />
        ) : (
          <div className="space-y-3">
            {assignments.map((a, idx) => {
              const isOpen = !!openPanels[a._id]
              return (
                <div key={a._id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <button onClick={() => togglePanel(a._id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 border border-primary/30 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">{a.title}</p>
                          <span className="text-xs bg-gray-50 text-neutral px-2 py-0.5 rounded-full">{a.department}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 text-xs text-neutral">
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
                    <ChevronDown size={16} className={`text-neutral transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100">
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
  if (!data)   return null

  const { members = [], tasks = [] } = data

  return (
    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Members */}
      <div>
        <p className="text-xs font-semibold text-neutral uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Users size={12} /> Team Members ({members.length})
        </p>
        {members.length === 0 ? (
          <p className="text-neutral text-sm">No members assigned</p>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m._id} className="flex items-center gap-3 px-3 py-2 bg-gray-100 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {(m.user_id?.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.user_id?.name ?? '—'}</p>
                  <p className="text-xs text-neutral">{m.user_id?.department}</p>
                </div>
                {m.allocated_hours && (
                  <span className="text-xs text-neutral font-mono">{m.allocated_hours}h</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks */}
      <div>
        <p className="text-xs font-semibold text-neutral uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <CheckSquare size={12} /> Tasks ({tasks.length})
        </p>
        {tasks.length === 0 ? (
          <p className="text-neutral text-sm">No tasks created</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => {
              const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
              return (
                <div key={t._id} className="px-3 py-2.5 bg-gray-100 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-1.5 h-6 rounded-full flex-shrink-0 ${PRIORITY_BAR[t.priority] ?? 'bg-slate-500'}`} />
                      <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral ml-3.5">
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
      <Icon size={14} className="text-neutral flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-neutral">{label}</p>
        <p className="text-sm text-gray-800 font-medium break-all">{value}</p>
      </div>
    </div>
  )
}