import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, Trash2, ExternalLink, Reply, Send, X, Volume2, VolumeX, Settings2, Music, Play, ChevronRight, Upload, RotateCcw } from 'lucide-react'
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

const SOUND_PRESETS = {
  chime: {
    label: 'Chime',
    category: 'task',
    notes: [
      { freq: 523.25, start: 0,    dur: 0.18, vol: 0.75 },
      { freq: 659.25, start: 0.15, dur: 0.22, vol: 0.70 },
      { freq: 783.99, start: 0.30, dur: 0.28, vol: 0.65 },
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

// ─────────────────────────────────────────────────────────────────────────────
// Custom ringtone storage keys
// ─────────────────────────────────────────────────────────────────────────────
const CUSTOM_RINGTONE_KEYS = {
  task:    'notif_custom_ringtone_task',
  meeting: 'notif_custom_ringtone_meeting',
  general: 'notif_custom_ringtone_general',
}

async function saveCustomRingtone(file, category) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.stringify({ name: file.name, dataUrl: reader.result })
        localStorage.setItem(CUSTOM_RINGTONE_KEYS[category], payload)
        resolve({ name: file.name, dataUrl: reader.result })
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadCustomRingtone(category) {
  try {
    const raw = localStorage.getItem(CUSTOM_RINGTONE_KEYS[category])
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function clearCustomRingtone(category) {
  localStorage.removeItem(CUSTOM_RINGTONE_KEYS[category])
}

function playCustomRingtone(dataUrl, volume = 1) {
  try {
    const audio = new Audio(dataUrl)
    audio.volume = Math.min(1, Math.max(0, volume))
    audio.play().catch(() => {})
  } catch {}
}

function playSound(presetKey = 'chime', masterVol = 1) {
  const preset = SOUND_PRESETS[presetKey]
  if (!preset) return
  const ctx = getOrResumeCtx()
  if (!ctx) return

  const now = ctx.currentTime
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
    volume:       0.85,
    taskSound:    'chime',
    meetingSound: 'fanfare',
    generalSound: 'soft',
    useCustomTask:    false,
    useCustomMeeting: false,
    useCustomGeneral: false,
  }
}

function saveSoundConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

function playSoundForCategory(category, cfg) {
  if (!cfg.enabled) return

  const useCustomMap = {
    task:    cfg.useCustomTask,
    meeting: cfg.useCustomMeeting,
    general: cfg.useCustomGeneral,
  }
  const presetMap = {
    task:    cfg.taskSound,
    meeting: cfg.meetingSound,
    general: cfg.generalSound,
  }

  if (useCustomMap[category]) {
    const ringtone = loadCustomRingtone(category)
    if (ringtone?.dataUrl) {
      playCustomRingtone(ringtone.dataUrl, cfg.volume)
      return
    }
  }
  playSound(presetMap[category] || 'soft', cfg.volume)
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX #1: CustomRingtoneUpload — local ringtone state to avoid stale closure
// ─────────────────────────────────────────────────────────────────────────────
function CustomRingtoneUpload({ category, cfg, onCfgUpdate, label }) {
  // FIX: Track ringtone in local state so it reacts to save/clear without
  // needing a parent re-render to re-read localStorage.
  const [ringtone, setRingtone] = useState(() => loadCustomRingtone(category))

  const useCustomKey  = `useCustom${category.charAt(0).toUpperCase() + category.slice(1)}`
  const isUsingCustom = cfg[useCustomKey] && !!ringtone

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file (mp3, wav, ogg, etc.)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large — max 5 MB')
      return
    }
    try {
      const saved = await saveCustomRingtone(file, category)
      // FIX: update local state immediately after save
      setRingtone(saved)
      onCfgUpdate({ [useCustomKey]: true })
      toast.success(`Custom ${label} ringtone saved!`)
    } catch {
      toast.error('Failed to save ringtone. File may be too large.')
    }
    e.target.value = ''
  }

  const handleClear = () => {
    clearCustomRingtone(category)
    // FIX: clear local state immediately
    setRingtone(null)
    onCfgUpdate({ [useCustomKey]: false })
    toast.success('Custom ringtone removed')
  }

  const handlePreview = () => {
    if (ringtone?.dataUrl) playCustomRingtone(ringtone.dataUrl, cfg.volume)
  }

  return (
    <div className="mt-3 p-3 rounded-xl border border-gray-200 bg-white/2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-neutral uppercase tracking-wider">
          Custom Ringtone
        </span>
        {isUsingCustom && (
          <span className="text-[10px] bg-purple-50 text-primary px-2 py-0.5 rounded-full font-medium">
            Active
          </span>
        )}
      </div>

      {ringtone ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-200">
            <Music size={11} className="text-primary shrink-0" />
            <span className="text-[16px] text-gray-600 truncate flex-1" title={ringtone.name}>
              {ringtone.name}
            </span>
            <button
              onClick={handlePreview}
              className="p-0.5 text-neutral hover:text-gray-800 transition-colors shrink-0"
              title="Preview"
            >
              <Play size={10} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onCfgUpdate({ [useCustomKey]: !cfg[useCustomKey] })}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                isUsingCustom
                  ? 'border-primary/30 bg-purple-50 text-primary'
                  : 'border-gray-200 bg-white/3 text-neutral hover:border-white/20 hover:text-gray-700'
              }`}
            >
              {isUsingCustom ? 'Using custom' : 'Use custom'}
            </button>
            <label
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-gray-200 bg-white/3 text-neutral hover:border-white/20 hover:text-gray-700 cursor-pointer transition-all flex items-center gap-1"
              title="Replace ringtone"
            >
              <Upload size={10} /> Replace
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            </label>
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg text-neutral hover:text-red-400 border border-gray-200 hover:border-red-500/30 transition-all"
              title="Remove custom ringtone"
            >
              <RotateCcw size={10} />
            </button>
          </div>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed border-white/15 text-neutral hover:border-primary/30 hover:text-primary cursor-pointer transition-all text-[16px] font-medium">
          <Upload size={12} />
          Upload audio file (mp3, wav, ogg…)
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
        </label>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX #2: SoundRow moved OUTSIDE SoundSettingsPanel to prevent remount on
// every parent render. Receives cfg, update, volume as props.
// ─────────────────────────────────────────────────────────────────────────────
function SoundRow({ label, configKey, category, useCustomKey, cfg, onUpdate }) {
  const categoryPresets = Object.entries(SOUND_PRESETS).filter(([, v]) => v.category === category)

  return (
    <div className="mb-5">
      <p className="text-[11px] font-semibold text-neutral uppercase tracking-wider mb-2">{label}</p>

      {/* Preset grid — disabled if custom is active */}
      <div className={`grid grid-cols-2 gap-1.5 transition-opacity ${cfg[useCustomKey] && loadCustomRingtone(category) ? 'opacity-40 pointer-events-none' : ''}`}>
        {categoryPresets.map(([key, preset]) => {
          const selected = cfg[configKey] === key && !cfg[useCustomKey]
          return (
            <div
              key={key}
              className={`flex items-center justify-between px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                selected
                  ? 'border-primary/30 bg-purple-50 text-primary'
                  : 'border-gray-200 bg-white/3 text-neutral hover:border-white/20 hover:text-gray-700'
              }`}
              onClick={() => onUpdate({ [configKey]: key, [useCustomKey]: false })}
            >
              <span className="text-[16px] font-medium">{preset.label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); playSound(key, cfg.volume) }}
                className="p-0.5 rounded hover:text-gray-800 transition-colors"
                title="Preview"
              >
                <Play size={10} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Custom ringtone upload */}
      <CustomRingtoneUpload
        category={category}
        cfg={cfg}
        onCfgUpdate={onUpdate}
        label={label.replace(/[^\w\s]/g, '').trim()}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sound Settings Panel
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

  return (
    <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white/2">
        <div className="flex items-center gap-2">
          <Music size={14} className="text-primary" />
          <span className="text-sm font-semibold text-gray-800">Sound Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral hover:text-gray-800 hover:bg-white/8 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4 max-h-[560px] overflow-y-auto space-y-5">
        {/* Master toggle + volume */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[16px] font-semibold text-gray-600">Enable Sounds</span>
            <button
              onClick={() => update({ enabled: !cfg.enabled })}
              className={`relative w-9 h-5 rounded-full transition-colors ${cfg.enabled ? 'bg-brand-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.enabled ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          <div className={`transition-opacity ${cfg.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-neutral">Volume</span>
              <span className="text-[11px] text-primary font-medium">{Math.round(cfg.volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <VolumeX size={12} className="text-neutral shrink-0" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={cfg.volume}
                onChange={e => update({ volume: parseFloat(e.target.value) })}
                className="flex-1 accent-brand-500 h-1 rounded-full cursor-pointer"
              />
              <Volume2 size={12} className="text-neutral shrink-0" />
            </div>
          </div>
        </div>

        {/* FIX #2: SoundRow is now a stable external component, passed cfg + update as props */}
        <div className={`space-y-1 transition-opacity ${cfg.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="h-px bg-white/6 mb-4" />
          <SoundRow label="📋 Task Notifications"  configKey="taskSound"    category="task"    useCustomKey="useCustomTask"    cfg={cfg} onUpdate={update} />
          <SoundRow label="📅 Meeting Invitations" configKey="meetingSound" category="meeting" useCustomKey="useCustomMeeting" cfg={cfg} onUpdate={update} />
          <SoundRow label="🔔 General Alerts"      configKey="generalSound" category="general" useCustomKey="useCustomGeneral" cfg={cfg} onUpdate={update} />
        </div>

        {/* Test all button */}
        <button
          onClick={() => {
            if (!cfg.enabled) return
            playSoundForCategory('general', cfg)
            setTimeout(() => playSoundForCategory('task',    cfg), 900)
            setTimeout(() => playSoundForCategory('meeting', cfg), 1800)
          }}
          disabled={!cfg.enabled}
          className="w-full py-2 rounded-xl bg-purple-50 hover:bg-purple-50 border border-primary/30 text-primary text-[16px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
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
  const [soundCfg,     setSoundCfg]     = useState(loadSoundConfig)

  const ref          = useRef(null)
  const prevUnread   = useRef(undefined)
  const prevNotifIds = useRef(new Set())
  const openRef      = useRef(open)
  // Baseline flag so the first poll doesn't fire sound/toast for existing items
  const initialized  = useRef(false)

  useEffect(() => { openRef.current = open }, [open])

  // Refresh soundCfg from storage whenever panel opens/closes
  useEffect(() => {
    setSoundCfg(loadSoundConfig())
  }, [open, showSettings])

  const playSoundFor = useCallback((kind = 'general') => {
    const cfg = loadSoundConfig()
    playSoundForCategory(kind, cfg)
  }, [])

  // ── Poll for new notifications (list + unread count in ONE request) ────────
  const checkForNew = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications?limit=10')
      const incoming    = data.data ?? []
      const unreadCount = data.unread_count ?? incoming.filter(n => !n.is_read).length

      // First run establishes a baseline — no sound/toast for already-existing items.
      if (!initialized.current) {
        prevNotifIds.current = new Set(incoming.map(n => n._id))
        prevUnread.current   = unreadCount
        setUnread(unreadCount)
        initialized.current  = true
        return
      }

      // Any id we haven't seen before is genuinely new.
      const newOnes = incoming.filter(n => !prevNotifIds.current.has(n._id))
      if (newOnes.length > 0) {
        const hasMeeting = newOnes.some(n => n.type === 'meeting_invite')
        const hasTask    = newOnes.some(n => [
          'task_assigned', 'task_updated', 'task_completed',
          'task_reminder', 'task_overdue', 'task_comment',
        ].includes(n.type))
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

        // If the panel is open, surface the new items immediately.
        if (openRef.current) setNotifs(incoming)
      }

      prevNotifIds.current = new Set(incoming.map(n => n._id))
      prevUnread.current   = unreadCount
      setUnread(unreadCount)
    } catch {}
  }, [playSoundFor])

  // Run once immediately, then poll every 12s; also re-check on tab focus.
  useEffect(() => {
    checkForNew()
    const t = setInterval(checkForNew, 12_000)
    const onFocus = () => checkForNew()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [checkForNew])

  // Unlock the Web Audio context on the first user gesture, so timer-driven
  // notification sounds can actually play (browsers block audio until then).
  useEffect(() => {
    const unlock = () => getOrResumeCtx()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown',     unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // ── FIX #4: fetchNotifs with AbortController to prevent setState on unmount ──
  const fetchNotifs = useCallback(async (signal) => {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications?limit=20', { signal })
      const incoming = data.data ?? []
      setNotifs(incoming)
      prevNotifIds.current = new Set(incoming.map(n => n._id))
    } catch (err) {
      // Ignore abort errors — component unmounted, no setState needed
      if (err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return
    } finally {
      // Guard: only call setLoading if request wasn't aborted
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetchNotifs(controller.signal)
    return () => controller.abort()
  }, [open, fetchNotifs])

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

  // FIX #5: clearAll now also resets open reply state
  const clearAll = async () => {
    try {
      await api.delete('/notifications/clear-all')
      setNotifs([])
      setUnread(0)
      prevUnread.current = 0
      prevNotifIds.current = new Set()
      // FIX: dismiss any open reply box so it doesn't point to a deleted notification
      cancelReply()
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

  const toggleMute = () => {
    const cfg = loadSoundConfig()
    const next = { ...cfg, enabled: !cfg.enabled }
    saveSoundConfig(next)
    setSoundCfg(next)
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={ref}>
      {/* ── Bell button ── */}
      <button
        onClick={() => { setOpen(o => !o); setShowSettings(false) }}
        className="relative p-2 rounded-xl text-neutral hover:text-gray-800 hover:bg-gray-50 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-4 right-1 w-4 h-4 bg-brand-500 rounded-full text-[10px] font-bold bg-yellow-400 text-red-500 flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Sound Settings Panel ── */}
      {showSettings && (
        <SoundSettingsPanel onClose={() => { setShowSettings(false); setSoundCfg(loadSoundConfig()) }} />
      )}

      {/* ── Notification Panel ── */}
      {open && !showSettings && (
        <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setOpen(false); setShowSettings(true) }}
                title="Sound Settings"
                className="p-1.5 rounded-lg text-neutral hover:text-primary hover:bg-gray-50 transition-colors"
              >
                <Settings2 size={13} />
              </button>

              <button
                onClick={toggleMute}
                title={soundCfg.enabled ? 'Mute sounds' : 'Unmute sounds'}
                className={`p-1.5 rounded-lg transition-colors ${
                  soundCfg.enabled
                    ? 'text-primary hover:text-primary hover:bg-gray-50'
                    : 'text-neutral hover:text-neutral hover:bg-gray-50'
                }`}
              >
                {soundCfg.enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>

              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="text-[16px] text-primary hover:text-primary px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-1"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
              <button
                onClick={clearAll}
                className="text-[16px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-1"
              >
                <Trash2 size={12} /> Clear
              </button>
            </div>
          </div>

          {/* Sound status bar */}
          <div className={`px-4 py-1.5 border-b border-gray-100 flex items-center justify-between text-[10px] ${soundCfg.enabled ? 'text-primary/70' : 'text-neutral'}`}>
            <div className="flex items-center gap-1">
              {soundCfg.enabled
                ? <><Volume2 size={9} /> Sound active — {Math.round(soundCfg.volume * 100)}% volume</>
                : <><VolumeX size={9} /> Sound muted</>
              }
            </div>
            <button
              onClick={() => { setOpen(false); setShowSettings(true) }}
              className="flex items-center gap-0.5 hover:text-primary transition-colors"
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
              <div className="text-center py-8 text-neutral text-sm">No notifications</div>
            ) : notifs.map(n => {
              const isMeeting  = n.type === 'meeting_invite'
              const isTask     = [
                'task_assigned', 'task_updated', 'task_completed',
                'task_reminder', 'task_overdue', 'task_comment',
              ].includes(n.type)
              const joinLink   = isMeeting ? extractLink(n.message) : null
              const displayMsg = isMeeting && joinLink
                ? n.message.replace(/Join:\s*https?:\/\/[^\s]+/, '').trim()
                : n.message
              const isReplying = replyId === n._id

              return (
                <div
                  key={n._id}
                  className={`px-4 py-3 border-b border-gray-100 transition-colors ${!n.is_read ? 'border-l-2 border-l-brand-500' : ''}`}
                >
                  {isMeeting && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-50 text-primary px-1.5 py-0.5 rounded-full mb-1">
                      📅 Meeting invite
                    </span>
                  )}
                  {isTask && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded-full mb-1">
                      ✅ Task
                    </span>
                  )}

                  <p className={`text-sm leading-snug ${n.is_read ? 'text-neutral' : 'text-gray-700'}`}>
                    {displayMsg}
                  </p>

                  {joinLink && (
                    <a
                      href={joinLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-[16px] text-primary hover:text-primary bg-purple-50 hover:bg-purple-50 px-2.5 py-1 rounded-lg transition-colors font-medium"
                    >
                      <ExternalLink size={11} /> Join Meeting
                    </a>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[16px] text-neutral">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                    {canReply && !isReplying && (
                      <button
                        onClick={() => openReply(n)}
                        className="text-[16px] text-neutral hover:text-primary flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-50 transition-colors"
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
                        className="w-full text-[16px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-slate-600 resize-none focus:outline-none focus:border-primary/30 transition-colors"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={cancelReply}
                          disabled={replying}
                          className="text-[16px] text-neutral hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-1 transition-colors"
                        >
                          <X size={11} /> Cancel
                        </button>
                        <button
                          onClick={() => sendReply(n)}
                          disabled={replying || !replyText.trim()}
                          className="text-[16px] text-gray-800 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors font-medium"
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