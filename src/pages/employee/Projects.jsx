import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, FolderKanban, Eye, Users, CheckSquare, Clock, AlertTriangle } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { PageHeader, SelectInput, StatusBadge, PriorityBadge, Spinner, EmptyState } from '../../components/common/UI'

export default function EmployeeProjects() {
  const [projects,    setProjects]    = useState([])
  const [taskCounts,  setTaskCounts]  = useState({}) // { [projectId]: { total, completed, inProgress } }
  const [loading,     setLoading]     = useState(true)
  const [statusF,     setStatusF]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF

      // Fetch projects AND all employee tasks in parallel
      const [projRes, taskRes] = await Promise.allSettled([
        api.get('/projects', { params }),
        api.get('/tasks?limit=200'),
      ])

      const fetchedProjects = projRes.status === 'fulfilled' ? (projRes.value.data.data ?? []) : []
      const fetchedTasks    = taskRes.status  === 'fulfilled' ? (taskRes.value.data.data  ?? []) : []

      // If projects list is empty but employee has tasks, derive projects from tasks
      let allProjects = [...fetchedProjects]

      if (fetchedTasks.length > 0) {
        const taskProjectIds = new Set(fetchedTasks.map(t => t.project_id?._id ?? t.project_id).filter(Boolean).map(String))

        // Find any project IDs from tasks that aren't already in the projects list
        const knownIds = new Set(fetchedProjects.map(p => String(p._id)))
        const missingIds = [...taskProjectIds].filter(id => !knownIds.has(id))

        // Fetch missing projects individually
        const missingFetches = await Promise.allSettled(
          missingIds.map(id => api.get(`/projects/${id}`))
        )
        missingFetches.forEach(r => {
          if (r.status === 'fulfilled') {
            const p = r.value.data.data
            if (p) allProjects.push(p)
          }
        })

        // Build task count map per project
        const counts = {}
        fetchedTasks.forEach(t => {
          const pid = String(t.project_id?._id ?? t.project_id)
          if (!pid) return
          if (!counts[pid]) counts[pid] = { total: 0, completed: 0, inProgress: 0 }
          counts[pid].total++
          if (t.status === 'completed')   counts[pid].completed++
          if (t.status === 'in-progress') counts[pid].inProgress++
        })
        setTaskCounts(counts)
      }

      setProjects(allProjects)
    } catch (e) {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [statusF])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="My Projects" subtitle="Projects you are assigned to" />

      <div className="flex gap-3">
        <SelectInput
          value={statusF}
          onChange={setStatusF}
          placeholder="All statuses"
          options={['planning','active','on-hold','completed','cancelled'].map(s => ({ value: s, label: s }))}
          className="w-44"
        />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="You haven't been assigned to any projects yet. Projects will appear here once tasks are assigned to you."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => {
            const counts  = taskCounts[String(p._id)] ?? {}
            const overdue = p.end_date && new Date(p.end_date) < new Date() && p.status !== 'completed'
            const progress = counts.total > 0
              ? Math.round((counts.completed / counts.total) * 100)
              : null

            return (
              <Link
                key={p._id}
                to={`/employee/projects/${p._id}`}
                className="card hover:border-gray-200 transition-all flex flex-col group"
              >
                {/* Top badges */}
                <div className="flex items-center gap-2 mb-3 flex-wrap justify-between">
                  <div className="flex gap-2">
                    <StatusBadge status={p.status} />
                    <PriorityBadge priority={p.priority} />
                  </div>
                  <Eye size={14} className="text-neutral group-hover:text-primary transition-colors" />
                </div>

                {/* Title */}
                <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1">{p.title}</h3>

                {/* Client */}
                {p.client_info?.company && (
                  <p className="text-xs text-primary mb-1">Client: {p.client_info.company}</p>
                )}

                {/* Description */}
                <p className="text-sm text-neutral line-clamp-2 mb-3 flex-1">
                  {p.extracted_description || p.description || 'No description'}
                </p>

                {/* Task progress bar */}
                {counts.total > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] text-neutral mb-1">
                      <span className="flex items-center gap-1">
                        <CheckSquare size={10} /> {counts.completed}/{counts.total} tasks
                      </span>
                      {counts.inProgress > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Clock size={10} /> {counts.inProgress} in progress
                        </span>
                      )}
                      <span className="text-neutral font-medium">{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-neutral pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {p.manager_id?.name ?? '—'}
                  </span>
                  <span className={`font-mono flex items-center gap-1 ${overdue ? 'text-red-400' : ''}`}>
                    {overdue && <AlertTriangle size={10} />}
                    {p.end_date ? format(new Date(p.end_date), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
