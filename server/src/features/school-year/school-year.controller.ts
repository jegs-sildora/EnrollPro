import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { auditLog } from '../audit-logs/audit-logs.service.js';
import {
	deriveSchoolYearScheduleFromOpeningDate,
	deriveNextSchoolYear,
	normalizeDateToUtcNoon,
} from './school-year.service.js';

const MANILA_TIME_ZONE = 'Asia/Manila';

const DEFAULT_GRADES = [
	{ name: 'Grade 7', displayOrder: 7 },
	{ name: 'Grade 8', displayOrder: 8 },
	{ name: 'Grade 9', displayOrder: 9 },
	{ name: 'Grade 10', displayOrder: 10 },
	{ name: 'Grade 11', displayOrder: 11 },
	{ name: 'Grade 12', displayOrder: 12 },
];

async function ensureDefaultGradeLevels(schoolYearId: number) {
	for (const grade of DEFAULT_GRADES) {
		const existing = await prisma.gradeLevel.findFirst({
			where: {
				schoolYearId,
				name: grade.name,
			},
		});

		if (!existing) {
			await prisma.gradeLevel.create({
				data: {
					name: grade.name,
					displayOrder: grade.displayOrder,
					schoolYearId,
				},
			});
		}
	}
}

function parseDateInput(value: unknown): Date | null {
	if (!value || typeof value !== 'string') {
		return null;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCurrentManilaYear(): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: MANILA_TIME_ZONE,
		year: 'numeric',
	}).formatToParts(new Date());

	return Number(
		parts.find((part) => part.type === 'year')?.value ??
			new Date().getFullYear(),
	);
}

export async function listSchoolYears(
	_req: Request,
	res: Response,
): Promise<void> {
	const years = await prisma.schoolYear.findMany({
		orderBy: { createdAt: 'desc' },
		include: {
			_count: {
				select: {
					gradeLevels: true,
					strands: true,
					applicants: true,
					enrollments: true,
				},
			},
		},
	});
	res.json({ years });
}

export async function getNextDefaults(
	req: Request,
	res: Response,
): Promise<void> {
	const defaults = deriveNextSchoolYear(new Date());
	res.json(defaults);
}

export async function getSchoolYear(
	req: Request,
	res: Response,
): Promise<void> {
	const id = parseInt(req.params.id as string);
	const year = await prisma.schoolYear.findUnique({
		where: { id },
		include: {
			gradeLevels: {
				orderBy: { displayOrder: 'asc' },
				include: {
					sections: { include: { _count: { select: { enrollments: true } } } },
				},
			},
			strands: true,
			_count: { select: { applicants: true, enrollments: true } },
		},
	});
	if (!year) {
		res.status(404).json({ message: 'School year not found' });
		return;
	}
	res.json({ year });
}

