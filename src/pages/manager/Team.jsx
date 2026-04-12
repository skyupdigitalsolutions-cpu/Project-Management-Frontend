import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Mail, Phone } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { PageHeader, SearchInput, SelectInput, StatusBadge, Spinner, EmptyState, StatCard } from '../../components/common/UI'
import { Users, UserCheck, Clock } from 'lucide-react'

export default function ManagerTeam() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [statusF, setStatusF] = useState('')
  const [deptF,   setDeptF]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { role: 'employee' }
      if (statusF) params.status     = statusF
      if (deptF)   params.department = deptF
      if (search)  params.search     = search
      const { data } = await api.get('/users', { params })
      setUsers(data.data ?? [])
    } catch { toast.error('Failed to load team') }
    finally { setLoading(false) }
  }, [search, statusF, deptF])

  useEffect(() => { load() }, [load])

  const active   = users.filter(u => u.status === 'active').length
  const onLeave  = users.filter(u => u.status === 'on-leave').length
  const depts    = [...new Set(users.map(u => u.department).filter(Boolean))]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="My Team" subtitle="View your team members and their current status" />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Members" value={users.length} icon={Users}     color="brand" />
        <StatCard label="Active"        value={active}       icon={UserCheck} color="emerald" />
        <StatCard label="On Leave"      value={onLeave}      icon={Clock}     color="amber" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search team members…" />
        </div>
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={['active','inactive','on-leave'].map(s => ({ value:s, label:s }))} className="w-40" />
        <SelectInput value={deptF} onChange={setDeptF} placeholder="All departments"
          options={depts.map(d => ({ value:d, label:d }))} className="w-44" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15}/></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg"/></div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No team members found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map(u => (
            <div key={u._id} className="card hover:border-white/10 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white truncate">{u.name}</p>
                    <StatusBadge status={u.status} />
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">{u.designation}</p>
                  <p className="text-xs text-slate-500">{u.department}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail size={12} className="flex-shrink-0" />
                  <span className="truncate">{u.email}</span>
                </div>
                {u.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone size={12} className="flex-shrink-0" />
                    <span>{u.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
