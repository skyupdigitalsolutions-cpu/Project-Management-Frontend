import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, Clock,
  Bell, LogOut, Menu, X, User, Briefcase, UserCheck, Video, ClipboardList
} from 'lucide-react'
import NotificationBell from '../common/NotificationBell'
import api from '../../api/axios'

const NAV = {
  admin: [
    { to: '/admin',               label: 'Dashboard',     icon: LayoutDashboard, end: true },
    { to: '/admin/users',         label: 'Users',         icon: Users },
    { to: '/admin/projects',      label: 'Projects',      icon: FolderKanban },
    { to: '/admin/tasks',         label: 'Tasks',         icon: CheckSquare },
    { to: '/admin/attendance',    label: 'Attendance',    icon: Clock },
    { to: '/admin/meetings',      label: 'Meetings',       icon: Video },
    { to: '/admin/notifications', label: 'Notifications',  icon: Bell },
    { to: '/admin/daily-reports', label: 'Daily Reports',  icon: ClipboardList },
  ],
  manager: [
    { to: '/manager',                label: 'Dashboard',     icon: LayoutDashboard, end: true },
    { to: '/manager/projects',       label: 'Projects',      icon: FolderKanban },
    { to: '/manager/tasks',          label: 'Tasks',         icon: CheckSquare },
    { to: '/manager/team',           label: 'My Team',       icon: UserCheck },
    { to: '/manager/attendance',     label: 'Attendance',    icon: Clock },
    { to: '/manager/meetings',       label: 'Meetings',       icon: Video },
    { to: '/manager/notifications',  label: 'Notifications',  icon: Bell },
    { to: '/manager/daily-reports',  label: 'Daily Reports',  icon: ClipboardList },
  ],
  employee: [
    { to: '/employee',            label: 'Dashboard',  icon: LayoutDashboard, end: true },
    { to: '/employee/tasks',      label: 'My Tasks',   icon: CheckSquare, taskBadge: true },
    { to: '/employee/projects',   label: 'Projects',   icon: FolderKanban },
    { to: '/employee/attendance',    label: 'Attendance',     icon: Clock },
    { to: '/employee/meetings',      label: 'Meetings',       icon: Video },
    { to: '/employee/daily-report',  label: 'Daily Report',   icon: ClipboardList },
  ],
}

const ROLE_COLOR = {
  admin:    'bg-brand-600/20 text-brand-300 border-brand-500/30',
  manager:  'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
  employee: 'bg-amber-600/20 text-amber-300 border-amber-500/30',
}

// Storage key for tracking which task IDs the employee has already "seen"
const SEEN_KEY = 'employee_seen_task_ids'

function getSeenIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function saveSeenIds(ids) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Task badge state — only used for employees
  const [newTaskCount, setNewTaskCount]   = useState(0)   // total unseen
  const [hasUrgent,    setHasUrgent]      = useState(false) // any unseen critical/high

  const isEmployee = user?.role === 'employee'
  const onTasksPage = location.pathname === '/employee/tasks'

  // Poll for new tasks every 60 seconds (lightweight — just the list, no stats)
  const checkNewTasks = useCallback(async () => {
    if (!isEmployee) return
    try {
      const { data } = await api.get('/tasks')
      const tasks = data.data ?? []
      const seen = getSeenIds()

      const unseen = tasks.filter(t => !seen.has(t._id))
      const urgentUnseen = unseen.filter(
        t => t.priority === 'critical' || t.priority === 'high'
      )

      setNewTaskCount(unseen.length)
      setHasUrgent(urgentUnseen.length > 0)
    } catch {
      // Silently ignore — badge is non-critical UI
    }
  }, [isEmployee])

  useEffect(() => {
    checkNewTasks()
    const interval = setInterval(checkNewTasks, 60_000)
    return () => clearInterval(interval)
  }, [checkNewTasks])

  // When employee navigates TO the tasks page, mark all current tasks as seen
  useEffect(() => {
    if (!isEmployee || !onTasksPage) return
    ;(async () => {
      try {
        const { data } = await api.get('/tasks')
        const tasks = data.data ?? []
        const allIds = new Set(tasks.map(t => t._id))
        saveSeenIds(allIds)
        setNewTaskCount(0)
        setHasUrgent(false)
      } catch {
        // ignore
      }
    })()
  }, [isEmployee, onTasksPage])

  const navItems = NAV[user?.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Badge component rendered next to nav label
  const TaskBadge = () => {
    if (newTaskCount === 0) return null

    if (hasUrgent) {
      return (
        <span
          title="Urgent tasks assigned"
          className="
            ml-auto flex items-center justify-center
            min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold
            bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.7)]
            animate-pulse
          "
        >
          {newTaskCount}
        </span>
      )
    }

    return (
      <span
        title="New tasks assigned"
        className="
          ml-auto flex items-center justify-center
          min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold
          bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.6)]
        "
      >
        {newTaskCount}
      </span>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="">
           <img src='/images/skyup_logo.webp'/>
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <span className={`badge border text-xs mt-0.5 ${ROLE_COLOR[user?.role]}`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 py-2">Menu</p>
        {navItems.map(({ to, label, icon: Icon, end, taskBadge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
          >
            <Icon size={17} />
            <span>{label}</span>
            {/* Show badge only on the My Tasks link for employees */}
            {taskBadge && isEmployee && <TaskBadge />}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-white/5 space-y-0.5">
        <NavLink
          to={`/${user?.role}/profile`}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
        >
          <User size={17} />
          <span>Profile</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="nav-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut size={17} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-surface-50 border-r border-white/5 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex flex-col w-64 bg-surface-50 border-r border-white/5 z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-white/5 bg-surface-50 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="h-5 w-px bg-white/10" />
            <NavLink
              to={`/${user?.role}/profile`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xs">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-300 hidden sm:block">{user?.name}</span>
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}