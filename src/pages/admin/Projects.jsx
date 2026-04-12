import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, RefreshCw, FolderKanban, FolderCheck, FolderClock, Users } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, StatCard, SearchInput, SelectInput, ConfirmModal,
  StatusBadge, PriorityBadge, Spinner, EmptyState
} from '../../components/common/UI'

const STATUSES   = ['planning','active','on-hold','completed','cancelled']
const PRIORITIES = ['low','medium','high','critical']

export default function AdminProjects() {
  const [projects, setProjects] = useState([])
  const [stats,    setStats]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')
  const [priF,     setPriF]     = useState('')
  const [search,   setSearch]   = useState('')
  const [delModal, setDelModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status   = statusF
      if (priF)    params.priority = priF
      if (search)  params.search   = search
      const [p, s] = await Promise.all([
        api.get('/projects', { params }),
        api.get('/projects/stats'),
      ])
      setProjects(p.data.data ?? [])
      setStats(s.data.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [statusF, priF, search])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/projects/${delModal._id}`)
      toast.success('Project deleted'); setDelModal(null); load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage all projects across the organization"
        action={
          <Link to="/admin/projects/create" className="btn-primary">
            <Plus size={16} /> New Project
          </Link>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"     value={stats.total}                    icon={FolderKanban} color="brand" />
          <StatCard label="Active"    value={stats.by_status?.active ?? 0}   icon={FolderCheck}  color="emerald" />
          <StatCard label="On Hold"   value={stats.by_status?.['on-hold'] ?? 0} icon={FolderClock} color="amber" />
          <StatCard label="Completed" value={stats.by_status?.completed ?? 0}   icon={FolderCheck} color="purple" />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />
        </div>
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"  options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />
        <SelectInput value={priF}    onChange={setPriF}    placeholder="All priorities" options={PRIORITIES.map(p => ({ value: p, label: p }))} className="w-40" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15}/></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg"/></div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects found"
          description="Create your first project using the wizard"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p._id} className="card hover:border-white/10 transition-all group flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={p.status} />
                  <PriorityBadge priority={p.priority} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/admin/projects/${p._id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors">
                    <Eye size={13}/>
                  </Link>
                  <Link to={`/admin/projects/edit/${p._id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                    <Pencil size={13}/>
                  </Link>
                  <button onClick={() => setDelModal(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-white mb-1 line-clamp-1">{p.title}</h3>
              {p.client_info?.company && (
                <p className="text-xs text-brand-400 mb-1">Client: {p.client_info.company}</p>
              )}
              <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{p.description}</p>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
                    <Users size={10} className="text-emerald-400" />
                  </div>
                  <span>{p.manager_id?.name ?? 'No manager'}</span>
                </div>
                <span className="font-mono">
                  {p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Project"
        message={`Permanently delete "${delModal?.title}"? This will also remove all assignments, tasks and members.`}
      />
    </div>
  )
}
