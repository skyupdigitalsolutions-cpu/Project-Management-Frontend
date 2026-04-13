import { useEffect, useState, useCallback } from 'react'
import { Bell, Send, Trash2, RefreshCw, CheckCheck, Reply, Inbox, SendHorizonal } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader, Modal, FormField, SelectInput, Spinner, EmptyState } from '../../components/common/UI'

const TYPES = ['general', 'task_assigned', 'task_updated', 'task_completed', 'project_assigned', 'project_updated', 'member_added', 'member_removed', 'deadline_reminder', 'meeting_invite']

export default function ManagerNotifications() {
  const [tab,         setTab]         = useState('inbox')
  const [notifs,      setNotifs]      = useState([])
  const [sent,        setSent]        = useState([])
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(false)
  const [replyModal,  setReplyModal]  = useState(false)
  const [replyTarget, setReplyTarget] = useState(null)
  const [form,        setForm]        = useState({ user_ids: [], message: '', type: 'general' })
  const [replyForm,   setReplyForm]   = useState({ message: '', type: 'general' })
  const [sending,     setSending]     = useState(false)
  const [replying,    setReplying]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [n, s, u] = await Promise.all([
        api.get('/notifications?limit=50'),
        api.get('/notifications/sent?limit=50'),
        api.get('/users'),
      ])
      setNotifs(n.data.data ?? [])
      setSent(s.data.data ?? [])
      setUsers(u.data.data ?? [])
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSend = async () => {
    if (!form.message.trim()) { toast.error('Enter a message'); return }
    setSending(true)
    try {
      const user_ids = form.user_ids.length > 0 ? form.user_ids : users.map(u => u._id)
      if (user_ids.length === 0) { toast.error('No users available'); setSending(false); return }
      await api.post('/notifications/send', { user_ids, message: form.message, type: form.type })
      toast.success(`Notification sent to ${user_ids.length} user(s)!`)
      setModal(false)
      setForm({ user_ids: [], message: '', type: 'general' })
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send')
    } finally { setSending(false) }
  }

  const openReply = (notif) => {
    setReplyTarget(notif)
    setReplyForm({ message: '', type: 'general' })
    setReplyModal(true)
  }

  const handleReply = async () => {
    if (!replyForm.message.trim()) { toast.error('Enter a reply message'); return }
    const recipientId = replyTarget?.sender_id || replyTarget?.user_id
    if (!recipientId) { toast.error('Cannot determine reply recipient'); return }
    setReplying(true)
    try {
      await api.post('/notifications/send', { user_ids: [recipientId], message: replyForm.message, type: replyForm.type })
      toast.success('Reply sent!')
      setReplyModal(false)
      setReplyTarget(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send reply')
    } finally { setReplying(false) }
  }

  const markAll = async () => {
    try { await api.patch('/notifications/mark-all-read'); load(); toast.success('All marked as read') }
    catch { toast.error('Failed') }
  }

  const clearAll = async () => {
    try { await api.delete('/notifications/clear-all'); load(); toast.success('Cleared') }
    catch { toast.error('Failed') }
  }

  const deleteOne = async (id) => {
    try { await api.delete(`/notifications/${id}`); load() }
    catch { toast.error('Failed') }
  }

  const toggleUser = (id) =>
    setForm(f => ({ ...f, user_ids: f.user_ids.includes(id) ? f.user_ids.filter(x => x !== id) : [...f.user_ids, id] }))

  const selectAll = () =>
    setForm(f => ({ ...f, user_ids: f.user_ids.length === users.length ? [] : users.map(u => u._id) }))

  const unreadCount = notifs.filter(n => !n.is_read).length
  const activeList  = tab === 'inbox' ? notifs : sent

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        action={
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Send size={16} /> Send Notification
          </button>
        }
      />

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'inbox' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Inbox size={15} /> Inbox
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{unreadCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'sent' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <SendHorizonal size={15} /> Sent
          {sent.length > 0 && (
            <span className="bg-slate-600 text-slate-300 text-xs rounded-full px-1.5 py-0.5 leading-none">{sent.length}</span>
          )}
        </button>
      </div>

      {/* ── Bulk actions ── */}
      {tab === 'inbox' && (
        <div className="flex gap-3">
          <button onClick={markAll}  className="btn-secondary"><CheckCheck size={15} /> Mark all read</button>
          <button onClick={clearAll} className="btn-danger"><Trash2 size={15} /> Clear all</button>
          <button onClick={load}     className="btn-secondary px-3"><RefreshCw size={15} /></button>
        </div>
      )}
      {tab === 'sent' && (
        <div className="flex gap-3">
          <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
        </div>
      )}

      {/* ── List ── */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : activeList.length === 0 ? (
          <EmptyState
            icon={tab === 'inbox' ? Bell : SendHorizonal}
            title={tab === 'inbox' ? 'No notifications' : 'No sent notifications'}
            description={tab === 'inbox' ? 'Send a notification to your team' : 'Notifications you send will appear here'}
          />
        ) : activeList.map(n => (
          <div
            key={n._id}
            className={`card !py-4 flex items-start justify-between gap-4 ${tab === 'inbox' && !n.is_read ? 'border-l-2 border-l-brand-500' : ''}`}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {tab === 'inbox' ? (
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.is_read ? 'bg-slate-600' : 'bg-brand-500'}`} />
              ) : (
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-emerald-500" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${tab === 'inbox' && !n.is_read ? 'text-slate-200' : 'text-slate-400'}`}>{n.message}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {n.type && (
                    <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{n.type}</span>
                  )}
                  {tab === 'sent' && n.recipient_count != null && (
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      → {n.recipient_count} recipient{n.recipient_count !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-xs text-slate-600">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {tab === 'inbox' && (
                <button onClick={() => openReply(n)} className="text-slate-500 hover:text-brand-400 p-1 rounded transition-colors" title="Reply">
                  <Reply size={14} />
                </button>
              )}
              <button onClick={() => deleteOne(n._id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Send Modal ── */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setForm({ user_ids: [], message: '', type: 'general' }) }}
        title="Send Notification"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setModal(false); setForm({ user_ids: [], message: '', type: 'general' }) }} disabled={sending}>Cancel</button>
            <button className="btn-primary" onClick={handleSend} disabled={sending}>
              {sending ? <Spinner size="sm" /> : <Send size={14} />} Send
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Message">
            <textarea className="input resize-none" rows={3} value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Notification message…" />
          </FormField>
          <FormField label="Type">
            <SelectInput value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
              options={TYPES.map(t => ({ value: t, label: t }))} />
          </FormField>
          <FormField label="Recipients (leave empty = all users)">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">
                {form.user_ids.length === 0 ? 'Will send to all users' : `${form.user_ids.length} of ${users.length} selected`}
              </span>
              <button type="button" onClick={selectAll} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                {form.user_ids.length === users.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1 border border-white/5 rounded-xl p-2 bg-surface-200">
              {users.map(u => (
                <label key={u._id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={form.user_ids.includes(u._id)} onChange={() => toggleUser(u._id)} className="w-4 h-4 accent-brand-500" />
                  <span className="text-sm text-slate-300">{u.name}</span>
                  <span className="text-xs text-slate-500 ml-auto capitalize">{u.role}</span>
                </label>
              ))}
            </div>
          </FormField>
        </div>
      </Modal>

      {/* ── Reply Modal ── */}
      <Modal
        open={replyModal}
        onClose={() => { setReplyModal(false); setReplyTarget(null) }}
        title="Reply to Notification"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setReplyModal(false); setReplyTarget(null) }} disabled={replying}>Cancel</button>
            <button className="btn-primary" onClick={handleReply} disabled={replying}>
              {replying ? <Spinner size="sm" /> : <Reply size={14} />} Reply
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {replyTarget && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Original message</p>
              <p className="text-sm text-slate-300 italic">"{replyTarget.message}"</p>
            </div>
          )}
          <FormField label="Reply Message">
            <textarea className="input resize-none" rows={3} value={replyForm.message}
              onChange={e => setReplyForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Type your reply…" />
          </FormField>
          <FormField label="Type">
            <SelectInput value={replyForm.type} onChange={v => setReplyForm(f => ({ ...f, type: v }))}
              options={TYPES.map(t => ({ value: t, label: t }))} />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
