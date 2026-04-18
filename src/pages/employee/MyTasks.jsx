import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, CheckSquare } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, SelectInput, StatusBadge, PriorityBadge, Spinner, EmptyState, StatCard
} from '../../components/common/UI'

// ─────────────────────────────────────────────────────────────────────────────
// Inline sound helpers
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
    useCustomTask: false,
  }
}

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
    notes: [
      { freq: 523.25, start: 0,    dur: 0.18, vol: 0.75 },
      { freq: 659.25, start: 0.15, dur: 0.22, vol: 0.70 },
      { freq: 783.99, start: 0.30, dur: 0.28, vol: 0.65 },
    ],
  },
  pop: {
    notes: [
      { freq: 800,  start: 0,    dur: 0.06, vol: 0.80, type: 'square' },
      { freq: 1000, start: 0.07, dur: 0.10, vol: 0.70, type: 'sine'   },
    ],
  },
  ping: {
    notes: [{ freq: 880, start: 0, dur: 0.30, vol: 0.80 }],
  },
  double_ping: {
    notes: [
      { freq: 880,    start: 0,    dur: 0.14, vol: 0.80 },
      { freq: 1046.5, start: 0.20, dur: 0.18, vol: 0.75 },
    ],
  },
  bell: {
    notes: [
      { freq: 1318.5, start: 0,    dur: 0.08, vol: 0.85, type: 'triangle' },
      { freq: 659.25, start: 0.05, dur: 0.40, vol: 0.55, type: 'sine'     },
      { freq: 987.77, start: 0.05, dur: 0.35, vol: 0.40, type: 'sine'     },
    ],
  },
  xylophone: {
    notes: [
      { freq: 523.25, start: 0,    dur: 0.14, vol: 0.80, type: 'triangle' },
      { freq: 659.25, start: 0.16, dur: 0.14, vol: 0.80, type: 'triangle' },
      { freq: 783.99, start: 0.32, dur: 0.14, vol: 0.80, type: 'triangle' },
      { freq: 1046.5, start: 0.48, dur: 0.18, vol: 0.75, type: 'triangle' },
    ],
  },
  soft: {
    notes: [{ freq: 440, start: 0, dur: 0.28, vol: 0.60 }],
  },
}

