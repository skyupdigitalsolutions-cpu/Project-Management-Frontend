import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, Trash2, ExternalLink, Reply, Send, X, Volume2, VolumeX } from 'lucide-react'
import api from '../../api/axios'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

function extractLink(message) {
  const match = message?.match(/https?:\/\/[^\s]+/)
  return match ? match[0] : null
}

// ── Audio helpers ──────────────────────────────────────────────────────────────
// Uses Web Audio API — no external files needed.

function createAudioContext() {
  try {
    return new (window.AudioContext || window.webkitAudioContext)()
  } catch {
    return null
  }
}

/**
 * Play a short notification chime.
 * @param {'task'|'meeting'|'general'} kind
 */
function playNotificationSound(kind = 'general') {
  const ctx = createAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  const presets = {
    // Two ascending tones — friendly "new task" ping
    task: [
      { freq: 523.25, start: 0,    dur: 0.12, vol: 0.45 }, // C5
      { freq: 659.25, start: 0.13, dur: 0.18, vol: 0.40 }, // E5
    ],
    // Three-note chime — attention-grabbing "meeting" alert
    meeting: [
      { freq: 523.25, start: 0,    dur: 0.12, vol: 0.50 }, // C5
      { freq: 659.25, start: 0.13, dur: 0.12, vol: 0.50 }, // E5
      { freq: 783.99, start: 0.26, dur: 0.22, vol: 0.45 }, // G5
    ],
    // Single soft ping — subtle "general" nudge
    general: [
      { freq: 440,    start: 0,    dur: 0.20, vol: 0.35 }, // A4
    ],
  }

  const notes = presets[kind] ?? presets.general

  notes.forEach(({ freq, start, dur, vol }) => {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + start)

    gain.gain.setValueAtTime(0, now + start)
    gain.gain.linearRampToValueAtTime(vol, now + start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur)

    osc.start(now + start)
    osc.stop(now + start + dur + 0.05)
  })

  // Release AudioContext after last note
  const totalDur = Math.max(...notes.map(n => n.start + n.dur)) + 0.2
  setTimeout(() => ctx.close(), totalDur * 1000 + 200)
}

