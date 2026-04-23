import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, UserMinus, Pencil, Clock, CalendarOff, CheckCircle2, XCircle, AlertCircle, Eye, Users } from 'lucide-react'
import api, { fetchAllLeaves, updateLeaveStatus } from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { PageHeader, StatCard, SelectInput, Modal, FormField, StatusBadge, Spinner, EmptyState } from '../../components/common/UI'

const STATUSES = ['present', 'absent', 'late', 'on-leave', 'half-day']

const LEAVE_TYPES = [
  { value: 'sick',      label: 'Sick Leave' },
  { value: 'casual',    label: 'Casual Leave' },
  { value: 'earned',    label: 'Earned Leave'},
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'emergency', label: 'Emergency Leave'},
  { value: 'unpaid',    label: 'Unpaid Leave'},
]

const LEAVE_STATUS_CONFIG = {
  pending:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   icon: AlertCircle  },
  approved: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  rejected: { color: 'text-red-400 bg-red-500/10 border-red-500/20',        icon: XCircle      },
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active ? 'bg-brand-600 text-gray-800 shadow' : 'text-neutral hover:text-gray-800'
    }`}>{children}</button>
  )
}

export default function AdminAttendance() {
  const [activeTab, setActiveTab] = useState('attendance')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetchAllLeaves({ status: 'pending' })
      .then(data => setPendingCount(data.filter(l => l.status === 'pending').length))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Attendance" subtitle="Track staff attendance and manage leave applications" />

      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl w-fit">
        <TabBtn active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')}><Clock size={14} /> Attendance</TabBtn>
        <TabBtn active={activeTab === 'leaves'} onClick={() => setActiveTab('leaves')}>
          <CalendarOff size={14} /> Leave Requests
          {pendingCount > 0 && <span className="ml-1 bg-amber-500 text-gray-800 text-[16px] rounded-full w-5 h-5 flex items-center justify-center font-bold">{pendingCount}</span>}
        </TabBtn>
      </div>

      {activeTab === 'attendance' && <AttendanceTab />}
      {activeTab === 'leaves'     && <LeaveApprovalTab onCountChange={setPendingCount} />}
    </div>
  )
}

// ─── Attendance Tab ──────────────────────────────────────────────────────────
function AttendanceTab() {
  const [records,     setRecords]     = useState([])
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [dateF,       setDateF]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [statusF,     setStatusF]     = useState('')
  const [roleF,       setRoleF]       = useState('')
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
      const [r, u] = await Promise.all([api.get('/attendance', { params }), api.get('/users', { params: { status: 'active' } })])
      setRecords(r.data.data ?? [])
      setUsers((u.data.data ?? []).filter(u => ['employee', 'manager'].includes(u.role)))
    } catch { toast.error('Failed to load attendance') } finally { setLoading(false) }
  }, [dateF, statusF])

  useEffect(() => { load() }, [load])

  const openEdit = (rec) => {
    setForm({ status: rec.status ?? '', clock_in: rec.clock_in ? format(new Date(rec.clock_in), 'HH:mm') : '', clock_out: rec.clock_out ? format(new Date(rec.clock_out), 'HH:mm') : '' })
    setEditModal(rec)
  }

  const handleSave = async () => {
    setSaving(true)
    try { await api.patch(`/attendance/${editModal._id}`, form); toast.success('Record updated'); setEditModal(null); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  const handleMarkAbsent = async () => {
    if (!absentIds.length) { toast.error('Select at least one user'); return }
    setSaving(true)
    try { await api.post('/attendance/mark-absent', { user_ids: absentIds, date: dateF }); toast.success(`Marked ${absentIds.length} absent`); setAbsentModal(false); setAbsentIds([]); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  const filtered = roleF ? records.filter(r => r.user_id?.role === roleF) : records
  const present = filtered.filter(r => r.status === 'present').length
  const absent  = filtered.filter(r => r.status === 'absent').length
  const late    = filtered.filter(r => r.status === 'late').length

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present" value={present} icon={Clock} color="emerald" />
        <StatCard label="Absent"  value={absent}  icon={Clock} color="red" />
        <StatCard label="Late"    value={late}    icon={Clock} color="amber" />
      </div>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <input type="date" value={dateF} onChange={e => setDateF(e.target.value)} className="input w-44" />
          <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses" options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />
          <SelectInput value={roleF} onChange={setRoleF} placeholder="All roles" options={[{ value: 'employee', label: 'Employee' }, { value: 'manager', label: 'Manager' }]} className="w-36" />
          <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={() => setAbsentModal(true)}><UserMinus size={16} /> Mark Absent</button>
      </div>
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100/50">
              <tr>{['Employee', 'Role', 'Department', 'Status', 'Clock In', 'Clock Out', 'Hours', 'Actions'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="py-16 text-center"><Spinner /></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8}><EmptyState icon={Clock} title="No records found" description="Try a different date or filter" /></td></tr>
              : filtered.map(r => {
                const hrs = r.clock_in && r.clock_out ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1) : null
                const roleBadge = r.user_id?.role === 'manager' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                return (
                  <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[16px]">{(r.user_id?.name ?? '?').charAt(0).toUpperCase()}</div>
                        <span className="text-sm font-medium text-gray-800">{r.user_id?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="table-cell"><span className={`text-[16px] px-2 py-0.5 rounded-full border capitalize ${roleBadge}`}>{r.user_id?.role ?? '—'}</span></td>
                    <td className="table-cell text-neutral text-sm">{r.user_id?.department ?? '—'}</td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell text-neutral font-mono text-[16px]">{r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}</td>
                    <td className="table-cell text-neutral font-mono text-[16px]">{r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}</td>
                    <td className="table-cell text-neutral text-[16px]">{hrs ? `${hrs}h` : '—'}</td>
                    <td className="table-cell"><button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-neutral hover:text-gray-800 hover:bg-white/10"><Pencil size={13} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Attendance Record"
        footer={<><button className="btn-secondary" onClick={() => setEditModal(null)} disabled={saving}>Cancel</button><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? <Spinner size="sm" /> : null} Save</button></>}>
        <div className="space-y-4">
          <FormField label="Status"><SelectInput value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={STATUSES.map(s => ({ value: s, label: s }))} /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Clock In (HH:mm)"><input className="input" type="time" value={form.clock_in} onChange={e => setForm(f => ({ ...f, clock_in: e.target.value }))} /></FormField>
            <FormField label="Clock Out (HH:mm)"><input className="input" type="time" value={form.clock_out} onChange={e => setForm(f => ({ ...f, clock_out: e.target.value }))} /></FormField>
          </div>
        </div>
      </Modal>
      <Modal open={absentModal} onClose={() => { setAbsentModal(false); setAbsentIds([]) }} title="Mark Users Absent"
        footer={<><button className="btn-secondary" onClick={() => { setAbsentModal(false); setAbsentIds([]) }} disabled={saving}>Cancel</button><button className="btn-primary" onClick={handleMarkAbsent} disabled={saving}>{saving ? <Spinner size="sm" /> : null} Mark Absent</button></>}>
        <div className="space-y-3">
          <p className="text-sm text-neutral">Select users to mark as absent for <span className="text-gray-800 font-semibold">{dateF}</span>:</p>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
            {users.map(u => (
              <label key={u._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={absentIds.includes(u._id)} onChange={e => setAbsentIds(ids => e.target.checked ? [...ids, u._id] : ids.filter(id => id !== u._id))} className="w-4 h-4 accent-brand-500" />
                <span className="text-sm text-gray-600">{u.name}</span>
                <span className={`text-[16px] ml-auto px-1.5 py-0.5 rounded-full border capitalize ${u.role === 'manager' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'}`}>{u.role}</span>
                <span className="text-[16px] text-neutral">{u.department}</span>
              </label>
            ))}
          </div>
          <p className="text-[16px] text-neutral">{absentIds.length} user(s) selected</p>
        </div>
      </Modal>
    </>
  )
}

