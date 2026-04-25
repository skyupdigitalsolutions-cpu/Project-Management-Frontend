import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, UserMinus, Pencil, Clock, CalendarOff,
  CheckCircle2, XCircle, AlertCircle, Fingerprint,
  Wifi, WifiOff, Link2, Users, Settings
} from 'lucide-react'
import api, { fetchAllLeaves, updateLeaveStatus } from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, StatCard, SelectInput, Modal,
  FormField, StatusBadge, Spinner, EmptyState
} from '../../components/common/UI'

const STATUSES = ['present', 'absent', 'late', 'on-leave', 'half-day']

const LEAVE_TYPES = [
  { value: 'sick',      label: 'Sick Leave' },
  { value: 'casual',    label: 'Casual Leave' },
  { value: 'earned',    label: 'Earned Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'unpaid',    label: 'Unpaid Leave' },
]

const LEAVE_STATUS_CONFIG = {
  pending:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',     icon: AlertCircle  },
  approved: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  rejected: { color: 'text-red-400 bg-red-500/10 border-red-500/20',           icon: XCircle      },
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-brand-600 text-gray-800 shadow' : 'text-neutral hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Source Badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  if (source === 'fingerprint') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-medium">
        <Fingerprint size={9} /> Biometric
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 font-medium">
      Manual
    </span>
  )
}

export default function AdminAttendance() {
  const [activeTab,    setActiveTab]    = useState('attendance')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetchAllLeaves({ status: 'pending' })
      .then(data => setPendingCount(data.filter(l => l.status === 'pending').length))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Attendance" subtitle="Track staff attendance and manage leave applications" />

      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl w-fit flex-wrap">
        <TabBtn active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')}>
          <Clock size={14} /> Attendance
        </TabBtn>
        <TabBtn active={activeTab === 'fingerprint'} onClick={() => setActiveTab('fingerprint')}>
          <Fingerprint size={14} /> Fingerprint Setup
        </TabBtn>
        <TabBtn active={activeTab === 'leaves'} onClick={() => setActiveTab('leaves')}>
          <CalendarOff size={14} /> Leave Requests
          {pendingCount > 0 && (
            <span className="ml-1 bg-amber-500 text-gray-800 text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {pendingCount}
            </span>
          )}
        </TabBtn>
      </div>

      {activeTab === 'attendance'   && <AttendanceTab />}
      {activeTab === 'fingerprint'  && <FingerprintSetupTab />}
      {activeTab === 'leaves'       && <LeaveApprovalTab onCountChange={setPendingCount} />}
    </div>
  )
}

