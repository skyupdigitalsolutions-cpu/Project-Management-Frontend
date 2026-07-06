import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, FolderKanban, MonitorSmartphone, CheckSquare, Clock,
  Bell, LogOut, Menu, X, User, UserCheck, Video, ClipboardList,
  GitBranch, ChevronLeft, ChevronRight, LayoutTemplate, MessageCircle
} from 'lucide-react'
import NotificationBell from '../common/NotificationBell'
import EmailComposer from '../common/EmailComposer'
import api from '../../api/axios'

const NAV = {
  admin: [
    { to: '/admin',               label: 'Dashboard',          icon: LayoutDashboard, end: true },
    { to: '/admin/users',         label: 'Users',              icon: Users },
    { to: '/admin/projects',      label: 'Projects',           icon: FolderKanban },
    { to: '/admin/task-templates', label: 'Task Templates',    icon: LayoutTemplate },
    { to: '/admin/tasks',         label: 'Tasks',              icon: CheckSquare },
    { to: '/admin/clients',       label: 'Clients',           icon: Users },
    { to: '/admin/attendance',    label: 'Attendance',         icon: Clock },
    { to: '/admin/meetings',      label: 'Meetings',           icon: Video },
    { to: '/admin/notifications', label: 'Notifications',      icon: Bell },
    { to: '/admin/daily-reports', label: 'Daily Reports',      icon: ClipboardList },
    { to: '/admin/workflow',      label: 'Workflow Dashboard', icon: GitBranch },
    { to: '/admin/tracker',       label: 'Productivity',       icon: MonitorSmartphone },
  ],
  manager: [
    { to: '/manager',                label: 'Dashboard',     icon: LayoutDashboard, end: true },
    { to: '/manager/projects',       label: 'Projects',      icon: FolderKanban },
    { to: '/manager/tasks',          label: 'Tasks',         icon: CheckSquare },
    { to: '/manager/team',           label: 'My Team',       icon: UserCheck },
    { to: '/manager/attendance',     label: 'Attendance',    icon: Clock },
    { to: '/manager/meetings',       label: 'Meetings',      icon: Video },
    { to: '/manager/notifications',  label: 'Notifications', icon: Bell },
    { to: '/manager/daily-reports',  label: 'Daily Reports', icon: ClipboardList },
  ],
  employee: [
    { to: '/employee',               label: 'Dashboard',    icon: LayoutDashboard, end: true },
    { to: '/employee/my-tasks',      label: 'My Tasks',     icon: CheckSquare, taskBadge: true },
    { to: '/employee/projects',      label: 'Projects',     icon: FolderKanban },
    { to: '/employee/attendance',    label: 'Attendance',   icon: Clock },
    { to: '/employee/meetings',      label: 'Meetings',     icon: Video },
    { to: '/employee/daily-report',  label: 'Daily Report', icon: ClipboardList },
    { to: '/employee/team-chat',     label: 'Team Chat',    icon: MessageCircle },
  ],
}

const ROLE_BADGE = {
  admin:    'bg-purple-100 text-primary',
  manager:  'bg-green-100 text-green-600',
  employee: 'bg-yellow-100 text-yellow-600',
}

