import { useEffect, useState, useCallback } from 'react'
import {
  Mail as MailIcon, Inbox, Send, Reply, Forward, RefreshCw, Paperclip, X,
  Plus, Loader2, Link2, AlertCircle,
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const Spinner = ({ size = 20 }) => (
  <Loader2 size={size} className="animate-spin text-primary" />
)

function addr(a) {
  if (!a) return ''
  return a.name ? `${a.name} <${a.address}>` : a.address
}
function shortName(a) {
  if (!a) return 'Unknown'
  return a.name || a.address || 'Unknown'
}
function stripPrefix(subject = '', prefix) {
  const re = new RegExp(`^\\s*(${prefix})\\s*:\\s*`, 'i')
  return subject.replace(re, '')
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
      toast.success('Mailbox connected')
      onConnected(data.email)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not connect mailbox')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Link2 size={20} className="text-primary" />
        <h2 className="text-lg font-bold text-gray-800">Connect your Hostinger mailbox</h2>
      </div>
      <p className="text-sm text-neutral mb-5">
        Use your full Hostinger email address and its password. Your password is stored
        encrypted and used only to sync your mail.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-[13px] font-medium text-gray-600">Email address</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@yourdomain.com"
            className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-[13px] font-medium text-gray-600">Mailbox password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          onClick={connect} disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-medium py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60"
        >
          {busy ? <Spinner size={16} /> : <Link2 size={16} />}
          {busy ? 'Connecting…' : 'Connect mailbox'}
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 text-[12px] text-neutral bg-gray-50 rounded-xl p-3">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        <span>Server settings are handled automatically (imap.hostinger.com / smtp.hostinger.com).</span>
      </div>
    </div>
  )
}

