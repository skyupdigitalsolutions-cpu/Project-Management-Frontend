import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, UserMinus, Pencil, Clock } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, StatCard, SelectInput, Modal,
  FormField, StatusBadge, Spinner, EmptyState
} from '../../components/common/UI'

const STATUSES = ['present', 'absent', 'late', 'on-leave', 'half-day']

export default function AdminAttendance() {
  const [records,     setRecords]     = useState([])
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [dateF,       setDateF]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [statusF,     setStatusF]     = useState('')
  const [roleF,       setRoleF]       = useState('')          // NEW: filter by role
  const [editModal,   setEditModal]   = useState(null)
  const [absentModal, setAbsentModal] = useState(false)
  const [absentIds,   setAbsentIds]   = useState([])
  const [form,        setForm]        = useState({ status: '', clock_in: '', clock_out: '' })
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateF)   params.date   = dateF
      if (statusF) params.status = statusF
      // Fetch ALL active users (employees + managers) for the mark-absent modal
      const [r, u] = await Promise.all([
        api.get('/attendance', { params }),
        api.get('/users', { params: { status: 'active' } }),
      ])
      setRecords(r.data.data ?? [])
      // Keep only employee + manager roles for the absent modal
      setUsers((u.data.data ?? []).filter(u => ['employee', 'manager'].includes(u.role)))
    } catch { toast.error('Failed to load attendance') }
    finally { setLoading(false) }
  }, [dateF, statusF])

  useEffect(() => { load() }, [load])

  const openEdit = (rec) => {
    setForm({
      status:    rec.status ?? '',
      clock_in:  rec.clock_in  ? format(new Date(rec.clock_in),  'HH:mm') : '',
      clock_out: rec.clock_out ? format(new Date(rec.clock_out), 'HH:mm') : '',
    })
    setEditModal(rec)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch(`/attendance/${editModal._id}`, form)
      toast.success('Record updated'); setEditModal(null); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const handleMarkAbsent = async () => {
    if (absentIds.length === 0) { toast.error('Select at least one user'); return }
    setSaving(true)
    try {
      await api.post('/attendance/mark-absent', { user_ids: absentIds, date: dateF })
      toast.success(`Marked ${absentIds.length} user(s) absent`)
      setAbsentModal(false); setAbsentIds([]); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  // Apply role filter client-side (attendance records already include user_id populated)
  const filtered = roleF
    ? records.filter(r => r.user_id?.role === roleF)
    : records

  const present = filtered.filter(r => r.status === 'present').length
  const absent  = filtered.filter(r => r.status === 'absent').length
  const late    = filtered.filter(r => r.status === 'late').length

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Attendance"
        subtitle="Track and manage all staff attendance — employees and managers"
        action={
          <button className="btn-secondary flex items-center gap-2" onClick={() => setAbsentModal(true)}>
            <UserMinus size={16} /> Mark Absent
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present" value={present} icon={Clock} color="emerald" />
        <StatCard label="Absent"  value={absent}  icon={Clock} color="red" />
        <StatCard label="Late"    value={late}    icon={Clock} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date" value={dateF}
          onChange={e => setDateF(e.target.value)}
          className="input w-44"
        />
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />
        {/* Role filter */}
        <SelectInput value={roleF} onChange={setRoleF} placeholder="All roles"
          options={[
            { value: 'employee', label: 'Employee' },
            { value: 'manager',  label: 'Manager'  },
          ]} className="w-36" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-200/50">
              <tr>
                {['Employee', 'Role', 'Department', 'Status', 'Clock In', 'Clock Out', 'Hours', 'Actions'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center"><Spinner /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={Clock} title="No records found" description="Try a different date or filter" /></td></tr>
              ) : filtered.map(r => {
                const hrs = r.clock_in && r.clock_out
                  ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1)
                  : null
                const roleBadgeColor = r.user_id?.role === 'manager'
                  ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                  : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                return (
                  <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xs">
                          {(r.user_id?.name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white">{r.user_id?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${roleBadgeColor}`}>
                        {r.user_id?.role ?? '—'}
                      </span>
                    </td>
                    <td className="table-cell text-slate-400 text-sm">{r.user_id?.department ?? '—'}</td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell text-slate-400 font-mono text-xs">
                      {r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}
                    </td>
                    <td className="table-cell text-slate-400 font-mono text-xs">
                      {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}
                    </td>
                    <td className="table-cell text-slate-400 text-xs">{hrs ? `${hrs}h` : '—'}</td>
                    <td className="table-cell">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={!!editModal} onClose={() => setEditModal(null)}
        title="Edit Attendance Record"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditModal(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : null} Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Status">
            <SelectInput value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
              options={STATUSES.map(s => ({ value: s, label: s }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Clock In (HH:mm)">
              <input className="input" type="time" value={form.clock_in}
                onChange={e => setForm(f => ({ ...f, clock_in: e.target.value }))} />
            </FormField>
            <FormField label="Clock Out (HH:mm)">
              <input className="input" type="time" value={form.clock_out}
                onChange={e => setForm(f => ({ ...f, clock_out: e.target.value }))} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Mark absent modal — shows both employees and managers */}
      <Modal
        open={absentModal} onClose={() => { setAbsentModal(false); setAbsentIds([]) }}
        title="Mark Users Absent"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setAbsentModal(false); setAbsentIds([]) }} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleMarkAbsent} disabled={saving}>
              {saving ? <Spinner size="sm" /> : null} Mark Absent
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Select users to mark as absent for <span className="text-white font-semibold">{dateF}</span>:</p>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-white/5 rounded-xl p-2">
            {users.map(u => (
              <label key={u._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={absentIds.includes(u._id)}
                  onChange={e => setAbsentIds(ids => e.target.checked ? [...ids, u._id] : ids.filter(id => id !== u._id))}
                  className="w-4 h-4 accent-brand-500" />
                <span className="text-sm text-slate-300">{u.name}</span>
                <span className={`text-xs ml-auto px-1.5 py-0.5 rounded-full border capitalize ${
                  u.role === 'manager'
                    ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                    : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                }`}>{u.role}</span>
                <span className="text-xs text-slate-500">{u.department}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">{absentIds.length} user(s) selected</p>
        </div>
      </Modal>
    </div>
  )
}