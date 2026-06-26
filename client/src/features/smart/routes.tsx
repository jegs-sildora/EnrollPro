// @ts-nocheck
import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { Navigate } from 'react-router';

// Layouts are eagerly imported
import TeacherLayout from './layouts/TeacherLayout';
import RegistrarLayout from './layouts/RegistrarLayout';
import AdminLayout from './layouts/AdminLayout';

// Direct redirector
import { SMARTRedirector } from './components/SMARTRedirector';

// Teacher pages
const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard'));
const ClassRecordsList = lazy(() => import('./pages/teacher/ClassRecordsList'));
const ClassRecordView = lazy(() => import('./pages/teacher/ClassRecordView'));
const MyAdvisory = lazy(() => import('./pages/teacher/MyAdvisory'));
const StudentGradeProfile = lazy(() => import('./pages/teacher/StudentGradeProfile'));
const Attendance = lazy(() => import('./pages/teacher/Attendance'));
const AttendanceReports = lazy(() => import('./pages/teacher/AttendanceReports'));

// Registrar pages
const RegistrarDashboard = lazy(() => import('./pages/registrar/Dashboard'));
const StudentRecords = lazy(() => import('./pages/registrar/StudentRecords'));
const SchoolForms = lazy(() => import('./pages/registrar/SchoolForms'));
const ApplicationTracker = lazy(() => import('./pages/registrar/ApplicationTracker'));
const BOSYQueue = lazy(() => import('./pages/registrar/BOSYQueue'));
const RemedialTracker = lazy(() => import('./pages/registrar/RemedialTracker'));
const SectionRosterViewer = lazy(() => import('./pages/registrar/SectionRosterViewer'));
const EOSYFinalization = lazy(() => import('./pages/registrar/EOSYFinalization'));
const TeachingLoad = lazy(() => import('./pages/registrar/TeachingLoad'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const GradingConfig = lazy(() => import('./pages/admin/GradingConfig'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));
const TemplateManager = lazy(() => import('./pages/admin/TemplateManager'));
const ECRTemplateManager = lazy(() => import('./pages/admin/ECRTemplateManager'));
const ClassAssignments = lazy(() => import('./pages/admin/ClassAssignments'));
const SystemHealth = lazy(() => import('./pages/admin/SystemHealth'));

export const smartRoutes: RouteObject[] = [
  // Redirect root and login routes to the SSO redirector
  {
    path: "",
    element: <SMARTRedirector />,
  },
  {
    path: "login",
    element: <SMARTRedirector />,
  },
  {
    path: "login/admin",
    element: <Navigate to="/smart/admin" replace />,
  },
  {
    path: "login/registrar",
    element: <Navigate to="/smart/registrar" replace />,
  },
  
  // Teacher routes
  {
    path: "teacher",
    element: <TeacherLayout />,
    children: [
      { index: true, element: <TeacherDashboard /> },
      { path: "classes", element: <ClassRecordsList /> },
      { path: "records", element: <ClassRecordsList /> },
      { path: "records/:classAssignmentId", element: <ClassRecordView /> },
      { path: "advisory", element: <MyAdvisory /> },
      { path: "advisory/student/:studentId", element: <StudentGradeProfile /> },
      { path: "attendance", element: <Attendance /> },
      { path: "attendance-reports", element: <AttendanceReports /> },
    ],
  },
  
  // Registrar routes
  {
    path: "registrar",
    element: <RegistrarLayout />,
    children: [
      { index: true, element: <RegistrarDashboard /> },
      { path: "students", element: <StudentRecords /> },
      { path: "forms", element: <SchoolForms /> },
      { path: "applications", element: <ApplicationTracker /> },
      { path: "bosy", element: <BOSYQueue /> },
      { path: "remedial", element: <RemedialTracker /> },
      { path: "roster", element: <SectionRosterViewer /> },
      { path: "eosy", element: <EOSYFinalization /> },
      { path: "teaching-load", element: <TeachingLoad /> },
    ],
  },

  // Admin routes
  {
    path: "admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: "users", element: <UserManagement /> },
      { path: "logs", element: <AuditLogs /> },
      { path: "grading", element: <GradingConfig /> },
      { path: "settings", element: <SystemSettings /> },
      { path: "health", element: <SystemHealth /> },
      { path: "templates", element: <TemplateManager /> },
      { path: "ecr-templates", element: <ECRTemplateManager /> },
      { path: "assignments", element: <ClassAssignments /> },
    ],
  },
  
  // Fallback redirect
  {
    path: "*",
    element: <SMARTRedirector />,
  },
];
