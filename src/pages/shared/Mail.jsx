import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Mail as MailIcon, Inbox, Send, Reply, Forward, RefreshCw, Paperclip, X,
  Plus, Loader2, Link2, AlertCircle, Search, Trash2, FileText, ShieldAlert,
  Archive, Folder, Users, ChevronLeft,
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const Spinner = ({ size = 20 }) => <Loader2 size={size} className="animate-spin text-primary" />

function addr(a) { if (!a) return ''; return a.name ? `${a.name} <${a.address}>` : a.address }
function shortName(a) { if (!a) return 'Unknown'; return a.name || a.address || 'Unknown' }
function stripPrefix(s = '', p) { return s.replace(new RegExp(`^\\s*(${p})\\s*:\\s*`, 'i'), '') }

/* Map an IMAP folder to a friendly label + icon + sort order */
const SPECIAL = {
  '\\Inbox':   { label: 'Inbox',   icon: Inbox,       order: 0 },
  '\\Sent':    { label: 'Sent',    icon: Send,        order: 1 },
  '\\Drafts':  { label: 'Drafts',  icon: FileText,    order: 2 },
  '\\Junk':    { label: 'Spam',    icon: ShieldAlert, order: 3 },
  '\\Trash':   { label: 'Trash',   icon: Trash2,      order: 4 },
  '\\Archive': { label: 'Archive', icon: Archive,     order: 5 },
}
function folderMeta(f) {
  const s = SPECIAL[f.specialUse]
  if (s) return { ...s, path: f.path }
  return { label: f.name, icon: Folder, order: 100, path: f.path }
}

/* ── Connect screen ─────────────────────────────────────────────── */
function ConnectMailbox({ onConnected }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const connect = async () => {
    if (!email || !password) return toast.error('Enter your Hostinger email and password')
    setBusy(true)
    try {
      const { data } = await api.post('/mail/connect', { email, password })
      toast.success('Mailbox connected'); onConnected(data.email)
    } catch (err) { toast.error(err.response?.data?.message || 'Could not connect mailbox') }
    finally { setBusy(false) }
  }
  return (
    <div className="max-w-md mx-auto mt-10 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Link2 size={20} className="text-primary" />
        <h2 className="text-lg font-bold text-gray-800">Connect your Hostinger mailbox</h2>
      </div>
      <p className="text-sm text-neutral mb-5">Use your full Hostinger email and its password. Your password is stored encrypted and used only to sync your mail.</p>
      <div className="space-y-3">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourdomain.com"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mailbox password"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button onClick={connect} disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-medium py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60">
          {busy ? <Spinner size={16} /> : <Link2 size={16} />} {busy ? 'Connecting…' : 'Connect mailbox'}
        </button>
      </div>
      <div className="mt-4 flex items-start gap-2 text-[12px] text-neutral bg-gray-50 rounded-xl p-3">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        <span>Server settings are handled automatically (imap.hostinger.com / smtp.hostinger.com).</span>
      </div>
    </div>
  )
}

/* ── Composer ───────────────────────────────────────────────────── */
// Brevo caps a transactional email at ~10 MB total, so we guard the combined
// raw size of all attachments a little under that.
const MAX_ATTACH_BYTES = 9 * 1024 * 1024