// ─── Attendance Tab ──────────────────────────────────────────────────────────
function AttendanceTab() {
  const [records,     setRecords]     = useState([])
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [dateF,       setDateF]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [statusF,     setStatusF]     = useState('')
  const [roleF,       setRoleF]       = useState('')
  const [editModal,   setEditModal]   = useState(null)
  const [absentModal, setAbsentModal] = useState(false)
  const [syncModal,   setSyncModal]   = useState(false)
  const [absentIds,   setAbsentIds]   = useState([])
  const [form,        setForm]        = useState({ status: '', clock_in: '', clock_out: '' })
  const [syncForm,    setSyncForm]    = useState({ ip: '', port: '4370' })
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateF)   params.date   = dateF
      if (statusF) params.status = statusF
      const [r, u] = await Promise.all([
        api.get('/attendance', { params }),
        api.get('/users', { params: { status: 'active' } }),
      ])
      setRecords(r.data.data ?? [])
      setUsers((u.data.data ?? []).filter(u => ['employee', 'manager'].includes(u.role)))
    } catch { toast.error('Failed to load attendance') } finally { setLoading(false) }
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
      toast.success('Record updated')
      setEditModal(null)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  const handleMarkAbsent = async () => {
    if (!absentIds.length) { toast.error('Select at least one user'); return }
    setSaving(true)
    try {
      await api.post('/attendance/mark-absent', { user_ids: absentIds, date: dateF })
      toast.success(`Marked ${absentIds.length} absent`)
      setAbsentModal(false)
      setAbsentIds([])
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  // ─── TCP Pull sync from device ──────────────────────────────────────────
  const handleTcpSync = async () => {
    if (!syncForm.ip) { toast.error('Enter device IP address'); return }
    setSyncing(true)
    try {
      const res = await api.post('/essl/sync', {
        ip:   syncForm.ip,
        port: Number(syncForm.port) || 4370,
      })
      const { saved = 0, skipped = 0, total_logs = 0 } = res.data
      toast.success(`Sync complete — ${saved} records saved, ${skipped} unlinked, ${total_logs} total punches`)
      setSyncModal(false)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Sync failed — check device IP & connection') }
    finally { setSyncing(false) }
  }

  const filtered = roleF ? records.filter(r => r.user_id?.role === roleF) : records
  const present  = filtered.filter(r => r.status === 'present').length
  const absent   = filtered.filter(r => r.status === 'absent').length
  const late     = filtered.filter(r => r.status === 'late').length
  const fromFp   = filtered.filter(r => r.source === 'fingerprint').length

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Present"    value={present} icon={Clock}        color="emerald" />
        <StatCard label="Absent"     value={absent}  icon={Clock}        color="red"     />
        <StatCard label="Late"       value={late}    icon={Clock}        color="amber"   />
        <StatCard label="Biometric"  value={fromFp}  icon={Fingerprint}  color="purple"  />
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            type="date" value={dateF}
            onChange={e => setDateF(e.target.value)}
            className="input w-44"
          />
          <SelectInput
            value={statusF} onChange={setStatusF}
            placeholder="All statuses"
            options={STATUSES.map(s => ({ value: s, label: s }))}
            className="w-40"
          />
          <SelectInput
            value={roleF} onChange={setRoleF}
            placeholder="All roles"
            options={[{ value: 'employee', label: 'Employee' }, { value: 'manager', label: 'Manager' }]}
            className="w-36"
          />
          <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => setSyncModal(true)}
            title="Pull attendance from fingerprint device over network"
          >
            <Wifi size={15} /> Sync Device
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => setAbsentModal(true)}
          >
            <UserMinus size={16} /> Mark Absent
          </button>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100/50">
              <tr>
                {['Employee', 'Role', 'Department', 'Status', 'Clock In', 'Clock Out', 'Hours', 'Source', 'Actions']
                  .map(h => <th key={h} className="table-header text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={9} className="py-16 text-center"><Spinner /></td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={9}><EmptyState icon={Clock} title="No records found" description="Try a different date or filter" /></td></tr>
                  : filtered.map(r => {
                    const hrs = r.clock_in && r.clock_out
                      ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(1)
                      : null
                    const roleBadge = r.user_id?.role === 'manager'
                      ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                      : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    return (
                      <tr key={r._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[10px]">
                              {(r.user_id?.name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-800">{r.user_id?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${roleBadge}`}>
                            {r.user_id?.role ?? '—'}
                          </span>
                        </td>
                        <td className="table-cell text-neutral text-sm">{r.user_id?.department ?? '—'}</td>
                        <td className="table-cell"><StatusBadge status={r.status} /></td>
                        <td className="table-cell text-neutral font-mono text-sm">
                          {r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}
                        </td>
                        <td className="table-cell text-neutral font-mono text-sm">
                          {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}
                        </td>
                        <td className="table-cell text-neutral text-sm">{hrs ? `${hrs}h` : '—'}</td>
                        <td className="table-cell"><SourceBadge source={r.source} /></td>
                        <td className="table-cell">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1.5 rounded-lg text-neutral hover:text-gray-800 hover:bg-white/10"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Attendance Record"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditModal(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary"   onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : null} Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Status">
            <SelectInput
              value={form.status}
              onChange={v => setForm(f => ({ ...f, status: v }))}
              options={STATUSES.map(s => ({ value: s, label: s }))}
            />
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

      {/* TCP Sync Modal */}
      <Modal open={syncModal} onClose={() => setSyncModal(false)} title="Sync from Fingerprint Device"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSyncModal(false)} disabled={syncing}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleTcpSync} disabled={syncing}>
              {syncing ? <Spinner size="sm" /> : <Wifi size={14} />}
              {syncing ? 'Syncing...' : 'Start Sync'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Wifi size={16} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-300">
              Connects to your eSSL device over the local network and pulls all attendance logs.
              The device must be on the same network as your server.
            </p>
          </div>
          <FormField label="Device IP Address">
            <input
              className="input font-mono"
              placeholder="e.g. 192.168.1.100"
              value={syncForm.ip}
              onChange={e => setSyncForm(f => ({ ...f, ip: e.target.value }))}
            />
          </FormField>
          <FormField label="Port (default: 4370)">
            <input
              className="input font-mono"
              placeholder="4370"
              value={syncForm.port}
              onChange={e => setSyncForm(f => ({ ...f, port: e.target.value }))}
            />
          </FormField>
          <p className="text-xs text-neutral">
            Tip: Make sure employees have their <strong>Fingerprint ID</strong> mapped in the
            <span className="text-violet-400"> Fingerprint Setup</span> tab before syncing.
          </p>
        </div>
      </Modal>

      {/* Mark Absent Modal */}
      <Modal open={absentModal} onClose={() => { setAbsentModal(false); setAbsentIds([]) }} title="Mark Users Absent"
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
          <p className="text-sm text-neutral">
            Select users to mark as absent for{' '}
            <span className="text-gray-800 font-semibold">{dateF}</span>:
          </p>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
            {users.map(u => (
              <label key={u._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={absentIds.includes(u._id)}
                  onChange={e => setAbsentIds(ids =>
                    e.target.checked ? [...ids, u._id] : ids.filter(id => id !== u._id)
                  )}
                  className="w-4 h-4 accent-brand-500"
                />
                <span className="text-sm text-gray-600">{u.name}</span>
                <span className={`text-[10px] ml-auto px-1.5 py-0.5 rounded-full border capitalize ${
                  u.role === 'manager' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                }`}>{u.role}</span>
                <span className="text-[10px] text-neutral">{u.department}</span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-neutral">{absentIds.length} user(s) selected</p>
        </div>
      </Modal>
    </>
  )
}

// ─── Fingerprint Setup Tab ────────────────────────────────────────────────────
function FingerprintSetupTab() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState(null)   // user being edited
  const [fpInput,  setFpInput]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/essl/fingerprint-map')
      setUsers(res.data.data ?? [])
    } catch { toast.error('Failed to load fingerprint map') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (user) => {
    setEditUser(user)
    setFpInput(user.fingerprint_id ?? '')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/essl/assign-fingerprint', {
        user_id:        editUser._id,
        fingerprint_id: fpInput.trim(),
      })
      toast.success(`Fingerprint ID "${fpInput.trim()}" assigned to ${editUser.name}`)
      setEditUser(null)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to assign') }
    finally { setSaving(false) }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  )

  const linked   = users.filter(u => u.fingerprint_id).length
  const unlinked = users.length - linked

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Employees" value={users.length}  icon={Users}        color="blue"   />
        <StatCard label="Linked"          value={linked}        icon={Fingerprint}  color="emerald" />
        <StatCard label="Not Linked"      value={unlinked}      icon={WifiOff}      color="amber"  />
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
        <Settings size={18} className="text-violet-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-violet-300">How ADMS Auto-Push Works</p>
          <p className="text-sm text-violet-200/70">
            On your eSSL device go to <strong>Menu → Comm → ADMS</strong> and set the server
            address to <code className="bg-violet-900/40 px-1 rounded text-violet-200">http://YOUR_SERVER_IP:PORT/api/essl/iclock/cdata</code>.
            The device will automatically push every punch to your server in real time.
            No manual sync needed once configured.
          </p>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Link2 size={15} /> Employee → Fingerprint ID Mapping
          </h3>
          <input
            className="input w-52"
            placeholder="Search name or dept..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100/50">
              <tr>
                {['Employee', 'Department', 'Designation', 'Fingerprint ID', 'Status', 'Action'].map(h =>
                  <th key={h} className="table-header text-left">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6} className="py-16 text-center"><Spinner /></td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon={Fingerprint} title="No employees" description="No employees found" /></td></tr>
                  : filtered.map(u => (
                    <tr key={u._id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[10px]">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="table-cell text-neutral text-sm">{u.department}</td>
                      <td className="table-cell text-neutral text-sm">{u.designation}</td>
                      <td className="table-cell">
                        {u.fingerprint_id
                          ? <span className="inline-flex items-center gap-1.5 font-mono text-sm px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300">
                              <Fingerprint size={11} /> {u.fingerprint_id}
                            </span>
                          : <span className="text-xs text-neutral italic">Not assigned</span>
                        }
                      </td>
                      <td className="table-cell">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                          u.status === 'active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-gray-400 bg-gray-500/10 border-gray-500/20'
                        }`}>{u.status}</span>
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                          title="Assign Fingerprint ID"
                        >
                          <Fingerprint size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Fingerprint Modal */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Assign Fingerprint ID"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditUser(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving || !fpInput.trim()}>
              {saving ? <Spinner size="sm" /> : <Fingerprint size={14} />} Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-100/50">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
              {editUser?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{editUser?.name}</p>
              <p className="text-xs text-neutral">{editUser?.department} · {editUser?.designation}</p>
            </div>
          </div>
          <FormField label="Fingerprint ID (from device enrollment)">
            <input
              className="input font-mono text-lg tracking-widest"
              placeholder="e.g. 1, 42, 100"
              value={fpInput}
              onChange={e => setFpInput(e.target.value)}
              autoFocus
            />
          </FormField>
          <p className="text-xs text-neutral">
            This is the <strong>Employee ID</strong> that was used when enrolling the employee's
            fingerprint on the eSSL device. Check the device's user list (Menu → User Mgt) to find it.
          </p>
        </div>
      </Modal>
    </>
  )
}

// ─── Leave Approval Tab ──────────────────────────────────────────────────────
function LeaveApprovalTab({ onCountChange }) {
  const [leaves,      setLeaves]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [statusF,     setStatusF]     = useState('pending')
  const [roleF,       setRoleF]       = useState('')
  const [viewModal,   setViewModal]   = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      const data = await fetchAllLeaves(params)
      const filtered = roleF ? data.filter(l => l.user_id?.role === roleF) : data
      setLeaves(filtered)
      onCountChange(data.filter(l => l.status === 'pending').length)
    } catch { toast.error('Failed to load leave requests') } finally { setLoading(false) }
  }, [statusF, roleF, onCountChange])

  useEffect(() => { load() }, [load])

  const handleAction = async (action) => {
    setSaving(true)
    try {
      await updateLeaveStatus(actionModal.leave._id, action)
      toast.success(`Leave ${action}d`)
      setActionModal(null)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <SelectInput
            value={statusF} onChange={setStatusF}
            placeholder="All statuses"
            options={['pending', 'approved', 'rejected'].map(s => ({ value: s, label: s }))}
            className="w-40"
          />
          <SelectInput
            value={roleF} onChange={setRoleF}
            placeholder="All roles"
            options={[{ value: 'employee', label: 'Employee' }, { value: 'manager', label: 'Manager' }]}
            className="w-36"
          />
          <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100/50">
              <tr>
                {['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h =>
                  <th key={h} className="table-header text-left">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} className="py-16 text-center"><Spinner /></td></tr>
                : leaves.length === 0
                  ? <tr><td colSpan={8}><EmptyState icon={CalendarOff} title="No leave requests" description="No requests match the filter" /></td></tr>
                  : leaves.map(l => {
                    const cfg = LEAVE_STATUS_CONFIG[l.status] ?? LEAVE_STATUS_CONFIG.pending
                    const Icon = cfg.icon
                    return (
                      <tr key={l._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[10px]">
                              {(l.user_id?.name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{l.user_id?.name ?? '—'}</p>
                              <p className="text-[10px] text-neutral capitalize">{l.user_id?.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell text-sm text-neutral capitalize">
                          {LEAVE_TYPES.find(t => t.value === l.leave_type)?.label ?? l.leave_type}
                        </td>
                        <td className="table-cell text-sm font-mono text-neutral">
                          {l.start_date ? format(new Date(l.start_date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="table-cell text-sm font-mono text-neutral">
                          {l.end_date ? format(new Date(l.end_date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="table-cell text-sm text-neutral">{l.days ?? '—'}</td>
                        <td className="table-cell text-sm text-neutral max-w-[160px] truncate">{l.reason ?? '—'}</td>
                        <td className="table-cell">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border capitalize ${cfg.color}`}>
                            <Icon size={10} /> {l.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewModal(l)} className="p-1.5 rounded-lg text-neutral hover:text-gray-800 hover:bg-white/10" title="View">
                              <AlertCircle size={13} />
                            </button>
                            {l.status === 'pending' && (
                              <>
                                <button onClick={() => setActionModal({ leave: l, action: 'approve' })} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10" title="Approve">
                                  <CheckCircle2 size={13} />
                                </button>
                                <button onClick={() => setActionModal({ leave: l, action: 'reject' })} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10" title="Reject">
                                  <XCircle size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title="Leave Request Details"
        footer={<button className="btn-secondary" onClick={() => setViewModal(null)}>Close</button>}
      >
        {viewModal && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-neutral text-xs mb-1">Employee</p><p className="font-medium text-gray-800">{viewModal.user_id?.name}</p></div>
              <div><p className="text-neutral text-xs mb-1">Type</p><p className="capitalize">{LEAVE_TYPES.find(t => t.value === viewModal.leave_type)?.label}</p></div>
              <div><p className="text-neutral text-xs mb-1">From</p><p>{viewModal.start_date ? format(new Date(viewModal.start_date), 'dd MMM yyyy') : '—'}</p></div>
              <div><p className="text-neutral text-xs mb-1">To</p><p>{viewModal.end_date ? format(new Date(viewModal.end_date), 'dd MMM yyyy') : '—'}</p></div>
            </div>
            <div><p className="text-neutral text-xs mb-1">Reason</p><p className="text-gray-800">{viewModal.reason}</p></div>
          </div>
        )}
      </Modal>

      {/* Confirm Action Modal */}
      <Modal
        open={!!actionModal}
        onClose={() => setActionModal(null)}
        title={`${actionModal?.action === 'approve' ? 'Approve' : 'Reject'} Leave Request`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setActionModal(null)} disabled={saving}>Cancel</button>
            <button
              className={actionModal?.action === 'approve' ? 'btn-primary' : 'bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600'}
              onClick={() => handleAction(actionModal.action)}
              disabled={saving}
            >
              {saving ? <Spinner size="sm" /> : null}
              {actionModal?.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral">
          Are you sure you want to <strong className="text-gray-800">{actionModal?.action}</strong> the leave
          request from <strong className="text-gray-800">{actionModal?.leave?.user_id?.name}</strong>?
        </p>
      </Modal>
    </>
  )
}
