import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { auditLog } from '../audit-logs/audit-logs.service.js';

function getUniqueConstraintFields(error: unknown): string[] {
	if (!error || typeof error !== 'object') return [];

	const prismaError = error as {
		code?: string;
		meta?: { target?: unknown };
	};

	if (prismaError.code !== 'P2002') return [];

	const target = prismaError.meta?.target;
	if (Array.isArray(target)) return target.map((field) => String(field));
	if (typeof target === 'string') return [target];

	return [];
}

export async function index(req: Request, res: Response) {
	try {
		const {
			role,
			isActive,
			search,
			sortBy = 'createdAt',
			sortOrder = 'desc',
			page = '1',
			limit = '20',
			gradeLevelId,
			sectionId,
			learnerStatus,
			tab, // Support explicit tab parameter
		} = req.query;

		const pageNumber = Math.max(1, parseInt(String(page), 10) || 1);
		const pageSize = Math.min(
			100,
			Math.max(1, parseInt(String(limit), 10) || 20),
		);
		const skip = (pageNumber - 1) * pageSize;

		const normalizedSearch = String(search ?? '').trim();
		const safeSortOrder = String(sortOrder) === 'asc' ? 'asc' : 'desc';
		
		// Priority 1: Check if we are explicitly in Learner Mode
		const isLearnerMode = String(role).toUpperCase() === 'LEARNER' || tab === 'learners';

		if (isLearnerMode) {
			const learnerWhere: any = {};
			
			if (learnerStatus && learnerStatus !== 'all') {
				learnerWhere.status = learnerStatus;
			}

			if (gradeLevelId && gradeLevelId !== 'all') {
				learnerWhere.enrollmentApplications = {
					some: { gradeLevelId: parseInt(String(gradeLevelId), 10) }
				};
			}

			if (sectionId && sectionId !== 'all') {
				learnerWhere.enrollmentApplications = {
					some: { enrollmentRecord: { sectionId: parseInt(String(sectionId), 10) } }
				};
			}

			if (normalizedSearch) {
				learnerWhere.OR = [
					{ firstName: { contains: normalizedSearch, mode: 'insensitive' } },
					{ lastName: { contains: normalizedSearch, mode: 'insensitive' } },
					{ lrn: { contains: normalizedSearch, mode: 'insensitive' } },
				];
			}

			const [learners, total] = await Promise.all([
				prisma.learner.findMany({
					where: learnerWhere,
					include: {
						user: {
							select: {
								id: true,
								email: true,
								isActive: true,
								lastLoginAt: true,
							}
						},
						enrollmentApplications: {
							take: 1,
							orderBy: { createdAt: 'desc' },
							include: {
								gradeLevel: true,
								enrollmentRecord: {
									include: { section: true }
								}
							}
						}
					},
					orderBy: { 
						lastName: safeSortOrder 
					},
					skip,
					take: pageSize,
				}),
				prisma.learner.count({ where: learnerWhere }),
			]);

			// Map Learners to a User-compatible structure for the frontend
			const mappedUsers = learners.map(l => {
				const currentApp = l.enrollmentApplications?.[0];
				return {
					id: l.user?.id || -(l.id),
					firstName: l.firstName,
					lastName: l.lastName,
					middleName: l.middleName || null,
					suffix: l.extensionName || null,
					sex: l.sex,
					email: l.user?.email || `(No Portal Account)`,
					role: 'LEARNER',
					isActive: l.user?.isActive ?? false,
					lastLoginAt: l.user?.lastLoginAt || null,
					createdAt: l.createdAt.toISOString(),
					learnerProfile: {
						lrn: l.lrn,
						status: l.status,
						enrollmentApplications: l.enrollmentApplications.map(app => ({
							gradeLevel: app.gradeLevel,
							enrollmentRecord: app.enrollmentRecord,
							portalPin: app.portalPin, // EXPOSE PORTAL PIN
							isPinPersonalized: !!app.portalPinChangedAt // Add this
						}))
					}
				};
			});

			return res.json({
				users: mappedUsers,
				total,
				page: pageNumber,
				limit: pageSize,
				totalPages: Math.max(1, Math.ceil(total / pageSize)),
				sortBy: 'lastName',
				sortOrder: safeSortOrder,
			});
		}

		// Staff Mode: Query User table primarily
		const allowedSortFields = new Set([
			'lastName',
			'designation',
			'email',
			'role',
			'isActive',
			'lastLoginAt',
			'createdAt',
		]);
		const safeSortBy = allowedSortFields.has(String(sortBy))
			? String(sortBy)
			: 'createdAt';

		const where: any = {};
		if (role && role !== 'all') {
			const requestedRole = String(role).toUpperCase();
			if (requestedRole === 'TEACHER') {
				where.role = { in: ['TEACHER', 'CLASS_ADVISER'] };
			} else {
				where.role = requestedRole;
			}
		} else {
			// Exclude learners when fetching "all staff"
			where.role = { not: 'LEARNER' };
		}
		
		if (isActive !== undefined) where.isActive = String(isActive) === 'true';

		if (normalizedSearch) {
			where.OR = [
				{ firstName: { contains: normalizedSearch, mode: 'insensitive' } },
				{ lastName: { contains: normalizedSearch, mode: 'insensitive' } },
				{ email: { contains: normalizedSearch, mode: 'insensitive' } },
				{ employeeId: { contains: normalizedSearch, mode: 'insensitive' } },
				{ designation: { contains: normalizedSearch, mode: 'insensitive' } },
				{ mobileNumber: { contains: normalizedSearch, mode: 'insensitive' } },
			];
		}

		const [users, total] = await Promise.all([
			prisma.user.findMany({
				where,
				select: {
					id: true,
					firstName: true,
					lastName: true,
					middleName: true,
					suffix: true,
					sex: true,
					employeeId: true,
					designation: true,
					mobileNumber: true,
					email: true,
					role: true,
					isActive: true,
					lastLoginAt: true,
					createdAt: true,
					createdBy: { select: { firstName: true, lastName: true } },
				},
				orderBy: { [safeSortBy]: safeSortOrder },
				skip,
				take: pageSize,
			}),
			prisma.user.count({ where }),
		]);

		res.json({
			users,
			total,
			page: pageNumber,
			limit: pageSize,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
			sortBy: safeSortBy,
			sortOrder: safeSortOrder,
		});
	} catch (error: any) {
		res.status(500).json({ message: error.message });
	}
}

