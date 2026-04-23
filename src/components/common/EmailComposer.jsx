import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mail, X, Send, Paperclip, ChevronDown, Search,
  Users, User, Check, AlertCircle, Loader2, Trash2,
  FileText, Image, File, Minimize2, Maximize2
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

// ─── File icon helper ─────────────────────────────────────────────────────────
function FileIcon({ name }) {
  const ext = name?.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return <Image size={13} className="text-blue-400" />
  if (['pdf'].includes(ext))
    return <FileText size={13} className="text-red-400" />
  return <File size={13} className="text-neutral" />
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Recipient Dropdown ───────────────────────────────────────────────────────
function RecipientPicker({ selected, onChange, users, loading }) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const ref                   = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (user) => {
    const exists = selected.find(s => s._id === user._id)
    if (exists) onChange(selected.filter(s => s._id !== user._id))
    else onChange([...selected, user])
  }

  const selectAll = () => {
    if (selected.length === filtered.length) onChange([])
    else onChange([...filtered])
  }

  return (
    <div className="relative" ref={ref}>
      {/* Selected chips + trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        className="min-h-[38px] w-full flex flex-wrap gap-1.5 items-center px-3 py-2 
                   bg-gray-50 border border-gray-200 rounded-xl cursor-pointer
                   hover:border-primary/30 transition-colors"
      >
        {selected.length === 0 && (
          <span className="text-neutral text-sm">Select recipients…</span>
        )}
        {selected.map(u => (
          <span
            key={u._id}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 
                       bg-purple-50 border border-primary/30 text-primary
                       rounded-full text-[16px] font-medium"
          >
            {u.name}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(u) }}
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center
                         hover:bg-purple-100 transition-colors"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <ChevronDown
          size={14}
          className={`ml-auto text-neutral transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50
                        bg-white border border-gray-200 rounded-xl shadow-2xl
                        overflow-hidden animate-slide-up">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Search size={13} className="text-neutral flex-shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, department…"
                className="flex-1 text-[16px] text-gray-700 bg-transparent outline-none placeholder-gray-400"
              />
            </div>
          </div>

          {/* Select all */}
          {filtered.length > 1 && (
            <button
              onClick={selectAll}
              className="w-full flex items-center gap-2 px-3 py-2 text-[16px]
                         text-neutral hover:text-gray-800 hover:bg-gray-50 transition-colors
                         border-b border-gray-100"
            >
              <Users size={13} />
              {selected.length === filtered.length ? 'Deselect all' : `Select all (${filtered.length})`}
            </button>
          )}

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={16} className="animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-5 text-[16px] text-neutral">No users found</p>
            ) : filtered.map(u => {
              const isSelected = !!selected.find(s => s._id === u._id)
              return (
                <button
                  key={u._id}
                  onClick={() => toggle(u)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left
                              transition-colors hover:bg-gray-50
                              ${isSelected ? 'bg-purple-50' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                                  text-[16px] font-bold flex-shrink-0
                                  ${isSelected
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 text-gray-600'}`}>
                    {u.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[16px] font-medium truncate ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                      {u.name}
                    </p>
                    <p className="text-[11px] text-neutral truncate">{u.department} · {u.designation}</p>
                  </div>
                  {isSelected && <Check size={13} className="text-primary flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main EmailComposer ───────────────────────────────────────────────────────
export default function EmailComposer() {
  const [open,        setOpen]        = useState(false)
  const [minimized,   setMinimized]   = useState(false)
  const [users,       setUsers]       = useState([])
  const [usersLoading,setUsersLoading]= useState(false)
  const [recipients,  setRecipients]  = useState([])
  const [subject,     setSubject]     = useState('')
  const [body,        setBody]        = useState('')
  const [files,       setFiles]       = useState([])
  const [sending,     setSending]     = useState(false)
  const [errors,      setErrors]      = useState({})

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setUsersLoading(true)
    api.get('/users?role=employee&status=active&limit=200')
      .then(r => setUsers(r.data.data ?? []))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setUsersLoading(false))
  }, [open])

  const validate = () => {
    const e = {}
    if (recipients.length === 0) e.recipients = 'Select at least one recipient'
    if (!subject.trim())         e.subject    = 'Subject is required'
    if (!body.trim())            e.body       = 'Message body is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleFileAdd = (e) => {
    const newFiles = Array.from(e.target.files || [])
    const MAX_SIZE = 10 * 1024 * 1024

    newFiles.forEach(f => {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} exceeds 10 MB limit`)
        return
      }
      setFiles(prev => [...prev, { file: f, id: `${Date.now()}-${Math.random()}` }])
    })
    e.target.value = ''
  }

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id))

  const handleSend = async () => {
    if (!validate()) return
    setSending(true)

    try {
      const recipientIds = recipients.map(r => r._id)
      const form = new FormData()
      form.append('user_ids', JSON.stringify(recipientIds))
      form.append('subject',  subject.trim())
      form.append('body',     body.trim())
      files.forEach(({ file }) => form.append('attachments', file))

      await api.post('/email/send', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success(`Email sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}! ✉️`)
      handleClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setMinimized(false)
    setRecipients([])
    setSubject('')
    setBody('')
    setFiles([])
    setErrors({})
  }

  const totalAttachSize = files.reduce((s, { file }) => s + file.size, 0)

  return (
    <>
      {/* ── Topbar Email Icon Button ── */}
      <button
        onClick={() => { setOpen(true); setMinimized(false) }}
        className="relative p-2 rounded-xl text-neutral hover:text-gray-800 hover:bg-gray-50 transition-colors"
        title="Compose Email"
      >
        <Mail size={18} />
      </button>

      {/* ── Composer Modal ── */}
      {open && (
        <>
          {/* Backdrop */}
          {!minimized && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setMinimized(true)}
            />
          )}

          {/* Composer window */}
          <div
            className={`fixed z-50 transition-all duration-300 ease-out bg-white shadow-2xl
              ${minimized
                ? 'bottom-4 right-4 w-64 rounded-2xl overflow-hidden'
                : 'bottom-6 right-6 w-[540px] rounded-2xl max-h-[90vh] flex flex-col'
              }`}
            style={{ border: '1px solid #e5e7eb' }}
          >

            {/* ── Header ── */}
            <div
              className={`flex items-center justify-between px-4 py-3 flex-shrink-0
                          border-b border-gray-100 bg-purple-50 rounded-t-2xl
                          ${minimized ? 'cursor-pointer' : ''}`}
              onClick={minimized ? () => setMinimized(false) : undefined}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white border border-primary/20
                                flex items-center justify-center shadow-sm">
                  <Mail size={13} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 leading-none">New Email</p>
                  {!minimized && recipients.length > 0 && (
                    <p className="text-[10px] text-neutral mt-0.5">
                      To: {recipients.map(r => r.name).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setMinimized(m => !m) }}
                  className="p-1.5 rounded-lg text-neutral hover:text-gray-700 hover:bg-white transition-colors"
                  title={minimized ? 'Expand' : 'Minimize'}
                >
                  {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleClose() }}
                  className="p-1.5 rounded-lg text-neutral hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Close"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            {!minimized && (
              <div className="flex flex-col flex-1 overflow-hidden bg-white">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                  {/* To */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      To
                    </label>
                    <RecipientPicker
                      selected={recipients}
                      onChange={r => { setRecipients(r); setErrors(e => ({ ...e, recipients: null })) }}
                      users={users}
                      loading={usersLoading}
                    />
                    {errors.recipients && (
                      <p className="mt-1 text-[16px] text-red-500 flex items-center gap-1">
                        <AlertCircle size={11} /> {errors.recipients}
                      </p>
                    )}
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Subject
                    </label>
                    <input
                      value={subject}
                      onChange={e => { setSubject(e.target.value); setErrors(err => ({ ...err, subject: null })) }}
                      placeholder="Enter email subject…"
                      className={`w-full px-3 py-2.5 bg-gray-50 border rounded-xl text-sm
                                  text-gray-700 placeholder-gray-400 outline-none transition-colors
                                  ${errors.subject
                                    ? 'border-red-400 focus:border-red-500'
                                    : 'border-gray-200 focus:border-primary/40'}`}
                    />
                    {errors.subject && (
                      <p className="mt-1 text-[16px] text-red-500 flex items-center gap-1">
                        <AlertCircle size={11} /> {errors.subject}
                      </p>
                    )}
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Message
                    </label>
                    <textarea
                      value={body}
                      onChange={e => { setBody(e.target.value); setErrors(err => ({ ...err, body: null })) }}
                      placeholder="Type your message here…"
                      rows={7}
                      className={`w-full px-3 py-2.5 bg-gray-50 border rounded-xl text-sm
                                  text-gray-700 placeholder-gray-400 outline-none transition-colors resize-none
                                  ${errors.body
                                    ? 'border-red-400 focus:border-red-500'
                                    : 'border-gray-200 focus:border-primary/40'}`}
                    />
                    {errors.body && (
                      <p className="mt-1 text-[16px] text-red-500 flex items-center gap-1">
                        <AlertCircle size={11} /> {errors.body}
                      </p>
                    )}
                  </div>

                  {/* Attachments preview */}
                  {files.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          Attachments ({files.length})
                        </label>
                        <span className="text-[11px] text-neutral">{formatBytes(totalAttachSize)}</span>
                      </div>
                      <div className="space-y-1.5">
                        {files.map(({ file, id }) => (
                          <div
                            key={id}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl
                                       bg-gray-50 border border-gray-200"
                          >
                            <FileIcon name={file.name} />
                            <span className="flex-1 text-[16px] text-gray-600 truncate min-w-0">{file.name}</span>
                            <span className="text-[11px] text-neutral flex-shrink-0">{formatBytes(file.size)}</span>
                            <button
                              onClick={() => removeFile(id)}
                              className="p-0.5 text-neutral hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 flex-shrink-0 bg-gray-50 rounded-b-2xl">
                  <div className="flex items-center gap-2">
                    {/* Attach file */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[16px]
                                 text-gray-600 hover:text-gray-800 border border-gray-200
                                 hover:border-gray-300 hover:bg-white transition-all"
                      title="Attach file"
                    >
                      <Paperclip size={13} />
                      Attach
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileAdd}
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.zip"
                    />

                    {/* All employees shortcut */}
                    <button
                      onClick={() => setRecipients(users)}
                      disabled={usersLoading || users.length === 0}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[16px]
                                 text-gray-600 hover:text-gray-800 border border-gray-200
                                 hover:border-gray-300 hover:bg-white transition-all
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Send to all employees"
                    >
                      <Users size={13} />
                      All
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClose}
                      className="px-3 py-2 rounded-xl text-[16px] text-gray-500
                                 hover:text-gray-700 hover:bg-white transition-colors border border-transparent hover:border-gray-200"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-[16px] font-semibold
                                 bg-primary hover:bg-primary/90 text-white
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-all shadow-sm shadow-primary/30"
                    >
                      {sending
                        ? <><Loader2 size={13} className="animate-spin" /> Sending…</>
                        : <><Send size={13} /> Send{recipients.length > 1 ? ` (${recipients.length})` : ''}</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Minimized quick info bar ── */}
            {minimized && (
              <div className="px-4 py-2 text-[11px] text-gray-500 bg-white">
                {recipients.length > 0
                  ? `To: ${recipients.slice(0, 2).map(r => r.name).join(', ')}${recipients.length > 2 ? ` +${recipients.length - 2}` : ''}`
                  : 'No recipients selected'}
                {subject && <span className="ml-2 text-neutral">· {subject.slice(0, 20)}{subject.length > 20 ? '…' : ''}</span>}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}