const SEEN_KEY = 'employee_seen_task_ids'
function getSeenIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set() }
}
function saveSeenIds(ids) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [newTaskCount, setNewTaskCount] = useState(0)
  const [hasUrgent, setHasUrgent] = useState(false)

  const isEmployee  = user?.role === 'employee'
  const isAdmin     = user?.role === 'admin'
  const isManager   = user?.role === 'manager'
  const onTasksPage = location.pathname === '/employee/my-tasks'

  const checkNewTasks = useCallback(async () => {
    if (!isEmployee) return
    try {
      const { data } = await api.get('/tasks')
      const tasks = data.data ?? []
      const seen  = getSeenIds()
      const unseen       = tasks.filter(t => !seen.has(t._id))
      const urgentUnseen = unseen.filter(t => t.priority === 'critical' || t.priority === 'high')
      setNewTaskCount(unseen.length)
      setHasUrgent(urgentUnseen.length > 0)
    } catch {}
  }, [isEmployee])

  useEffect(() => {
    checkNewTasks()
    const interval = setInterval(checkNewTasks, 60_000)
    return () => clearInterval(interval)
  }, [checkNewTasks])

  useEffect(() => {
    if (!isEmployee || !onTasksPage) return
    ;(async () => {
      try {
        const { data } = await api.get('/tasks')
        const tasks  = data.data ?? []
        const allIds = new Set(tasks.map(t => t._id))
        saveSeenIds(allIds)
        setNewTaskCount(0)
        setHasUrgent(false)
      } catch {}
    })()
  }, [isEmployee, onTasksPage])

  const navItems = NAV[user?.role] || []
  const handleLogout = () => { logout(); navigate('/login') }

  const TaskBadge = () => {
    if (newTaskCount === 0) return null
    return (
      <span className={`ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-gray-800 shadow-sm ${hasUrgent ? 'bg-danger animate-pulse' : 'bg-success'}`}>
        {newTaskCount}
      </span>
    )
  }

  const SidebarContent = ({ isCollapsed }) => (
    <div className="flex flex-col h-full font-poppins">
      {/* Logo */}
      {/* Logo */}
<div className={`flex items-center border-b border-gray-100 ${isCollapsed ? 'p-6 justify-center' : 'p-6 gap-3'}`}>
  {isCollapsed
    ? <img
        src='/images/skyup_logo1.svg'
        alt="Logo"
        className="w-15 h-8 object-contain"
      />
    : <img
        src='/images/skyup_logo.webp'
        alt="Logo"
        className="h-8 object-contain"
      />
  }
</div>

      {/* User info */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-gray-800 truncate">{user?.name}</p>
              <span className={`badge text-[16px] mt-0.5 ${ROLE_BADGE[user?.role]}`}>{user?.role}</span>
            </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="flex justify-center py-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {!isCollapsed && (
          <p className="text-[16px] font-semibold text-gray-400 uppercase tracking-widest px-3 py-2">Menu</p>
        )}
        {navItems.map(({ to, label, icon: Icon, end, taskBadge }) => (
          <NavLink
            key={to} to={to} end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
            title={isCollapsed ? label : undefined}
          >
            <Icon size={17} className="flex-shrink-0" />
            {!isCollapsed && <span>{label}</span>}
            {!isCollapsed && taskBadge && isEmployee && <TaskBadge />}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-100 space-y-0.5">
        <NavLink
          to={`/${user?.role}/profile`}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
          title={isCollapsed ? 'Profile' : undefined}
        >
          <User size={17} className="flex-shrink-0" />
          {!isCollapsed && <span>Profile</span>}
        </NavLink>
        <button
          onClick={handleLogout}
          className="nav-link w-full text-danger hover:text-red-700 hover:bg-red-50"
          title={isCollapsed ? 'Sign out' : undefined}
        >
          <LogOut size={17} className="flex-shrink-0" />
          {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-poppins">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-gray-200 flex-shrink-0 shadow-sm transition-all duration-300 relative ${collapsed ? 'w-16' : 'w-60'}`}>
        <SidebarContent isCollapsed={collapsed} />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-neutral hover:text-primary hover:border-primary transition-all duration-200 shadow-sm z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-white border-r border-gray-200 z-10 shadow-xl">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-neutral hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
              <X size={20} />
            </button>
            <SidebarContent isCollapsed={false} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header/Navbar */}
        <header className="h-18 lg:py-3 flex items-center justify-between px-4 lg:px-6 border-b border-gray-200 bg-white flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-neutral hover:text-primary p-1.5 rounded-lg hover:bg-purple-50 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="hidden lg:block" />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {(isAdmin || isManager) && <EmailComposer />}
            <NotificationBell />
            <div className="h-5 w-px bg-gray-200" />
            <NavLink
              to={`/${user?.role}/profile`}
              className="flex items-center gap-2 px-1.5 sm:px-3 py-1.5 rounded-xl hover:bg-purple-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[16px] shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[16px] font-semibold text-gray-700 leading-none">{user?.name}</p>
                <p className="text-[16px] text-neutral mt-0.5 capitalize">{user?.role}</p>
              </div>
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}