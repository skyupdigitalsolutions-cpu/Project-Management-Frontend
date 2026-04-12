import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, Trash2, ExternalLink, Reply, Send, X, Volume2, VolumeX, Settings2, Music, Play, ChevronRight } from 'lucide-react'
import api from '../../api/axios'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────
function extractLink(message) {
  const match = message?.match(/https?:\/\/[^\s]+/)
  return match ? match[0] : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Engine  (Web Audio API — no external files needed)
// ─────────────────────────────────────────────────────────────────────────────

function getOrResumeCtx() {
  if (!window.__notifAudioCtx || window.__notifAudioCtx.state === 'closed') {
    try {
      window.__notifAudioCtx = new (window.AudioContext || window.webkitAudioContext)()
    } catch { return null }
  }
  if (window.__notifAudioCtx.state === 'suspended') {
    window.__notifAudioCtx.resume().catch(() => {})
  }
  return window.__notifAudioCtx
}

/**
 * All sound presets.  vol values raised for louder output.
 * Each preset is an array of { freq, start, dur, vol, type? } note descriptors.
 */
const SOUND_PRESETS = {
  // ── task sounds ──────────────────────────────────────────────────────────
  chime: {
    label: 'Chime',
    category: 'task',
    notes: [
      { freq: 523.25, start: 0,    dur: 0.18, vol: 0.75 }, // C5
      { freq: 659.25, start: 0.15, dur: 0.22, vol: 0.70 }, // E5
      { freq: 783.99, start: 0.30, dur: 0.28, vol: 0.65 }, // G5
    ],
  },
  pop: {
    label: 'Pop',
    category: 'task',
    notes: [
      { freq: 800,    start: 0,    dur: 0.06, vol: 0.80, type: 'square' },
      { freq: 1000,   start: 0.07, dur: 0.10, vol: 0.70, type: 'sine'   },
    ],
  },
  ping: {
    label: 'Ping',
    category: 'task',
    notes: [
      { freq: 880,    start: 0,    dur: 0.30, vol: 0.80 },
    ],
  },
  double_ping: {
    label: 'Double Ping',
    category: 'task',
    notes: [
      { freq: 880,    start: 0,    dur: 0.14, vol: 0.80 },
      { freq: 1046.5, start: 0.20, dur: 0.18, vol: 0.75 },
    ],
  },
  bell: {
    label: 'Bell',
    category: 'task',
    notes: [
      { freq: 1318.5, start: 0,    dur: 0.08, vol: 0.85, type: 'triangle' },
      { freq: 659.25, start: 0.05, dur: 0.40, vol: 0.55, type: 'sine'     },
      { freq: 987.77, start: 0.05, dur: 0.35, vol: 0.40, type: 'sine'     },
    ],
  },
  xylophone: {
    label: 'Xylophone',
    category: 'task',
    notes: [
      { freq: 523.25, start: 0,    dur: 0.14, vol: 0.80, type: 'triangle' },
      { freq: 659.25, start: 0.16, dur: 0.14, vol: 0.80, type: 'triangle' },
      { freq: 783.99, start: 0.32, dur: 0.14, vol: 0.80, type: 'triangle' },
      { freq: 1046.5, start: 0.48, dur: 0.18, vol: 0.75, type: 'triangle' },
    ],
  },
  // ── meeting sounds ───────────────────────────────────────────────────────
  fanfare: {
    label: 'Fanfare',
    category: 'meeting',
    notes: [
      { freq: 523.25, start: 0,    dur: 0.12, vol: 0.80 },
      { freq: 659.25, start: 0.13, dur: 0.12, vol: 0.80 },
      { freq: 783.99, start: 0.26, dur: 0.12, vol: 0.80 },
      { freq: 1046.5, start: 0.39, dur: 0.28, vol: 0.75 },
    ],
  },
  alert: {
    label: 'Alert',
    category: 'meeting',
    notes: [
      { freq: 440,    start: 0,    dur: 0.10, vol: 0.90, type: 'square' },
      { freq: 550,    start: 0.15, dur: 0.10, vol: 0.90, type: 'square' },
      { freq: 440,    start: 0.30, dur: 0.10, vol: 0.85, type: 'square' },
      { freq: 660,    start: 0.45, dur: 0.20, vol: 0.80, type: 'square' },
    ],
  },
  // ── general sounds ───────────────────────────────────────────────────────
  soft: {
    label: 'Soft',
    category: 'general',
    notes: [
      { freq: 440,    start: 0,    dur: 0.28, vol: 0.60 },
    ],
  },
  swoosh: {
    label: 'Swoosh',
    category: 'general',
    notes: [
      { freq: 300,    start: 0,    dur: 0.05, vol: 0.50, type: 'sawtooth' },
      { freq: 600,    start: 0.06, dur: 0.12, vol: 0.65, type: 'sine'     },
      { freq: 900,    start: 0.18, dur: 0.10, vol: 0.55, type: 'sine'     },
    ],
  },
}

/**
 * Core playback.  Accepts a preset key string.
 * Volume is scaled by `masterVol` (0–1, default 1).
 */
function playSound(presetKey = 'chime', masterVol = 1) {
  const preset = SOUND_PRESETS[presetKey]
  if (!preset) return
  const ctx = getOrResumeCtx()
  if (!ctx) return

  const now = ctx.currentTime

  // Master gain node for volume scaling
  const masterGain = ctx.createGain()
  masterGain.gain.setValueAtTime(Math.min(1, Math.max(0, masterVol)), now)
  masterGain.connect(ctx.destination)

  preset.notes.forEach(({ freq, start, dur, vol, type = 'sine' }) => {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(masterGain)

    osc.type = type
    osc.frequency.setValueAtTime(freq, now + start)

    gain.gain.setValueAtTime(0, now + start)
    gain.gain.linearRampToValueAtTime(vol, now + start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur)

    osc.start(now + start)
    osc.stop(now + start + dur + 0.05)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Default sound config stored in localStorage
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'notif_sound_config'

function loadSoundConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    enabled:      true,
    volume:       0.85,       // 0–1
    taskSound:    'chime',
    meetingSound: 'fanfare',
    generalSound: 'soft',
  }
}

function saveSoundConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sound Settings Panel (sub-component)
// ─────────────────────────────────────────────────────────────────────────────
function SoundSettingsPanel({ onClose }) {
  const [cfg, setCfg] = useState(loadSoundConfig)

  const update = (patch) => {
    setCfg(prev => {
      const next = { ...prev, ...patch }
      saveSoundConfig(next)
      return next
    })
  }

  const previewSound = (key) => {
    playSound(key, cfg.volume)
  }

  const categoryPresets = (cat) =>
    Object.entries(SOUND_PRESETS).filter(([, v]) => v.category === cat)

  const SoundRow = ({ label, configKey, category }) => (
    <div className="mb-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {categoryPresets(category).map(([key, preset]) => {
          const selected = cfg[configKey] === key
          return (
            <div
              key={key}
              className={`flex items-center justify-between px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                selected
                  ? 'border-brand-500/70 bg-brand-500/15 text-brand-300'
                  : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/20 hover:text-slate-200'
              }`}
              onClick={() => update({ [configKey]: key })}
            >
              <span className="text-xs font-medium">{preset.label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); previewSound(key) }}
                className="p-0.5 rounded hover:text-white transition-colors"
                title="Preview"
              >
                <Play size={10} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="absolute right-0 top-11 w-80 bg-surface-100 border border-white/10 rounded-2xl shadow-2xl z-50 animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-white/2">
        <div className="flex items-center gap-2">
          <Music size={14} className="text-brand-400" />
          <span className="text-sm font-semibold text-white">Sound Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4 max-h-[480px] overflow-y-auto space-y-5">
        {/* Master toggle + volume */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300">Enable Sounds</span>
            <button
              onClick={() => update({ enabled: !cfg.enabled })}
              className={`relative w-9 h-5 rounded-full transition-colors ${cfg.enabled ? 'bg-brand-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.enabled ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          {/* Volume slider */}
          <div className={`transition-opacity ${cfg.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-slate-400">Volume</span>
              <span className="text-[11px] text-brand-400 font-medium">{Math.round(cfg.volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <VolumeX size={12} className="text-slate-600 shrink-0" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={cfg.volume}
                onChange={e => update({ volume: parseFloat(e.target.value) })}
                className="flex-1 accent-brand-500 h-1 rounded-full cursor-pointer"
              />
              <Volume2 size={12} className="text-slate-400 shrink-0" />
            </div>
          </div>
        </div>

        <div className={`space-y-1 transition-opacity ${cfg.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="h-px bg-white/6 mb-4" />

          <SoundRow label="📋 Task Notifications" configKey="taskSound"    category="task"    />
          <SoundRow label="📅 Meeting Invitations" configKey="meetingSound" category="meeting" />
          <SoundRow label="🔔 General Alerts"      configKey="generalSound" category="general" />
        </div>

        {/* Test all button */}
        <button
          onClick={() => {
            if (!cfg.enabled) return
            playSound(cfg.generalSound, cfg.volume)
            setTimeout(() => playSound(cfg.taskSound,    cfg.volume), 800)
            setTimeout(() => playSound(cfg.meetingSound, cfg.volume), 1600)
          }}
          disabled={!cfg.enabled}
          className="w-full py-2 rounded-xl bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 text-brand-300 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Play size={11} /> Preview All Sounds
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const { user } = useAuth()
  const canReply = user?.role
    ? ['admin', 'manager'].includes(user.role.toLowerCase())
    : false

  const [open,         setOpen]         = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [notifs,       setNotifs]       = useState([])
  const [unread,       setUnread]       = useState(0)
  const [loading,      setLoading]      = useState(false)
  const [replyId,      setReplyId]      = useState(null)
  const [replyText,    setReplyText]    = useState('')
  const [replying,     setReplying]     = useState(false)

  const ref          = useRef(null)
  const prevUnread   = useRef(undefined)
  const prevNotifIds = useRef(new Set())
  const openRef      = useRef(open)

  useEffect(() => { openRef.current = open }, [open])

  // ── helper: play based on current config ──────────────────────────────────
  const playSoundFor = useCallback((kind = 'general') => {
    const cfg = loadSoundConfig()
    if (!cfg.enabled) return
    const key = kind === 'meeting' ? cfg.meetingSound
              : kind === 'task'    ? cfg.taskSound
              :                      cfg.generalSound
    playSound(key, cfg.volume)
  }, [])

  // ── poll unread count every 15 s ──────────────────────────────────────────
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
            const hasMeeting = newOnes.some(n => n.type === 'meeting_invite')
            const hasTask    = newOnes.some(n =>
              ['task_assigned', 'task_updated', 'task_completed'].includes(n.type)
            )
            const kind = hasMeeting ? 'meeting' : hasTask ? 'task' : 'general'

            playSoundFor(kind)

            if (!openRef.current) {
              const label = hasMeeting ? '📅 New meeting invitation!'
                          : hasTask    ? '✅ New task assigned!'
                          :              '🔔 New notification!'
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
          playSoundFor('general')
        }
      }

      prevUnread.current = newCount
      setUnread(newCount)
    } catch {}
  }, [playSoundFor])

  useEffect(() => {
    fetchCount()
    const t = setInterval(fetchCount, 15_000)   // tighter poll: 15 s
    return () => clearInterval(t)
  }, [fetchCount])

  // ── fetch list when panel opens ───────────────────────────────────────────
  const fetchNotifs = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications?limit=20')
      const incoming = data.data ?? []
      setNotifs(incoming)
      // Sync both refs so next poll diff is correct
      prevNotifIds.current = new Set(incoming.map(n => n._id))
      const unreadCount = incoming.filter(n => !n.is_read).length
      prevUnread.current = unreadCount
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) fetchNotifs() }, [open])

  // ── close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setShowSettings(false)
      }
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
    } finally { setReplying(false) }
  }

  const soundCfg = loadSoundConfig()

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={ref}>
      {/* ── Bell button ── */}
      <button
        onClick={() => { setOpen(o => !o); setShowSettings(false) }}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-brand-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Sound Settings Panel ── */}
      {showSettings && (
        <SoundSettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* ── Notification Panel ── */}
      {open && !showSettings && (
        <div className="absolute right-0 top-11 w-80 bg-surface-100 border border-white/10 rounded-2xl shadow-2xl z-50 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-1">

              {/* Sound settings gear */}
              <button
                onClick={() => { setOpen(false); setShowSettings(true) }}
                title="Sound Settings"
                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-white/5 transition-colors"
              >
                <Settings2 size={13} />
              </button>

              {/* Quick mute/unmute */}
              <button
                onClick={() => {
                  const cfg = loadSoundConfig()
                  saveSoundConfig({ ...cfg, enabled: !cfg.enabled })
                  // force re-render
                  setNotifs(n => [...n])
                }}
                title={soundCfg.enabled ? 'Mute sounds' : 'Unmute sounds'}
                className={`p-1.5 rounded-lg transition-colors ${
                  soundCfg.enabled
                    ? 'text-brand-400 hover:text-brand-300 hover:bg-white/5'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-white/5'
                }`}
              >
                {soundCfg.enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
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
          <div className={`px-4 py-1.5 border-b border-white/5 flex items-center justify-between text-[10px] ${soundCfg.enabled ? 'text-brand-400/70' : 'text-slate-600'}`}>
            <div className="flex items-center gap-1">
              {soundCfg.enabled
                ? <><Volume2 size={9} /> Sound active — {Math.round(soundCfg.volume * 100)}% volume</>
                : <><VolumeX size={9} /> Sound muted</>
              }
            </div>
            <button
              onClick={() => { setOpen(false); setShowSettings(true) }}
              className="flex items-center gap-0.5 hover:text-brand-400 transition-colors"
            >
              Customize <ChevronRight size={9} />
            </button>
          </div>

          {/* Notification list */}
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
