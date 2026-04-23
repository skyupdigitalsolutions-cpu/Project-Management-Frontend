import { useEffect, useState, useCallback } from 'react'
import {
  Video, Plus, Trash2, Bell, ExternalLink, Users,
  Clock, Calendar, RefreshCw, Edit2, X, Check, ChevronDown
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow, isPast } from 'date-fns'

// ─── tiny shared UI helpers ───────────────────────────────────────────────────

const Spinner = ({ sm }) => (
  <div className={`border-2 border-brand-500 border-t-transparent rounded-full animate-spin ${sm ? 'w-4 h-4' : 'w-8 h-8'}`} />
)

const Badge = ({ children, color = 'slate' }) => {
  const colors = {
    slate:   'bg-slate-700/50 text-gray-600',
    green:   'bg-emerald-600/20 text-emerald-300',
    yellow:  'bg-amber-600/20  text-amber-300',
    red:     'bg-red-600/20    text-red-300',
    brand:   'bg-purple-50  text-primary',
    purple:  'bg-purple-600/20 text-purple-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: 'zoom',        label: 'Zoom',         color: 'brand' },
  { value: 'google_meet', label: 'Google Meet',  color: 'green' },
  { value: 'other',       label: 'Other',        color: 'slate' },
]

const STATUS_OPTIONS = ['upcoming', 'ongoing', 'completed', 'cancelled']

const platformBadge = (p) => {
  const found = PLATFORMS.find(x => x.value === p)
  return <Badge color={found?.color ?? 'slate'}>{found?.label ?? p}</Badge>
}

const statusBadge = (s) => {
  const map = { upcoming: 'brand', ongoing: 'green', completed: 'slate', cancelled: 'red' }
  return <Badge color={map[s] ?? 'slate'}>{s}</Badge>
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-neutral hover:text-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Multi-select user picker ─────────────────────────────────────────────────

function UserPicker({ users, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const selectedUsers = users.filter(u => selected.includes(u._id))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-primary/30 transition-colors"
      >
        <span className="truncate">
          {selected.length === 0
            ? 'All employees (broadcast)'
            : `${selected.length} employee${selected.length > 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 ml-2 text-neutral" />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedUsers.map(u => (
            <span key={u._id} className="inline-flex items-center gap-1 bg-purple-50 text-primary text-xs px-2 py-0.5 rounded-full">
              {u.name}
              <button onClick={() => toggle(u._id)} className="hover:text-gray-800"><X size={10} /></button>
            </span>
          ))}
          <button onClick={() => onChange([])} className="text-xs text-neutral hover:text-red-400 px-1">Clear all</button>
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search employees…"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 placeholder-slate-600 focus:outline-none focus:border-primary/30"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-center text-neutral text-sm py-4">No results</p>
              : filtered.map(u => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => toggle(u._id)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selected.includes(u._id) ? 'bg-brand-500 border-brand-500' : 'border-white/20'}`}>
                    {selected.includes(u._id) && <Check size={10} className="text-gray-800" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{u.name}</p>
                    <p className="text-xs text-neutral truncate">{u.department} · {u.email}</p>
                  </div>
                </button>
              ))
            }
          </div>
          <div className="p-2 border-t border-gray-100">
            <button onClick={() => setOpen(false)} className="w-full text-xs text-primary hover:text-primary py-1">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Meeting form ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '', description: '', platform: 'zoom', meeting_link: '',
  scheduled_at: '', duration_minutes: 60, invitee_ids: [],
}

function MeetingForm({ users, initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs text-neutral mb-1.5 font-medium">Meeting Title *</label>
        <input
          required value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="e.g. Weekly Standup"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-slate-600 focus:outline-none focus:border-primary/30 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral mb-1.5 font-medium">Description</label>
        <textarea
          rows={2} value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Optional agenda or notes…"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-slate-600 focus:outline-none focus:border-primary/30 transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-neutral mb-1.5 font-medium">Platform *</label>
          <select
            required value={form.platform} onChange={e => set('platform', e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary/30 transition-colors"
          >
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral mb-1.5 font-medium">Duration (minutes)</label>
          <input
            type="number" min="1" value={form.duration_minutes}
            onChange={e => set('duration_minutes', Number(e.target.value))}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary/30 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral mb-1.5 font-medium">Meeting Link *</label>
        <input
          required value={form.meeting_link} onChange={e => set('meeting_link', e.target.value)}
          placeholder="https://zoom.us/j/... or https://meet.google.com/..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-slate-600 focus:outline-none focus:border-primary/30 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral mb-1.5 font-medium">Scheduled Date & Time *</label>
        <input
          required type="datetime-local" value={form.scheduled_at}
          onChange={e => set('scheduled_at', e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary/30 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral mb-1.5 font-medium">
          Invite Employees
          <span className="text-neutral font-normal ml-1">(leave empty to send to everyone)</span>
        </label>
        <UserPicker users={users} selected={form.invitee_ids} onChange={v => set('invitee_ids', v)} />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-neutral hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-gray-800 rounded-xl transition-colors font-medium">
          {saving ? <Spinner sm /> : <Check size={15} />}
          {initial ? 'Update Meeting' : 'Create & Notify'}
        </button>
      </div>
    </form>
  )
}

// ─── Notify modal ─────────────────────────────────────────────────────────────

function NotifyModal({ meeting, users, onClose }) {
  const [selected, setSelected] = useState([])
  const [sending, setSending]   = useState(false)

  const submit = async () => {
    setSending(true)
    try {
      await api.post(`/meetings/${meeting._id}/notify`, { invitee_ids: selected })
      toast.success('Reminder sent!')
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send reminder')
    } finally { setSending(false) }
  }

  const inviteeIds = (meeting.invitees ?? []).map(u => u._id)
  const invitedUsers = users.filter(u => inviteeIds.includes(u._id))

  return (
    <Modal title="Send Meeting Reminder" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-neutral">
          Send a reminder notification for <span className="text-gray-800 font-medium">"{meeting.title}"</span>. Leave empty to notify all invitees.
        </p>
        <UserPicker users={invitedUsers.length > 0 ? invitedUsers : users} selected={selected} onChange={setSelected} />
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
          <button onClick={submit} disabled={sending}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-gray-800 rounded-xl transition-colors font-medium">
            {sending ? <Spinner sm /> : <Bell size={15} />}
            Send Reminder
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

function MeetingCard({ meeting, onEdit, onDelete, onNotify }) {
  const past = isPast(new Date(meeting.scheduled_at))

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {platformBadge(meeting.platform)}
            {statusBadge(meeting.status)}
            {meeting.is_broadcast && <Badge color="purple">All staff</Badge>}
          </div>
          <h3 className="text-gray-800 font-semibold text-base leading-snug truncate">{meeting.title}</h3>
          {meeting.description && (
            <p className="text-neutral text-sm mt-1 line-clamp-2">{meeting.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onNotify(meeting)} title="Send reminder"
            className="p-2 text-neutral hover:text-primary hover:bg-purple-50 rounded-lg transition-colors">
            <Bell size={15} />
          </button>
          <button onClick={() => onEdit(meeting)} title="Edit"
            className="p-2 text-neutral hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors">
            <Edit2 size={15} />
          </button>
          <button onClick={() => onDelete(meeting._id)} title="Delete"
            className="p-2 text-neutral hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral mb-3">
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {format(new Date(meeting.scheduled_at), 'dd MMM yyyy, hh:mm a')}
          {past && <span className="text-neutral ml-1">(passed)</span>}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {meeting.duration_minutes} min
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} />
          {meeting.is_broadcast ? 'All employees' : `${(meeting.invitees ?? []).length} invitee${(meeting.invitees ?? []).length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <a
        href={meeting.meeting_link} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary bg-purple-50 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
      >
        <ExternalLink size={12} /> Join Meeting
      </a>

      <p className="text-xs text-neutral mt-2">
        Created by {meeting.created_by?.name} · {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminMeetings() {
  const [meetings, setMeetings] = useState([])
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null) // null | 'create' | 'edit' | 'notify'
  const [active,   setActive]   = useState(null) // selected meeting
  const [saving,   setSaving]   = useState(false)
  const [filter,   setFilter]   = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, u] = await Promise.all([
        api.get('/meetings'),
        api.get('/users'),
      ])
      setMeetings(m.data.data ?? [])
      setUsers((u.data.data ?? []).filter(u => u.role === 'employee' || u.role === 'manager'))
    } catch { toast.error('Failed to load meetings') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (form) => {
    setSaving(true)
    try {
      const { data } = await api.post('/meetings', form)
      setMeetings(prev => [data.data, ...prev])
      toast.success('Meeting created & notifications sent!')
      setModal(null)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create meeting')
    } finally { setSaving(false) }
  }

  const handleUpdate = async (form) => {
    setSaving(true)
    try {
      const { data } = await api.patch(`/meetings/${active._id}`, form)
      setMeetings(prev => prev.map(m => m._id === active._id ? data.data : m))
      toast.success('Meeting updated!')
      setModal(null)
      setActive(null)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this meeting?')) return
    try {
      await api.delete(`/meetings/${id}`)
      setMeetings(prev => prev.filter(m => m._id !== id))
      toast.success('Meeting deleted')
    } catch { toast.error('Failed to delete') }
  }

  const openEdit = (meeting) => {
    setActive(meeting)
    setModal('edit')
  }

  const openNotify = (meeting) => {
    setActive(meeting)
    setModal('notify')
  }

  const filtered = filter === 'all' ? meetings : meetings.filter(m => m.status === filter)

  // convert meeting for editing (convert date to datetime-local format)
  const toFormValues = (m) => ({
    title: m.title,
    description: m.description,
    platform: m.platform,
    meeting_link: m.meeting_link,
    scheduled_at: m.scheduled_at ? new Date(m.scheduled_at).toISOString().slice(0, 16) : '',
    duration_minutes: m.duration_minutes,
    invitee_ids: (m.invitees ?? []).map(u => u._id),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Video size={22} className="text-primary" /> Meetings
          </h1>
          <p className="text-sm text-neutral mt-0.5">Schedule and manage team meetings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-neutral hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-gray-800 text-sm rounded-xl transition-colors font-medium"
          >
            <Plus size={16} /> New Meeting
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit">
        {['all', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === s ? 'bg-brand-500 text-gray-800' : 'text-neutral hover:text-gray-800'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-neutral">
          <Video size={40} className="mx-auto mb-3 opacity-30" />
          <p>No meetings found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(m => (
            <MeetingCard key={m._id} meeting={m} onEdit={openEdit} onDelete={handleDelete} onNotify={openNotify} />
          ))}
        </div>
      )}

      {/* Create modal */}
      {modal === 'create' && (
        <Modal title="Schedule New Meeting" onClose={() => setModal(null)}>
          <MeetingForm users={users} onSave={handleCreate} onClose={() => setModal(null)} saving={saving} />
        </Modal>
      )}

      {/* Edit modal */}
      {modal === 'edit' && active && (
        <Modal title="Edit Meeting" onClose={() => { setModal(null); setActive(null) }}>
          <MeetingForm
            users={users}
            initial={toFormValues(active)}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setActive(null) }}
            saving={saving}
          />
        </Modal>
      )}

      {/* Notify modal */}
      {modal === 'notify' && active && (
        <NotifyModal
          meeting={active}
          users={users}
          onClose={() => { setModal(null); setActive(null) }}
        />
      )}
    </div>
  )
}