export async function createSchoolYear(
	req: Request,
	res: Response,
): Promise<void> {
	const { classOpeningDate, classEndDate, cloneFromId } = req.body;

	const parsedOpeningDate = parseDateInput(classOpeningDate);
	if (!parsedOpeningDate) {
		res.status(400).json({ message: 'A valid classOpeningDate is required' });
		return;
	}

	const normalizedOpeningDate = normalizeDateToUtcNoon(parsedOpeningDate);
	const openingYear = normalizedOpeningDate.getUTCFullYear();
	const currentManilaYear = getCurrentManilaYear();

	if (openingYear < currentManilaYear || openingYear > currentManilaYear + 1) {
		res.status(400).json({
			message: `Class opening year must be within ${currentManilaYear} and ${currentManilaYear + 1}`,
		});
		return;
	}

	const parsedClassEndDate = classEndDate ? parseDateInput(classEndDate) : null;
	if (classEndDate && !parsedClassEndDate) {
		res.status(400).json({ message: 'classEndDate must be a valid date' });
		return;
	}

	const schedule = deriveSchoolYearScheduleFromOpeningDate(
		normalizedOpeningDate,
		parsedClassEndDate ? normalizeDateToUtcNoon(parsedClassEndDate) : undefined,
	);

	const existing = await prisma.schoolYear.findUnique({
		where: { yearLabel: schedule.yearLabel },
	});
	if (existing) {
		res
			.status(400)
			.json({ message: 'A school year with this label already exists' });
		return;
	}

	// Deactivate others
	await prisma.schoolYear.updateMany({
		where: { status: 'ACTIVE' },
		data: { status: 'ARCHIVED', isActive: false },
	});

	const year = await prisma.schoolYear.create({
		data: {
			yearLabel: schedule.yearLabel,
			status: 'ACTIVE',
			isActive: true,
			classOpeningDate: schedule.classOpeningDate,
			classEndDate: schedule.classEndDate,
			earlyRegOpenDate: schedule.earlyRegOpenDate,
			earlyRegCloseDate: schedule.earlyRegCloseDate,
			enrollOpenDate: schedule.enrollOpenDate,
			enrollCloseDate: schedule.enrollCloseDate,
			clonedFromId: cloneFromId ?? null,
		},
	});

	const settings = await prisma.schoolSettings.findFirst();
	if (settings) {
		await prisma.schoolSettings.update({
			where: { id: settings.id },
			data: { activeSchoolYearId: year.id },
		});
	}

	// Clone structure if requested
	if (cloneFromId) {
		const source = await prisma.schoolYear.findUnique({
			where: { id: cloneFromId },
			include: {
				gradeLevels: { include: { sections: true } },
				strands: { include: { gradeLevels: true } },
				scpConfigs: { include: { options: true } },
			},
		});

		if (source) {
			const gradeLevelIdMap = new Map<number, number>();

			for (const gl of source.gradeLevels) {
				const newGl = await prisma.gradeLevel.create({
					data: {
						name: gl.name,
						displayOrder: gl.displayOrder,
						schoolYearId: year.id,
					},
				});
				gradeLevelIdMap.set(gl.id, newGl.id);

				for (const sec of gl.sections) {
					await prisma.section.create({
						data: {
							name: sec.name,
							maxCapacity: sec.maxCapacity,
							gradeLevelId: newGl.id,
						},
					});
				}
			}

			for (const strand of source.strands) {
				const newStrand = await prisma.strand.create({
					data: {
						name: strand.name,
						schoolYearId: year.id,
					},
				});
				// Clone strand-grade-level mappings via junction table
				const mappedGls = strand.gradeLevels
					.map((sgl) => gradeLevelIdMap.get(sgl.gradeLevelId))
					.filter((id): id is number => id !== undefined);
				if (mappedGls.length > 0) {
					await prisma.strandGradeLevel.createMany({
						data: mappedGls.map((glId) => ({
							strandId: newStrand.id,
							gradeLevelId: glId,
						})),
					});
				}
			}

			for (const scp of source.scpConfigs) {
				const newScp = await prisma.scpConfig.create({
					data: {
						schoolYearId: year.id,
						scpType: scp.scpType,
						isOffered: scp.isOffered,
						cutoffScore: scp.cutoffScore,
						examDate: scp.examDate,
						notes: scp.notes,
					},
				});
				// Clone SCP config options
				if (scp.options.length > 0) {
					await prisma.scpConfigOption.createMany({
						data: scp.options.map((opt) => ({
							scpConfigId: newScp.id,
							optionType: opt.optionType,
							value: opt.value,
						})),
					});
				}
			}
		}
	}

	// Ensure baseline grades are available
	// This fills in standard grades if not cloned or if cloning was partial
	await ensureDefaultGradeLevels(year.id);

	await auditLog({
		userId: req.user!.userId,
		actionType: 'SY_CREATED',
		description: `Created and activated school year "${schedule.yearLabel}"${cloneFromId ? ` (cloned from ID ${cloneFromId})` : ''}`,
		subjectType: 'SchoolYear',
		recordId: year.id,
		req,
	});

	const full = await prisma.schoolYear.findUnique({
		where: { id: year.id },
		include: {
			gradeLevels: { orderBy: { displayOrder: 'asc' } },
			strands: true,
			_count: { select: { applicants: true, enrollments: true } },
		},
	});

	res.status(201).json({ year: full });
}

export async function toggleOverride(
	req: Request,
	res: Response,
): Promise<void> {
	const id = parseInt(req.params.id as string);
	const { isManualOverrideOpen } = req.body;

	const updated = await prisma.schoolYear.update({
		where: { id },
		data: { isManualOverrideOpen },
	});

	await auditLog({
		userId: req.user!.userId,
		actionType: 'SCHOOL_YEAR_OVERRIDE_TOGGLED',
		description: `Manual override set to ${isManualOverrideOpen ? 'OPEN' : 'OFF'} for year "${updated.yearLabel}"`,
		subjectType: 'SchoolYear',
		recordId: id,
		req,
	});

	res.json({ year: updated });
}

export async function updateDates(req: Request, res: Response): Promise<void> {
	const id = parseInt(req.params.id as string);
	const {
		earlyRegOpenDate,
		earlyRegCloseDate,
		enrollOpenDate,
		enrollCloseDate,
	} = req.body;

	const updated = await prisma.schoolYear.update({
		where: { id },
		data: {
			...(earlyRegOpenDate !== undefined
				? {
						earlyRegOpenDate: earlyRegOpenDate
							? normalizeDateToUtcNoon(new Date(earlyRegOpenDate))
							: null,
					}
				: {}),
			...(earlyRegCloseDate !== undefined
				? {
						earlyRegCloseDate: earlyRegCloseDate
							? normalizeDateToUtcNoon(new Date(earlyRegCloseDate))
							: null,
					}
				: {}),
			...(enrollOpenDate !== undefined
				? {
						enrollOpenDate: enrollOpenDate
							? normalizeDateToUtcNoon(new Date(enrollOpenDate))
							: null,
					}
				: {}),
			...(enrollCloseDate !== undefined
				? {
						enrollCloseDate: enrollCloseDate
							? normalizeDateToUtcNoon(new Date(enrollCloseDate))
							: null,
					}
				: {}),
		},
	});

	await auditLog({
		userId: req.user!.userId,
		actionType: 'ENROLLMENT_DATES_UPDATED',
		description: `Updated enrollment dates for "${updated.yearLabel}"`,
		subjectType: 'SchoolYear',
		recordId: id,
		req,
	});

	res.json({ year: updated });
}

