import { createBrowserRouter, Navigate } from 'react-router';

import AuthLayout from '@/shared/layouts/AuthLayout';
import AppLayout from '@/shared/layouts/AppLayout';
import RootLayout from '@/shared/layouts/RootLayout';
import ProtectedRoute from '@/shared/components/ProtectedRoute';

import Login from '@/features/auth/pages/Login';
import ChangePassword from '@/features/auth/pages/ChangePassword';
import Dashboard from '@/features/dashboard/pages/Index';
import EarlyRegistration from '@/features/admission/pages/early-registration/EarlyRegistrationList';
import EarlyRegistrationDetail from '@/features/admission/pages/early-registration/EarlyRegistrationDetail';
import Enrollment from '@/features/enrollment/pages/Index';
import Students from '@/features/students/pages/Index';
import Profile from '@/features/students/pages/Profile';
import LearnerPortal from '@/features/learner/pages/LearnerPortal';
import Sections from '@/features/sections/pages/Index';
import AuditLogs from '@/features/audit-logs/pages/Index';
import Settings from '@/features/settings/pages/Index';
import DocumentaryRequirements from '@/features/enrollment/pages/DocumentaryRequirements';
import NotFound from '@/shared/components/NotFound';

// Admin Pages
import AdminUsers from '@/features/admin/pages/Users';
import EmailLogs from '@/features/admin/pages/EmailLogs';
import SystemHealth from '@/features/admin/pages/SystemHealth';
import Teachers from '@/features/teachers/pages/Index';

// F2F EARLY REGISTRATION Page
import F2FEarlyRegistration from '@/features/admission/pages/f2f/Index';

import Apply from '@/features/admission/pages/apply/Index';

export const router = createBrowserRouter([
	{
		element: <RootLayout />,
		children: [
			// Public routes
			{
				path: '/apply',
				element: <Apply />,
			},
			{
				path: '/learner',
				element: <LearnerPortal />,
			},
			// Auth routes
			{
				path: '/login',
				element: (
					<AuthLayout>
						<Login />
					</AuthLayout>
				),
			},
			{
				path: '/change-password',
				element: <ChangePassword />,
			},

			// Protected routes for Registrar and System Admin
			{
				element: (
					<ProtectedRoute allowedRoles={['REGISTRAR', 'SYSTEM_ADMIN']} />
				),
				children: [
					{
						path: '/dashboard',
						element: (
							<AppLayout>
								<Dashboard />
							</AppLayout>
						),
					},
					{
						path: '/f2f-early-registration',
						element: (
							<AppLayout>
								<F2FEarlyRegistration />
							</AppLayout>
						),
					},
					{
						path: '/applications',
						element: (
							<Navigate
								to='/applications/early-registration'
								replace
							/>
						),
					},
					{
						path: '/applications/early-registration',
						element: (
							<AppLayout>
								<EarlyRegistration />
							</AppLayout>
						),
					},
					{
						path: '/applications/admission/:id',
						element: (
							<AppLayout>
								<EarlyRegistrationDetail />
							</AppLayout>
						),
					},
					{
						path: '/applications/enrollment',
						element: (
							<AppLayout>
								<Enrollment />
							</AppLayout>
						),
					},
					{
						path: '/students',
						element: (
							<AppLayout>
								<Students />
							</AppLayout>
						),
					},
					{
						path: '/students/:id',
						element: (
							<AppLayout>
								<Profile />
							</AppLayout>
						),
					},
					{
						path: '/sections',
						element: (
							<AppLayout>
								<Sections />
							</AppLayout>
						),
					},
					{
						path: '/enrollment/requirements',
						element: (
							<AppLayout>
								<DocumentaryRequirements />
							</AppLayout>
						),
					},
					{
						path: '/audit-logs',
						element: (
							<AppLayout>
								<AuditLogs />
							</AppLayout>
						),
					},
					{
						path: '/settings',
						element: (
							<AppLayout>
								<Settings />
							</AppLayout>
						),
					},
				],
			},

			// Protected routes for System Admin Only
			{
				element: <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />,
				children: [
					{
						path: '/teachers',
						element: (
							<AppLayout>
								<Teachers />
							</AppLayout>
						),
					},
					{
						path: '/admin/users',
						element: (
							<AppLayout>
								<AdminUsers />
							</AppLayout>
						),
					},
					{
						path: '/admin/email-logs',
						element: (
							<AppLayout>
								<EmailLogs />
							</AppLayout>
						),
					},
					{
						path: '/admin/system',
						element: (
							<AppLayout>
								<SystemHealth />
							</AppLayout>
						),
					},
				],
			},

			// Default redirect
			{
				path: '/',
				element: (
					<Navigate
						to='/dashboard'
						replace
					/>
				),
			},

			// Fallback
			{ path: '*', element: <NotFound /> },
		],
	},
]);
