/**
 * pages/admin/Attendance.jsx
 *
 * Changes in this version:
 *   ✅ Fixed: users.filter is not a function — Array.isArray() guard on fingerprint map response
 *   ✅ Added: Collapsible WFH Policy panel inside WfhRequestsTab
 *   ✅ Added: "Require Manager Approval" toggle that PATCHes /policy/wfh
 *   ✅ Added: Auto-refresh on the Attendance tab — silent poll every 30s + on tab focus,
 *            so new device clock-in/out punches appear without a manual reload.
 *
 * PLACE AT: Project-Management-Frontend/src/pages/admin/Attendance.jsx
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  RefreshCw, UserMinus, Pencil, Clock, CalendarOff,
  CheckCircle2, XCircle, AlertCircle, Fingerprint,
  Wifi, WifiOff, Link2, Users, Settings, Home,
  Shield, ToggleLeft, ToggleRight, Plus, Trash2,
  Calendar, BookOpen, Loader2, ChevronDown, ChevronUp,
  FileSpreadsheet, X, Upload, Download, Paperclip, FileText, ExternalLink,
  Send, Timer,
} from 'lucide-react'
import api, { fetchAllLeaves, updateLeaveStatus } from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, StatCard, SelectInput, Modal,
  FormField, StatusBadge, Spinner, EmptyState,
} from '../../components/common/UI'

import * as XLSX from 'xlsx'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES   = ['present', 'absent', 'late', 'on-leave', 'half-day', 'wfh']
const SOURCES    = ['fingerprint', 'wfh', 'manual']
const WORK_MODES = ['office', 'wfh', 'hybrid']

const LEAVE_TYPES = [
  { value: 'sick',      label: 'Sick Leave' },
  { value: 'casual',    label: 'Casual Leave' },
  { value: 'earned',    label: 'Earned Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'unpaid',    label: 'Unpaid Leave' },
]

const LEAVE_STATUS_CONFIG = {
  pending:  { color: 'text-amber-600 bg-amber-50 border-amber-200',       icon: AlertCircle  },
  approved: { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  rejected: { color: 'text-red-600 bg-red-50 border-red-200',             icon: XCircle      },
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Shared UI ────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-primary text-white shadow' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
    </button>
  )
}

function SourceBadge({ source }) {
  if (source === 'fingerprint') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 border border-violet-200 text-violet-600 font-medium">
        <Fingerprint size={9} /> Biometric
      </span>
    )
  }
  if (source === 'wfh') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-600 font-medium">
        <Home size={9} /> WFH
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500 font-medium">
      Manual
    </span>
  )
}

function WorkModeBadge({ mode }) {
  const cfg = {
    office: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    wfh:    'bg-blue-100 text-blue-700 border-blue-200',
    hybrid: 'bg-purple-100 text-purple-700 border-purple-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium ${cfg[mode] ?? cfg.office}`}>
      {mode === 'wfh' ? <Home size={9} /> : mode === 'hybrid' ? <Shield size={9} /> : null}
      {mode ?? 'office'}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAttendance() {
  const [activeTab,    setActiveTab]    = useState('attendance')
  const [pendingCount, setPendingCount] = useState(0)
  const [wfhCount,     setWfhCount]     = useState(0)

  const loadCounts = useCallback(() => {
    fetchAllLeaves({ status: 'pending' })
      .then(data => setPendingCount(data.filter(l => l.status === 'pending').length))
      .catch(() => {})

    api.get('/wfh/requests?status=pending')
      .then(r => setWfhCount(r.data.total ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => { loadCounts() }, [loadCounts])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Attendance" subtitle="Track attendance, manage WFH requests and attendance policy" />

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl w-fit flex-wrap border border-gray-200">
        <TabBtn active={activeTab === 'attendance'}  onClick={() => setActiveTab('attendance')}>
          <Clock size={14} /> Attendance
        </TabBtn>
        <TabBtn active={activeTab === 'fingerprint'} onClick={() => setActiveTab('fingerprint')}>
          <Fingerprint size={14} /> Fingerprint Setup
        </TabBtn>
        <TabBtn active={activeTab === 'wfh'}         onClick={() => setActiveTab('wfh')} badge={wfhCount}>
          <Home size={14} /> WFH Requests
        </TabBtn>
        <TabBtn active={activeTab === 'leaves'}      onClick={() => setActiveTab('leaves')} badge={pendingCount}>
          <CalendarOff size={14} /> Leave Requests
        </TabBtn>
        <TabBtn active={activeTab === 'policy'}      onClick={() => setActiveTab('policy')}>
          <Settings size={14} /> Policy Settings
        </TabBtn>
      </div>

      {activeTab === 'attendance'  && <AttendanceTab />}
      {activeTab === 'fingerprint' && <FingerprintSetupTab />}
      {activeTab === 'wfh'         && <WfhRequestsTab onCountChange={setWfhCount} />}
      {activeTab === 'leaves'      && <LeaveApprovalTab onCountChange={setPendingCount} />}
      {activeTab === 'policy'      && <PolicySettingsTab />}
    </div>
  )
}


function downloadHolidayTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Date',       'Holiday Name',    'Description'],
    ['2026-01-26', 'Republic Day',    'National holiday'],
    ['2026-08-15', 'Independence Day','National holiday'],
    ['2026-10-02', 'Gandhi Jayanti',  'National holiday'],
  ])
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 32 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Holidays')
  XLSX.writeFile(wb, 'holiday_import_template.xlsx')
  toast.success('Template downloaded!')
}

function ImportHolidaysModal({ onClose, onSuccess }) {
  const fileRef              = useRef()
  const [rows,    setRows]   = useState([])
  const [errors,  setErrors] = useState([])
  const [step,    setStep]   = useState('upload')
  const [importing, setImp]  = useState(false)
  const [fileName, setName]  = useState('')

  const parseAnyDate = (raw) => {
    if (!raw) return null
    if (typeof raw === 'number') {
      const d = XLSX.SSF.parse_date_code(raw)
      if (d) return new Date(d.y, d.m - 1, d.d)
    }
    const s = String(raw).trim()
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split('/'); return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`)
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split('-'); return new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`)
    }
    const dt = new Date(s)
    return isNaN(dt) ? null : dt
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb  = XLSX.read(ev.target.result, { type: 'array', cellDates: false })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        let headerIdx = 0
        for (let i = 0; i < Math.min(raw.length, 5); i++) {
          if (raw[i].some(c => String(c).toLowerCase().includes('date'))) { headerIdx = i; break }
        }
        const headers = raw[headerIdx].map(h => String(h).toLowerCase().trim())
        const dateCol = headers.findIndex(h => h.includes('date'))
        const nameCol = headers.findIndex(h => h.includes('name') || h.includes('holiday'))
        const descCol = headers.findIndex(h => h.includes('desc') || h.includes('note'))
        if (dateCol === -1 || nameCol === -1) { toast.error('Could not find Date and Name columns. Use the template.'); return }
        const parsed = [], errs = []
        raw.slice(headerIdx + 1).forEach((row, i) => {
          const rawDate = row[dateCol], rawName = String(row[nameCol] ?? '').trim()
          const rawDesc = descCol >= 0 ? String(row[descCol] ?? '').trim() : ''
          if (!rawDate && !rawName) return
          const dt = parseAnyDate(rawDate)
          if (!dt || isNaN(dt)) { errs.push(`Row ${headerIdx+i+2}: Invalid date "${rawDate}"`); return }
          if (!rawName)          { errs.push(`Row ${headerIdx+i+2}: Holiday name is empty`);     return }
          parsed.push({ date: format(dt,'yyyy-MM-dd'), displayDate: format(dt,'dd MMM yyyy'), day: format(dt,'EEEE'), name: rawName, description: rawDesc || null })
        })
        setRows(parsed); setErrors(errs); setStep('preview')
      } catch (err) { toast.error('Failed to parse file: ' + err.message) }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    setImp(true)
    let added = 0, skipped = 0
    for (const row of rows) {
      try {
        await api.post('/policy/holidays', { date: row.date, name: row.name, description: row.description })
        added++
      } catch (e) {
        if (e.response?.data?.message?.includes('already exists')) skipped++
      }
    }
    setImp(false); setStep('done')
    if (added > 0) { toast.success(`${added} holiday${added > 1 ? 's' : ''} imported!`); onSuccess() }
    if (skipped > 0) toast(`${skipped} already existed — skipped`, { icon: 'ℹ️' })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-emerald-600" /> Import Holidays from Excel / CSV
          </h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-blue-500" />
                <div>
                  <p className="font-semibold mb-1">Expected columns (order doesn't matter):</p>
                  <p><code className="bg-blue-100 px-1 rounded">Date</code> — YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, or Excel date</p>
                  <p><code className="bg-blue-100 px-1 rounded">Holiday Name</code> — required &nbsp;|&nbsp; <code className="bg-blue-100 px-1 rounded">Description</code> — optional</p>
                </div>
              </div>
              <div
                onDrop={e => { e.preventDefault(); handleFile({ target: { files: [e.dataTransfer.files[0]] } }) }}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <FileSpreadsheet size={36} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-semibold text-gray-600">Drop your file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  From <strong>{fileName}</strong>: <span className="text-emerald-600 font-bold">{rows.length}</span> valid
                  {errors.length > 0 && <span className="text-amber-600 ml-2">, {errors.length} errors</span>}
                </p>
                <button onClick={() => { setStep('upload'); setRows([]); setErrors([]) }}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <RefreshCw size={11} /> Re-upload
                </button>
              </div>
              {errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  {errors.map((e, i) => <p key={i} className="text-xs text-amber-600 font-mono">{e}</p>)}
                </div>
              )}
              {rows.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>
                      {['Date','Day','Holiday Name','Description'].map(h =>
                        <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-2.5">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{r.displayDate}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{r.day}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{r.name}</td>
                          <td className="px-4 py-2.5 text-gray-400">{r.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-gray-800">Import Complete</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100 shrink-0">
          <button className="btn-secondary" onClick={onClose}>{step === 'done' ? 'Close' : 'Cancel'}</button>
          {step === 'preview' && rows.length > 0 && (
            <button className="btn-primary flex items-center gap-2" onClick={handleImport} disabled={importing}>
              {importing ? <Spinner size="sm" /> : <Upload size={14} />}
              Import {rows.length} Holiday{rows.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab() {
  const [records,      setRecords]      = useState([])
  const [users,        setUsers]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [syncing,      setSyncing]      = useState(false)
  const [dateF,        setDateF]        = useState(format(new Date(), 'yyyy-MM-dd'))
  const [statusF,      setStatusF]      = useState('')
  const [sourceF,      setSourceF]      = useState('')
  const [workModeF,    setWorkModeF]    = useState('')
  const [editModal,    setEditModal]    = useState(null)
  const [absentModal,  setAbsentModal]  = useState(false)
  const [syncModal,    setSyncModal]    = useState(false)
  const [workModeModal,setWorkModeModal]= useState(null)
  const [absentIds,    setAbsentIds]    = useState([])
  const [form,         setForm]         = useState({ status: '', clock_in: '', clock_out: '' })
  const [syncForm,     setSyncForm]     = useState({ ip: '', port: '4370' })
  const [wmForm,       setWmForm]       = useState({ work_mode: 'office', attendance_override: false })
  const [saving,       setSaving]       = useState(false)
  const [pinging,      setPinging]      = useState(false)
  const [pingStatus,   setPingStatus]   = useState(null)   // { reachable, message }
  const [lastSynced,   setLastSynced]   = useState(null)   // timestamp of last successful auto-refresh
  const [tgBusy,       setTgBusy]       = useState(null)   // 'test' | 'digest' | null

  // Overtime display config — mirrors the backend defaults
  // (STANDARD_WORK_HOURS / STANDARD_BREAK_MINUTES / OVERTIME_MIN_MINUTES).
  // Keep these in sync if you change those env vars.
  const STD_HOURS      = 8
  const STD_BREAK_MIN  = 60
  const OT_MIN_MINUTES = 15

  // Extra minutes worked beyond the standard day for one record (0 if none).
  const overtimeMinutes = (r) => {
    if (!r.clock_in || !r.clock_out) return 0
    const grossMin = (new Date(r.clock_out) - new Date(r.clock_in)) / 60000
    const appBreak = r.break_minutes ?? 0
    const breakMin = appBreak > 0 ? appBreak : STD_BREAK_MIN
    const netMin   = Math.max(0, grossMin - breakMin)
    const dailyMin = (r.user_id?.dailyWorkingHours || STD_HOURS) * 60
    const extra    = Math.round(netMin - dailyMin)
    return extra >= OT_MIN_MINUTES ? extra : 0
  }

  // Pre-fill device IP from backend .env (DEVICE_IP) so admin doesn't retype it every time
  useEffect(() => {
    api.get('/essl/device-config')
      .then(r => {
        if (r.data?.data?.ip) {
          setSyncForm({ ip: r.data.data.ip, port: String(r.data.data.port || 4370) })
        }
      })
      .catch(() => {}) // silent — field stays blank if endpoint unreachable
  }, [])

  // load(quiet): when quiet=true (background poll) we don't flash the spinner
  // or show an error toast — the table just updates silently in place.
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const params = {}
      if (dateF)     params.date      = dateF
      if (statusF)   params.status    = statusF
      if (sourceF)   params.source    = sourceF
      if (workModeF) params.work_mode = workModeF
      const [r, u] = await Promise.all([
        api.get('/attendance', { params }),
        api.get('/users', { params: { status: 'active' } }),
      ])
      setRecords(r.data.data ?? [])
      setUsers((u.data.data ?? []).filter(u => ['employee', 'manager'].includes(u.role)))
      setLastSynced(new Date())
    } catch {
      if (!quiet) toast.error('Failed to load attendance')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [dateF, statusF, sourceF, workModeF])

  useEffect(() => { load() }, [load])

  // ── Auto-refresh ────────────────────────────────────────────────────────────
  // Silently re-fetch every 30s so new device clock-in/out punches appear without
  // a manual reload. Also refreshes the moment the browser tab regains focus.
  useEffect(() => {
    const interval = setInterval(() => { load(true) }, 30000) // 30 seconds
    const onFocus  = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const openEdit = (rec) => {
    setForm({
      status:    rec.status ?? '',
      clock_in:  rec.clock_in  ? format(new Date(rec.clock_in),  'HH:mm') : '',
      clock_out: rec.clock_out ? format(new Date(rec.clock_out), 'HH:mm') : '',
    })
    setEditModal(rec)
  }

  const openWorkMode = (rec) => {
    setWmForm({
      work_mode:           rec.user_id?.work_mode           ?? 'office',
      attendance_override: rec.user_id?.attendance_override ?? false,
    })
    setWorkModeModal(rec)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch(`/attendance/${editModal._id}`, form)
      toast.success('Record updated')
      setEditModal(null)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  const handleSetWorkMode = async () => {
    setSaving(true)
    try {
      await api.patch(`/attendance/work-mode/${workModeModal.user_id?._id}`, wmForm)
      toast.success(`Work mode updated for ${workModeModal.user_id?.name}`)
      setWorkModeModal(null)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  const handleMarkAbsent = async () => {
    if (!absentIds.length) { toast.error('Select at least one user'); return }
    setSaving(true)
    try {
      await api.post('/attendance/mark-absent', { user_ids: absentIds, date: dateF })
      toast.success(`Marked ${absentIds.length} absent`)
      setAbsentModal(false); setAbsentIds([])
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setSaving(false) }
  }

  const handlePingDevice = async () => {
    if (!syncForm.ip) { toast.error('Enter device IP address first'); return }
    setPinging(true)
    setPingStatus(null)
    try {
      const res = await api.post('/essl/ping', { ip: syncForm.ip, port: Number(syncForm.port) || 4370 })
      setPingStatus({ reachable: res.data.reachable, message: res.data.message })
    } catch (e) {
      setPingStatus({ reachable: false, message: e.response?.data?.message || 'Test failed — check backend is running' })
    } finally {
      setPinging(false)
    }
  }

  const handleTcpSync = async () => {
    if (!syncForm.ip) { toast.error('Enter device IP address'); return }
    setSyncing(true)
    try {
      const res = await api.post('/essl/sync', { ip: syncForm.ip, port: Number(syncForm.port) || 4370 })

      // Device-unreachable errors come back as 200 { success: false, message: "..." }
      // so axios stays in the happy path and no red console error is logged.
      if (!res.data.success) {
        toast.error(res.data.message || 'Sync failed', { duration: 10000 })
        return
      }

      const { saved = 0, skipped = 0, total_logs = 0, wfh_override_skipped = 0, unmatched_fp_ids = [] } = res.data

      if (total_logs === 0) {
        toast('No attendance logs found on device.', { icon: 'ℹ️' })
      } else {
        toast.success(`Sync done — ${saved} saved, ${skipped} skipped, ${wfh_override_skipped} WFH-skipped`)
      }

      if (unmatched_fp_ids.length > 0) {
        toast(`⚠️ ${unmatched_fp_ids.length} fingerprint ID(s) not mapped to any employee: [${unmatched_fp_ids.join(', ')}]. Go to Fingerprint Setup tab.`,
          { duration: 8000, icon: '⚠️' })
      }

      setSyncModal(false); load()
    } catch (e) {
      // Genuine network failure (backend itself is down / CORS / etc.)
      const msg = e.response?.data?.message || e.message || 'Sync failed'
      toast.error(msg, { duration: 10000 })
    }
    finally { setSyncing(false) }
  }

  // ── Telegram ──────────────────────────────────────────────────────────────
  const handleTelegramTest = async () => {
    setTgBusy('test')
    try {
      const res = await api.post('/attendance/telegram/test')
      toast.success(res.data.message || 'Test message sent to Telegram')
    } catch (e) {
      toast.error(e.response?.data?.message || 'Telegram test failed', { duration: 8000 })
    } finally {
      setTgBusy(null)
    }
  }

  const handleTelegramDigest = async () => {
    setTgBusy('digest')
    try {
      const res = await api.post('/attendance/telegram/digest', null, { params: { date: dateF } })
      const c = res.data.counts || {}
      toast.success(`Digest sent — ${c.present ?? 0} present · ${c.late ?? 0} late · ${c.overtime ?? 0} OT`)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send digest', { duration: 8000 })
    } finally {
      setTgBusy(null)
    }
  }

  const present = records.filter(r => ['present', 'wfh'].includes(r.status)).length
  const absent  = records.filter(r => r.status === 'absent').length
  const late    = records.filter(r => r.status === 'late').length
  const fromFp  = records.filter(r => r.source === 'fingerprint').length
  const fromWfh = records.filter(r => r.source === 'wfh').length
  const otCount = records.filter(r => overtimeMinutes(r) > 0).length

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Present"    value={present} icon={CheckCircle2}  color="emerald" />
        <StatCard label="Absent"     value={absent}  icon={XCircle}       color="red"     />
        <StatCard label="Late"       value={late}    icon={Clock}         color="amber"   />
        <StatCard label="Overtime"   value={otCount} icon={Timer}         color="orange"  />
        <StatCard label="Biometric"  value={fromFp}  icon={Fingerprint}   color="purple"  />
        <StatCard label="WFH"        value={fromWfh} icon={Home}          color="blue"    />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <input type="date" value={dateF} onChange={e => setDateF(e.target.value)} className="input w-44" />

          <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
            options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />

          <SelectInput value={sourceF} onChange={setSourceF} placeholder="All sources"
            options={SOURCES.map(s => ({ value: s, label: s === 'fingerprint' ? 'Biometric' : s === 'wfh' ? 'WFH' : 'Manual' }))}
            className="w-36" />

          <SelectInput value={workModeF} onChange={setWorkModeF} placeholder="All modes"
            options={WORK_MODES.map(m => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))}
            className="w-36" />

          <button onClick={() => load()} className="btn-secondary px-3" title="Refresh now"><RefreshCw size={15} /></button>

          {/* Live auto-refresh indicator */}
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
            {lastSynced && (
              <span className="text-gray-300">· updated {format(lastSynced, 'HH:mm:ss')}</span>
            )}
          </span>
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={handleTelegramTest} disabled={tgBusy !== null}
            title="Send a test message to the configured Telegram chat">
            {tgBusy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Test Telegram
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={handleTelegramDigest} disabled={tgBusy !== null}
            title="Send the attendance digest for the selected date to Telegram now">
            {tgBusy === 'digest' ? <Loader2 size={15} className="animate-spin" /> : <Timer size={15} />} Send Digest
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={() => setSyncModal(true)}>
            <Wifi size={15} /> Sync Device
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={() => setAbsentModal(true)}>
            <UserMinus size={16} /> Mark Absent
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Department', 'Status', 'Work Mode', 'Clock In', 'Clock Out', 'Break', 'Hours', 'OT', 'Source', 'Actions']
                  .map(h => <th key={h} className="table-header text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? <tr><td colSpan={11} className="py-16 text-center"><Spinner /></td></tr>
                : records.length === 0
                  ? <tr><td colSpan={11}><EmptyState icon={Clock} title="No records found" description="Try a different date or filter" /></td></tr>
                  : records.map(r => {
                    const breakMin = r.break_minutes ?? 0
                    const grossH   = r.clock_in && r.clock_out ? (new Date(r.clock_out) - new Date(r.clock_in)) / 3600000 : null
                    const hrs      = grossH != null ? Math.max(0, grossH - breakMin / 60).toFixed(1) : null
                    const fmtMin   = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
                    const otMin    = overtimeMinutes(r)
                    return (
                      <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                        <td className="table-cell px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                              {(r.user_id?.name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{r.user_id?.name ?? '—'}</p>
                              {r.user_id?.attendance_override && (
                                <span className="text-[9px] text-blue-500 font-medium">WFH Override</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="table-cell px-4 py-3 text-sm text-gray-500">{r.user_id?.department ?? '—'}</td>
                        <td className="table-cell px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="table-cell px-4 py-3"><WorkModeBadge mode={r.work_mode ?? r.user_id?.work_mode} /></td>
                        <td className="table-cell px-4 py-3 text-gray-500 font-mono text-sm">
                          {r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}
                          {r.late_by_minutes > 0 && (
                            <span className="ml-1 text-[9px] text-amber-500">+{r.late_by_minutes}m</span>
                          )}
                        </td>
                        <td className="table-cell px-4 py-3 text-gray-500 font-mono text-sm">
                          {r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}
                        </td>
                        <td className="table-cell px-4 py-3 text-sm text-orange-500">{breakMin > 0 ? fmtMin(breakMin) : '—'}</td>
                        <td className="table-cell px-4 py-3 text-sm text-gray-500">{hrs ? `${hrs}h` : '—'}</td>
                        <td className="table-cell px-4 py-3">
                          {otMin > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold px-2 py-0.5"
                              title={`Worked ${fmtMin(otMin)} beyond the standard day`}>
                              <Timer size={11} /> +{fmtMin(otMin)}
                            </span>
                          ) : <span className="text-sm text-gray-400">—</span>}
                        </td>
                        <td className="table-cell px-4 py-3"><SourceBadge source={r.source} /></td>
                        <td className="table-cell px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(r)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                              title="Edit record">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => openWorkMode(r)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Set work mode">
                              <Home size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Attendance Record"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditModal(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Status">
            <SelectInput value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
              options={STATUSES.map(s => ({ value: s, label: s }))} />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Clock In (HH:mm)">
              <input className="input" type="time" value={form.clock_in}
                onChange={e => setForm(f => ({ ...f, clock_in: e.target.value }))} />
            </FormField>
            <FormField label="Clock Out (HH:mm)">
              <input className="input" type="time" value={form.clock_out}
                onChange={e => setForm(f => ({ ...f, clock_out: e.target.value }))} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Work Mode Modal */}
      <Modal open={!!workModeModal} onClose={() => setWorkModeModal(null)} title="Set Work Mode"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setWorkModeModal(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSetWorkMode} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Apply'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
              {workModeModal?.user_id?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{workModeModal?.user_id?.name}</p>
              <p className="text-xs text-gray-400">{workModeModal?.user_id?.department}</p>
            </div>
          </div>

          <FormField label="Work Mode">
            <div className="flex gap-2">
              {WORK_MODES.map(m => (
                <button key={m}
                  onClick={() => setWmForm(f => ({ ...f, work_mode: m }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                    wmForm.work_mode === m
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </FormField>

          {wmForm.work_mode === 'wfh' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800">Biometric Override</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    When ON — ignores eSSL biometric completely. Employee uses WFH clock-in instead.
                  </p>
                </div>
                <button onClick={() => setWmForm(f => ({ ...f, attendance_override: !f.attendance_override }))}>
                  {wmForm.attendance_override
                    ? <ToggleRight size={28} className="text-blue-600" />
                    : <ToggleLeft  size={28} className="text-gray-400" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* TCP Sync Modal */}
      <Modal open={syncModal} onClose={() => { setSyncModal(false); setPingStatus(null) }} title="Sync from Fingerprint Device"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setSyncModal(false); setPingStatus(null) }} disabled={syncing}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleTcpSync} disabled={syncing || pingStatus?.reachable === false}>
              {syncing ? <Spinner size="sm" /> : <Wifi size={14} />}
              {syncing ? 'Syncing...' : 'Start Sync'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <Wifi size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700">
              Connects to your eSSL device over the local network.
              <strong> WFH-override employees are automatically skipped</strong> — only office attendance is synced.
            </p>
          </div>
          <FormField label="Device IP Address">
            <input className="input font-mono" placeholder="e.g. 192.168.0.170"
              value={syncForm.ip} onChange={e => { setSyncForm(f => ({ ...f, ip: e.target.value })); setPingStatus(null) }} />
          </FormField>
          <FormField label="Port (default: 4370)">
            <input className="input font-mono" placeholder="4370"
              value={syncForm.port} onChange={e => { setSyncForm(f => ({ ...f, port: e.target.value })); setPingStatus(null) }} />
          </FormField>

          {/* Test Connection button + result */}
          <div className="flex items-center gap-3">
            <button
              className="btn-secondary flex items-center gap-2 text-sm"
              onClick={handlePingDevice}
              disabled={pinging || syncing}
            >
              {pinging ? <Spinner size="sm" /> : <Wifi size={13} />}
              {pinging ? 'Testing...' : 'Test Connection'}
            </button>
            {pingStatus && (
              <span className={`text-sm font-medium flex items-center gap-1 ${pingStatus.reachable ? 'text-emerald-600' : 'text-red-600'}`}>
                {pingStatus.reachable ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {pingStatus.message}
              </span>
            )}
          </div>

          {/* Error detail box */}
          {pingStatus && !pingStatus.reachable && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
              <p className="font-semibold">Why this happens:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Your backend server and the device must be on the <strong>same local network (LAN)</strong></li>
                <li>If backend runs on Render/cloud, it cannot reach <code>192.168.x.x</code> (local IPs)</li>
                <li>Run your backend locally: <code>npm run dev</code> on the same WiFi/LAN as the device</li>
                <li>Check device is powered on and TCP/IP is enabled (Port 4370)</li>
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {/* Mark Absent Modal */}
      <Modal open={absentModal} onClose={() => { setAbsentModal(false); setAbsentIds([]) }} title="Mark Users Absent"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setAbsentModal(false); setAbsentIds([]) }} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleMarkAbsent} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Mark Absent'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select users to mark absent for <strong>{dateF}</strong>:</p>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
            {users.map(u => (
              <label key={u._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={absentIds.includes(u._id)}
                  onChange={e => setAbsentIds(ids => e.target.checked ? [...ids, u._id] : ids.filter(id => id !== u._id))}
                  className="w-4 h-4 accent-primary" />
                <span className="text-sm text-gray-700 flex-1">{u.name}</span>
                <WorkModeBadge mode={u.work_mode} />
                <span className="text-[10px] text-gray-400">{u.department}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">{absentIds.length} user(s) selected</p>
        </div>
      </Modal>
    </>
  )
}

// ─── WFH Requests Tab ─────────────────────────────────────────────────────────

function WfhRequestsTab({ onCountChange }) {
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [statusF,  setStatusF]  = useState('pending')
  const [modal,    setModal]    = useState(null)   // { request, action }
  const [saving,   setSaving]   = useState(false)
  const [note,     setNote]     = useState('')
  const [overrideModal, setOverrideModal] = useState(null)
  const [overrideForm,  setOverrideForm]  = useState({ work_mode: 'wfh', attendance_override: false })

  // ── WFH Policy collapsible panel ──────────────────────────────────────────
  const [policyOpen,    setPolicyOpen]    = useState(false)
  const [wfhPolicy,     setWfhPolicy]     = useState(null)   // null = not fetched yet
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policySaving,  setPolicySaving]  = useState(false)

  const loadWfhPolicy = useCallback(async () => {
    setPolicyLoading(true)
    try {
      const res = await api.get('/policy/wfh')
      setWfhPolicy(res.data.data ?? res.data ?? {})
    } catch {
      // Endpoint may not exist yet — use a safe default so UI still renders
      setWfhPolicy({ require_manager_approval: true })
    } finally { setPolicyLoading(false) }
  }, [])

  // Lazy-load policy only the first time the panel is opened
  useEffect(() => {
    if (policyOpen && wfhPolicy === null) loadWfhPolicy()
  }, [policyOpen, wfhPolicy, loadWfhPolicy])

  const handlePolicyToggle = async (key, value) => {
    const prev    = wfhPolicy
    const updated = { ...(wfhPolicy ?? {}), [key]: value }
    setWfhPolicy(updated)          // optimistic
    setPolicySaving(true)
    try {
      await api.patch('/policy/wfh', { [key]: value })
      toast.success('WFH policy updated')
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save policy')
      setWfhPolicy(prev)           // revert on error
    } finally { setPolicySaving(false) }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      const res = await api.get('/wfh/requests', { params })
      const data = res.data.data ?? []
      setRequests(data)
      onCountChange(data.filter(r => r.status === 'pending').length)
    } catch { toast.error('Failed to load WFH requests') }
    finally { setLoading(false) }
  }, [statusF, onCountChange])

  useEffect(() => { load() }, [load])

  const handleAction = async () => {
    setSaving(true)
    try {
      await api.patch(`/wfh/request/${modal.request._id}/status`, {
        status:     modal.action,
        admin_note: note,
      })
      toast.success(`WFH request ${modal.action}d`)
      setModal(null); setNote('')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const handleSetOverride = async () => {
    setSaving(true)
    try {
      await api.patch(`/wfh/override/${overrideModal.user_id?._id}`, overrideForm)
      toast.success('Work mode override updated')
      setOverrideModal(null); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const pending  = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved').length

  return (
    <>
      {/* ── WFH Policy Panel ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setPolicyOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Settings size={15} className="text-gray-400" />
            WFH Policy
          </span>
          {policyOpen
            ? <ChevronUp   size={15} className="text-gray-400" />
            : <ChevronDown size={15} className="text-gray-400" />}
        </button>

        {policyOpen && (
          <div className="p-5 border-t border-gray-100 bg-white">
            {policyLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Require Manager Approval
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    When <strong>ON</strong> — every WFH request must be approved before it takes effect.
                    When <strong>OFF</strong> — requests are auto-approved on submission.
                  </p>
                </div>
                <button
                  onClick={() =>
                    handlePolicyToggle(
                      'require_manager_approval',
                      !wfhPolicy?.require_manager_approval
                    )
                  }
                  disabled={policySaving}
                  className="ml-6 shrink-0 disabled:opacity-50"
                >
                  {wfhPolicy?.require_manager_approval
                    ? <ToggleRight size={28} className="text-primary" />
                    : <ToggleLeft  size={28} className="text-gray-300" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {/* ─────────────────────────────────────────────────────────────────── */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Pending"  value={pending}  icon={AlertCircle}  color="amber"   />
        <StatCard label="Approved" value={approved} icon={CheckCircle2} color="emerald" />
        <StatCard label="Total"    value={requests.length} icon={Home}  color="blue"    />
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={['pending', 'approved', 'rejected'].map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
          className="w-40" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Department', 'Work Mode', 'From', 'To', 'Reason', 'Status', 'Actions']
                  .map(h => <th key={h} className="table-header px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? <tr><td colSpan={8} className="py-16 text-center"><Spinner /></td></tr>
                : requests.length === 0
                  ? <tr><td colSpan={8}><EmptyState icon={Home} title="No WFH requests" description="No requests match the filter" /></td></tr>
                  : requests.map(r => {
                    const cfg  = LEAVE_STATUS_CONFIG[r.status] ?? LEAVE_STATUS_CONFIG.pending
                    const Icon = cfg.icon
                    return (
                      <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                        <td className="table-cell px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                              {(r.user_id?.name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{r.user_id?.name ?? '—'}</p>
                              {r.user_id?.attendance_override && (
                                <span className="text-[9px] text-blue-500 font-medium">Override Active</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="table-cell px-4 py-3 text-sm text-gray-500">{r.user_id?.department ?? '—'}</td>
                        <td className="table-cell px-4 py-3"><WorkModeBadge mode={r.user_id?.work_mode} /></td>
                        <td className="table-cell px-4 py-3 text-sm font-mono text-gray-500">
                          {r.from_date ? format(new Date(r.from_date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="table-cell px-4 py-3 text-sm font-mono text-gray-500">
                          {r.to_date ? format(new Date(r.to_date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="table-cell px-4 py-3 text-sm text-gray-500 max-w-[180px] truncate">{r.reason}</td>
                        <td className="table-cell px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium ${cfg.color}`}>
                            <Icon size={10} /> {r.status}
                          </span>
                        </td>
                        <td className="table-cell px-4 py-3">
                          <div className="flex items-center gap-1">
                            {r.status === 'pending' && (
                              <>
                                <button onClick={() => { setModal({ request: r, action: 'approved' }); setNote('') }}
                                  className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors" title="Approve">
                                  <CheckCircle2 size={14} />
                                </button>
                                <button onClick={() => { setModal({ request: r, action: 'rejected' }); setNote('') }}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Reject">
                                  <XCircle size={14} />
                                </button>
                              </>
                            )}
                            <button onClick={() => {
                              setOverrideModal(r)
                              setOverrideForm({ work_mode: r.user_id?.work_mode ?? 'wfh', attendance_override: r.user_id?.attendance_override ?? false })
                            }}
                              className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 transition-colors" title="Set override">
                              <Shield size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve / Reject modal */}
      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal?.action === 'approved' ? 'Approve WFH Request' : 'Reject WFH Request'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</button>
            <button
              className={modal?.action === 'approved' ? 'btn-primary' : 'px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600'}
              onClick={handleAction} disabled={saving}>
              {saving ? <Spinner size="sm" /> : (modal?.action === 'approved' ? 'Approve' : 'Reject')}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {modal?.action === 'approved' ? 'Approving' : 'Rejecting'} WFH request for{' '}
            <strong className="text-gray-800">{modal?.request?.user_id?.name}</strong>{' '}
            ({modal?.request?.from_date ? format(new Date(modal.request.from_date), 'dd MMM') : ''}
            {' → '}
            {modal?.request?.to_date ? format(new Date(modal.request.to_date), 'dd MMM yyyy') : ''})
          </p>
          <FormField label="Admin Note (optional)">
            <textarea className="input resize-none" rows={2} value={note}
              onChange={e => setNote(e.target.value)} placeholder="Reason or instructions..." />
          </FormField>
        </div>
      </Modal>

      {/* Override modal */}
      <Modal open={!!overrideModal} onClose={() => setOverrideModal(null)} title="Set Work Mode Override"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOverrideModal(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSetOverride} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Save Override'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Work Mode">
            <div className="flex gap-2">
              {WORK_MODES.map(m => (
                <button key={m} onClick={() => setOverrideForm(f => ({ ...f, work_mode: m }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                    overrideForm.work_mode === m ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                  }`}>{m}</button>
              ))}
            </div>
          </FormField>
          <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-blue-800">Biometric Override</p>
              <p className="text-xs text-blue-600 mt-0.5">Ignore eSSL — use WFH clock-in only</p>
            </div>
            <button onClick={() => setOverrideForm(f => ({ ...f, attendance_override: !f.attendance_override }))}>
              {overrideForm.attendance_override
                ? <ToggleRight size={28} className="text-blue-600" />
                : <ToggleLeft  size={28} className="text-gray-400" />}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Policy Settings Tab ──────────────────────────────────────────────────────

function PolicySettingsTab() {
  const [policy,      setPolicy]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [section,     setSection]     = useState('hours')
  const [newHoliday,  setNewHoliday]  = useState({ date: '', name: '', is_optional: false })
  const [addingHol,   setAddingHol]   = useState(false)
  const [importModal, setImportModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/policy')
      setPolicy(res.data.data)
    } catch { toast.error('Failed to load policy') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const pd = (k, v) => setPolicy(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (policy?._id) {
        await api.patch(`/policy/${policy._id}`, policy)
      } else {
        await api.post('/policy', { ...policy, is_active: true })
      }
      toast.success('Policy saved!')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) { toast.error('Date and name required'); return }
    setAddingHol(true)
    try {
      await api.post('/policy/holidays', newHoliday)
      toast.success('Holiday added')
      setNewHoliday({ date: '', name: '', is_optional: false })
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setAddingHol(false) }
  }

  const handleRemoveHoliday = async (date) => {
    try {
      await api.delete(`/policy/holidays/${date}`)
      toast.success('Holiday removed')
      load()
    } catch { toast.error('Failed to remove holiday') }
  }

  const updateLeaveType = (index, key, value) => {
    const updated = [...(policy?.leave_types ?? [])]
    updated[index] = { ...updated[index], [key]: value }
    pd('leave_types', updated)
  }

  const SECTIONS = [
    { id: 'hours',    label: 'Working Hours',  icon: Clock },
    { id: 'leaves',   label: 'Leave Rules',    icon: CalendarOff },
    { id: 'compoff',  label: 'Comp-Off',       icon: CheckCircle2 },
    { id: 'holidays', label: 'Holidays',       icon: Calendar },
  ]

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
        <BookOpen size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Attendance Policy Settings</p>
          <p className="text-sm text-blue-600 mt-0.5">
            These settings drive late calculation, comp-off generation, and carry-forward logic system-wide.
            {!policy && ' No policy configured yet — defaults are used. Save to create one.'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {SECTIONS.map(s => {
          const Icon = s.icon
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                section === s.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={14} /> {s.label}
            </button>
          )
        })}
      </div>

      <div className="card space-y-6">

        {/* Working Hours */}
        {section === 'hours' && (
          <div className="space-y-5">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Clock size={16} /> Working Hours Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Work Start Time">
                <input className="input" type="time" value={policy?.work_start_time ?? '09:00'}
                  onChange={e => pd('work_start_time', e.target.value)} />
              </FormField>
              <FormField label="Work End Time">
                <input className="input" type="time" value={policy?.work_end_time ?? '18:00'}
                  onChange={e => pd('work_end_time', e.target.value)} />
              </FormField>
              <FormField label="Late Threshold (minutes after start)">
                <input className="input" type="number" min={0} max={120} value={policy?.late_threshold_minutes ?? 15}
                  onChange={e => pd('late_threshold_minutes', Number(e.target.value))} />
              </FormField>
              <FormField label="Half-Day Threshold (hours)">
                <input className="input" type="number" min={1} max={8} value={policy?.half_day_hours ?? 4}
                  onChange={e => pd('half_day_hours', Number(e.target.value))} />
              </FormField>
              <FormField label="Full Day Hours">
                <input className="input" type="number" min={4} max={12} value={policy?.full_day_hours ?? 8}
                  onChange={e => pd('full_day_hours', Number(e.target.value))} />
              </FormField>
            </div>

            <FormField label="Weekly Off Days">
              <div className="flex gap-2 flex-wrap mt-1">
                {DAYS_OF_WEEK.map((day, idx) => (
                  <button key={idx}
                    onClick={() => {
                      const current = policy?.weekly_offs ?? [0, 6]
                      pd('weekly_offs', current.includes(idx) ? current.filter(d => d !== idx) : [...current, idx])
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      (policy?.weekly_offs ?? [0, 6]).includes(idx)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                    }`}>{day}</button>
                ))}
              </div>
            </FormField>
          </div>
        )}

        {/* Leave Rules */}
        {section === 'leaves' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><CalendarOff size={16} /> Leave Type Configuration</h3>
            <p className="text-sm text-gray-500">Configure allowed days, carry-forward rules, and paid/unpaid for each leave type.</p>
            <div className="space-y-3">
              {(policy?.leave_types ?? []).map((lt, idx) => (
                <div key={lt.type} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-800">{lt.label}</p>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-gray-500">
                        <input type="checkbox" checked={lt.is_paid}
                          onChange={e => updateLeaveType(idx, 'is_paid', e.target.checked)}
                          className="accent-primary" />
                        Paid
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500">
                        <input type="checkbox" checked={lt.carry_forward}
                          onChange={e => updateLeaveType(idx, 'carry_forward', e.target.checked)}
                          className="accent-primary" />
                        Carry Forward
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Per Month</label>
                      <input className="input text-sm" type="number" min={0}
                        value={lt.allowed_per_month} onChange={e => updateLeaveType(idx, 'allowed_per_month', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Per Year</label>
                      <input className="input text-sm" type="number" min={0}
                        value={lt.allowed_per_year} onChange={e => updateLeaveType(idx, 'allowed_per_year', Number(e.target.value))} />
                    </div>
                    {lt.carry_forward && (
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Max Carry Days</label>
                        <input className="input text-sm" type="number" min={0}
                          value={lt.carry_forward_max} onChange={e => updateLeaveType(idx, 'carry_forward_max', Number(e.target.value))} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comp-Off */}
        {section === 'compoff' && (
          <div className="space-y-5">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><CheckCircle2 size={16} /> Comp-Off Rules</h3>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Enable Comp-Off</p>
                <p className="text-xs text-gray-400 mt-0.5">Allow employees to earn comp-offs for working on holidays/weekends</p>
              </div>
              <button onClick={() => pd('comp_off_enabled', !policy?.comp_off_enabled)}>
                {policy?.comp_off_enabled
                  ? <ToggleRight size={28} className="text-primary" />
                  : <ToggleLeft  size={28} className="text-gray-300" />}
              </button>
            </div>

            {policy?.comp_off_enabled && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                    <p className="text-sm text-gray-700">On Holidays</p>
                    <button onClick={() => pd('comp_off_on_holiday', !policy?.comp_off_on_holiday)}>
                      {policy?.comp_off_on_holiday
                        ? <ToggleRight size={24} className="text-primary" />
                        : <ToggleLeft  size={24} className="text-gray-300" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                    <p className="text-sm text-gray-700">On Weekends</p>
                    <button onClick={() => pd('comp_off_on_weekend', !policy?.comp_off_on_weekend)}>
                      {policy?.comp_off_on_weekend
                        ? <ToggleRight size={24} className="text-primary" />
                        : <ToggleLeft  size={24} className="text-gray-300" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Min Hours to Earn Comp-Off">
                    <input className="input" type="number" min={1} max={12}
                      value={policy?.min_hours_for_comp_off ?? 8}
                      onChange={e => pd('min_hours_for_comp_off', Number(e.target.value))} />
                  </FormField>
                  <FormField label="Comp-Off Expiry (days)">
                    <input className="input" type="number" min={30} max={365}
                      value={policy?.comp_off_expiry_days ?? 90}
                      onChange={e => pd('comp_off_expiry_days', Number(e.target.value))} />
                  </FormField>
                </div>
              </>
            )}
          </div>
        )}

        {/* Holidays Calendar */}
        {section === 'holidays' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Calendar size={16} /> Holiday Calendar — {policy?.year ?? new Date().getFullYear()}</h3>

            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase">Add Holiday</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors"
                  >
                    <FileSpreadsheet size={12} /> Import Excel / CSV
                  </button>
                  <button
                    onClick={downloadHolidayTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium transition-colors"
                  >
                    <Download size={12} /> Template
                  </button>
                </div>
              </div>
              <div className="flex gap-3 items-end flex-wrap">
                <FormField label="Date" className="flex-shrink-0">
                  <input className="input w-44" type="date" value={newHoliday.date}
                    onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))} />
                </FormField>
                <FormField label="Name" className="flex-1 min-w-[160px]">
                  <input className="input" placeholder="e.g. Diwali, Christmas..." value={newHoliday.name}
                    onChange={e => setNewHoliday(h => ({ ...h, name: e.target.value }))} />
                </FormField>
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-1 cursor-pointer">
                  <input type="checkbox" checked={newHoliday.is_optional}
                    onChange={e => setNewHoliday(h => ({ ...h, is_optional: e.target.checked }))}
                    className="accent-primary" />
                  Optional
                </label>
                <button onClick={handleAddHoliday} disabled={addingHol}
                  className="btn-primary flex items-center gap-2 mb-1">
                  {addingHol ? <Spinner size="sm" /> : <Plus size={14} />} Add
                </button>
              </div>
            </div>

            {(policy?.holidays ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No holidays added yet.</p>
            ) : (
              <div className="space-y-2">
                {(policy?.holidays ?? [])
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((h, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {format(new Date(h.date), 'dd')}
                          <br />
                          <span className="text-[8px]">{format(new Date(h.date), 'MMM')}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{h.name}</p>
                          <p className="text-xs text-gray-400">{format(new Date(h.date), 'EEEE, dd MMM yyyy')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.is_optional && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">Optional</span>
                        )}
                        <button onClick={() => handleRemoveHoliday(h.date)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {importModal && (
          <ImportHolidaysModal
            onClose={() => setImportModal(false)}
            onSuccess={() => { setImportModal(false); load() }}
          />
        )}

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 px-6">
            {saving ? <Spinner size="sm" /> : <CheckCircle2 size={15} />}
            Save Policy
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fingerprint Setup Tab ────────────────────────────────────────────────────

function FingerprintSetupTab() {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editUser, setEditUser] = useState(null)
  const [fpInput,  setFpInput]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res     = await api.get('/essl/fingerprint-map')
      // ✅ FIX: guard against non-array API responses
      const payload = res.data.data ?? res.data ?? []
      setUsers(Array.isArray(payload) ? payload : [])
    } catch { toast.error('Failed to load fingerprint map') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (user) => { setEditUser(user); setFpInput(user.fingerprint_id ?? '') }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/essl/assign-fingerprint', { user_id: editUser._id, fingerprint_id: fpInput.trim() })
      toast.success(`Fingerprint ID "${fpInput.trim()}" assigned to ${editUser.name}`)
      setEditUser(null); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to assign') }
    finally { setSaving(false) }
  }

  // ✅ FIX: Array.isArray guard on filter to prevent "users.filter is not a function"
  const filtered = (Array.isArray(users) ? users : []).filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  )
  const linked   = (Array.isArray(users) ? users : []).filter(u => u.fingerprint_id).length
  const unlinked = (Array.isArray(users) ? users : []).length - linked

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Employees" value={(Array.isArray(users) ? users : []).length} icon={Users}       color="blue"    />
        <StatCard label="Linked"          value={linked}                                      icon={Fingerprint} color="emerald" />
        <StatCard label="Not Linked"      value={unlinked}                                    icon={WifiOff}     color="amber"   />
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50 border border-violet-100">
        <Settings size={18} className="text-violet-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-violet-800">How ADMS Auto-Push Works</p>
          <p className="text-sm text-violet-600 mt-0.5">
            Go to <strong>Menu → Comm → ADMS</strong> on your eSSL device and set server address to{' '}
            <code className="bg-violet-100 px-1 rounded">http://YOUR_SERVER/api/essl/iclock/cdata</code>.
            Note: WFH-override employees are automatically excluded from biometric sync.
          </p>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Link2 size={15} /> Employee → Fingerprint ID Mapping
          </h3>
          <input className="input w-52" placeholder="Search name or dept..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Department', 'Designation', 'Work Mode', 'Fingerprint ID', 'Status', 'Action']
                  .map(h => <th key={h} className="table-header px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? <tr><td colSpan={7} className="py-16 text-center"><Spinner /></td></tr>
                : filtered.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[10px]">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.department}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.designation}</td>
                    <td className="px-4 py-3"><WorkModeBadge mode={u.work_mode} /></td>
                    <td className="px-4 py-3">
                      {u.fingerprint_id
                        ? <span className="inline-flex items-center gap-1.5 font-mono text-sm px-2 py-0.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-600">
                            <Fingerprint size={11} /> {u.fingerprint_id}
                          </span>
                        : <span className="text-xs text-gray-400 italic">Not assigned</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                        u.status === 'active' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-gray-400 bg-gray-50 border-gray-200'
                      }`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 transition-colors" title="Assign Fingerprint ID">
                        <Fingerprint size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Assign Fingerprint ID"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditUser(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving || !fpInput.trim()}>
              {saving ? <Spinner size="sm" /> : <Fingerprint size={14} />} Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
              {editUser?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{editUser?.name}</p>
              <p className="text-xs text-gray-400">{editUser?.department} · {editUser?.designation}</p>
            </div>
          </div>
          <FormField label="Fingerprint ID (from device enrollment)">
            <input className="input font-mono text-lg tracking-widest" placeholder="e.g. 1, 42, 100"
              value={fpInput} onChange={e => setFpInput(e.target.value)} autoFocus />
          </FormField>
        </div>
      </Modal>
    </>
  )
}

// ─── Leave Approval Tab ───────────────────────────────────────────────────────

function LeaveApprovalTab({ onCountChange }) {
  const [leaves,      setLeaves]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [statusF,     setStatusF]     = useState('pending')
  const [roleF,       setRoleF]       = useState('')
  const [viewModal,   setViewModal]   = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusF) params.status = statusF
      const data     = await fetchAllLeaves(params)
      const filtered = roleF ? data.filter(l => l.user_id?.role === roleF) : data
      setLeaves(filtered)
      onCountChange(data.filter(l => l.status === 'pending').length)
    } catch { toast.error('Failed to load leave requests') } finally { setLoading(false) }
  }, [statusF, roleF, onCountChange])

  useEffect(() => { load() }, [load])

  const handleAction = async (action) => {
    setSaving(true)
    // Backend expects the final status ('approved' / 'rejected'),
    // but the UI uses the verb ('approve' / 'reject') — map it here.
    const status = action === 'approve' ? 'approved' : 'rejected'
    try {
      // updateLeaveStatus catches its own errors and returns { ok, message }
      // instead of throwing, so we must check result.ok — otherwise a failed
      // request would still show a success toast and the row stays pending.
      const result = await updateLeaveStatus(actionModal.leave._id, status)
      if (!result || !result.ok) {
        toast.error(result?.message || 'Action failed')
        return
      }
      toast.success(`Leave ${status}`)
      setActionModal(null); load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center">
        <SelectInput value={statusF} onChange={setStatusF} placeholder="All statuses"
          options={['pending', 'approved', 'rejected'].map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} className="w-40" />
        <SelectInput value={roleF} onChange={setRoleF} placeholder="All roles"
          options={[{ value: 'employee', label: 'Employee' }, { value: 'manager', label: 'Manager' }]} className="w-36" />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions']
                  .map(h => <th key={h} className="table-header px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? <tr><td colSpan={8} className="py-16 text-center"><Spinner /></td></tr>
                : leaves.length === 0
                  ? <tr><td colSpan={8}><EmptyState icon={CalendarOff} title="No leave requests" description="No requests match the filter" /></td></tr>
                  : leaves.map(l => {
                    const cfg  = LEAVE_STATUS_CONFIG[l.status] ?? LEAVE_STATUS_CONFIG.pending
                    const Icon = cfg.icon
                    return (
                      <tr key={l._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                              {(l.user_id?.name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{l.user_id?.name ?? '—'}</p>
                              <p className="text-[10px] text-gray-400 capitalize">{l.user_id?.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 capitalize">
                          {LEAVE_TYPES.find(t => t.value === l.leave_type)?.label ?? l.leave_type}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-500">
                          {l.from_date ? format(new Date(l.from_date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-500">
                          {l.to_date ? format(new Date(l.to_date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{l.days ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[180px]">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{l.reason ?? '—'}</span>
                            {l.documents?.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary flex-shrink-0" title={`${l.documents.length} attachment(s)`}>
                                <Paperclip size={11} />{l.documents.length}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium ${cfg.color}`}>
                            <Icon size={10} /> {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewModal(l)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="View">
                              <AlertCircle size={13} />
                            </button>
                            {l.status === 'pending' && (
                              <>
                                <button onClick={() => setActionModal({ leave: l, action: 'approve' })}
                                  className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50" title="Approve">
                                  <CheckCircle2 size={13} />
                                </button>
                                <button onClick={() => setActionModal({ leave: l, action: 'reject' })}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50" title="Reject">
                                  <XCircle size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* View modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title="Leave Request Details"
        footer={<button className="btn-secondary" onClick={() => setViewModal(null)}>Close</button>}>
        {viewModal && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><p className="text-gray-400 text-xs mb-1">Employee</p><p className="font-medium">{viewModal.user_id?.name}</p></div>
              <div><p className="text-gray-400 text-xs mb-1">Type</p><p className="capitalize">{LEAVE_TYPES.find(t => t.value === viewModal.leave_type)?.label}</p></div>
              <div><p className="text-gray-400 text-xs mb-1">From</p><p>{viewModal.from_date ? format(new Date(viewModal.from_date), 'dd MMM yyyy') : '—'}</p></div>
              <div><p className="text-gray-400 text-xs mb-1">To</p><p>{viewModal.to_date ? format(new Date(viewModal.to_date), 'dd MMM yyyy') : '—'}</p></div>
            </div>
            <div><p className="text-gray-400 text-xs mb-1">Reason</p><p className="text-gray-800">{viewModal.reason}</p></div>

            <div>
              <p className="text-gray-400 text-xs mb-1">Attachments</p>
              {viewModal.documents?.length > 0 ? (
                <div className="space-y-1.5">
                  {viewModal.documents.map((doc, i) => (
                    <a
                      key={i}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-primary/30 transition-colors group"
                    >
                      <FileText size={15} className="text-primary flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate flex-1" title={doc.name}>
                        {doc.name || `Attachment ${i + 1}`}
                      </span>
                      <ExternalLink size={13} className="text-gray-400 group-hover:text-primary flex-shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No documents attached</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm action modal */}
      <Modal open={!!actionModal} onClose={() => setActionModal(null)}
        title={`${actionModal?.action === 'approve' ? 'Approve' : 'Reject'} Leave Request`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setActionModal(null)} disabled={saving}>Cancel</button>
            <button
              className={actionModal?.action === 'approve' ? 'btn-primary' : 'px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600'}
              onClick={() => handleAction(actionModal.action)} disabled={saving}>
              {saving ? <Spinner size="sm" /> : (actionModal?.action === 'approve' ? 'Approve' : 'Reject')}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-500">
          Are you sure you want to <strong className="text-gray-800">{actionModal?.action}</strong> the leave
          request from <strong className="text-gray-800">{actionModal?.leave?.user_id?.name}</strong>?
        </p>
      </Modal>
    </>
  )
}