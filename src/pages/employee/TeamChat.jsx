import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Trash2, Users, MessageCircle, Loader2, RefreshCw } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const POLL_MS = 4000

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

export default function TeamChat() {
  const { user } = useAuth()
  const myId = user?._id

  const [messages, setMessages]   = useState([])
  const [participants, setParts]  = useState([])
  const [text, setText]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)

  const bottomRef = useRef(null)
  const lastTsRef = useRef(null)      // createdAt of the newest message we have
  const scrollBox = useRef(null)

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

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

  // Poll for new messages since the last one we have
  const poll = useCallback(async () => {
    if (!lastTsRef.current) return
    try {
      const { data } = await api.get('/employee-chat/messages', { params: { after: lastTsRef.current } })
      const fresh = data.data || []
      if (fresh.length) {
        setMessages(prev => {
          const seen = new Set(prev.map(m => m._id))
          const add = fresh.filter(m => !seen.has(m._id))
          return add.length ? [...prev, ...add] : prev
        })
        lastTsRef.current = fresh[fresh.length - 1].createdAt
        // Only autoscroll if user is near the bottom
        const box = scrollBox.current
        const nearBottom = !box || (box.scrollHeight - box.scrollTop - box.clientHeight < 120)
        if (nearBottom) setTimeout(() => scrollToBottom(true), 40)
      }
    } catch { /* silent — will retry next tick */ }
  }, [])

  useEffect(() => { loadInitial(); loadParticipants() }, [loadInitial, loadParticipants])

  useEffect(() => {
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const { data } = await api.post('/employee-chat/messages', { content })
      setMessages(prev => [...prev, data.data])
      lastTsRef.current = data.data.createdAt
      setText('')
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
      setMessages(prev => prev.filter(m => m._id !== id))
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete')
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Group messages by day for date separators
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
                return (
                  <div key={m._id}>
                    {showDay && (
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-3 py-0.5 rounded-full">{day}</span>
                      </div>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                        {!mine && <div className="text-[11px] font-semibold text-primary mb-0.5">{senderName}</div>}
                        <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
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
          <div className="border-t border-gray-200 p-3 flex items-end gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder="Type a message…  (Enter to send, Shift+Enter for new line)"
              className="flex-1 resize-none max-h-32 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="shrink-0 flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
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
            {participants.map(p => (
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