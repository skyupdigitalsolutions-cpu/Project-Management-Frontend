import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Eye, RefreshCw, FolderKanban, Users } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, SearchInput, SelectInput, StatusBadge, PriorityBadge, Spinner, EmptyState
} from '../../components/common/UI'

const STATUSES = ['planning','active','on-hold','completed','cancelled']

export default function ManagerProjects() {
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')
  const [search,   setSearch]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      if (search)  params.search = search
      const { data } = await api.get('/projects', { params })
      setProjects(data.data ?? [])
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [statusF, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage and monitor your projects"
        action={
          <Link to="/manager/projects/create" className="btn-primary">
            <Plus size={16} /> New Project
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />
        </div>
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15}/></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg"/></div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects found"
          description="Create your first project using the wizard" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p._id} className="card hover:border-gray-200 transition-all group flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={p.status} />
                  <PriorityBadge priority={p.priority} />
                </div>
                <Link to={`/manager/projects/${p._id}`}
                  className="p-1.5 rounded-lg text-neutral hover:text-primary hover:bg-purple-50 transition-colors opacity-0 group-hover:opacity-100">
                  <Eye size={13}/>
                </Link>
              </div>

              <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1">{p.title}</h3>
              {p.client_info?.company && (
                <p className="text-xs text-primary mb-1">Client: {p.client_info.company}</p>
              )}
              <p className="text-sm text-neutral line-clamp-2 mb-4 flex-1">{p.description}</p>

              <div className="flex items-center justify-between text-xs text-neutral pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1.5">
                  <Users size={11}/> {p.manager_id?.name ?? '—'}
                </span>
                <span className="font-mono">
                  {p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
