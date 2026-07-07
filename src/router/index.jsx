import React, { Suspense, lazy } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { useAuthStore } from '../store/authStore'
import { Spinner } from '../components/ui/Spinner'
import { NotFound } from '../pages/NotFound'

// Eager imports for auth
import { Login } from '../pages/auth/Login'
import { Register } from '../pages/auth/Register'
import { ForgotPassword } from '../pages/auth/ForgotPassword'
import { ResetPassword } from '../pages/auth/ResetPassword'

// Lazy loaded pages
const Settings = lazy(() => import('../pages/company/Settings').then(m => ({ default: m.Settings })))
const Branches = lazy(() => import('../pages/company/Branches').then(m => ({ default: m.Branches })))
const Users = lazy(() => import('../pages/company/Users').then(m => ({ default: m.Users })))
const Roles = lazy(() => import('../pages/company/Roles').then(m => ({ default: m.Roles })))

const Overview = lazy(() => import('../pages/dashboard/Overview').then(m => ({ default: m.Overview })))
const SalesDashboard = lazy(() => import('../pages/sales/SalesDashboard').then(m => ({ default: m.SalesDashboard })))
const Pipeline = lazy(() => import('../pages/sales/Pipeline').then(m => ({ default: m.Pipeline })))
const Leads = lazy(() => import('../pages/sales/Leads').then(m => ({ default: m.Leads })))
const Clients = lazy(() => import('../pages/sales/Clients').then(m => ({ default: m.Clients })))
const ClientProfile = lazy(() => import('../pages/sales/ClientProfile').then(m => ({ default: m.ClientProfile })))
const Quotations = lazy(() => import('../pages/sales/Quotations').then(m => ({ default: m.Quotations })))
const QuotationForm = lazy(() => import('../pages/sales/QuotationForm').then(m => ({ default: m.QuotationForm })))
const Invoices = lazy(() => import('../pages/sales/Invoices').then(m => ({ default: m.Invoices })))
const InvoiceForm = lazy(() => import('../pages/sales/InvoiceForm').then(m => ({ default: m.InvoiceForm })))
const Commissions = lazy(() => import('../pages/sales/Commissions').then(m => ({ default: m.Commissions })))

const Directory = lazy(() => import('../pages/employees/Directory').then(m => ({ default: m.Directory })))
const Profile = lazy(() => import('../pages/employees/Profile').then(m => ({ default: m.Profile })))

const Departments = lazy(() => import('../pages/operations/Departments').then(m => ({ default: m.Departments })))
const Projects = lazy(() => import('../pages/operations/Projects').then(m => ({ default: m.Projects })))
const ProjectDetail = lazy(() => import('../pages/operations/ProjectDetail').then(m => ({ default: m.ProjectDetail })))
const Tasks = lazy(() => import('../pages/operations/Tasks').then(m => ({ default: m.Tasks })))
const Approvals = lazy(() => import('../pages/operations/Approvals').then(m => ({ default: m.Approvals })))
const SOPs = lazy(() => import('../pages/operations/SOPs').then(m => ({ default: m.SOPs })))
const Calendar = lazy(() => import('../pages/operations/Calendar').then(m => ({ default: m.Calendar })))

const Leave = lazy(() => import('../pages/hr/Leave').then(m => ({ default: m.Leave })))
const Attendance = lazy(() => import('../pages/hr/Attendance').then(m => ({ default: m.Attendance })))
const DailyActivity = lazy(() => import('../pages/hr/DailyActivity').then(m => ({ default: m.DailyActivity })))
const Announcements = lazy(() => import('../pages/hr/Announcements').then(m => ({ default: m.Announcements })))



const SalesAnalytics = lazy(() => import('../pages/reports/SalesAnalytics').then(m => ({ default: m.SalesAnalytics })))
const PerformanceAnalytics = lazy(() => import('../pages/reports/PerformanceAnalytics').then(m => ({ default: m.PerformanceAnalytics })))
const OperationsAnalytics = lazy(() => import('../pages/reports/OperationsAnalytics').then(m => ({ default: m.OperationsAnalytics })))
const ExportCenter = lazy(() => import('../pages/reports/ExportCenter').then(m => ({ default: m.ExportCenter })))

const Messages = lazy(() => import('../pages/messages/Messages').then(m => ({ default: m.Messages })))


