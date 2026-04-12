import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, FolderKanban, Eye, Users } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { PageHeader, SelectInput, StatusBadge, PriorityBadge, Spinner, EmptyState } from '../../components/common/UI'

export default function EmployeeProjects() {
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      const { data } = await api.get('/projects', { params })
      setProjects(data.data ?? [])
    } catch { toast.error('Failed to load projects') }
    finally { setLoading(false) }
  }, [statusF])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="My Projects" subtitle="Projects you are a member of" />
      <div className="flex gap-3">
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={['planning','active','on-hold','completed','cancelled'].map(s => ({ value:s, label:s }))}
          className="w-44" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15}/></button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg"/></div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects" description="You haven't been added to any projects yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <Link key={p._id} to={`/employee/projects/${p._id}`}
              className="card hover:border-white/10 transition-all flex flex-col group">
              <div className="flex items-center gap-2 mb-3 flex-wrap justify-between">
                <div className="flex gap-2"><StatusBadge status={p.status}/><PriorityBadge priority={p.priority}/></div>
                <Eye size={14} className="text-slate-600 group-hover:text-brand-400 transition-colors" />
              </div>
              <h3 className="font-semibold text-white mb-1 line-clamp-1">{p.title}</h3>
              {p.client_info?.company && <p className="text-xs text-brand-400 mb-1">Client: {p.client_info.company}</p>}
              <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-1">{p.description}</p>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
                <span className="flex items-center gap-1"><Users size={11}/> {p.manager_id?.name ?? '—'}</span>
                <span className="font-mono">{p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