/* ── Compose / Reply / Forward modal ────────────────────────────── */
function Composer({ initial, onClose, onSent }) {
  const [to, setTo] = useState(initial.to || '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(initial.subject || '')
  const [body, setBody] = useState(initial.body || '')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!to.trim()) return toast.error('Add at least one recipient')
    setBusy(true)
    try {
      await api.post('/mail/send', {
        to, cc: cc || undefined, subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
        inReplyTo: initial.inReplyTo,
        references: initial.references,
        attachments: initial.attachments, // carried through on forward
      })
      toast.success('Message sent')
      onSent?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send')
    } finally {
      setBusy(false)
    }
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
          {initial.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {initial.attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[12px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
                  <Paperclip size={12} /> {a.filename}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={send} disabled={busy}
            className="inline-flex items-center gap-2 bg-primary text-white font-medium px-5 py-2 rounded-xl hover:opacity-90 transition disabled:opacity-60">
            {busy ? <Spinner size={16} /> : <Send size={16} />} {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────────── */
export default function Mail() {
  const [checking, setChecking] = useState(true)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [active, setActive] = useState(null)      // full message
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [composer, setComposer] = useState(null)  // composer initial state or null

  const checkStatus = useCallback(async () => {
    setChecking(true)
    try {
      const { data } = await api.get('/mail/status')
      setConnected(data.connected)
    } catch { setConnected(false) }
    finally { setChecking(false) }
  }, [])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const { data } = await api.get('/mail/messages', { params: { box: 'INBOX', limit: 40 } })
      setMessages(data.data ?? [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load inbox')
    } finally { setLoadingList(false) }
  }, [])

  useEffect(() => { checkStatus() }, [checkStatus])
  useEffect(() => { if (connected) loadList() }, [connected, loadList])

  const openMessage = async (uid) => {
    setLoadingMsg(true)
    setActive({ uid })
    try {
      const { data } = await api.get(`/mail/messages/${uid}`)
      setActive(data.data)
      setMessages(ms => ms.map(m => m.uid === uid ? { ...m, seen: true } : m))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to open message')
      setActive(null)
    } finally { setLoadingMsg(false) }
  }

  const startReply = (msg) => {
    const quoted = `\n\n\n----- On ${msg.date ? format(new Date(msg.date), 'dd MMM yyyy, hh:mm a') : ''}, ${shortName(msg.from)} wrote: -----\n${msg.text || ''}`
    setComposer({
      heading: 'Reply',
      to: msg.from?.address || '',
      subject: `Re: ${stripPrefix(msg.subject, 'Re')}`,
      body: quoted,
      inReplyTo: msg.messageId,
      references: msg.references,
    })
  }

  const startForward = (msg) => {
    const fwd = `\n\n----- Forwarded message -----\nFrom: ${addr(msg.from)}\nDate: ${msg.date ? format(new Date(msg.date), 'dd MMM yyyy, hh:mm a') : ''}\nSubject: ${msg.subject}\n\n${msg.text || ''}`
    setComposer({
      heading: 'Forward',
      to: '',
      subject: `Fwd: ${stripPrefix(msg.subject, 'Fwd')}`,
      body: fwd,
      attachments: msg.attachments,
    })
  }

  if (checking) {
    return <div className="flex justify-center py-24"><Spinner size={28} /></div>
  }

  if (!connected) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MailIcon size={22} className="text-primary" /> Mail
        </h1>
        <ConnectMailbox onConnected={() => setConnected(true)} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MailIcon size={22} className="text-primary" /> Mail
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={loadList} className="p-2 text-neutral hover:text-gray-800 hover:bg-gray-50 rounded-xl transition">
            <RefreshCw size={16} className={loadingList ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setComposer({ heading: 'New message' })}
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:opacity-90 transition">
            <Plus size={16} /> Compose
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* List */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
            <Inbox size={16} className="text-primary" /> Inbox
          </div>
          {loadingList ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-neutral text-sm">Your inbox is empty.</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {messages.map(m => (
                <button key={m.uid} onClick={() => openMessage(m.uid)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${active?.uid === m.uid ? 'bg-purple-50' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${m.seen ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>
                      {shortName(m.from)}
                    </span>
                    <span className="text-[11px] text-neutral flex-shrink-0">
                      {m.date ? format(new Date(m.date), 'dd MMM') : ''}
                    </span>
                  </div>
                  <div className={`text-[13px] truncate ${m.seen ? 'text-neutral' : 'text-gray-800 font-medium'}`}>
                    {m.subject}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reader */}
        <div className="bg-white border border-gray-100 rounded-2xl min-h-[60vh]">
          {!active ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral py-20">
              <MailIcon size={40} className="opacity-30 mb-3" />
              <p className="text-sm">Select a message to read</p>
            </div>
          ) : loadingMsg ? (
            <div className="flex justify-center py-24"><Spinner size={26} /></div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">{active.subject}</h2>
                <div className="text-[13px] text-neutral">
                  <div><span className="text-gray-500">From:</span> {addr(active.from)}</div>
                  <div><span className="text-gray-500">To:</span> {active.to?.map(addr).join(', ')}</div>
                  <div className="mt-0.5">{active.date ? format(new Date(active.date), 'dd MMM yyyy, hh:mm a') : ''}</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => startReply(active)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">
                    <Reply size={14} /> Reply
                  </button>
                  <button onClick={() => startForward(active)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">
                    <Forward size={14} /> Forward
                  </button>
                </div>
              </div>

              {/* Body: HTML rendered in a sandboxed iframe, else plain text */}
              <div className="flex-1 overflow-y-auto p-5">
                {active.html ? (
                  <iframe
                    title="message-body"
                    sandbox=""
                    srcDoc={active.html}
                    className="w-full min-h-[40vh] border-0"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-poppins text-sm text-gray-700">{active.text}</pre>
                )}

                {active.attachments?.length > 0 && (
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <p className="text-[13px] font-semibold text-gray-600 mb-2">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {active.attachments.map((a, i) => (
                        <a key={i}
                          href={`data:${a.contentType};base64,${a.content}`}
                          download={a.filename}
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

      {composer && (
        <Composer initial={composer} onClose={() => setComposer(null)} onSent={loadList} />
      )}
    </div>
  )
}