function ProtectedRoute({ children }) {
  const { user } = useAuthStore()
  if (!user) {
    return <Navigate to="/auth/login" replace />
  }
  return children ? children : <Outlet />
}

function SuspenseWrapper({ children }) {
  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center p-12"><Spinner /></div>}>
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/auth/login" replace />,
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
    ],
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: 'overview', element: <SuspenseWrapper><Overview /></SuspenseWrapper> },

      // Sales
      { path: 'sales', element: <SuspenseWrapper><SalesDashboard /></SuspenseWrapper> },
      { path: 'sales/pipeline', element: <SuspenseWrapper><Pipeline /></SuspenseWrapper> },
      { path: 'sales/leads', element: <SuspenseWrapper><Leads /></SuspenseWrapper> },
      { path: 'sales/clients', element: <SuspenseWrapper><Clients /></SuspenseWrapper> },
      { path: 'sales/clients/:id', element: <SuspenseWrapper><ClientProfile /></SuspenseWrapper> },
      { path: 'sales/quotations', element: <SuspenseWrapper><Quotations /></SuspenseWrapper> },
      { path: 'sales/quotations/new', element: <SuspenseWrapper><QuotationForm /></SuspenseWrapper> },
      { path: 'sales/quotations/:id', element: <SuspenseWrapper><QuotationForm /></SuspenseWrapper> },
      { path: 'sales/invoices', element: <SuspenseWrapper><Invoices /></SuspenseWrapper> },
      { path: 'sales/invoices/new', element: <SuspenseWrapper><InvoiceForm /></SuspenseWrapper> },
      { path: 'sales/invoices/:id', element: <SuspenseWrapper><InvoiceForm /></SuspenseWrapper> },
      { path: 'sales/commissions', element: <SuspenseWrapper><Commissions /></SuspenseWrapper> },

      // People / Employees
      { path: 'employees', element: <SuspenseWrapper><Directory /></SuspenseWrapper> },
      { path: 'employees/:id', element: <SuspenseWrapper><Profile /></SuspenseWrapper> },

      // Operations
      { path: 'operations/departments', element: <SuspenseWrapper><Departments /></SuspenseWrapper> },
      { path: 'operations/projects', element: <SuspenseWrapper><Projects /></SuspenseWrapper> },
      { path: 'operations/projects/:id', element: <SuspenseWrapper><ProjectDetail /></SuspenseWrapper> },
      { path: 'operations/tasks', element: <SuspenseWrapper><Tasks /></SuspenseWrapper> },
      { path: 'operations/approvals', element: <SuspenseWrapper><Approvals /></SuspenseWrapper> },
      { path: 'operations/sops', element: <SuspenseWrapper><SOPs /></SuspenseWrapper> },
      { path: 'operations/calendar', element: <SuspenseWrapper><Calendar /></SuspenseWrapper> },

      // HR
      { path: 'hr/leave', element: <SuspenseWrapper><Leave /></SuspenseWrapper> },
      { path: 'hr/attendance', element: <SuspenseWrapper><Attendance /></SuspenseWrapper> },
      { path: 'hr/activity', element: <SuspenseWrapper><DailyActivity /></SuspenseWrapper> },
      { path: 'hr/announcements', element: <SuspenseWrapper><Announcements /></SuspenseWrapper> },



      // Analytics / Reports
      { path: 'reports/sales', element: <SuspenseWrapper><SalesAnalytics /></SuspenseWrapper> },
      { path: 'reports/performance', element: <SuspenseWrapper><PerformanceAnalytics /></SuspenseWrapper> },
      { path: 'reports/operations', element: <SuspenseWrapper><OperationsAnalytics /></SuspenseWrapper> },
      { path: 'reports/export', element: <SuspenseWrapper><ExportCenter /></SuspenseWrapper> },

      // Communications
      { path: 'messages', element: <SuspenseWrapper><Messages /></SuspenseWrapper> },

      // Company Settings
      { path: 'company/settings', element: <SuspenseWrapper><Settings /></SuspenseWrapper> },
      { path: 'company/branches', element: <SuspenseWrapper><Branches /></SuspenseWrapper> },
      { path: 'company/users', element: <SuspenseWrapper><Users /></SuspenseWrapper> },
      { path: 'company/roles', element: <SuspenseWrapper><Roles /></SuspenseWrapper> },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  }
])
