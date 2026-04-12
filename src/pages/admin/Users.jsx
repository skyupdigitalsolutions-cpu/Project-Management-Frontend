import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Shield, RefreshCw } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, StatCard, SearchInput, SelectInput, Modal, ConfirmModal,
  FormField, StatusBadge, Spinner, EmptyState
} from '../../components/common/UI'
import { Users, UserCheck, UserX } from 'lucide-react'

const ROLES       = ['admin', 'manager', 'employee']
const STATUSES    = ['active', 'inactive', 'on-leave']
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

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'employee', department: '', designation: '', status: 'active' }

export default function AdminUsers() {
  const [users,    setUsers]    = useState([])
  const [stats,    setStats]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [roleF,    setRoleF]    = useState('')
  const [statusF,  setStatusF]  = useState('')
  const [modal,    setModal]    = useState(null) // 'create' | 'edit' | 'role'
  const [delModal, setDelModal] = useState(null)
  const [form,     setForm]     = useState(emptyForm)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [target,   setTarget]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (roleF)   params.role   = roleF
      if (statusF) params.status = statusF
      if (search)  params.search = search
      const [u, s] = await Promise.all([
        api.get('/users', { params }),
        api.get('/users/stats'),
      ])
      setUsers(u.data.data ?? [])
      setStats(s.data.data)
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }, [roleF, statusF, search])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setForm(emptyForm); setTarget(null); setModal('create') }
  const openEdit   = (u) => { setForm({ ...u, password: '' }); setTarget(u); setModal('edit') }
  const openRole   = (u) => { setForm({ role: u.role }); setTarget(u); setModal('role') }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') {
        const { data } = await api.post('/auth/register', form)
        toast.success('User created')
      } else if (modal === 'edit') {
        const { password, role, ...rest } = form
        await api.patch(`/users/${target._id}`, rest)
        toast.success('User updated')
      } else if (modal === 'role') {
        await api.patch(`/users/${target._id}/role`, { role: form.role })
        toast.success('Role updated')
      }
      setModal(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/users/${delModal._id}`)
      toast.success('User deactivated')
      setDelModal(null)
      load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Users"
        subtitle="Manage all team members and their access"
        action={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add User
          </button>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"    value={stats.total}             icon={Users}     color="brand" />
          <StatCard label="Active"   value={stats.active}            icon={UserCheck} color="emerald" />
          <StatCard label="Managers" value={stats.manager}           icon={Shield}    color="blue" />
          <StatCard label="On Leave" value={stats['on-leave'] ?? 0}  icon={UserX}     color="amber" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" />
        </div>
        <SelectInput value={roleF}   onChange={setRoleF}   placeholder="All roles"    options={ROLES.map(r => ({ value: r, label: r }))} className="w-36" />
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses" options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-200/50">
              <tr>
                {['Name', 'Role', 'Department', 'Designation', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Spinner /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Users} title="No users found" description="Try adjusting your filters" /></td></tr>
              ) : users.map(u => (
                <tr key={u._id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell"><span className={`badge border ${roleColor(u.role)}`}>{u.role}</span></td>
                  <td className="table-cell text-slate-400">{u.department}</td>
                  <td className="table-cell text-slate-400">{u.designation}</td>
                  <td className="table-cell"><StatusBadge status={u.status} /></td>
                  <td className="table-cell text-slate-500 font-mono text-xs">{u.joining_date ? format(new Date(u.joining_date), 'dd MMM yyyy') : '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => openRole(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"><Shield size={14} /></button>
                      <button onClick={() => setDelModal(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add New User' : 'Edit User'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : null}
              {modal === 'create' ? 'Create User' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full Name">
            <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="John Doe" />
          </FormField>
          <FormField label="Email">
            <input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="john@company.com" />
          </FormField>
          {modal === 'create' && (
            <FormField label="Password">
              <input className="input" type="password" value={form.password} onChange={e => f('password', e.target.value)} placeholder="Min 6 chars" />
            </FormField>
          )}
          <FormField label="Phone">
            <input className="input" value={form.phone || ''} onChange={e => f('phone', e.target.value)} placeholder="+91 98765 43210" />
          </FormField>
          <FormField label="Department">
            <SelectInput value={form.department} onChange={v => f('department', v)} placeholder="Select department"
              options={DEPARTMENTS.map(d => ({ value: d, label: d }))} />
          </FormField>
          <FormField label="Designation">
            <input className="input" value={form.designation} onChange={e => f('designation', e.target.value)} placeholder="Software Engineer" />
          </FormField>
          {modal === 'create' && (
            <FormField label="Role">
              <SelectInput value={form.role} onChange={v => f('role', v)} options={ROLES.map(r => ({ value: r, label: r }))} />
            </FormField>
          )}
          <FormField label="Status">
            <SelectInput value={form.status} onChange={v => f('status', v)} options={STATUSES.map(s => ({ value: s, label: s }))} />
          </FormField>
        </div>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        open={modal === 'role'}
        onClose={() => setModal(null)}
        title={`Change Role — ${target?.name}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : null} Update Role
            </button>
          </>
        }
      >
        <FormField label="New Role">
          <SelectInput value={form.role} onChange={v => f('role', v)} options={ROLES.map(r => ({ value: r, label: r }))} />
        </FormField>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Deactivate User"
        message={`Are you sure you want to deactivate "${delModal?.name}"? They will lose access to the system.`}
      />
    </div>
  )
}

const roleColor = r => ({
  admin:    'bg-brand-500/20 text-brand-300 border-brand-500/30',
  manager:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  employee: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
}[r] ?? '')
