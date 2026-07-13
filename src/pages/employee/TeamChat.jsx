import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Trash2, Users, MessageCircle, Loader2, RefreshCw,
  Smile, Paperclip, X, FileText, Download,
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const POLL_MS = 4000
const MAX_FILES = 5
const MAX_FILE_MB = 25

// Dependency-free emoji set for the picker.
const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
  '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥳','😏','😒',
  '😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡',
  '🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶',
  '😐','😑','😬','🙄','😯','😲','🥱','😴','🤤','😪','🤐','🥴','🤢','🤮','🤧','😷',
  '👍','👎','👌','✌️','🤞','🤟','🤘','👏','🙌','👐','🙏','🤝','💪','👀','🫶','👋',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💯','🔥','✨','⭐','🎉','🎊','✅','❌',
  '⚡','💻','📱','📧','📎','📌','📅','⏰','☕','🍕','🎯','🚀','📈','📝','🙈','🤙',
]

function fmtTime(d) {
  try {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}
function fmtDay(d) {
  const date = new Date(d)
  const today = new Date()
  const y = new Date(); y.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === y.toDateString()) return 'Yesterday'
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// One rendered attachment inside a message bubble.
function Attachment({ a, mine }) {
  const rt = a.resource_type || 'raw'
  if (rt === 'image') {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block mt-1">
        <img src={a.url} alt={a.name || 'image'} className="rounded-lg max-h-60 max-w-full object-cover" />
      </a>
    )
  }
  if (rt === 'video') {
    return <video src={a.url} controls className="rounded-lg max-h-60 max-w-full mt-1" />
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        mine ? 'bg-white/15 text-white' : 'bg-white text-gray-700 border border-gray-200'
      }`}
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[160px]">{a.name || 'file'}</span>
      {a.bytes ? <span className="text-[10px] opacity-70">{fmtSize(a.bytes)}</span> : null}
      <Download className="w-3.5 h-3.5 ml-auto opacity-70" />
    </a>
  )
}

// Render message text with @mentions highlighted.
function renderContent(m, mine) {
  if (!m.content) return null
  const names = (m.mentions || []).map((u) => u?.name).filter(Boolean)
  if (!names.length) return <span>{m.content}</span>

  const re = new RegExp(`@(${names.map(escapeRegExp).join('|')})`, 'g')
  const parts = []
  let last = 0
  let key = 0
  let mt
  while ((mt = re.exec(m.content)) !== null) {
    if (mt.index > last) parts.push(<span key={key++}>{m.content.slice(last, mt.index)}</span>)
    parts.push(
      <span key={key++} className={`font-semibold ${mine ? 'text-white' : 'text-primary'}`}>
        {mt[0]}
      </span>
    )
    last = mt.index + mt[0].length
  }
  if (last < m.content.length) parts.push(<span key={key++}>{m.content.slice(last)}</span>)
  return <>{parts}</>
}

export default function TeamChat() {
  const { user } = useAuth()
  const myId = user?._id

  const [messages, setMessages]   = useState([])
  const [participants, setParts]  = useState([])
  const [text, setText]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)

  const [files, setFiles]         = useState([])            // File[] pending send
  const [showEmoji, setShowEmoji] = useState(false)
  const [pickedMentions, setPicked] = useState([])          // [{_id, name}]
  const [mention, setMention]     = useState({ open: false, query: '', start: 0 })
  const [mentionIndex, setMentionIndex] = useState(0)

  const bottomRef  = useRef(null)
  const lastTsRef  = useRef(null)
  const scrollBox  = useRef(null)
  const taRef      = useRef(null)
  const fileRef    = useRef(null)
  const emojiWrap  = useRef(null)

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  const mentionMatches = mention.open
    ? participants
        .filter((p) => p._id !== myId && (p.name || '').toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 6)
    : []

  const loadInitial = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/employee-chat/messages', { params: { limit: 50 } })
      const msgs = data.data || []
      setMessages(msgs)
      if (msgs.length) lastTsRef.current = msgs[msgs.length - 1].createdAt
      setTimeout(() => scrollToBottom(false), 50)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load chat')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadParticipants = useCallback(async () => {
    try {
      const { data } = await api.get('/employee-chat/participants')
      setParts(data.data || [])
    } catch { /* non-critical */ }
  }, [])

  const poll = useCallback(async () => {
    if (!lastTsRef.current) return
    try {
      const { data } = await api.get('/employee-chat/messages', { params: { after: lastTsRef.current } })
      const fresh = data.data || []
      if (fresh.length) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m._id))
          const add = fresh.filter((m) => !seen.has(m._id))
          return add.length ? [...prev, ...add] : prev
        })
        lastTsRef.current = fresh[fresh.length - 1].createdAt
        const box = scrollBox.current
        const nearBottom = !box || (box.scrollHeight - box.scrollTop - box.clientHeight < 120)
        if (nearBottom) setTimeout(() => scrollToBottom(true), 40)
      }
    } catch { /* silent — retries next tick */ }
  }, [])

  useEffect(() => { loadInitial(); loadParticipants() }, [loadInitial, loadParticipants])

  useEffect(() => {
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  // Close the emoji panel on outside click.
  useEffect(() => {
    const onDocClick = (e) => {
      if (emojiWrap.current && !emojiWrap.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Insert text at the textarea caret (used by emoji picker).
  const insertText = (insert) => {
    const ta = taRef.current
    const start = ta ? ta.selectionStart : text.length
    const end = ta ? ta.selectionEnd : text.length
    const next = text.slice(0, start) + insert + text.slice(end)
    setText(next)
    const pos = start + insert.length
    requestAnimationFrame(() => {
      if (taRef.current) { taRef.current.focus(); taRef.current.setSelectionRange(pos, pos) }
    })
  }

  // Detect an in-progress "@query" immediately before the caret.
  const detectMention = (value, caret) => {
    const upto = value.slice(0, caret)
    const m = upto.match(/(?:^|\s)@([^\s@]*)$/)
    if (!m) return null
    return { query: m[1], start: caret - m[1].length - 1 }
  }

  const onChange = (e) => {
    const value = e.target.value
    setText(value)
    const caret = e.target.selectionStart
    const found = detectMention(value, caret)
    if (found) { setMention({ open: true, query: found.query, start: found.start }); setMentionIndex(0) }
    else if (mention.open) setMention({ open: false, query: '', start: 0 })
  }

  const chooseMention = (p) => {
    if (!p) return
    const before = text.slice(0, mention.start)
    const after = text.slice(mention.start + 1 + mention.query.length)
    const insert = `@${p.name} `
    const next = before + insert + after
    setText(next)
    setPicked((prev) => (prev.some((x) => x._id === p._id) ? prev : [...prev, { _id: p._id, name: p.name }]))
    setMention({ open: false, query: '', start: 0 })
    const pos = (before + insert).length
    requestAnimationFrame(() => {
      if (taRef.current) { taRef.current.focus(); taRef.current.setSelectionRange(pos, pos) }
    })
  }

  const onKey = (e) => {
    if (mention.open && mentionMatches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionMatches.length); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); chooseMention(mentionMatches[mentionIndex]); return }
      if (e.key === 'Escape')    { setMention({ open: false, query: '', start: 0 }); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const onPickFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length) {
      const tooBig = picked.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024)
      if (tooBig.length) toast.error(`Some files exceed ${MAX_FILE_MB} MB and were skipped`)
      const ok = picked.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)
      setFiles((prev) => {
        const combined = [...prev, ...ok].slice(0, MAX_FILES)
        if (prev.length + ok.length > MAX_FILES) toast.error(`You can attach up to ${MAX_FILES} files`)
        return combined
      })
    }
    e.target.value = ''
  }

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const send = async () => {
    const content = text.trim()
    if ((!content && files.length === 0) || sending) return
    setSending(true)
    try {
      const ids = pickedMentions.filter((pm) => content.includes(`@${pm.name}`)).map((pm) => pm._id)
      const fd = new FormData()
      fd.append('content', content)
      if (ids.length) fd.append('mentions', JSON.stringify(ids))
      files.forEach((f) => fd.append('attachments', f))

      const { data } = await api.post('/employee-chat/messages', fd)
      setMessages((prev) => [...prev, data.data])
      lastTsRef.current = data.data.createdAt
      setText(''); setFiles([]); setPicked([]); setShowEmoji(false)
      setMention({ open: false, query: '', start: 0 })
      setTimeout(() => scrollToBottom(true), 40)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const remove = async (id) => {
    try {
      await api.delete(`/employee-chat/messages/${id}`)
      setMessages((prev) => prev.filter((m) => m._id !== id))
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete')
    }
  }

  let lastDay = null

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <MessageCircle className="w-6 h-6" /> Team Chat
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">A private space for the team — not visible to admins.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Chat column */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl flex flex-col" style={{ height: '70vh' }}>
          {/* Messages */}
          <div ref={scrollBox} className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
                No messages yet. Say hello 👋
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id?._id === myId || m.sender_id === myId
                const senderName = m.sender_id?.name || 'Unknown'
                const day = fmtDay(m.createdAt)
                const showDay = day !== lastDay
                lastDay = day
                const atts = m.attachments || []
                return (
                  <div key={m._id}>
                    {showDay && (
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-3 py-0.5 rounded-full">{day}</span>
                      </div>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                        {!mine && <div className="text-[11px] font-semibold text-primary mb-0.5">{senderName}</div>}
                        {m.content && (
                          <div className="text-sm whitespace-pre-wrap break-words">{renderContent(m, mine)}</div>
                        )}
                        {atts.map((a, i) => <Attachment key={i} a={a} mine={mine} />)}
                        <div className={`text-[10px] mt-1 flex items-center gap-2 ${mine ? 'text-white/70 justify-end' : 'text-gray-400'}`}>
                          {fmtTime(m.createdAt)}
                          {mine && (
                            <button
                              onClick={() => remove(m._id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-300"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 p-3 relative">
            {/* Mention dropdown */}
            {mention.open && mentionMatches.length > 0 && (
              <div className="absolute left-3 bottom-full mb-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20">
                {mentionMatches.map((p, i) => (
                  <button
                    key={p._id}
                    onMouseDown={(e) => { e.preventDefault(); chooseMention(p) }}
                    onMouseEnter={() => setMentionIndex(i)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${i === mentionIndex ? 'bg-primary/10' : 'hover:bg-gray-50'}`}
                  >
                    <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-semibold">
                      {(p.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate text-gray-700">{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected file previews */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f, i) => {
                  const isImg = f.type?.startsWith('image/')
                  return (
                    <div key={i} className="relative flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg pl-2 pr-6 py-1.5 text-xs text-gray-600">
                      {isImg ? (
                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="truncate max-w-[120px]">{f.name}</span>
                      <span className="opacity-60">{fmtSize(f.size)}</span>
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 text-gray-400 hover:text-red-500"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Attach */}
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.ppt,.pptx"
                className="hidden"
                onChange={onPickFiles}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="shrink-0 p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition"
                title="Attach files, images or video"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Emoji */}
              <div ref={emojiWrap} className="relative shrink-0">
                <button
                  onClick={() => setShowEmoji((s) => !s)}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition"
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                {showEmoji && (
                  <div className="absolute left-0 bottom-full mb-2 w-64 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-8 gap-1 z-20">
                    {EMOJIS.map((em, i) => (
                      <button
                        key={i}
                        onClick={() => insertText(em)}
                        className="text-xl leading-none p-1 rounded hover:bg-gray-100"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <textarea
                ref={taRef}
                value={text}
                onChange={onChange}
                onKeyDown={onKey}
                rows={1}
                placeholder="Type a message…  (@ to mention, Enter to send)"
                className="flex-1 resize-none max-h-32 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={send}
                disabled={sending || (!text.trim() && files.length === 0)}
                className="shrink-0 flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Roster */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Members ({participants.length})
            </h2>
            <button onClick={loadParticipants} className="text-gray-400 hover:text-primary" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {participants.map((p) => (
              <div key={p._id} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-7 h-7 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-semibold">
                  {(p.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{p.name}{p._id === myId && ' (you)'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}