// Read a File into the shape the backend/Brevo expect: base64 `content`
// (without the data: prefix) plus filename/type/size for the UI.
function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve({
        filename: file.name,
        content: base64,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      })
    }
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function fmtSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Composer({ initial, onClose, onSent }) {
  const [to, setTo] = useState(initial.to || '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(initial.subject || '')
  const [body, setBody] = useState(initial.body || '')
  const [attachments, setAttachments] = useState(initial.attachments || [])
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef(null)

  const totalBytes = attachments.reduce((s, a) => s + (a.size || 0), 0)

  const pickFiles = () => fileInputRef.current?.click()

  const onFilesChosen = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // allow re-selecting the same file later
    if (!files.length) return
    try {
      const read = await Promise.all(files.map(fileToAttachment))
      const merged = [...attachments, ...read]
      const newTotal = merged.reduce((s, a) => s + (a.size || 0), 0)
      if (newTotal > MAX_ATTACH_BYTES) {
        return toast.error(`Attachments too large — keep the total under ${fmtSize(MAX_ATTACH_BYTES)}`)
      }
      setAttachments(merged)
    } catch (err) {
      toast.error(err.message || 'Could not read file')
    }
  }

  const removeAttachment = (i) => setAttachments((list) => list.filter((_, idx) => idx !== i))

  const send = async () => {
    if (!to.trim()) return toast.error('Add at least one recipient')
    setBusy(true)
    try {
      await api.post('/mail/send', {
        to, cc: cc || undefined, subject,
        text: body, html: body.replace(/\n/g, '<br>'),
        inReplyTo: initial.inReplyTo, references: initial.references,
        attachments: attachments.length ? attachments : undefined,
      })
      toast.success('Message sent'); onSent?.(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to send')
    } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{initial.heading || 'New message'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-neutral"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <input value={to} onChange={e => setTo(e.target.value)} placeholder="To (comma-separated)"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input value={cc} onChange={e => setCc(e.target.value)} placeholder="Cc (optional)"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} placeholder="Write your message…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30" />

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
                  <Paperclip size={12} />
                  <span className="max-w-[180px] truncate">{a.filename}</span>
                  {a.size ? <span className="text-gray-400">({fmtSize(a.size)})</span> : null}
                  <button onClick={() => removeAttachment(i)} className="ml-0.5 text-gray-400 hover:text-danger" title="Remove">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFilesChosen} />
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={pickFiles} type="button"
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 font-medium px-3 py-2 rounded-xl hover:bg-gray-50 transition">
              <Paperclip size={16} /> Attach
            </button>
            {totalBytes > 0 && (
              <span className="text-[12px] text-neutral truncate">
                {attachments.length} file{attachments.length === 1 ? '' : 's'} · {fmtSize(totalBytes)}
              </span>
            )}
          </div>
          <button onClick={send} disabled={busy}
            className="inline-flex items-center gap-2 bg-primary text-white font-medium px-5 py-2 rounded-xl hover:opacity-90 transition disabled:opacity-60">
            {busy ? <Spinner size={16} /> : <Send size={16} />} {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function Mail() {
  const [checking, setChecking] = useState(true)
  const [connected, setConnected] = useState(false)
  const [folders, setFolders] = useState([])
  const [box, setBox] = useState('INBOX')
  const [view, setView] = useState('mail')          // 'mail' | 'contacts'
  const [messages, setMessages] = useState([])
  const [contacts, setContacts] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [active, setActive] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [composer, setComposer] = useState(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')            // applied search
  const reqRef = useRef(0)                           // guards against out-of-order folder loads

  const checkStatus = useCallback(async () => {
    setChecking(true)
    try { const { data } = await api.get('/mail/status'); setConnected(data.connected) }
    catch { setConnected(false) } finally { setChecking(false) }
  }, [])

  const loadFolders = useCallback(async () => {
    try {
      const { data } = await api.get('/mail/folders')
      const sorted = (data.data ?? []).map(folderMeta).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      setFolders(sorted)
    } catch { /* non-fatal */ }
  }, [])

  const loadList = useCallback(async (targetBox, q = '') => {
    const my = ++reqRef.current
    setLoadingList(true); setActive(null)
    try {
      const { data } = await api.get('/mail/messages', { params: { box: targetBox, limit: 40, search: q || undefined } })
      if (my !== reqRef.current) return               // a newer request superseded this one
      setMessages(data.data ?? [])
    } catch (err) {
      if (my === reqRef.current) toast.error(err.response?.data?.message || 'Failed to load mail')
    } finally {
      if (my === reqRef.current) setLoadingList(false)
    }
  }, [])

  const loadContacts = useCallback(async () => {
    const my = ++reqRef.current
    setLoadingList(true)
    try {
      const { data } = await api.get('/mail/contacts')
      if (my !== reqRef.current) return
      setContacts(data.data ?? [])
    } catch (err) {
      if (my === reqRef.current) toast.error(err.response?.data?.message || 'Failed to load contacts')
    } finally {
      if (my === reqRef.current) setLoadingList(false)
    }
  }, [])

  useEffect(() => { checkStatus() }, [checkStatus])
  useEffect(() => {
    if (!connected) return
    loadFolders()
    loadList('INBOX', '')
    // run once when the mailbox connects — folder switches are handled by selectFolder
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  const selectFolder = (path) => {
    setView('mail'); setBox(path); setSearch(''); setQuery(''); loadList(path, '')
  }
  const openContacts = () => { setView('contacts'); setActive(null); loadContacts() }

  const runSearch = () => { setQuery(search); setView('mail'); loadList(box, search) }

  const openMessage = async (uid) => {
    setLoadingMsg(true); setActive({ uid })
    try {
      const { data } = await api.get(`/mail/messages/${uid}`, { params: { box } })
      setActive(data.data)
      setMessages(ms => ms.map(m => m.uid === uid ? { ...m, seen: true } : m))
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to open message'); setActive(null) }
    finally { setLoadingMsg(false) }
  }

  const removeMessage = async (uid) => {
    try {
      await api.delete(`/mail/messages/${uid}`, { params: { box } })
      setMessages(ms => ms.filter(m => m.uid !== uid)); setActive(null); toast.success('Moved to Trash')
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete') }
  }

  const startReply = (m) => setComposer({
    heading: 'Reply', to: m.from?.address || '',
    subject: `Re: ${stripPrefix(m.subject, 'Re')}`,
    body: `\n\n\n----- On ${m.date ? format(new Date(m.date), 'dd MMM yyyy, hh:mm a') : ''}, ${shortName(m.from)} wrote: -----\n${m.text || ''}`,
    inReplyTo: m.messageId, references: m.references,
  })
  const startForward = (m) => setComposer({
    heading: 'Forward', to: '',
    subject: `Fwd: ${stripPrefix(m.subject, 'Fwd')}`,
    body: `\n\n----- Forwarded message -----\nFrom: ${addr(m.from)}\nDate: ${m.date ? format(new Date(m.date), 'dd MMM yyyy, hh:mm a') : ''}\nSubject: ${m.subject}\n\n${m.text || ''}`,
    attachments: m.attachments,
  })

  if (checking) return <div className="flex justify-center py-24"><Spinner size={28} /></div>
  if (!connected) return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><MailIcon size={22} className="text-primary" /> Mail</h1>
      <ConnectMailbox onConnected={() => setConnected(true)} />
    </div>
  )

  const currentFolderLabel = folders.find(f => f.path === box)?.label || 'Inbox'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><MailIcon size={22} className="text-primary" /> Mail</h1>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="Search mail…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button onClick={() => setComposer({ heading: 'New message' })}
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:opacity-90 transition whitespace-nowrap">
            <Plus size={16} /> Compose
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[190px_320px_1fr] gap-4">
        {/* Folder rail */}
        <div className="bg-white border border-gray-100 rounded-2xl p-2 h-fit">
          {folders.map(f => {
            const Icon = f.icon
            const activeF = view === 'mail' && box === f.path
            return (
              <button key={f.path} onClick={() => selectFolder(f.path)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${activeF ? 'bg-purple-50 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                <Icon size={16} /> <span className="truncate">{f.label}</span>
              </button>
            )
          })}
          <div className="my-1 border-t border-gray-100" />
          <button onClick={openContacts}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${view === 'contacts' ? 'bg-purple-50 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Users size={16} /> Contacts
          </button>
        </div>

        {/* Middle: list or contacts */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
            <span>{view === 'contacts' ? 'Contacts' : (query ? `Search: "${query}"` : currentFolderLabel)}</span>
            <button onClick={() => view === 'contacts' ? loadContacts() : loadList(box, query)}
              className="p-1 text-neutral hover:text-gray-800 rounded-lg">
              <RefreshCw size={14} className={loadingList ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingList ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : view === 'contacts' ? (
            contacts.length === 0 ? <div className="text-center py-16 text-neutral text-sm">No contacts found yet.</div> : (
              <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
                {contacts.map((c, i) => (
                  <button key={i} onClick={() => setComposer({ heading: 'New message', to: c.address })}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition">
                    <div className="text-sm text-gray-800 font-medium truncate">{c.name || c.address}</div>
                    {c.name && <div className="text-[12px] text-neutral truncate">{c.address}</div>}
                  </button>
                ))}
              </div>
            )
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-neutral text-sm">{query ? 'No matches.' : 'Nothing here.'}</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {messages.map(m => (
                <button key={m.uid} onClick={() => openMessage(m.uid)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${active?.uid === m.uid ? 'bg-purple-50' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${m.seen ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>{shortName(m.from)}</span>
                    <span className="text-[11px] text-neutral flex-shrink-0">{m.date ? format(new Date(m.date), 'dd MMM') : ''}</span>
                  </div>
                  <div className={`text-[13px] truncate ${m.seen ? 'text-neutral' : 'text-gray-800 font-medium'}`}>{m.subject}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reader */}
        <div className="bg-white border border-gray-100 rounded-2xl min-h-[60vh]">
          {view === 'contacts' ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral py-20">
              <Users size={40} className="opacity-30 mb-3" /><p className="text-sm">Tap a contact to email them</p>
            </div>
          ) : !active ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral py-20">
              <MailIcon size={40} className="opacity-30 mb-3" /><p className="text-sm">Select a message to read</p>
            </div>
          ) : loadingMsg ? (
            <div className="flex justify-center py-24"><Spinner size={26} /></div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">{active.subject}</h2>
                  <button onClick={() => removeMessage(active.uid)} title="Delete"
                    className="p-1.5 text-neutral hover:text-danger hover:bg-red-50 rounded-lg flex-shrink-0"><Trash2 size={16} /></button>
                </div>
                <div className="text-[13px] text-neutral">
                  <div><span className="text-gray-500">From:</span> {addr(active.from)}</div>
                  <div><span className="text-gray-500">To:</span> {active.to?.map(addr).join(', ')}</div>
                  <div className="mt-0.5">{active.date ? format(new Date(active.date), 'dd MMM yyyy, hh:mm a') : ''}</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => startReply(active)} className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700"><Reply size={14} /> Reply</button>
                  <button onClick={() => startForward(active)} className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700"><Forward size={14} /> Forward</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {active.html ? (
                  <iframe title="message-body" sandbox="" srcDoc={active.html} className="w-full min-h-[40vh] border-0" />
                ) : (
                  <pre className="whitespace-pre-wrap font-poppins text-sm text-gray-700">{active.text}</pre>
                )}
                {active.attachments?.length > 0 && (
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <p className="text-[13px] font-semibold text-gray-600 mb-2">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {active.attachments.map((a, i) => (
                        <a key={i} href={`data:${a.contentType};base64,${a.content}`} download={a.filename}
                          className="inline-flex items-center gap-1.5 text-[13px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:bg-gray-100">
                          <Paperclip size={13} /> {a.filename}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {composer && <Composer initial={composer} onClose={() => setComposer(null)} onSent={() => loadList(box, query)} />}
    </div>
  )
}