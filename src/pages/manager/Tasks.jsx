import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, CheckSquare } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, SearchInput, SelectInput, Modal, ConfirmModal,
  FormField, StatusBadge, PriorityBadge, Spinner, EmptyState, StatCard
} from '../../components/common/UI'

const STATUSES   = ['todo','in-progress','completed','on-hold','cancelled']
const PRIORITIES = ['low','medium','high','critical']
const emptyForm  = { title:'', description:'', project_id:'', assigned_to:'', status:'todo', priority:'medium', due_date:'' }

export default function ManagerTasks() {
  const [tasks,    setTasks]    = useState([])
  const [stats,    setStats]    = useState(null)
  const [projects, setProjects] = useState([])
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')
  const [priF,     setPriF]     = useState('')
  const [projF,    setProjF]    = useState('')
  const [modal,    setModal]    = useState(null)
  const [delModal, setDelModal] = useState(null)
  const [form,     setForm]     = useState(emptyForm)
  const [target,   setTarget]   = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status     = statusF
      if (priF)    params.priority   = priF
      if (projF)   params.project_id = projF
      const [t, s, p, u] = await Promise.all([
        api.get('/tasks', { params }),
        api.get('/tasks/stats'),
        api.get('/projects'),
        api.get('/users'),
      ])
      setTasks(t.data.data ?? [])
      setStats(s.data.data)
      setProjects(p.data.data ?? [])
      setUsers(u.data.data ?? [])
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }, [statusF, priF, projF])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setForm(emptyForm); setTarget(null); setModal('form') }
  const openEdit   = (t) => {
    setForm({
      title: t.title, description: t.description ?? '',
      project_id: t.project_id?._id ?? t.project_id,
      assigned_to: t.assigned_to?._id ?? t.assigned_to,
      status: t.status, priority: t.priority,
      due_date: t.due_date?.slice(0,10) ?? '',
    })
    setTarget(t); setModal('form')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (target) await api.patch(`/tasks/${target._id}`, form)
      else        await api.post('/tasks', form)
      toast.success(target ? 'Task updated' : 'Task created')
      setModal(null); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/tasks/${delModal._id}`)
      toast.success('Task deleted'); setDelModal(null); load()
    } catch { toast.error('Failed') }
    finally { setDeleting(false) }
  }

  const f = (k,v) => setForm(p => ({ ...p, [k]: v }))
  const s = stats || {}

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tasks"
        subtitle="Assign and track tasks across your projects"
        action={<button className="btn-primary" onClick={openCreate}><Plus size={16}/> New Task</button>}
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"       value={s.total}               icon={CheckSquare} color="brand" />
          <StatCard label="In Progress" value={s['in-progress'] ?? 0} icon={CheckSquare} color="amber" />
          <StatCard label="Completed"   value={s.completed ?? 0}      icon={CheckSquare} color="emerald" />
          <StatCard label="On Hold"     value={s['on-hold'] ?? 0}     icon={CheckSquare} color="red" />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <SelectInput value={projF}   onChange={setProjF}   placeholder="All projects"  options={projects.map(p => ({ value:p._id, label:p.title }))} className="w-48" />
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"  options={STATUSES.map(s => ({ value:s, label:s }))} className="w-40" />
        <SelectInput value={priF}    onChange={setPriF}    placeholder="All priorities" options={PRIORITIES.map(p => ({ value:p, label:p }))} className="w-40" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15}/></button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-200/50">
              <tr>
                {['Task','Project','Assigned To','Priority','Status','Due Date','Actions'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Spinner/></td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={CheckSquare} title="No tasks found" /></td></tr>
              ) : tasks.map(t => {
                const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
                return (
                  <tr key={t._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell">
                      <p className="font-medium text-white text-sm line-clamp-1">{t.title}</p>
                    </td>
                    <td className="table-cell text-slate-400 text-xs">{t.project_id?.title ?? '—'}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xs">
                          {(t.assigned_to?.name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-300">{t.assigned_to?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="table-cell"><PriorityBadge priority={t.priority}/></td>
                    <td className="table-cell"><StatusBadge status={t.status}/></td>
                    <td className="table-cell">
                      <span className={`text-xs font-mono ${overdue ? 'text-red-400' : 'text-slate-400'}`}>
                        {t.due_date ? format(new Date(t.due_date), 'dd MMM yyyy') : '—'}
                        {overdue && ' ⚠'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"><Pencil size={13}/></button>
                        <button onClick={() => setDelModal(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal === 'form'} onClose={() => setModal(null)}
        title={target ? 'Edit Task' : 'Create Task'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm"/> : null}{target ? 'Save' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Title"><input className="input" value={form.title} onChange={e => f('title', e.target.value)} placeholder="Task title" /></FormField>
          <FormField label="Description"><textarea className="input resize-none" rows={2} value={form.description} onChange={e => f('description', e.target.value)} /></FormField>
          <FormField label="Project"><SelectInput value={form.project_id} onChange={v => f('project_id', v)} placeholder="Select project" options={projects.map(p => ({ value:p._id, label:p.title }))} /></FormField>
          <FormField label="Assign To"><SelectInput value={form.assigned_to} onChange={v => f('assigned_to', v)} placeholder="Select member" options={users.map(u => ({ value:u._id, label:`${u.name} (${u.role})` }))} /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Status"><SelectInput value={form.status} onChange={v => f('status', v)} options={STATUSES.map(s => ({ value:s, label:s }))} /></FormField>
            <FormField label="Priority"><SelectInput value={form.priority} onChange={v => f('priority', v)} options={PRIORITIES.map(p => ({ value:p, label:p }))} /></FormField>
          </div>
          <FormField label="Due Date"><input className="input" type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} /></FormField>
        </div>
      </Modal>

      <ConfirmModal
        open={!!delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Task" message={`Delete "${delModal?.title}"?`}
      />
    </div>
  )
}
