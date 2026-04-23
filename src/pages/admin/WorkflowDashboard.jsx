import { useState, useEffect } from "react";
import axiosInstance from "../../api/axios";

const PRIORITY_COLOR = {
  critical: "bg-red-500/20 text-red-600 border border-red-500/30",
  high:     "bg-orange-500/20 text-orange-600 border border-orange-500/30",
  medium:   "bg-yellow-500/20 text-yellow-600 border border-yellow-500/30",
  low:      "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30",
};

const STATUS_COLOR = {
  "todo":        "bg-slate-100 text-slate-600",
  "in-progress": "bg-blue-100 text-blue-600",
  "completed":   "bg-emerald-100 text-emerald-600",
  "on-hold":     "bg-yellow-100 text-yellow-600",
  "cancelled":   "bg-red-100 text-red-600",
  "blocked":     "bg-purple-100 text-purple-600",
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
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Workflow Dashboard</h1>
        <button
          onClick={fetchAll}
          className="text-sm px-3 py-1.5 rounded-lg text-[#000000] bg-[#ffffff] transition-colors hover:opacity-90 border border-gray-300"
         
        >
          🔄 Refresh
        </button>
      </div>

      {/* Message banner */}
      {msg && (
        <div className="rounded-lg px-4 py-3 text-sm text-blue-700 flex justify-between items-center bg-blue-50 border border-blue-200">
          {msg}
          <button onClick={() => setMsg("")} className="text-blue-500 hover:text-blue-700 ml-4">✕</button>
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
      <div className="rounded-xl p-5 bg-white border border-gray-200 shadow-sm">
        <div className="flex justify-between mb-2">
          <span className="font-semibold text-gray-700">Overall Project Progress</span>
          <span className="font-bold text-blue-600">{overallProgress}%</span>
        </div>
        <div className="w-full rounded-full h-3 bg-gray-100">
          <div
            className="h-3 rounded-full transition-all"
            style={{ width: `${overallProgress}%`, backgroundColor: '#3b82f6' }}
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(stats.by_status || {}).map(([status, count]) => (
            <span key={status} className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[status] || "bg-slate-100 text-slate-600"}`}>
              {status}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm">
        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              style={
                activeTab === t.id
                  ? { backgroundColor: 'rgba(59,130,246,0.08)', color: '#2563eb', borderBottom: '2px solid #3b82f6' }
                  : { color: '#94a3b8' }
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
              <p className="text-sm text-gray-500 mb-3">Recent tasks sorted by priority</p>
              {tasks.slice(0, 15).map((task) => (
                <TaskRow key={task._id} task={task} onLogDelay={() => setDelayModal(task)} />
              ))}
            </div>
          )}

          {/* Delayed Tasks Tab */}
          {activeTab === "delayed" && (
            <div className="space-y-3">
              {delayedTasks.length === 0 ? (
                <p className="text-center text-gray-500 py-8">🎉 No delayed tasks!</p>
              ) : (
                delayedTasks.map((task) => (
                  <div
                    key={task._id}
                    className="rounded-lg p-4 bg-red-50 border border-red-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">{task.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[task.priority]}`}>
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Assigned to: <strong className="text-gray-700">{task.assigned_to?.name || "—"}</strong> ·
                          Due: <strong className="text-red-600">{new Date(task.due_date).toLocaleDateString()}</strong>
                        </p>
                        {task.delay_reason && (
                          <p className="mt-1 text-xs text-red-600 rounded px-2 py-1 bg-red-100">
                            Last reason: {task.delay_reason}
                          </p>
                        )}
                        {task.delay_logs?.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">{task.delay_logs.length} delay log(s)</p>
                        )}
                      </div>
                      <button
                        onClick={() => setDelayModal(task)}
                        className="text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors bg-red-500"
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
                <p className="text-center text-gray-500 py-8">No pending permission requests</p>
              ) : (
                pendingPerms.map((task) => (
                  <div
                    key={task._id}
                    className="rounded-lg p-4 bg-purple-50 border border-purple-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">{task.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 border border-purple-300">
                            {task.permission_status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Assigned to: <strong className="text-gray-700">{task.assigned_to?.name || "—"}</strong>
                        </p>
                        {task.permission_description && (
                          <div className="mt-2 rounded-lg px-3 py-2 bg-purple-100 border border-purple-200">
                            <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-0.5">Employee's reason:</p>
                            <p className="text-xs text-purple-700 italic">"{task.permission_description}"</p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Project: <strong className="text-gray-600">{task.project_id?.title || "—"}</strong>
                          {task.due_date && <span> · Due {new Date(task.due_date).toLocaleDateString()}</span>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => grantPermission(task._id, "grant")}
                          className="text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors bg-emerald-500"
                        >
                          ✅ Grant
                        </button>
                        <button
                          onClick={() => grantPermission(task._id, "deny")}
                          className="text-xs px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors bg-red-500"
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
              <p className="text-sm text-gray-500 mb-3">Active task load per employee (higher score = more loaded)</p>
              {workload.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No workload data</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4 bg-white border border-gray-200 shadow-xl">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-gray-800 text-lg">Log Delay</h3>
              <button onClick={() => setDelayModal(null)} className="text-gray-400 hover:text-gray-700 text-xl transition-colors">✕</button>
            </div>
            <p className="text-sm text-gray-500">
              Task: <strong className="text-gray-800">{delayModal.title}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Delay *</label>
              <textarea
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                rows={3}
                placeholder="Explain why this task is delayed (min 10 characters)..."
                className="w-full rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50 border border-gray-200"
              />
              <p className="text-xs text-gray-400 mt-1">{delayReason.length}/10 min characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Due Date (optional)</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 border border-gray-200"
              />
            </div>
            {msg && <p className="text-sm text-red-500">{msg}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setDelayModal(null); setDelayReason(""); setNewDueDate(""); setMsg(""); }}
                className="flex-1 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-800 transition-colors bg-gray-100 border border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={submitDelay}
                disabled={submitting}
                className="flex-1 py-2 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition-colors bg-red-500"
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
    blue:   { backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb' },
    green:  { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' },
    red:    { backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' },
    purple: { backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', color: '#9333ea' },
  };
  return (
    <div className="rounded-xl p-4 shadow-sm" style={styles[color]}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold" style={{ color: styles[color].color }}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onLogDelay }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-3 px-1 border-b border-gray-100"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-800 truncate">{task.title}</span>
          {task.is_delayed && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">Delayed</span>
          )}
          {task.requires_permission && task.permission_status !== "granted" && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">
              Needs Permission
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {task.assigned_to?.name || "Unassigned"} · Due {new Date(task.due_date).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[task.priority] || ""}`}>
          {task.priority}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[task.status] || "bg-slate-100 text-slate-600"}`}>
          {task.status}
        </span>
        {task.progress_percent > 0 && (
          <span className="text-xs text-gray-400 w-8 text-right">{task.progress_percent}%</span>
        )}
        {!task.is_delayed && task.status !== "completed" && (
          <button
            onClick={onLogDelay}
            className="text-xs px-2 py-1 rounded hover:opacity-80 transition-colors border border-red-300 text-red-500"
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
    <div className="rounded-lg p-4 bg-white border border-gray-200 shadow-sm">
      <div className="flex justify-between mb-2">
        <div>
          <span className="font-medium text-sm text-gray-800">{emp.name}</span>
          <span className="text-xs text-gray-400 ml-2">{emp.designation} · {emp.department}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-gray-700">{emp.task_count} tasks</span>
          <span className="text-xs text-gray-400 ml-2">score: {emp.workload_score}</span>
        </div>
      </div>
      <div className="w-full rounded-full h-2.5 bg-gray-100">
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}