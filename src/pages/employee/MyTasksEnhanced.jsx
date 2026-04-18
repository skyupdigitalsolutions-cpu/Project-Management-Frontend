import { useState, useEffect } from "react";
import axiosInstance from "../../api/axios";

const PRIORITY_COLOR = {
  critical: "bg-red-500/20 text-red-400",
  high:     "bg-orange-500/20 text-orange-400",
  medium:   "bg-yellow-500/20 text-yellow-400",
  low:      "bg-emerald-500/20 text-emerald-400",
};

const STATUS_COLOR = {
  "todo":        "bg-slate-500/20 text-slate-400",
  "in-progress": "bg-blue-500/20 text-blue-400",
  "completed":   "bg-emerald-500/20 text-emerald-400",
  "on-hold":     "bg-yellow-500/20 text-yellow-400",
  "cancelled":   "bg-red-500/20 text-red-400",
  "blocked":     "bg-purple-500/20 text-purple-400",
};

export default function EmployeeMyTasksEnhanced() {
  const [tasks,          setTasks]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filter,         setFilter]         = useState("all");
  const [selectedTask,   setSelectedTask]   = useState(null);
  const [detailTask,     setDetailTask]     = useState(null);
  const [progressVal,    setProgressVal]    = useState(0);
  const [actualHours,    setActualHours]    = useState("");
  const [delayReason,    setDelayReason]    = useState("");
  const [newDueDate,     setNewDueDate]     = useState("");
  const [activeModal,    setActiveModal]    = useState(null);
  const [submitting,     setSubmitting]     = useState(false);
  const [msg,            setMsg]            = useState("");

  useEffect(() => { fetchTasks(); }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/tasks?limit=100");
      setTasks(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTaskDetail(taskId) {
    try {
      const res = await axiosInstance.get(`/tasks/${taskId}`);
      setDetailTask(res.data.data);
    } catch (e) {
      console.error(e);
    }
  }

  function openProgressModal(task) {
    setSelectedTask(task);
    setProgressVal(task.progress_percent || 0);
    setActualHours(task.actual_hours || "");
    setActiveModal("progress");
  }

  function openDelayModal(task) {
    setSelectedTask(task);
    setDelayReason("");
    setNewDueDate("");
    setActiveModal("delay");
  }

  async function openDetail(task) {
    setActiveModal("detail");
    setDetailTask(null);
    await fetchTaskDetail(task._id);
  }

  function closeModal() {
    setActiveModal(null);
    setSelectedTask(null);
    setDetailTask(null);
    setMsg("");
  }

  async function submitProgress() {
    setSubmitting(true);
    try {
      await axiosInstance.patch(`/tasks/${selectedTask._id}/progress`, {
        progress_percent: progressVal,
        actual_hours:     actualHours ? Number(actualHours) : undefined,
      });
      setMsg("Progress updated!");
      fetchTasks();
      setTimeout(closeModal, 1200);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDelay() {
    if (delayReason.trim().length < 10) {
      setMsg("Reason must be at least 10 characters");
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post(`/tasks/${selectedTask._id}/delay`, {
        reason:       delayReason,
        new_due_date: newDueDate || undefined,
      });
      setMsg("Delay reported to your manager");
      fetchTasks();
      setTimeout(closeModal, 1400);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = tasks.filter((t) => {
    if (filter === "all")       return true;
    if (filter === "active")    return ["todo", "in-progress"].includes(t.status);
    if (filter === "delayed")   return t.is_delayed;
    if (filter === "blocked")   return t.status === "blocked";
    if (filter === "completed") return t.status === "completed";
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Tasks</h1>
        <button
          onClick={fetchTasks}
          className="text-sm px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition-colors"
          style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all",       label: `All (${tasks.length})` },
          { key: "active",    label: `Active (${tasks.filter((t) => ["todo","in-progress"].includes(t.status)).length})` },
          { key: "delayed",   label: `⚠️ Delayed (${tasks.filter((t) => t.is_delayed).length})` },
          { key: "blocked",   label: `🔐 Blocked (${tasks.filter((t) => t.status === "blocked").length})` },
          { key: "completed", label: `✅ Done (${tasks.filter((t) => t.status === "completed").length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="text-sm px-3 py-1 rounded-full transition-colors"
            style={
              filter === f.key
                ? { backgroundColor: '#3b82f6', color: '#fff', border: '1px solid #3b82f6' }
                : { backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-12">No tasks found</div>
        ) : (
          filtered.map((task) => (
            <div
              key={task._id}
              className="rounded-xl p-4 space-y-3 transition-all"
              style={{
                backgroundColor: '#1e293b',
                border: `1px solid ${
                  task.is_delayed
                    ? 'rgba(239,68,68,0.3)'
                    : task.status === 'blocked'
                    ? 'rgba(168,85,247,0.3)'
                    : 'rgba(255,255,255,0.08)'
                }`,
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white">{task.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[task.status]}`}>
                      {task.status}
                    </span>
                    {task.is_auto_assigned && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">🤖 Auto</span>
                    )}
                    {task.is_delayed && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">⚠️ Delayed</span>
                    )}
                    {task.status === "blocked" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">🔐 Needs Permission</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Due: {new Date(task.due_date).toLocaleDateString()}
                    {task.estimated_hours && ` · Est. ${task.estimated_hours}h`}
                    {task.project_id?.title && ` · ${task.project_id.title}`}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              {task.status !== "cancelled" && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span>
                    <span className="font-medium text-slate-300">{task.progress_percent || 0}%</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: '#0f172a' }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${task.progress_percent || 0}%`,
                        backgroundColor:
                          (task.progress_percent || 0) === 100
                            ? '#10b981'
                            : task.is_delayed
                            ? '#f87171'
                            : '#3b82f6',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Auto-assign reason */}
              {task.auto_assign_reason && (
                <p className="text-xs text-blue-400 rounded px-2 py-1" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
                  ℹ️ {task.auto_assign_reason}
                </p>
              )}

              {/* Delay reason */}
              {task.delay_reason && (
                <p className="text-xs text-red-400 rounded px-2 py-1" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                  ⚠️ Last delay reason: {task.delay_reason}
                </p>
              )}

              {/* Blocked info */}
              {task.status === "blocked" && task.permission_description && (
                <p className="text-xs text-purple-400 rounded px-2 py-1" style={{ backgroundColor: 'rgba(168,85,247,0.1)' }}>
                  🔐 Waiting for permission: {task.permission_description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap pt-1">
                {task.status !== "completed" && task.status !== "cancelled" && task.status !== "blocked" && (
                  <button
                    onClick={() => openProgressModal(task)}
                    className="text-xs px-3 py-1.5 text-white rounded-lg transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#3b82f6' }}
                  >
                    📈 Update Progress
                  </button>
                )}
                {task.status !== "completed" && task.status !== "cancelled" && (
                  <button
                    onClick={() => openDelayModal(task)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171',
                    }}
                  >
                    ⚠️ Report Delay
                  </button>
                )}
                <button
                  onClick={() => openDetail(task)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8',
                  }}
                >
                  📋 View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Progress Modal */}
      {activeModal === "progress" && selectedTask && (
        <Modal title="Update Progress" onClose={closeModal}>
          <p className="text-sm text-slate-400 mb-4">Task: <strong className="text-white">{selectedTask.title}</strong></p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Progress: <strong className="text-blue-400">{progressVal}%</strong>
              </label>
              <input
                type="range" min="0" max="100" step="5"
                value={progressVal}
                onChange={(e) => setProgressVal(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0%</span><span>50%</span><span>100% (Done)</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Actual Hours Spent</label>
              <input
                type="number" min="0" value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                placeholder="e.g. 6"
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.12)' }}
              />
            </div>
          </div>
          {msg && <p className="text-sm text-blue-400 mt-3">{msg}</p>}
          <ModalFooter onCancel={closeModal} onSubmit={submitProgress} loading={submitting} submitLabel="Update" />
        </Modal>
      )}

      {/* Delay Modal */}
      {activeModal === "delay" && selectedTask && (
        <Modal title="Report Delay" onClose={closeModal}>
          <p className="text-sm text-slate-400 mb-4">Task: <strong className="text-white">{selectedTask.title}</strong></p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Reason *</label>
              <textarea
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                rows={3}
                placeholder="Explain why this task is delayed (min 10 characters)..."
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.12)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Proposed New Due Date (optional)</label>
              <input
                type="date" value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', colorScheme: 'dark' }}
              />
            </div>
          </div>
          {msg && <p className="text-sm text-red-400 mt-3">{msg}</p>}
          <ModalFooter onCancel={closeModal} onSubmit={submitDelay} loading={submitting} submitLabel="Report" submitColor="red" />
        </Modal>
      )}

      {/* Detail Modal */}
      {activeModal === "detail" && (
        <Modal title="Task Details" onClose={closeModal} wide>
          {!detailTask ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Status" value={
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[detailTask.status]}`}>
                    {detailTask.status}
                  </span>
                } />
                <InfoRow label="Priority" value={
                  <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLOR[detailTask.priority]}`}>
                    {detailTask.priority}
                  </span>
                } />
                <InfoRow label="Due Date"     value={new Date(detailTask.due_date).toLocaleDateString()} />
                <InfoRow label="Progress"     value={`${detailTask.progress_percent || 0}%`} />
                <InfoRow label="Est. Hours"   value={detailTask.estimated_hours || "—"} />
                <InfoRow label="Actual Hours" value={detailTask.actual_hours || "—"} />
                <InfoRow label="Auto Assigned" value={detailTask.is_auto_assigned ? "Yes 🤖" : "No"} />
                <InfoRow label="Permission"   value={detailTask.permission_status || "—"} />
              </div>

              {detailTask.auto_assign_reason && (
                <div className="rounded-lg p-3 text-blue-400 text-xs" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <strong>Auto-Assign Reason:</strong> {detailTask.auto_assign_reason}
                </div>
              )}

              {/* Delay Logs */}
              {detailTask.delay_logs?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-300 mb-2">⚠️ Delay History</h4>
                  <div className="space-y-2">
                    {detailTask.delay_logs.map((log, i) => (
                      <div key={i} className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <p className="text-red-400 font-medium">{log.reason}</p>
                        <p className="text-slate-500 mt-1">
                          Reported by {log.reported_by?.name || "—"} on {new Date(log.reported_at).toLocaleDateString()}
                          {log.new_due_date && ` → New due: ${new Date(log.new_due_date).toLocaleDateString()}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reassign Logs */}
              {detailTask.reassign_logs?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-300 mb-2">🔄 Reassignment History</h4>
                  <div className="space-y-2">
                    {detailTask.reassign_logs.map((log, i) => (
                      <div key={i} className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
                        <p className="text-slate-300">
                          <strong>{log.from_user?.name || "Unknown"}</strong> → <strong>{log.to_user?.name || "—"}</strong>
                        </p>
                        <p className="text-slate-500 mt-0.5">{log.reason} · {log.trigger}</p>
                        <p className="text-slate-600 mt-0.5">{new Date(log.reassigned_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div
        className={`${wide ? "w-full max-w-xl" : "w-full max-w-md"} rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto`}
        style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-white text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Modal Footer ─────────────────────────────────────────────────────────────

function ModalFooter({ onCancel, onSubmit, loading, submitLabel, submitColor = "blue" }) {
  const colors = {
    blue: '#3b82f6',
    red:  '#ef4444',
  };
  return (
    <div className="flex gap-3 pt-4">
      <button
        onClick={onCancel}
        className="flex-1 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
        style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={loading}
        className="flex-1 py-2 text-white rounded-lg text-sm disabled:opacity-50 transition-colors hover:opacity-90"
        style={{ backgroundColor: colors[submitColor] }}
      >
        {loading ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="font-medium text-slate-200 mt-0.5">{value}</div>
    </div>
  );
}
