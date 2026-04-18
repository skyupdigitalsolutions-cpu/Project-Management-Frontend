import { useState, useEffect } from "react";
import axiosInstance from "../../api/axios";

const PROJECT_TYPES = [
  { value: "website",        label: "🌐 Website",         hint: "Frontend, Backend, Full Stack, Designer" },
  { value: "mobile_app",     label: "📱 Mobile App",       hint: "Mobile Dev, Backend, Designer" },
  { value: "ecommerce",      label: "🛒 E-Commerce",       hint: "Full Stack, Backend, SEO, Designer" },
  { value: "api_service",    label: "⚙️ API Service",      hint: "Backend, Full Stack" },
  { value: "data_analytics", label: "📊 Data Analytics",   hint: "Data Analyst, Backend" },
  { value: "design",         label: "🎨 Design",           hint: "Designer" },
  { value: "content",        label: "✍️ Content",          hint: "Content Writer" },
  { value: "seo",            label: "🔍 SEO",              hint: "SEO Specialist, Content Writer" },
  { value: "marketing",      label: "📣 Marketing",        hint: "Marketing Specialist, Content Writer" },
  { value: "other",          label: "📁 Other",            hint: "General assignment" },
];

const PRIORITIES      = ["low", "medium", "high", "critical"];
const TASK_PRIORITIES = ["low", "medium", "high", "critical"];

const emptyTask = () => ({
  id: Date.now() + Math.random(),
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
  estimated_hours: "",
  required_role: "",
  requires_permission: false,
  permission_description: "",
});

const emptyAssignment = () => ({
  id: Date.now() + Math.random(),
  department: "",
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  estimated_hours: "",
  tasks: [emptyTask()],
});