function playSound(presetKey = 'chime', masterVol = 1) {
  const preset = SOUND_PRESETS[presetKey]
  if (!preset) return
  const ctx = getOrResumeCtx()
  if (!ctx) return

  const now        = ctx.currentTime
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

function playCustomRingtone(dataUrl, volume = 1) {
  try {
    const audio = new Audio(dataUrl)
    audio.volume = Math.min(1, Math.max(0, volume))
    audio.play().catch(() => {})
  } catch {}
}

function playTaskSound() {
  const cfg = loadSoundConfig()
  if (!cfg.enabled) return

  if (cfg.useCustomTask) {
    try {
      const raw = localStorage.getItem('notif_custom_ringtone_task')
      if (raw) {
        const { dataUrl } = JSON.parse(raw)
        if (dataUrl) { playCustomRingtone(dataUrl, cfg.volume); return }
      }
    } catch {}
  }

  playSound(cfg.taskSound || 'chime', cfg.volume)
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = ['todo', 'in-progress', 'completed', 'on-hold', 'cancelled']

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function EmployeeMyTasks() {
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('')
  const [updating, setUpdating] = useState(null)

  const knownTaskIds  = useRef(null)
  const pollInterval  = useRef(null)

  // ── fetch helpers ──────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async (params = {}) => {
    const { data } = await api.get('/tasks', { params })
    return data.data ?? []
  }, [])

  // ── initial load ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      const fetched = await fetchTasks(params)
      setTasks(fetched)
      knownTaskIds.current = new Set(fetched.map(t => t._id))
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [statusF, fetchTasks])

  useEffect(() => { load() }, [load])

  // ── background poll every 15 s ─────────────────────────────────────────────

  const poll = useCallback(async () => {
    if (knownTaskIds.current === null) return

    try {
      const fetched = await fetchTasks()
      const newTasks = fetched.filter(t => !knownTaskIds.current.has(t._id))

      if (newTasks.length > 0) {
        playTaskSound()

        newTasks.slice(0, 3).forEach(t => {
          toast(`✅ New task assigned: ${t.title}`, {
            duration: 5000,
            style: {
              background:   '#1e293b',
              color:        '#e2e8f0',
              border:       '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
            },
          })
        })

        knownTaskIds.current = new Set(fetched.map(t => t._id))

        const matchesFilter = (t) => !statusF || t.status === statusF
        const hasVisibleNew = newTasks.some(matchesFilter)
        if (hasVisibleNew) {
          setTasks(fetched.filter(matchesFilter))
        }
      }
    } catch {
      // silently swallow poll errors
    }
  }, [statusF, fetchTasks])

  useEffect(() => {
    pollInterval.current = setInterval(poll, 15_000)
    return () => clearInterval(pollInterval.current)
  }, [poll])

  // ── status update ──────────────────────────────────────────────────────────

  const updateStatus = async (taskId, newStatus) => {
    setUpdating(taskId)
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus })
      toast.success('Status updated')
      setTasks(prev =>
        prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t)
      )
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update')
    } finally {
      setUpdating(null)
    }
  }

  // ── derived stats ──────────────────────────────────────────────────────────

  const stats = {
    total:         tasks.length,
    todo:          tasks.filter(t => t.status === 'todo').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    completed:     tasks.filter(t => t.status === 'completed').length,
    overdue:       tasks.filter(t =>
      t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
    ).length,
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="My Tasks"
        subtitle="View and update the status of your assigned tasks"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total"       value={stats.total}          icon={CheckSquare} color="brand"   />
        <StatCard label="Todo"        value={stats.todo}           icon={CheckSquare} color="blue"    />
        <StatCard label="In Progress" value={stats['in-progress']} icon={CheckSquare} color="amber"   />
        <StatCard label="Completed"   value={stats.completed}      icon={CheckSquare} color="emerald" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <SelectInput
          value={statusF}
          onChange={setStatusF}
          placeholder="All statuses"
          options={STATUSES.map(s => ({ value: s, label: s }))}
          className="w-44"
        />
        <button
          onClick={load}
          className="px-3 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
          style={{
            backgroundColor: '#1e293b',
            border:          '1px solid rgba(255,255,255,0.1)',
            color:           '#94a3b8',
          }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description={statusF ? 'No tasks match this filter' : 'No tasks have been assigned to you yet'}
        />
      ) : (
        <div className="space-y-3">
          {tasks.map(t => {
            const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
            return (
              <div
                key={t._id}
                className="rounded-xl p-4 transition-all"
                style={{
                  backgroundColor: '#1e293b',
                  border:          '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">

                  {/* Left — task info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Priority colour bar */}
                    <div className={`w-1.5 h-10 rounded-full flex-shrink-0 mt-1 ${
                      t.priority === 'critical' ? 'bg-red-500'    :
                      t.priority === 'high'     ? 'bg-orange-500' :
                      t.priority === 'medium'   ? 'bg-yellow-500' : 'bg-emerald-500'
                    }`} />

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{t.title}</p>
                      {t.description && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500">
                          Project: <span className="text-slate-300">{t.project_id?.title ?? '—'}</span>
                        </span>
                        <span className={`text-xs font-mono ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                          {t.due_date
                            ? `Due: ${format(new Date(t.due_date), 'MMM d, yyyy')}`
                            : 'No deadline'}
                          {overdue && ' ⚠ Overdue'}
                        </span>
                        {t.assigned_by && (
                          <span className="text-xs text-slate-500">
                            By: <span className="text-slate-300">{t.assigned_by?.name}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right — priority badge + status selector */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <PriorityBadge priority={t.priority} />

                    <div className="relative">
                      <select
                        value={t.status}
                        onChange={e => updateStatus(t._id, e.target.value)}
                        disabled={updating === t._id}
                        className="text-xs py-1.5 pr-8 pl-2 w-36 appearance-none cursor-pointer rounded-xl outline-none"
                        style={{
                          backgroundColor: '#0f172a',
                          color:           '#e2e8f0',
                          border:          '1px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}
                            style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}
                          >
                            {s}
                          </option>
                        ))}
                      </select>

                      {/* Inline spinner while saving */}
                      {updating === t._id && (
                        <div
                          className="absolute inset-0 flex items-center justify-center rounded-xl"
                          style={{ backgroundColor: 'rgba(15,23,42,0.8)' }}
                        >
                          <div className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
