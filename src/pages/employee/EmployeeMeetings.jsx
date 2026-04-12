import { useEffect, useState, useCallback } from 'react'
import { Video, ExternalLink, Calendar, Clock, Users, RefreshCw } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, isPast, isWithinInterval, addMinutes } from 'date-fns'

const Spinner = () => (
  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
)

const Badge = ({ children, color = 'slate' }) => {
  const colors = {
    slate:  'bg-slate-700/50 text-slate-300',
    green:  'bg-emerald-600/20 text-emerald-300',
    yellow: 'bg-amber-600/20  text-amber-300',
    red:    'bg-red-600/20    text-red-300',
    brand:  'bg-brand-600/20  text-brand-300',
    purple: 'bg-purple-600/20 text-purple-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

const PLATFORMS = {
  zoom:        { label: 'Zoom',        color: 'brand' },
  google_meet: { label: 'Google Meet', color: 'green' },
  other:       { label: 'Meeting',     color: 'slate' },
}

const STATUS_MAP = {
  upcoming:  'brand',
  ongoing:   'green',
  completed: 'slate',
  cancelled: 'red',
}

function isLive(meeting) {
  const start = new Date(meeting.scheduled_at)
  const end   = addMinutes(start, meeting.duration_minutes)
  return isWithinInterval(new Date(), { start, end })
}

function MeetingCard({ meeting }) {
  const live      = isLive(meeting)
  const past      = isPast(addMinutes(new Date(meeting.scheduled_at), meeting.duration_minutes))
  const cancelled = meeting.status === 'cancelled'
  const platform  = PLATFORMS[meeting.platform] ?? { label: meeting.platform, color: 'slate' }

  return (
    <div className={`bg-surface-50 border rounded-2xl p-5 transition-colors ${live ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : 'border-white/5 hover:border-white/10'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Badge color={platform.color}>{platform.label}</Badge>
            <Badge color={STATUS_MAP[meeting.status] ?? 'slate'}>{meeting.status}</Badge>
            {live && <Badge color="green">🔴 Live now</Badge>}
            {meeting.is_broadcast && <Badge color="purple">All staff</Badge>}
          </div>
          <h3 className="text-white font-semibold text-base leading-snug">{meeting.title}</h3>
          {meeting.description && (
            <p className="text-slate-500 text-sm mt-1 line-clamp-2">{meeting.description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {format(new Date(meeting.scheduled_at), 'dd MMM yyyy, hh:mm a')}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {meeting.duration_minutes} min
        </span>
        {meeting.created_by && (
          <span className="flex items-center gap-1">
            <Users size={12} /> Organised by {meeting.created_by.name}
          </span>
        )}
      </div>

      {cancelled ? (
        <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">
          This meeting has been cancelled
        </span>
      ) : (
        <a
          href={meeting.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl transition-colors ${
            live
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : past
              ? 'bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
              : 'bg-brand-500 hover:bg-brand-600 text-white'
          }`}
        >
          <ExternalLink size={13} />
          {live ? 'Join Now' : past ? 'View Link' : 'Join Meeting'}
        </a>
      )}
    </div>
  )
}

export default function EmployeeMeetings() {
  const [meetings, setMeetings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/meetings')
      setMeetings(data.data ?? [])
    } catch { toast.error('Failed to load meetings') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const tabs = ['all', 'upcoming', 'ongoing', 'completed']
  const filtered = filter === 'all' ? meetings : meetings.filter(m => m.status === filter)

  const liveCount = meetings.filter(isLive).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Video size={22} className="text-brand-400" /> My Meetings
            {liveCount > 0 && (
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                {liveCount} live
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Meetings you've been invited to</p>
        </div>
        <button onClick={load} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface-50 border border-white/5 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === t ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Video size={40} className="mx-auto mb-3 opacity-30" />
          <p>{filter === 'all' ? "You haven't been invited to any meetings yet." : `No ${filter} meetings.`}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(m => (
            <MeetingCard key={m._id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  )
}
