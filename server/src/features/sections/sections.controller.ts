import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { auditLog } from '../audit-logs/audit-logs.service.js';

export async function listSections(req: Request, res: Response): Promise<void> {
	const ayId = req.params.ayId ? parseInt(req.params.ayId as string) : null;
	const { gradeLevelId, level } = req.query;

	if (gradeLevelId) {
		const sections = await prisma.section.findMany({
			where: { gradeLevelId: parseInt(gradeLevelId as string) },
			include: {
				advisingTeacher: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						middleName: true,
					},
				},
				_count: { select: { enrollments: true } },
			},
			orderBy: { name: 'asc' },
		});
		// Format teacher names
		const formatted = sections.map((s) => ({
			...s,
			advisingTeacher: s.advisingTeacher
				? {
						id: s.advisingTeacher.id,
						name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ''}`,
					}
				: null,
		}));
		res.json({ sections: formatted });
		return;
	}

	if (!ayId) {
		res
			.status(400)
			.json({ message: 'School Year ID or Grade Level ID is required' });
		return;
	}

	const whereClause: any = { schoolYearId: ayId };

	if (level === 'JHS') {
		whereClause.displayOrder = { lte: 10 };
	} else if (level === 'SHS') {
		whereClause.displayOrder = { gte: 11 };
	}

	const gradeLevels = await prisma.gradeLevel.findMany({
		where: whereClause,
		orderBy: { displayOrder: 'asc' },
		include: {
			sections: {
				orderBy: { name: 'asc' },
				include: {
					advisingTeacher: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							middleName: true,
						},
					},
					_count: { select: { enrollments: true } },
				},
			},
		},
	});

	const result = gradeLevels.map((gl) => ({
		gradeLevelId: gl.id,
		gradeLevelName: gl.name,
		displayOrder: gl.displayOrder,
		sections: gl.sections.map((s) => ({
			id: s.id,
			name: s.name,
			maxCapacity: s.maxCapacity,
			enrolledCount: s._count.enrollments,
			fillPercent:
				s.maxCapacity > 0
					? Math.round((s._count.enrollments / s.maxCapacity) * 100)
					: 0,
			advisingTeacher: s.advisingTeacher
				? {
						id: s.advisingTeacher.id,
						name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ''}`,
					}
				: null,
		})),
	}));

	res.json({ gradeLevels: result });
}

export async function listTeachers(req: Request, res: Response): Promise<void> {
	const teachers = await prisma.teacher.findMany({
		where: { isActive: true },
		select: {
			id: true,
			firstName: true,
			lastName: true,
			middleName: true,
			employeeId: true,
		},
		orderBy: { lastName: 'asc' },
	});
	// Format the name for display in dropdowns
	const formatted = teachers.map((t) => ({
		id: t.id,
		name: `${t.lastName}, ${t.firstName}${t.middleName ? ` ${t.middleName.charAt(0)}.` : ''}`,
		employeeId: t.employeeId,
	}));
	res.json({ teachers: formatted });
}

export async function createSection(
	req: Request,
	res: Response,
): Promise<void> {
	const { name, maxCapacity, gradeLevelId, advisingTeacherId } = req.body;

	if (!name || !gradeLevelId) {
		res.status(400).json({ message: 'name and gradeLevelId are required' });
		return;
	}

	const section = await prisma.section.create({
		data: {
			name,
			maxCapacity: maxCapacity ?? 40,
			gradeLevelId,
			advisingTeacherId: advisingTeacherId ?? null,
		},
	});

	await auditLog({
		userId: req.user!.userId,
		actionType: 'SECTION_CREATED',
		description: `Created section "${name}"`,
		subjectType: 'Section',
		recordId: section.id,
		req,
	});

	res.status(201).json({ section });
}

export async function updateSection(
	req: Request,
	res: Response,
): Promise<void> {
	const id = parseInt(req.params.id as string);
	const { name, maxCapacity, advisingTeacherId } = req.body;

	const section = await prisma.section.findUnique({ where: { id } });
	if (!section) {
		res.status(404).json({ message: 'Section not found' });
		return;
	}

	const updated = await prisma.section.update({
		where: { id },
		data: {
			...(name ? { name } : {}),
			...(maxCapacity !== undefined ? { maxCapacity } : {}),
			...(advisingTeacherId !== undefined
				? { advisingTeacherId: advisingTeacherId || null }
				: {}),
		},
	});

	await auditLog({
		userId: req.user!.userId,
		actionType: 'SECTION_UPDATED',
		description: `Updated section "${updated.name}"`,
		subjectType: 'Section',
		recordId: id,
		req,
	});

	res.json({ section: updated });
}

export async function deleteSection(
	req: Request,
	res: Response,
): Promise<void> {
	const id = parseInt(req.params.id as string);

	const section = await prisma.section.findUnique({
		where: { id },
		include: { _count: { select: { enrollments: true } } },
	});

	if (!section) {
		res.status(404).json({ message: 'Section not found' });
		return;
	}

	if (section._count.enrollments > 0) {
		res
			.status(400)
			.json({ message: 'Cannot delete a section with enrolled students' });
		return;
	}

	await prisma.section.delete({ where: { id } });

	await auditLog({
		userId: req.user!.userId,
		actionType: 'SECTION_DELETED',
		description: `Deleted section "${section.name}"`,
		subjectType: 'Section',
		recordId: id,
		req,
	});

	res.json({ message: 'Section deleted' });
}