export async function store(req: Request, res: Response) {
	try {
		const {
			firstName,
			lastName,
			middleName,
			suffix,
			sex,
			employeeId,
			designation,
			mobileNumber,
			email,
			password,
			role,
			mustChangePassword = true,
		} = req.body;

		const hashed = await bcrypt.hash(password, 12);

		const user = await prisma.user.create({
			data: {
				firstName,
				lastName,
				middleName,
				suffix,
				sex,
				employeeId,
				designation,
				mobileNumber,
				email,
				password: hashed,
				role,
				mustChangePassword,
				createdById: req.user!.userId,
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				role: true,
				isActive: true,
				mustChangePassword: true,
			},
		});

		await auditLog({
			userId: req.user!.userId,
			actionType: 'ADMIN_USER_CREATED',
			description: `Admin created account: ${lastName}, ${firstName} (${role})`,
			subjectType: 'User',
			recordId: user.id,
			req,
		});

		res.status(201).json(user);
	} catch (error: any) {
		const uniqueFields = getUniqueConstraintFields(error);
		if (uniqueFields.some((field) => field.toLowerCase().includes('email'))) {
			return res.status(409).json({
				message: 'Email address is already in use by another account.',
				field: 'email',
				code: 'DUPLICATE_EMAIL',
			});
		}

		res.status(500).json({ message: error.message });
	}
}

