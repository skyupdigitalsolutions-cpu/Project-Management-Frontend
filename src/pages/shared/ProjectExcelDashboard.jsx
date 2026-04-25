/**
 * src/pages/shared/ProjectExcelDashboard.jsx
 * ─────────────────────────────────────────────────────────
 * Drop-in page (or embedded section) showing Excel import + task table.
 * Can be used two ways:
 *
 *  A) Full page route:
 *     <Route path="projects/:id/tasks" element={<ProjectExcelDashboard />} />
 *
 *  B) Embedded in ProjectDetail.jsx — see the INTEGRATION SNIPPET below.
 *
 * PLACE AT: src/pages/shared/ProjectExcelDashboard.jsx
 *
 * ─── INTEGRATION SNIPPET FOR ProjectDetail.jsx ───────────────────────────────
 * Add these two imports at the top of ProjectDetail.jsx:
 *
 *   import ExcelUpload    from '../../components/excel/ExcelUpload'
 *   import ExcelTaskTable from '../../components/excel/ExcelTaskTable'
 *
 * Then inside the JSX return, after the "Reference Document" card block,
 * add this section (admin/manager only):
 *
 *   {(role === 'admin' || role === 'manager') && (
 *     <>
 *       <ExcelUpload
 *         projectId={id}
 *         projectName={project.title}
 *         onImported={() => setTaskRefreshKey(k => k + 1)}
 *       />
 *       <div className="card">
 *         <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
 *           <CheckSquare size={16} className="text-primary" /> Project Tasks
 *         </h3>
 *         <ExcelTaskTable
 *           key={taskRefreshKey}
 *           projectId={id}
 *         />
 *       </div>
 *     </>
 *   )}
 *
 * And add this state at the top of ProjectDetail:
 *   const [taskRefreshKey, setTaskRefreshKey] = useState(0)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState }    from 'react'
import { ArrowLeft, CheckSquare } from 'lucide-react'
import api                        from '../../api/axios'
import toast                      from 'react-hot-toast'
import { useAuth }                from '../../context/AuthContext'
import { Spinner }                from '../../components/common/UI'
import ExcelUpload                from '../../components/excel/ExcelUpload'
import ExcelTaskTable             from '../../components/excel/ExcelTaskTable'

export default function ProjectExcelDashboard() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const [project,  setProject]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then(r  => setProject(r.data.data))
      .catch(() => { toast.error('Project not found'); navigate(-1) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (!project) return null

  const canEdit = user?.role === 'admin' || user?.role === 'manager'

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="text-sm text-neutral">
          <span className="font-semibold text-gray-800">{project.title}</span>
          <span className="mx-2">›</span>
          <span>Tasks</span>
        </div>
      </div>

      {/* Excel Import Panel (admin/manager only) */}
      {canEdit && (
        <ExcelUpload
          projectId={id}
          projectName={project.title}
          onImported={() => setRefreshKey(k => k + 1)}
        />
      )}

      {/* Task Table */}
      <div className="card">
        <h3 className="text-sm font-bold text-gray-800 mb-5 flex items-center gap-2">
          <CheckSquare size={16} className="text-primary" />
          All Tasks
          <span className="text-xs text-neutral font-normal bg-gray-100 px-2 py-0.5 rounded-full">
            {project.title}
          </span>
        </h3>
        <ExcelTaskTable
          key={refreshKey}
          projectId={id}
        />
      </div>
    </div>
  )
}