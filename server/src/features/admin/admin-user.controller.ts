import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { auditLog } from '../audit-logs/audit-logs.service.js';

export async function index(req: Request, res: Response) {
	try {
		const { role, isActive, page = '1', limit = '20' } = req.query;
		const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));

		const where: any = {};
		if (role) {
			where.role = role;
		}
		if (isActive !== undefined) where.isActive = String(isActive) === 'true';

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
				orderBy: { createdAt: 'desc' },
				skip,
				take: parseInt(String(limit)),
			}),
			prisma.user.count({ where }),
		]);

		res.json({
			users,
			total,
			page: parseInt(String(page)),
			limit: parseInt(String(limit)),
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
		res.status(500).json({ message: error.message });
	}
}

export async function deactivate(req: Request, res: Response) {
	try {
		const userId = parseInt(String(req.params.id));

		const targetUser = await prisma.user.findUnique({ where: { id: userId } });
		if (!targetUser) return res.status(404).json({ message: 'User not found' });

		if (targetUser.role === 'SYSTEM_ADMIN') {
			return res
				.status(400)
				.json({
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