export async function updateSchoolYear(
	req: Request,
	res: Response,
): Promise<void> {
	const id = parseInt(req.params.id as string);
	const { yearLabel } = req.body;

	const year = await prisma.schoolYear.findUnique({ where: { id } });
	if (!year) {
		res.status(404).json({ message: 'School year not found' });
		return;
	}

	if (year.status === 'ARCHIVED') {
		res.status(400).json({ message: 'Cannot edit an archived school year' });
		return;
	}

	const updated = await prisma.schoolYear.update({
		where: { id },
		data: {
			...(yearLabel ? { yearLabel } : {}),
		},
	});

	await auditLog({
		userId: req.user!.userId,
		actionType: 'SY_UPDATED',
		description: `Updated school year "${updated.yearLabel}"`,
		subjectType: 'SchoolYear',
		recordId: id,
		req,
	});

	res.json({ year: updated });
}

export async function transitionSchoolYear(
	req: Request,
	res: Response,
): Promise<void> {
	const id = parseInt(req.params.id as string);
	const { status } = req.body;

	const validStatuses = ['DRAFT', 'UPCOMING', 'ACTIVE', 'ARCHIVED'];
	if (!validStatuses.includes(status)) {
		res.status(400).json({
			message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
		});
		return;
	}

	const year = await prisma.schoolYear.findUnique({ where: { id } });
	if (!year) {
		res.status(404).json({ message: 'School year not found' });
		return;
	}

	// If setting to ACTIVE, deactivate all others and update settings
	if (status === 'ACTIVE') {
		await prisma.schoolYear.updateMany({
			where: { status: 'ACTIVE', id: { not: id } },
			data: { status: 'ARCHIVED', isActive: false },
		});

		await prisma.schoolYear.update({
			where: { id },
			data: { status: 'ACTIVE', isActive: true },
		});

		// Ensure baseline grades are available immediately
		await ensureDefaultGradeLevels(id);

		// Also update SchoolSettings
		const settings = await prisma.schoolSettings.findFirst();
		if (settings) {
			await prisma.schoolSettings.update({
				where: { id: settings.id },
				data: { activeSchoolYearId: id },
			});
		}
	} else {
		await prisma.schoolYear.update({
			where: { id },
			data: {
				status,
				isActive: false,
			},
		});

		// If was active, clear settings
		if (year.isActive) {
			const settings = await prisma.schoolSettings.findFirst();
			if (settings && settings.activeSchoolYearId === id) {
				await prisma.schoolSettings.update({
					where: { id: settings.id },
					data: { activeSchoolYearId: null },
				});
			}
		}
	}

	await auditLog({
		userId: req.user!.userId,
		actionType: 'SY_STATUS_CHANGED',
		description: `School year "${year.yearLabel}" status changed to ${status}`,
		subjectType: 'SchoolYear',
		recordId: id,
		req,
	});

	const updated = await prisma.schoolYear.findUnique({ where: { id } });
	res.json({ year: updated });
}

export async function deleteSchoolYear(
	req: Request,
	res: Response,
): Promise<void> {
	const id = parseInt(req.params.id as string);

	const year = await prisma.schoolYear.findUnique({
		where: { id },
		include: { _count: { select: { applicants: true, enrollments: true } } },
	});

	if (!year) {
		res.status(404).json({ message: 'School year not found' });
		return;
	}

	if (year._count.applicants > 0 || year._count.enrollments > 0) {
		res
			.status(400)
			.json({ message: 'Cannot delete a school year with existing records' });
		return;
	}

	const wasActive = year.status === 'ACTIVE' || year.isActive;

	await prisma.schoolYear.delete({ where: { id } });

	if (wasActive) {
		const settings = await prisma.schoolSettings.findFirst();
		if (settings && settings.activeSchoolYearId === id) {
			await prisma.schoolSettings.update({
				where: { id: settings.id },
				data: { activeSchoolYearId: null },
			});
		}
	}

	await auditLog({
		userId: req.user!.userId,
		actionType: 'SY_DELETED',
		description: `Deleted school year "${year.yearLabel}"`,
		subjectType: 'SchoolYear',
		recordId: id,
		req,
	});

	res.json({ message: 'School year deleted' });
}