function soundKindFor(type) {
  if (type === 'meeting_invite') return 'meeting'
  if (['task_assigned', 'task_updated', 'task_completed'].includes(type)) return 'task'
  return 'general'
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const { user } = useAuth()
  const canReply = user?.role
    ? ['admin', 'manager'].includes(user.role.toLowerCase())
    : false

  const [open,      setOpen]      = useState(false)
  const [notifs,    setNotifs]    = useState([])
  const [unread,    setUnread]    = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [replyId,   setReplyId]   = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replying,  setReplying]  = useState(false)
  const [soundOn,   setSoundOn]   = useState(() => {
    const saved = localStorage.getItem('notif_sound')
    return saved === null ? true : saved === 'true'
  })

  const ref            = useRef(null)
  const prevUnread     = useRef(undefined)
  const prevNotifIds   = useRef(new Set())
  const openRef        = useRef(open)

  useEffect(() => { openRef.current = open }, [open])

  // ── sound toggle ──────────────────────────────────────────────────────────
  const toggleSound = () => {
    setSoundOn(prev => {
      const next = !prev
      localStorage.setItem('notif_sound', String(next))
      if (next) playNotificationSound('general')
      return next
    })
  }

  // ── poll unread count ─────────────────────────────────────────────────────
  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count')
      const newCount = data.unread_count ?? 0

      if (prevUnread.current !== undefined && newCount > prevUnread.current) {
        try {
          const { data: nd } = await api.get('/notifications?limit=10')
          const incoming = nd.data ?? []
          const newOnes  = incoming.filter(n => !prevNotifIds.current.has(n._id))

          if (newOnes.length > 0) {
            // Determine the most important sound
            const hasMeeting = newOnes.some(n => n.type === 'meeting_invite')
            const hasTask    = newOnes.some(n =>
              ['task_assigned', 'task_updated', 'task_completed'].includes(n.type)
            )
            const kind = hasMeeting ? 'meeting' : hasTask ? 'task' : 'general'

            // Play sound (read from ref to get current value without re-creating callback)
            const soundEnabled = localStorage.getItem('notif_sound') !== 'false'
            if (soundEnabled) playNotificationSound(kind)

            // Toast only when panel is closed
            if (!openRef.current) {
              const label = hasMeeting
                ? '📅 New meeting invitation!'
                : hasTask
                  ? '✅ New task assigned!'
                  : '🔔 New notification!'
              toast(label, {
                duration: 4000,
                style: {
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                },
              })
            }

            prevNotifIds.current = new Set(incoming.map(n => n._id))
          }
        } catch {
          const soundEnabled = localStorage.getItem('notif_sound') !== 'false'
          if (soundEnabled) playNotificationSound('general')
        }
      }

      prevUnread.current = newCount
      setUnread(newCount)
    } catch {}
  }, []) // stable — reads sound pref from localStorage directly

  useEffect(() => {
    fetchCount()
    const t = setInterval(fetchCount, 30000)
    return () => clearInterval(t)
  }, [fetchCount])

  // ── fetch list when panel opens ───────────────────────────────────────────
  const fetchNotifs = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications?limit=10')
      const incoming = data.data ?? []
      setNotifs(incoming)
      prevNotifIds.current = new Set(incoming.map(n => n._id))
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) fetchNotifs() }, [open])

  // ── close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── actions ───────────────────────────────────────────────────────────────
  const markAll = async () => {
    try {
      await api.patch('/notifications/mark-all-read')
      setNotifs(n => n.map(x => ({ ...x, is_read: true })))
      setUnread(0)
      prevUnread.current = 0
    } catch { toast.error('Failed') }
  }

  const clearAll = async () => {
    try {
      await api.delete('/notifications/clear-all')
      setNotifs([])
      setUnread(0)
      prevUnread.current = 0
      prevNotifIds.current = new Set()
    } catch { toast.error('Failed') }
  }

  const openReply   = (notif) => { setReplyId(notif._id); setReplyText('') }
  const cancelReply = ()      => { setReplyId(null); setReplyText('') }

  const sendReply = async (notif) => {
    if (!replyText.trim()) { toast.error('Enter a reply message'); return }
    const recipientId = notif.sender_id || notif.user_id
    if (!recipientId) { toast.error('Cannot determine reply recipient'); return }

    setReplying(true)
    try {
      await api.post('/notifications/send', {
        user_ids: [recipientId],
        message:  replyText.trim(),
        type:     'general',
      })
      toast.success('Reply sent!')
      cancelReply()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send reply')
    } finally {
      setReplying(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-brand-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-surface-100 border border-white/10 rounded-2xl shadow-2xl z-50 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-1">
              {/* Sound toggle button */}
              <button
                onClick={toggleSound}
                title={soundOn ? 'Mute notification sounds' : 'Enable notification sounds'}
                className={`p-1.5 rounded-lg transition-colors ${
                  soundOn
                    ? 'text-brand-400 hover:text-brand-300 hover:bg-white/5'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-white/5'
                }`}
              >
                {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>

              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="text-xs text-brand-400 hover:text-brand-300 px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
              <button
                onClick={clearAll}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1"
              >
                <Trash2 size={12} /> Clear
              </button>
            </div>
          </div>

          {/* Sound status bar */}
          <div className={`px-4 py-1.5 border-b border-white/5 flex items-center gap-1 text-[10px] ${soundOn ? 'text-brand-400/70' : 'text-slate-600'}`}>
            {soundOn
              ? <><Volume2 size={9} /> Sound alerts active — you'll hear chimes for new notifications</>
              : <><VolumeX size={9} /> Sound alerts muted</>
            }
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No notifications</div>
            ) : notifs.map(n => {
              const isMeeting  = n.type === 'meeting_invite'
              const isTask     = ['task_assigned', 'task_updated', 'task_completed'].includes(n.type)
              const joinLink   = isMeeting ? extractLink(n.message) : null
              const displayMsg = isMeeting && joinLink
                ? n.message.replace(/Join:\s*https?:\/\/[^\s]+/, '').trim()
                : n.message
              const isReplying = replyId === n._id

              return (
                <div
                  key={n._id}
                  className={`px-4 py-3 border-b border-white/5 transition-colors ${!n.is_read ? 'border-l-2 border-l-brand-500' : ''}`}
                >
                  {isMeeting && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-brand-600/20 text-brand-300 px-1.5 py-0.5 rounded-full mb-1">
                      📅 Meeting invite
                    </span>
                  )}
                  {isTask && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded-full mb-1">
                      ✅ Task
                    </span>
                  )}

                  <p className={`text-sm leading-snug ${n.is_read ? 'text-slate-400' : 'text-slate-200'}`}>
                    {displayMsg}
                  </p>

                  {joinLink && (
                    <a
                      href={joinLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-xs text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 px-2.5 py-1 rounded-lg transition-colors font-medium"
                    >
                      <ExternalLink size={11} /> Join Meeting
                    </a>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>

                    {canReply && !isReplying && (
                      <button
                        onClick={() => openReply(n)}
                        className="text-xs text-slate-500 hover:text-brand-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
                      >
                        <Reply size={11} /> Reply
                      </button>
                    )}
                  </div>

                  {canReply && isReplying && (
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        autoFocus
                        rows={2}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Type your reply…"
                        className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-brand-500/50 transition-colors"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={cancelReply}
                          disabled={replying}
                          className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1 transition-colors"
                        >
                          <X size={11} /> Cancel
                        </button>
                        <button
                          onClick={() => sendReply(n)}
                          disabled={replying || !replyText.trim()}
                          className="text-xs text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors font-medium"
                        >
                          {replying
                            ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            : <Send size={11} />
                          }
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}