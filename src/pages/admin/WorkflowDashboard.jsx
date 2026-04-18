import { useState, useEffect } from "react";
import axiosInstance from "../../api/axios";

const PRIORITY_COLOR = {
  critical: "bg-red-500/20 text-red-400 border border-red-500/30",
  high:     "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  medium:   "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  low:      "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
};

const STATUS_COLOR = {
  "todo":        "bg-slate-500/20 text-slate-400",
  "in-progress": "bg-blue-500/20 text-blue-400",
  "completed":   "bg-emerald-500/20 text-emerald-400",
  "on-hold":     "bg-yellow-500/20 text-yellow-400",
  "cancelled":   "bg-red-500/20 text-red-400",
  "blocked":     "bg-purple-500/20 text-purple-400",
};

export default function WorkflowDashboard() {
  const [tasks,        setTasks]        = useState([]);
  const [stats,        setStats]        = useState({});
  const [workload,     setWorkload]     = useState([]);
  const [delayedTasks, setDelayedTasks] = useState([]);
  const [pendingPerms, setPendingPerms] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState("overview");
  const [delayModal,   setDelayModal]   = useState(null);
  const [delayReason,  setDelayReason]  = useState("");
  const [newDueDate,   setNewDueDate]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [msg,          setMsg]          = useState("");

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [tasksRes, statsRes, workloadRes, delayedRes, permRes] = await Promise.all([
        axiosInstance.get("/tasks?limit=50"),
        axiosInstance.get("/tasks/stats"),
        axiosInstance.get("/tasks/workload"),
        axiosInstance.get("/tasks?is_delayed=true&limit=20"),
        axiosInstance.get("/tasks?permission_status=pending&limit=20"),
      ]);
      setTasks(tasksRes.data.data || []);
      setStats(statsRes.data.data || {});
      setWorkload(workloadRes.data.data || []);
      setDelayedTasks(delayedRes.data.data || []);
      setPendingPerms(permRes.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function grantPermission(taskId, action) {
    try {
      await axiosInstance.patch(`/tasks/${taskId}/permission`, { action });
      setMsg(`Permission ${action}ed successfully`);
      fetchAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    }
  }

  async function submitDelay() {
    if (!delayReason.trim() || delayReason.length < 10) {
      setMsg("Reason must be at least 10 characters");
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post(`/tasks/${delayModal._id}/delay`, {
        reason:       delayReason,
        new_due_date: newDueDate || undefined,
      });
      setMsg("Delay logged");
      setDelayModal(null);
      setDelayReason("");
      setNewDueDate("");
      fetchAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const totalTasks      = Object.values(stats.by_status || {}).reduce((a, b) => a + b, 0);
  const completedCount  = stats.by_status?.completed || 0;
  const overallProgress = totalTasks ? Math.round((completedCount / totalTasks) * 100) : 0;

  const TABS = [
    { id: "overview",    label: "📊 Overview" },
    { id: "delayed",     label: `⚠️ Delayed (${delayedTasks.length})` },
    { id: "permissions", label: `🔐 Permissions (${pendingPerms.length})` },
    { id: "workload",    label: "👥 Workload" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Workflow Dashboard</h1>
        <button
          onClick={fetchAll}
          className="text-sm px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition-colors"
          style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Message banner */}
      {msg && (
        <div
          className="rounded-lg px-4 py-3 text-sm text-blue-400 flex justify-between items-center"
          style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          {msg}
          <button onClick={() => setMsg("")} className="text-blue-500 hover:text-blue-300 ml-4">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Tasks"         value={totalTasks}          color="blue"   icon="📋" />
        <KPICard label="Completed"           value={completedCount}      color="green"  icon="✅" />
        <KPICard label="Delayed"             value={delayedTasks.length} color="red"    icon="⚠️" />
        <KPICard label="Pending Permissions" value={pendingPerms.length} color="purple" icon="🔐" />
      </div>

      {/* Overall Progress */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex justify-between mb-2">
          <span className="font-semibold text-slate-300">Overall Project Progress</span>
          <span className="font-bold text-blue-400">{overallProgress}%</span>
        </div>
        <div className="w-full rounded-full h-3" style={{ backgroundColor: '#0f172a' }}>
          <div
            className="h-3 rounded-full transition-all"
            style={{ width: `${overallProgress}%`, backgroundColor: '#3b82f6' }}
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(stats.by_status || {}).map(([status, count]) => (
            <span key={status} className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[status] || "bg-slate-500/20 text-slate-400"}`}>
              {status}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Tab bar */}
        <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              style={
                activeTab === t.id
                  ? { backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderBottom: '2px solid #3b82f6' }
                  : { color: '#64748b' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-3">Recent tasks sorted by priority</p>
              {tasks.slice(0, 15).map((task) => (
                <TaskRow key={task._id} task={task} onLogDelay={() => setDelayModal(task)} />
              ))}
            </div>
          )}

          {/* Delayed Tasks Tab */}
          {activeTab === "delayed" && (
            <div className="space-y-3">
              {delayedTasks.length === 0 ? (
                <p className="text-center text-slate-500 py-8">🎉 No delayed tasks!</p>
              ) : (
                delayedTasks.map((task) => (
                  <div
                    key={task._id}
                    className="rounded-lg p-4"
                    style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{task.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[task.priority]}`}>
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Assigned to: <strong className="text-slate-300">{task.assigned_to?.name || "—"}</strong> ·
                          Due: <strong className="text-red-400">{new Date(task.due_date).toLocaleDateString()}</strong>
                        </p>
                        {task.delay_reason && (
                          <p className="mt-1 text-xs text-red-400 rounded px-2 py-1" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                            Last reason: {task.delay_reason}
                          </p>
                        )}
                        {task.delay_logs?.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">{task.delay_logs.length} delay log(s)</p>
                        )}
                      </div>
                      <button
                        onClick={() => setDelayModal(task)}
                        className="text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors"
                        style={{ backgroundColor: '#ef4444' }}
                      >
                        Log Delay
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === "permissions" && (
            <div className="space-y-3">
              {pendingPerms.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No pending permission requests</p>
              ) : (
                pendingPerms.map((task) => (
                  <div
                    key={task._id}
                    className="rounded-lg p-4"
                    style={{ backgroundColor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{task.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            {task.permission_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Assigned to: <strong className="text-slate-300">{task.assigned_to?.name || "—"}</strong>
                        </p>
                        {task.permission_description && (
                          <p className="mt-1 text-xs text-purple-400 rounded px-2 py-1" style={{ backgroundColor: 'rgba(168,85,247,0.1)' }}>
                            {task.permission_description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => grantPermission(task._id, "grant")}
                          className="text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors"
                          style={{ backgroundColor: '#10b981' }}
                        >
                          ✅ Grant
                        </button>
                        <button
                          onClick={() => grantPermission(task._id, "deny")}
                          className="text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors"
                          style={{ backgroundColor: '#ef4444' }}
                        >
                          ❌ Deny
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Workload Tab */}
          {activeTab === "workload" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-3">Active task load per employee (higher score = more loaded)</p>
              {workload.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No workload data</p>
              ) : (
                workload
                  .sort((a, b) => b.workload_score - a.workload_score)
                  .map((emp) => (
                    <WorkloadBar key={emp._id} emp={emp} />
                  ))
              )}
            </div>
          )}

        </div>
      </div>

      {/* Delay Modal */}
      {delayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full max-w-md rounded-xl p-6 space-y-4"
            style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-white text-lg">Log Delay</h3>
              <button onClick={() => setDelayModal(null)} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
            </div>
            <p className="text-sm text-slate-400">
              Task: <strong className="text-white">{delayModal.title}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Reason for Delay *</label>
              <textarea
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                rows={3}
                placeholder="Explain why this task is delayed (min 10 characters)..."
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              <p className="text-xs text-slate-500 mt-1">{delayReason.length}/10 min characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">New Due Date (optional)</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', colorScheme: 'dark' }}
              />
            </div>
            {msg && <p className="text-sm text-red-400">{msg}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setDelayModal(null); setDelayReason(""); setNewDueDate(""); setMsg(""); }}
                className="flex-1 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
                style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={submitDelay}
                disabled={submitting}
                className="flex-1 py-2 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#ef4444' }}
              >
                {submitting ? "Logging..." : "Log Delay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, color, icon }) {
  const styles = {
    blue:   { backgroundColor: 'rgba(59,130,246,0.1)',  border: '1px solid rgba(59,130,246,0.2)',  color: '#60a5fa'  },
    green:  { backgroundColor: 'rgba(16,185,129,0.1)',  border: '1px solid rgba(16,185,129,0.2)',  color: '#34d399'  },
    red:    { backgroundColor: 'rgba(239,68,68,0.1)',   border: '1px solid rgba(239,68,68,0.2)',   color: '#f87171'  },
    purple: { backgroundColor: 'rgba(168,85,247,0.1)',  border: '1px solid rgba(168,85,247,0.2)',  color: '#c084fc'  },
  };
  return (
    <div className="rounded-xl p-4" style={styles[color]}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold" style={{ color: styles[color].color }}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onLogDelay }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-3 px-1"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-white truncate">{task.title}</span>
          {task.is_delayed && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Delayed</span>
          )}
          {task.requires_permission && task.permission_status !== "granted" && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
              Needs Permission
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {task.assigned_to?.name || "Unassigned"} · Due {new Date(task.due_date).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[task.priority] || ""}`}>
          {task.priority}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[task.status] || "bg-slate-500/20 text-slate-400"}`}>
          {task.status}
        </span>
        {task.progress_percent > 0 && (
          <span className="text-xs text-slate-500 w-8 text-right">{task.progress_percent}%</span>
        )}
        {!task.is_delayed && task.status !== "completed" && (
          <button
            onClick={onLogDelay}
            className="text-xs px-2 py-1 rounded hover:opacity-80 transition-colors"
            style={{ border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
          >
            Delay
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Workload Bar ─────────────────────────────────────────────────────────────

function WorkloadBar({ emp }) {
  const max = 300;
  const pct = Math.min((emp.workload_score / max) * 100, 100);
  const barColor =
    pct > 75 ? '#ef4444' :
    pct > 50 ? '#f97316' : '#3b82f6';

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex justify-between mb-2">
        <div>
          <span className="font-medium text-sm text-white">{emp.name}</span>
          <span className="text-xs text-slate-500 ml-2">{emp.designation} · {emp.department}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-slate-300">{emp.task_count} tasks</span>
          <span className="text-xs text-slate-500 ml-2">score: {emp.workload_score}</span>
        </div>
      </div>
      <div className="w-full rounded-full h-2.5" style={{ backgroundColor: '#0f172a' }}>
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
