import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardLayout from "./components/layout/DashboardLayout";
import Login from "./pages/Login";
import WorkflowDashboard from "./pages/admin/WorkflowDashboard";
import MyTasksEnhanced from "./pages/employee/MyTasksEnhanced";

// Shared
import CreateProject from "./pages/shared/CreateProject";
import ProjectDetail from "./pages/shared/ProjectDetail";

// Admin
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminProjects from "./pages/admin/Projects";
import AdminTasks from "./pages/admin/Tasks";
import AdminAttendance from "./pages/admin/Attendance";
import AdminNotifications from "./pages/admin/Notifications";
import ProjectExcelDashboard from "./pages/shared/ProjectExcelDashboard";
import Clients from "./pages/admin/Clients";
import TaskTemplates from "./pages/admin/TaskTemplates";
import TrackerDashboard from "./pages/admin/TrackerDashboard";

// ── NEW: Smart project creator + workload dashboard ──────────────────────────
// import CreateProjectWithTasks from './pages/admin/CreateProjectWithTasks'
import WorkloadDashboard from "./pages/admin/Workloaddashboard";

// ── NEW: Employee task dashboard with schedule view ──────────────────────────
import EmployeeTaskDashboard from "./pages/employee/Employeetaskdashboard";

// Manager
import ManagerDashboard from "./pages/manager/Dashboard";
import ManagerProjects from "./pages/manager/Projects";
import ManagerTasks from "./pages/manager/Tasks";
import ManagerTeam from "./pages/manager/Team";
import ManagerAttendance from "./pages/manager/ManagerAttendance";
import ManagerNotifications from "./pages/manager/Notifications";

// Employee
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeProjects from "./pages/employee/Projects";
import EmployeeAttendance from "./pages/employee/Attendance";
import EmployeeDailyReport from "./pages/employee/Dailyreport";

// Meetings
import AdminMeetings from "./pages/admin/AdminMeetings";
import ManagerMeetings from "./pages/manager/ManagerMeeting";
import EmployeeMeetings from "./pages/employee/EmployeeMeetings";

// Daily Reports
import AdminDailyReports from "./pages/admin/Admindailyreports";
import ManagerDailyReports from "./pages/manager/Managerdailyreports";

import Profile from "./pages/Profile";

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to={`/${user.role}`} replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to={`/${user.role}`} replace />;
  return children;
};

const FullPageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const RoleRedirect = () => {
  const { user } = useAuth();
  return user ? (
    <Navigate to={`/${user.role}`} replace />
  ) : (
    <Navigate to="/login" replace />
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route path="/" element={<RoleRedirect />} />

        {/* ── Admin ── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="projects/create" element={<CreateProject />} />
          <Route
            path="projects/edit/:id"
            element={<CreateProject editMode />}
          />
          <Route
            path="projects/:id/tasks"
            element={<ProjectExcelDashboard />}
          />
          {/* ── NEW: Smart project creator with task generation ── */}
          {/* <Route path="projects/create-smart" element={<CreateProjectWithTasks />} /> */}
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="tasks" element={<AdminTasks />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="meetings" element={<AdminMeetings />} />
          <Route path="Clients" element={<Clients />} />
          <Route path="task-templates" element={<TaskTemplates />} />

          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="daily-reports" element={<AdminDailyReports />} />
          <Route path="profile" element={<Profile />} />
          {/* Existing workflow dashboard */}
          <Route path="workflow" element={<WorkflowDashboard />} />
          {/* ── NEW: Workload distribution dashboard ── */}
          <Route path="workload" element={<WorkloadDashboard />} />

          <Route path="tracker" element={<TrackerDashboard />} />
        </Route>

        {/* ── Manager ── */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute roles={["manager"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ManagerDashboard />} />
          <Route path="projects" element={<ManagerProjects />} />
          <Route path="projects/create" element={<CreateProject />} />
          <Route
            path="projects/edit/:id"
            element={<CreateProject editMode />}
          />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="tasks" element={<ManagerTasks />} />
          <Route path="team" element={<ManagerTeam />} />
          <Route path="attendance" element={<ManagerAttendance />} />
          <Route path="meetings" element={<ManagerMeetings />} />
          <Route path="notifications" element={<ManagerNotifications />} />
          <Route path="daily-reports" element={<ManagerDailyReports />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* ── Employee ── */}
        <Route
          path="/employee"
          element={
            <ProtectedRoute roles={["employee"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<EmployeeDashboard />} />
          {/* Existing enhanced tasks page */}
          <Route path="my-tasks" element={<MyTasksEnhanced />} />
          {/* ── NEW: Smart task dashboard with daily schedule + capacity ── */}
          <Route path="task-dashboard" element={<EmployeeTaskDashboard />} />
          <Route path="projects" element={<EmployeeProjects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="attendance" element={<EmployeeAttendance />} />
          <Route path="meetings" element={<EmployeeMeetings />} />
          <Route path="daily-report" element={<EmployeeDailyReport />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}