export async function update(req: Request, res: Response) {
	try {
		const {
			firstName,
			lastName,
			middleName,
			suffix,
			sex,
			employeeId,
			designation,
			mobileNumber,
			email,
			role,
		} = req.body;
		const userId = parseInt(String(req.params.id));

		const targetUser = await prisma.user.findUnique({ where: { id: userId } });
		if (!targetUser) return res.status(404).json({ message: 'User not found' });

		const user = await prisma.user.update({
			where: { id: userId },
			data: {
				firstName,
				lastName,
				middleName,
				suffix,
				sex,
				employeeId,
				designation,
				mobileNumber,
				email,
				...(role ? { role } : {}),
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				role: true,
				isActive: true,
			},
		});

		await auditLog({
			userId: req.user!.userId,
			actionType: 'ADMIN_USER_UPDATED',
			description: `Admin updated account: ${lastName}, ${firstName}`,
			subjectType: 'User',
			recordId: userId,
			req,
		});

		res.json(user);
	} catch (error: any) {
		const uniqueFields = getUniqueConstraintFields(error);
		if (uniqueFields.some((field) => field.toLowerCase().includes('email'))) {
			return res.status(409).json({
				message: 'Email address is already in use by another account.',
				field: 'email',
				code: 'DUPLICATE_EMAIL',
			});
		}

		res.status(500).json({ message: error.message });
	}
}

export async function deactivate(req: Request, res: Response) {
	try {
		const userId = parseInt(String(req.params.id));

		const targetUser = await prisma.user.findUnique({ where: { id: userId } });
		if (!targetUser) return res.status(404).json({ message: 'User not found' });

		if (targetUser.role === 'SYSTEM_ADMIN') {
			return res.status(400).json({
				message:
					'SYSTEM_ADMIN accounts cannot be deactivated to prevent system lockout.',
			});
		}

		const user = await prisma.user.update({
			where: { id: userId },
			data: { isActive: false },
			select: { id: true, firstName: true, lastName: true, role: true },
		});

		await auditLog({
			userId: req.user!.userId,
			actionType: 'ADMIN_USER_DEACTIVATED',
			description: `Admin deactivated account: ${user.lastName}, ${user.firstName} (${user.role})`,
			subjectType: 'User',
			recordId: userId,
			req,
		});

		res.json(user);
	} catch (error: any) {
		res.status(500).json({ message: error.message });
	}
}

export async function reactivate(req: Request, res: Response) {
	try {
		const userId = parseInt(String(req.params.id));

		const user = await prisma.user.update({
			where: { id: userId },
			data: { isActive: true },
			select: { id: true, firstName: true, lastName: true, role: true },
		});

		await auditLog({
			userId: req.user!.userId,
			actionType: 'ADMIN_USER_REACTIVATED',
			description: `Admin reactivated account: ${user.lastName}, ${user.firstName} (${user.role})`,
			subjectType: 'User',
			recordId: userId,
			req,
		});

		res.json(user);
	} catch (error: any) {
		res.status(500).json({ message: error.message });
	}
}

export async function resetPassword(req: Request, res: Response) {
	try {
		const { newPassword, mustChangePassword = true } = req.body;
		const userId = parseInt(String(req.params.id));

		const hashed = await bcrypt.hash(newPassword, 12);

		const user = await prisma.user.update({
			where: { id: userId },
			data: { password: hashed, mustChangePassword },
			select: { id: true, firstName: true, lastName: true },
		});

		await auditLog({
			userId: req.user!.userId,
			actionType: 'ADMIN_PASSWORD_RESET',
			description: `Admin reset password for: ${user.lastName}, ${user.firstName}`,
			subjectType: 'User',
			recordId: userId,
			req,
		});

		res.json({ message: 'Password reset successfully' });
	} catch (error: any) {
		res.status(500).json({ message: error.message });
	}
}

export async function metrics(_req: Request, res: Response) {
	try {
		const [totalActiveStaff, pendingUnverified, lockedDeactivated] =
			await Promise.all([
				prisma.user.count({
					where: {
						isActive: true,
						role: { not: 'LEARNER' },
					},
				}),
				prisma.user.count({
					where: {
						role: { not: 'LEARNER' },
						OR: [{ mustChangePassword: true }, { lastLoginAt: null }],
					},
				}),
				prisma.user.count({
					where: {
						isActive: false,
						role: { not: 'LEARNER' },
					},
				}),
			]);

		res.json({
			totalActiveStaff,
			pendingUnverified,
			lockedDeactivated,
		});
	} catch (error: any) {
		res.status(500).json({ message: error.message });
	}
}