export default function AutoAssignProject() {
  const [managers,    setManagers]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState({ type: "", text: "" });
  const [autoAssign,  setAutoAssign]  = useState(true);

  const [project, setProject] = useState({
    title:        "",
    description:  "",
    manager_id:   "",
    priority:     "medium",
    project_type: "website",
    start_date:   "",
    end_date:     "",
  });

  const [assignments, setAssignments] = useState([emptyAssignment()]);

  useEffect(() => {
    axiosInstance.get("/users?role=manager")
      .then((r) => setManagers(r.data.data || []))
      .catch(console.error);
  }, []);

  function updateProject(field, val) {
    setProject((p) => ({ ...p, [field]: val }));
  }

  function updateAssignment(idx, field, val) {
    setAssignments((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: val } : a))
    );
  }

  function addAssignment() {
    setAssignments((prev) => [...prev, emptyAssignment()]);
  }

  function removeAssignment(idx) {
    setAssignments((prev) => prev.filter((_, i) => i !== idx));
  }

  function addTask(aIdx) {
    setAssignments((prev) =>
      prev.map((a, i) => (i === aIdx ? { ...a, tasks: [...a.tasks, emptyTask()] } : a))
    );
  }

  function removeTask(aIdx, tIdx) {
    setAssignments((prev) =>
      prev.map((a, i) =>
        i === aIdx ? { ...a, tasks: a.tasks.filter((_, ti) => ti !== tIdx) } : a
      )
    );
  }

  function updateTask(aIdx, tIdx, field, val) {
    setAssignments((prev) =>
      prev.map((a, i) =>
        i === aIdx
          ? { ...a, tasks: a.tasks.map((t, ti) => (ti === tIdx ? { ...t, [field]: val } : t)) }
          : a
      )
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "", text: "" });

    try {
      const payload = {
        project:     { ...project, auto_assign: autoAssign },
        assignments: assignments.map(({ id, tasks, ...a }) => ({
          ...a,
          tasks: tasks.map(({ id: _tid, ...t }) => ({
            ...t,
            estimated_hours: t.estimated_hours ? Number(t.estimated_hours) : null,
          })),
        })),
        auto_assign: autoAssign,
      };

      const res = await axiosInstance.post("/assignments/wizard", payload);
      setMsg({ type: "success", text: res.data.message || "Project created successfully!" });
      setProject({ title: "", description: "", manager_id: "", priority: "medium", project_type: "website", start_date: "", end_date: "" });
      setAssignments([emptyAssignment()]);
    } catch (err) {
      setMsg({ type: "error", text: err?.response?.data?.message || "Failed to create project" });
    } finally {
      setLoading(false);
    }
  }

  const selectedType = PROJECT_TYPES.find((t) => t.value === project.project_type);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Create Project</h1>
        <p className="text-sm text-slate-400 mt-1">
          Use Auto-Assign to let the system pick the best employees based on project type and workload.
        </p>
      </div>

      {/* Message banner */}
      {msg.text && (
        <div
          className="rounded-lg px-4 py-3 text-sm flex justify-between items-start"
          style={
            msg.type === "success"
              ? { backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
              : { backgroundColor: 'rgba(239,68,68,0.1)',  border: '1px solid rgba(239,68,68,0.25)',  color: '#f87171' }
          }
        >
          {msg.text}
          <button onClick={() => setMsg({ type: "", text: "" })} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Auto-Assign Toggle */}
        <div
          className="rounded-xl p-5 transition-colors"
          style={
            autoAssign
              ? { backgroundColor: 'rgba(59,130,246,0.1)', border: '2px solid rgba(59,130,246,0.5)' }
              : { backgroundColor: '#1e293b',               border: '2px solid rgba(255,255,255,0.08)' }
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">🤖 Smart Auto-Assignment</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically assign tasks to best-fit employees based on their role, department, and current workload.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                checked={autoAssign}
                onChange={(e) => setAutoAssign(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{ backgroundColor: autoAssign ? undefined : '#334155' }}
              ></div>
            </label>
          </div>
        </div>

        {/* Project Details */}
        <Section title="Project Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField label="Project Title *">
                <input
                  required value={project.title}
                  onChange={(e) => updateProject("title", e.target.value)}
                  placeholder="e.g. Company Website Redesign"
                  className={INPUT}
                  style={IS}
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Description *">
                <textarea
                  required value={project.description}
                  onChange={(e) => updateProject("description", e.target.value)}
                  rows={2} placeholder="Project overview..."
                  className={INPUT}
                  style={IS}
                />
              </FormField>
            </div>

            <FormField label="Project Type *">
              <select
                required value={project.project_type}
                onChange={(e) => updateProject("project_type", e.target.value)}
                className={INPUT}
                style={IS}
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}
                    style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                    {t.label}
                  </option>
                ))}
              </select>
              {selectedType && (
                <p className="text-xs text-blue-400 mt-1">
                  🎯 Will auto-assign: <strong>{selectedType.hint}</strong>
                </p>
              )}
            </FormField>

            <FormField label="Priority *">
              <select
                required value={project.priority}
                onChange={(e) => updateProject("priority", e.target.value)}
                className={INPUT}
                style={IS}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}
                    style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Manager">
              <select
                value={project.manager_id}
                onChange={(e) => updateProject("manager_id", e.target.value)}
                className={INPUT}
                style={IS}
              >
                <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                  Select manager...
                </option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}
                    style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                    {m.name} ({m.designation})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Start Date *">
              <input type="date" required value={project.start_date}
                onChange={(e) => updateProject("start_date", e.target.value)}
                className={INPUT} style={IS} />
            </FormField>

            <FormField label="End Date *">
              <input type="date" required value={project.end_date}
                onChange={(e) => updateProject("end_date", e.target.value)}
                className={INPUT} style={IS} />
            </FormField>
          </div>
        </Section>

        {/* Assignments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Assignments &amp; Tasks</h2>
            <button
              type="button"
              onClick={addAssignment}
              className="text-sm px-3 py-1.5 text-white rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: '#3b82f6' }}
            >
              + Add Assignment
            </button>
          </div>

          {assignments.map((asgn, aIdx) => (
            <div
              key={asgn.id}
              className="rounded-xl p-5 space-y-4"
              style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-300">Assignment {aIdx + 1}</h3>
                {assignments.length > 1 && (
                  <button type="button" onClick={() => removeAssignment(aIdx)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors">
                    ✕ Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Title *">
                  <input required value={asgn.title}
                    onChange={(e) => updateAssignment(aIdx, "title", e.target.value)}
                    placeholder="e.g. Frontend Development Phase"
                    className={INPUT} style={IS} />
                </FormField>
                <FormField label="Department *">
                  <input required value={asgn.department}
                    onChange={(e) => updateAssignment(aIdx, "department", e.target.value)}
                    placeholder="e.g. Web Development"
                    className={INPUT} style={IS} />
                </FormField>
                <FormField label="Start Date *">
                  <input type="date" required value={asgn.start_date}
                    onChange={(e) => updateAssignment(aIdx, "start_date", e.target.value)}
                    className={INPUT} style={IS} />
                </FormField>
                <FormField label="End Date *">
                  <input type="date" required value={asgn.end_date}
                    onChange={(e) => updateAssignment(aIdx, "end_date", e.target.value)}
                    className={INPUT} style={IS} />
                </FormField>
              </div>

              {/* Tasks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-slate-400">Tasks</h4>
                  <button
                    type="button"
                    onClick={() => addTask(aIdx)}
                    className="text-xs px-2.5 py-1 rounded transition-colors hover:opacity-80"
                    style={{ border: '1px solid rgba(59,130,246,0.5)', color: '#60a5fa' }}
                  >
                    + Add Task
                  </button>
                </div>

                <div className="space-y-3">
                  {asgn.tasks.map((task, tIdx) => (
                    <div
                      key={task.id}
                      className="rounded-lg p-3 space-y-3"
                      style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Task {tIdx + 1}</span>
                        {asgn.tasks.length > 1 && (
                          <button type="button" onClick={() => removeTask(aIdx, tIdx)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors">✕</button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormField label="Title *">
                          <input required value={task.title}
                            onChange={(e) => updateTask(aIdx, tIdx, "title", e.target.value)}
                            placeholder="e.g. Design Homepage"
                            className={INPUT} style={IS} />
                        </FormField>
                        <FormField label="Required Role">
                          <input value={task.required_role}
                            onChange={(e) => updateTask(aIdx, tIdx, "required_role", e.target.value)}
                            placeholder="e.g. frontend developer"
                            className={INPUT} style={IS} />
                          {autoAssign && (
                            <p className="text-xs text-blue-400 mt-0.5">Used for auto-matching</p>
                          )}
                        </FormField>
                        <FormField label="Priority">
                          <select value={task.priority}
                            onChange={(e) => updateTask(aIdx, tIdx, "priority", e.target.value)}
                            className={INPUT} style={IS}>
                            {TASK_PRIORITIES.map((p) => (
                              <option key={p} value={p}
                                style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="Due Date *">
                          <input type="date" required value={task.due_date}
                            onChange={(e) => updateTask(aIdx, tIdx, "due_date", e.target.value)}
                            className={INPUT} style={IS} />
                        </FormField>
                        <FormField label="Est. Hours">
                          <input type="number" min="0" value={task.estimated_hours}
                            onChange={(e) => updateTask(aIdx, tIdx, "estimated_hours", e.target.value)}
                            placeholder="e.g. 8"
                            className={INPUT} style={IS} />
                        </FormField>
                        <FormField label="Requires Admin Permission">
                          <div className="flex items-center gap-2 pt-2">
                            <input
                              type="checkbox"
                              id={`perm-${aIdx}-${tIdx}`}
                              checked={task.requires_permission}
                              onChange={(e) => updateTask(aIdx, tIdx, "requires_permission", e.target.checked)}
                              className="w-4 h-4 accent-blue-500"
                            />
                            <label htmlFor={`perm-${aIdx}-${tIdx}`} className="text-sm text-slate-400">
                              Requires admin permission to start
                            </label>
                          </div>
                        </FormField>
                        {task.requires_permission && (
                          <div className="md:col-span-2">
                            <FormField label="Permission Description">
                              <input value={task.permission_description}
                                onChange={(e) => updateTask(aIdx, tIdx, "permission_description", e.target.value)}
                                placeholder="What access is needed?"
                                className={INPUT} style={IS} />
                            </FormField>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#3b82f6' }}
        >
          {loading
            ? "Creating..."
            : autoAssign
            ? "🤖 Create Project & Auto-Assign Tasks"
            : "📋 Create Project Manually"}
        </button>
      </form>
    </div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT = [
  "w-full rounded-lg px-3 py-2 text-sm text-white outline-none",
  "focus:ring-2 focus:ring-blue-500",
  "placeholder:text-slate-600",
].join(" ");

// Shared inline dark style — applied to every input/select/textarea
const IS = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(255,255,255,0.12)',
  colorScheme: 'dark',
};

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