// ─── Leave Approval Tab ──────────────────────────────────────────────────────
function LeaveApprovalTab({ onCountChange }) {
  const [leaves,  setLeaves]  = useState([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState('pending')
  const [roleF,   setRoleF]   = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [actionModal, setActionModal] = useState(null) // { leave, action: 'approve'|'reject' }
  const [adminNote, setAdminNote] = useState('')
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      if (roleF)   params.role   = roleF
      const data = await fetchAllLeaves(params)
      setLeaves(data)
      if (statusF === 'pending' || !statusF) {
        onCountChange(data.filter(l => l.status === 'pending').length)
      }
    } catch { toast.error('Failed to load leave requests') } finally { setLoading(false) }
  }, [statusF, roleF])

  useEffect(() => { load() }, [load])

  const handleAction = async () => {
    setSaving(true)
    try {
      const newStatus = actionModal.action === 'approve' ? 'approved' : 'rejected'
      const result = await updateLeaveStatus(actionModal.leave._id, newStatus, adminNote)
      if (result.ok) {
        toast.success(`Leave ${actionModal.action === 'approve' ? 'approved' : 'rejected'} successfully`)
        setActionModal(null); setAdminNote(''); load()
      } else if (result.unsupported) {
        toast.error('Leave management is not yet enabled on this server.')
        setActionModal(null)
      } else {
        toast.error(result.message)
      }
    } finally { setSaving(false) }
  }

  const pendingCount = leaves.filter(l => l.status === 'pending').length
  const approvedCount = leaves.filter(l => l.status === 'approved').length
  const rejectedCount = leaves.filter(l => l.status === 'rejected').length

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending"  value={pendingCount}  icon={AlertCircle}  color="amber"   />
        <StatCard label="Approved" value={approvedCount} icon={CheckCircle2} color="emerald" />
        <StatCard label="Rejected" value={rejectedCount} icon={XCircle}      color="red"     />
      </div>

      <div className="flex flex-wrap gap-3">
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]}
          className="w-40" />
        <SelectInput value={roleF} onChange={setRoleF} placeholder="All roles"
          options={[{ value: 'employee', label: 'Employee' }, { value: 'manager', label: 'Manager' }]}
          className="w-36" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : leaves.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <CalendarOff size={40} className="text-neutral mb-4" />
            <p className="text-neutral font-medium">No leave requests found</p>
            <p className="text-neutral text-sm mt-1">
              {statusF === 'pending' ? 'No pending requests — all clear!' : 'Try changing the filters above'}
            </p>
          </div>
        ) : leaves.map(leave => {
          const cfg = LEAVE_STATUS_CONFIG[leave.status] ?? LEAVE_STATUS_CONFIG.pending
          const StatusIcon = cfg.icon
          const lt = LEAVE_TYPES.find(t => t.value === leave.leave_type)
          const roleBadge = leave.user_id?.role === 'manager' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
          return (
            <div key={leave._id} className="card hover:border-gray-200 transition-all">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="text-2xl mt-0.5 flex-shrink-0">{lt?.icon ?? ''}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Applicant */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[16px] flex-shrink-0">
                          {(leave.user_id?.name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800 text-sm">{leave.user_id?.name ?? 'Unknown'}</span>
                      </div>
                      <span className={`text-[16px] px-1.5 py-0.5 rounded-full border capitalize ${roleBadge}`}>{leave.user_id?.role ?? '—'}</span>
                      <span className="text-neutral text-[16px]">{leave.user_id?.department ?? ''}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-gray-600 font-medium">{lt?.label ?? leave.leave_type}</span>
                      <span className={`inline-flex items-center gap-1 text-[16px] px-2 py-0.5 rounded-full border ${cfg.color}`}><StatusIcon size={11} /> {leave.status}</span>
                      {leave.is_urgent && <span className="text-[16px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">🚨 Urgent</span>}
                    </div>
                    <p className="text-neutral text-[16px] mt-1">
                      {leave.from_date ? format(parseISO(leave.from_date.slice(0, 10)), 'MMM d, yyyy') : '—'} → {leave.to_date ? format(parseISO(leave.to_date.slice(0, 10)), 'MMM d, yyyy') : '—'}
                      {leave.days && <span className="ml-2 text-primary font-semibold">{leave.days} day{leave.days !== 1 ? 's' : ''}</span>}
                    </p>
                    {leave.reason && <p className="text-neutral text-[16px] mt-1 italic truncate max-w-md">"{leave.reason}"</p>}
                    {leave.admin_note && (
                      <p className={`text-[16px] mt-1.5 px-2 py-1 rounded-lg border inline-block ${leave.status === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                        Note: {leave.admin_note}
                      </p>
                    )}
                    {leave.documents?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {leave.documents.map((doc, i) => (
                          <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[16px] text-neutral hover:text-gray-800 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 hover:border-gray-200 transition-all">
                            <Eye size={10} /> {doc.name ?? `Doc ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-[16px] text-neutral">{leave.createdAt ? format(new Date(leave.createdAt), 'MMM d, yyyy') : ''}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewModal(leave)} className="btn-secondary py-1.5 px-3 text-[16px] flex items-center gap-1.5">
                      <Eye size={13} /> View
                    </button>
                    {leave.status === 'pending' && (
                      <>
                        <button onClick={() => { setActionModal({ leave, action: 'approve' }); setAdminNote('') }}
                          className="py-1.5 px-3 text-[16px] rounded-xl border font-medium transition-all bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1.5">
                          <CheckCircle2 size={13} /> Approve
                        </button>
                        <button onClick={() => { setActionModal({ leave, action: 'reject' }); setAdminNote('') }}
                          className="py-1.5 px-3 text-[16px] rounded-xl border font-medium transition-all bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center gap-1.5">
                          <XCircle size={13} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* View details modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title="Leave Request Details"
        footer={
          viewModal?.status === 'pending'
            ? <div className="flex gap-2">
                <button onClick={() => { setActionModal({ leave: viewModal, action: 'approve' }); setAdminNote(''); setViewModal(null) }} className="py-2 px-4 text-sm rounded-xl border font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1.5"><CheckCircle2 size={14} /> Approve</button>
                <button onClick={() => { setActionModal({ leave: viewModal, action: 'reject'  }); setAdminNote(''); setViewModal(null) }} className="py-2 px-4 text-sm rounded-xl border font-medium bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center gap-1.5"><XCircle size={14} /> Reject</button>
              </div>
            : <button className="btn-secondary" onClick={() => setViewModal(null)}>Close</button>
        }>
        {viewModal && (() => {
          const lt = LEAVE_TYPES.find(t => t.value === viewModal.leave_type)
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">{(viewModal.user_id?.name ?? '?').charAt(0).toUpperCase()}</div>
                <div>
                  <p className="font-semibold text-gray-800">{viewModal.user_id?.name ?? 'Unknown'}</p>
                  <p className="text-[16px] text-neutral capitalize">{viewModal.user_id?.role} · {viewModal.user_id?.department}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Leave Type',  `${lt?.icon} ${lt?.label ?? viewModal.leave_type}`],
                  ['Status',      viewModal.status],
                  ['From',        viewModal.from_date ? format(parseISO(viewModal.from_date.slice(0, 10)), 'EEE, MMM d yyyy') : '—'],
                  ['To',          viewModal.to_date   ? format(parseISO(viewModal.to_date.slice(0, 10)),   'EEE, MMM d yyyy') : '—'],
                  ['Duration',    `${viewModal.days ?? '?'} day(s)`],
                  ['Priority',    viewModal.is_urgent ? ' Urgent' : 'Normal'],
                  ['Applied On',  viewModal.createdAt ? format(new Date(viewModal.createdAt), 'MMM d, yyyy') : '—'],
                  ['Contact',     viewModal.contact_during_leave || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white/[0.02] p-3 rounded-xl border border-gray-100">
                    <p className="text-[16px] text-neutral mb-0.5">{k}</p>
                    <p className="text-sm font-medium text-gray-800 capitalize">{v}</p>
                  </div>
                ))}
              </div>
              {viewModal.reason && (
                <div className="bg-white/[0.02] p-3 rounded-xl border border-gray-100">
                  <p className="text-[16px] text-neutral mb-1">Reason</p>
                  <p className="text-sm text-gray-600">{viewModal.reason}</p>
                </div>
              )}
              {viewModal.handover_notes && (
                <div className="bg-white/[0.02] p-3 rounded-xl border border-gray-100">
                  <p className="text-[16px] text-neutral mb-1">Handover Notes</p>
                  <p className="text-sm text-gray-600">{viewModal.handover_notes}</p>
                </div>
              )}
              {viewModal.documents?.length > 0 && (
                <div>
                  <p className="text-[16px] text-neutral mb-2">Attached Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {viewModal.documents.map((doc, i) => (
                      <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-[16px] text-neutral hover:text-gray-800 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                        <Eye size={12} /> {doc.name ?? `Document ${i + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Approve / Reject action modal */}
      <Modal
        open={!!actionModal}
        onClose={() => { setActionModal(null); setAdminNote('') }}
        title={actionModal?.action === 'approve' ? ' Approve Leave Request' : ' Reject Leave Request'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setActionModal(null); setAdminNote('') }} disabled={saving}>Cancel</button>
            <button
              onClick={handleAction}
              disabled={saving}
              className={`py-2 px-4 text-sm rounded-xl border font-medium transition-all flex items-center gap-2 ${
                actionModal?.action === 'approve'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              }`}
            >
              {saving ? <Spinner size="sm" /> : actionModal?.action === 'approve' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              {actionModal?.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </>
        }
      >
        {actionModal && (() => {
          const lt = LEAVE_TYPES.find(t => t.value === actionModal.leave.leave_type)
          return (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${actionModal.action === 'approve' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl">{lt?.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{actionModal.leave.user_id?.name} — {lt?.label}</p>
                    <p className="text-[16px] text-neutral mt-0.5">
                      {actionModal.leave.from_date ? format(parseISO(actionModal.leave.from_date.slice(0, 10)), 'MMM d') : '—'} → {actionModal.leave.to_date ? format(parseISO(actionModal.leave.to_date.slice(0, 10)), 'MMM d, yyyy') : '—'}
                      {actionModal.leave.days && ` · ${actionModal.leave.days} day(s)`}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Admin Note <span className="text-neutral font-normal">(optional)</span></label>
                <textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder={actionModal.action === 'approve' ? 'Add a note for the employee (e.g. approved, enjoy your leave!)' : 'Reason for rejection...'}
                  className="input resize-none"
                />
                <p className="text-[16px] text-neutral mt-1">This note will be visible to the employee</p>
              </div>
            </div>
          )
        })()}
      </Modal>
    </>
  )
}
