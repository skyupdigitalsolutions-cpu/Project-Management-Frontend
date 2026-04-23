import { useEffect, useState, useCallback } from 'react'
import { ClipboardList, Plus, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, CalendarDays, X } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { PageHeader, Spinner, EmptyState } from '../../components/common/UI'

export default function EmployeeDailyReport() {
  const [reports,     setReports]     = useState([])
  const [todayReport, setTodayReport] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [expanded,    setExpanded]    = useState(null)

  const [form, setForm] = useState({
    summary: '',
    tasks_completed: [''],
    blockers: '',
    plan_for_tomorrow: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [todayRes, historyRes] = await Promise.all([
        api.get('/daily-reports/today'),
        api.get('/daily-reports/my?limit=30'),
      ])
      const t = todayRes.data.data
      setTodayReport(t)
      setReports(historyRes.data.data ?? [])
      if (t) {
        setForm({
          summary:           t.summary || '',
          tasks_completed:   t.tasks_completed?.length ? t.tasks_completed : [''],
          blockers:          t.blockers || '',
          plan_for_tomorrow: t.plan_for_tomorrow || '',
        })
      }
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleTaskChange = (i, val) => {
    const updated = [...form.tasks_completed]
    updated[i] = val
    setForm(f => ({ ...f, tasks_completed: updated }))
  }
  const addTask    = () => setForm(f => ({ ...f, tasks_completed: [...f.tasks_completed, ''] }))
  const removeTask = (i) => setForm(f => ({ ...f, tasks_completed: f.tasks_completed.filter((_, idx) => idx !== i) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.summary.trim()) return toast.error('Summary is required')
    setSubmitting(true)
    try {
      await api.post('/daily-reports', {
        ...form,
        tasks_completed: form.tasks_completed.filter(t => t.trim()),
      })
      toast.success(todayReport ? 'Report updated!' : 'Report submitted!')
      setShowForm(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit report')
    } finally { setSubmitting(false) }
  }

  const openForm = () => {
    if (!todayReport) {
      setForm({ summary: '', tasks_completed: [''], blockers: '', plan_for_tomorrow: '' })
    }
    setShowForm(true)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in bg-gray-50 min-h-screen p-6">
      <PageHeader
        title="Daily Report"
        subtitle="Log what you worked on each day"
        icon={ClipboardList}
        action={
          <button onClick={openForm} className="btn-primary gap-2">
            <Plus size={15} />
            {todayReport ? 'Update Today' : 'Submit Report'}
          </button>
        }
      />

      {/* Today's status card */}
      <div className={`bg-white rounded-xl p-4 flex items-center gap-4 border shadow-sm ${
        todayReport ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
      }`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          todayReport ? 'bg-emerald-100' : 'bg-amber-100'
        }`}>
          {todayReport
            ? <CheckCircle size={20} className="text-emerald-600" />
            : <AlertTriangle size={20} className="text-amber-600" />}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${todayReport ? 'text-emerald-700' : 'text-amber-700'}`}>
            {todayReport ? "Today's report submitted ✓" : "Today's report pending"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {todayReport
              ? `Submitted ${format(parseISO(todayReport.createdAt), 'hh:mm a')}`
              : "Don't forget to log your work before end of day"}
          </p>
        </div>
        {!todayReport && (
          <button onClick={openForm} className="btn-primary py-1.5 text-sm">Submit Now</button>
        )}
      </div>

      {/* Submit / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                {todayReport ? 'Update Daily Report' : 'Submit Daily Report'} — {format(new Date(), 'MMMM d, yyyy')}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Summary */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Work Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  rows={3}
                  maxLength={2000}
                  placeholder="Briefly describe what you worked on today..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-brand-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{form.summary.length}/2000</p>
              </div>

              {/* Tasks Completed */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tasks Completed</label>
                <div className="space-y-2">
                  {form.tasks_completed.map((task, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-gray-400 text-xs w-4 text-right">{i + 1}.</span>
                      <input
                        value={task}
                        onChange={e => handleTaskChange(i, e.target.value)}
                        placeholder={`Task ${i + 1}...`}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-brand-500"
                      />
                      {form.tasks_completed.length > 1 && (
                        <button type="button" onClick={() => removeTask(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addTask} className="mt-2 text-xs text-primary hover:opacity-80 flex items-center gap-1">
                  <Plus size={12} /> Add task
                </button>
              </div>

              {/* Blockers */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Blockers / Issues</label>
                <textarea
                  value={form.blockers}
                  onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))}
                  rows={2}
                  placeholder="Any blockers or challenges? (optional)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              {/* Plan for tomorrow */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Plan for Tomorrow</label>
                <textarea
                  value={form.plan_for_tomorrow}
                  onChange={e => setForm(f => ({ ...f, plan_for_tomorrow: e.target.value }))}
                  rows={2}
                  placeholder="What do you plan to work on tomorrow? (optional)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 gap-2">
                  {submitting ? <Spinner size="sm" /> : null}
                  {todayReport ? 'Update Report' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <CalendarDays size={15} className="text-gray-400" /> Report History
        </h3>
        {reports.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No reports yet" description="Submit your first daily report to get started" />
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <ReportCard key={r._id} report={r} expanded={expanded === r._id} onToggle={() => setExpanded(expanded === r._id ? null : r._id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReportCard({ report, expanded, onToggle }) {
  const dateStr = report.date ? format(parseISO(report.date), 'EEEE, MMMM d, yyyy') : '—'
  const isToday = report.date && format(parseISO(report.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
              {dateStr}
              {isToday && (
                <span className="text-xs bg-purple-50 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full">Today</span>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{report.summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {expanded
            ? <ChevronUp size={15} className="text-gray-400" />
            : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3 bg-gray-50">
          <Section label="Summary" content={report.summary} />
          {report.tasks_completed?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tasks Completed</p>
              <ul className="space-y-1">
                {report.tasks_completed.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.blockers          && <Section label="Blockers"          content={report.blockers}          highlight="amber" />}
          {report.plan_for_tomorrow && <Section label="Plan for Tomorrow" content={report.plan_for_tomorrow} />}
        </div>
      )}
    </div>
  )
}

function Section({ label, content, highlight }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm ${highlight === 'amber' ? 'text-amber-600' : 'text-gray-700'}`}>{content}</p>
    </div>
  )
}