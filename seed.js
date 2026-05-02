/**
 * ATLAS Database Seed Script
 * 
 * This script populates the ATLAS database with all necessary data for a
 * fully functional demo environment. Run with: npm run db:seed
 * 
 * Seeded Data:
 * 1. School — ATLAS Pilot School
 * 2. Subjects — 9 DepEd JHS learning areas (DO 010 s.2024 compliant)
 * 3. Buildings — 4 campus buildings with rooms
 * 4. Faculty Mirror — 20 teachers (synced from EnrollPro or stub)
 * 5. Faculty-Subject Assignments — Qualifications for each teacher
 * 6. Scheduling Policy — Default algorithm configuration
 * 
 * Prerequisites:
 * - Database migrated (npm run db:migrate)
 * - EnrollPro seeded if using live integration
 */

require('dotenv').config();

const { PrismaClient } = require('../atlas-server/node_modules/.prisma/client');

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// SEED DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/** DepEd JHS Learning Areas per DO 010 s.2024 */
const subjectSeeds = [
	{ code: 'FIL', name: 'Filipino', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'SCI', name: 'Science', minMinutesPerWeek: 225, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 200, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'VE', name: 'Values Education', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 200, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10], isSeedable: true },
	{ code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true },
];

/** Stub faculty data — used when FACULTY_ADAPTER=stub */
const facultySeeds = [
	{ externalId: 'T-0001', firstName: 'Maria', lastName: 'Santos', email: 't-0001@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['FIL'] },
	{ externalId: 'T-0002', firstName: 'Jose', lastName: 'Reyes', email: 't-0002@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['ENG'] },
	{ externalId: 'T-0003', firstName: 'Ana', lastName: 'Dela Cruz', email: 't-0003@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 'T-0004', firstName: 'Mark', lastName: 'Villanueva', email: 't-0004@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI'] },
	{ externalId: 'T-0005', firstName: 'Liza', lastName: 'Garcia', email: 't-0005@deped.local', department: 'Social Studies', maxWeeklyHours: 30, subjects: ['AP'] },
	{ externalId: 'T-0006', firstName: 'Paolo', lastName: 'Castro', email: 't-0006@deped.local', department: 'MAPEH', maxWeeklyHours: 30, subjects: ['MAPEH'] },
	{ externalId: 'T-0007', firstName: 'Rica', lastName: 'Mendoza', email: 't-0007@deped.local', department: 'Values', maxWeeklyHours: 30, subjects: ['VE'] },
	{ externalId: 'T-0008', firstName: 'Neil', lastName: 'Torres', email: 't-0008@deped.local', department: 'TLE', maxWeeklyHours: 30, subjects: ['TLE'] },
	{ externalId: 'T-0009', firstName: 'Grace', lastName: 'Aquino', email: 't-0009@deped.local', department: 'Guidance', maxWeeklyHours: 20, subjects: ['HG'] },
	{ externalId: 'T-0010', firstName: 'Ivy', lastName: 'Flores', email: 't-0010@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 'T-0011', firstName: 'Jomar', lastName: 'Navarro', email: 't-0011@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI'] },
	{ externalId: 'T-0012', firstName: 'Celia', lastName: 'Pascual', email: 't-0012@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['ENG'] },
	{ externalId: 'T-0013', firstName: 'Ramon', lastName: 'Lopez', email: 't-0013@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['FIL'] },
	{ externalId: 'T-0014', firstName: 'Katrina', lastName: 'Salazar', email: 't-0014@deped.local', department: 'Social Studies', maxWeeklyHours: 30, subjects: ['AP'] },
	{ externalId: 'T-0015', firstName: 'Lourdes', lastName: 'Valdez', email: 't-0015@deped.local', department: 'MAPEH', maxWeeklyHours: 30, subjects: ['MAPEH'] },
	{ externalId: 'T-0016', firstName: 'Harold', lastName: 'Bautista', email: 't-0016@deped.local', department: 'Values', maxWeeklyHours: 30, subjects: ['VE'] },
	{ externalId: 'T-0017', firstName: 'Mika', lastName: 'Ramos', email: 't-0017@deped.local', department: 'TLE', maxWeeklyHours: 30, subjects: ['TLE'] },
	{ externalId: 'T-0018', firstName: 'Jonas', lastName: 'Domingo', email: 't-0018@deped.local', department: 'Mathematics', maxWeeklyHours: 30, subjects: ['MATH'] },
	{ externalId: 'T-0019', firstName: 'Ella', lastName: 'Rivera', email: 't-0019@deped.local', department: 'Science', maxWeeklyHours: 30, subjects: ['SCI'] },
	{ externalId: 'T-0020', firstName: 'Darren', lastName: 'Serrano', email: 't-0020@deped.local', department: 'Languages', maxWeeklyHours: 30, subjects: ['ENG'] },
];

async function main() {
	const school = await prisma.school.upsert({
		where: { id: 1 },
		update: {
			name: 'ATLAS Pilot School',
			shortName: 'ATLAS',
		},
		create: {
			name: 'ATLAS Pilot School',
			shortName: 'ATLAS',
		},
	});

	for (const subject of subjectSeeds) {
		await prisma.subject.upsert({
			where: {
				schoolId_code: {
					schoolId: school.id,
					code: subject.code,
				},
			},
			update: {
				name: subject.name,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				preferredRoomType: subject.preferredRoomType,
				gradeLevels: subject.gradeLevels,
				isSeedable: subject.isSeedable,
			},
			create: {
				schoolId: school.id,
				code: subject.code,
				name: subject.name,
				minMinutesPerWeek: subject.minMinutesPerWeek,
				preferredRoomType: subject.preferredRoomType,
				gradeLevels: subject.gradeLevels,
				isSeedable: subject.isSeedable,
				isActive: true,
			},
		});
	}

	console.log(`Seeded ${subjectSeeds.length} ATLAS subjects for school ${school.name}.`);

	// Seed demo buildings + rooms (adequate for 12 JHS sections)
	const buildingSeeds = [
		{
			name: 'Main Academic Building',
			shortCode: 'MAIN',
			floorCount: 3,
			x: 70, y: 80, width: 280, height: 170, color: '#2563eb',
			rooms: [
				{ name: 'Room 101', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
				{ name: 'Room 102', floor: 1, type: 'CLASSROOM', capacity: 45, floorPosition: 2 },
				{ name: 'Room 103', floor: 1, type: 'CLASSROOM', capacity: 40, floorPosition: 3 },
				{ name: 'Room 201', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
				{ name: 'Room 202', floor: 2, type: 'CLASSROOM', capacity: 45, floorPosition: 2 },
				{ name: 'Room 203', floor: 2, type: 'CLASSROOM', capacity: 40, floorPosition: 3 },
				{ name: 'Room 301', floor: 3, type: 'CLASSROOM', capacity: 45, floorPosition: 1 },
				{ name: 'Room 302', floor: 3, type: 'CLASSROOM', capacity: 45, floorPosition: 2 },
			],
		},
		{
			name: 'Science and Labs',
			shortCode: 'SCI',
			floorCount: 2,
			x: 390, y: 90, width: 220, height: 150, color: '#059669',
			rooms: [
				{ name: 'Chemistry Lab', floor: 1, type: 'LABORATORY', capacity: 35, floorPosition: 1 },
				{ name: 'Biology Lab', floor: 1, type: 'LABORATORY', capacity: 35, floorPosition: 2 },
				{ name: 'Physics Lab', floor: 2, type: 'LABORATORY', capacity: 30, floorPosition: 1 },
				{ name: 'Computer Lab', floor: 2, type: 'COMPUTER_LAB', capacity: 40, floorPosition: 2 },
			],
		},
		{
			name: 'TLE Building',
			shortCode: 'TLE',
			floorCount: 2,
			x: 640, y: 95, width: 180, height: 140, color: '#d97706',
			rooms: [
				{ name: 'Workshop A', floor: 1, type: 'TLE_WORKSHOP', capacity: 35, floorPosition: 1 },
				{ name: 'Workshop B', floor: 1, type: 'TLE_WORKSHOP', capacity: 35, floorPosition: 2 },
				{ name: 'Home Econ Lab', floor: 2, type: 'TLE_WORKSHOP', capacity: 30, floorPosition: 1 },
			],
		},
		{
			name: 'Gym and Covered Court',
			shortCode: 'GYM',
			floorCount: 1,
			x: 100, y: 300, width: 270, height: 170, color: '#ea580c',
			rooms: [
				{ name: 'Court A', floor: 1, type: 'GYMNASIUM', capacity: 200, floorPosition: 1 },
				{ name: 'Court B', floor: 1, type: 'GYMNASIUM', capacity: 150, floorPosition: 2 },
			],
		},
		{
			name: 'Library and Admin',
			shortCode: 'ADMIN',
			floorCount: 2,
			isTeachingBuilding: false,
			x: 420, y: 285, width: 250, height: 185, color: '#7c3aed',
			rooms: [
				{ name: 'Library', floor: 1, type: 'LIBRARY', capacity: 80, floorPosition: 1, isTeachingSpace: false },
				{ name: 'Principal Office', floor: 2, type: 'OFFICE', capacity: 5, floorPosition: 1, isTeachingSpace: false },
				{ name: 'Faculty Room', floor: 2, type: 'FACULTY_ROOM', capacity: 20, floorPosition: 2, isTeachingSpace: false },
			],
		},
	];

	for (const b of buildingSeeds) {
		const existing = await prisma.building.findFirst({
			where: { schoolId: school.id, name: b.name },
		});
		if (!existing) {
			await prisma.building.create({
				data: {
					schoolId: school.id,
					name: b.name,
					shortCode: b.shortCode,
					floorCount: b.floorCount || 1,
					isTeachingBuilding: b.isTeachingBuilding !== false,
					x: b.x,
					y: b.y,
					width: b.width,
					height: b.height,
					color: b.color,
					rooms: {
						create: b.rooms.map((r) => ({
							name: r.name,
							floor: r.floor,
							floorPosition: r.floorPosition || 1,
							type: r.type,
							capacity: r.capacity,
							isTeachingSpace: r.isTeachingSpace !== false,
						})),
					},
				},
			});
		}
	}
	console.log(`✅ Seeded ${buildingSeeds.length} buildings for school ${school.name}.`);

	// ═══════════════════════════════════════════════════════════════════════════
	// FACULTY MIRROR — Sync stub faculty for standalone mode
	// ═══════════════════════════════════════════════════════════════════════════
	
	// Get all subjects for faculty-subject mapping
	const allSubjects = await prisma.subject.findMany({
		where: { schoolId: school.id },
	});
	const subjectMap = new Map(allSubjects.map(s => [s.code, s.id]));

	let facultyCreated = 0;
	let assignmentsCreated = 0;

	for (const f of facultySeeds) {
		const faculty = await prisma.facultyMirror.upsert({
			where: {
				schoolId_externalId: {
					schoolId: school.id,
					externalId: f.externalId,
				},
			},
			update: {
				firstName: f.firstName,
				lastName: f.lastName,
				email: f.email,
				department: f.department,
				maxWeeklyHours: f.maxWeeklyHours,
				isActive: true,
			},
			create: {
				schoolId: school.id,
				externalId: f.externalId,
				firstName: f.firstName,
				lastName: f.lastName,
				email: f.email,
				department: f.department,
				maxWeeklyHours: f.maxWeeklyHours,
				isActive: true,
			},
		});
		facultyCreated++;

		// Create faculty-subject qualifications
		for (const subjectCode of f.subjects) {
			const subjectId = subjectMap.get(subjectCode);
			if (!subjectId) continue;

			const existingAssignment = await prisma.facultySubject.findUnique({
				where: {
					facultyId_subjectId: {
						facultyId: faculty.id,
						subjectId: subjectId,
					},
				},
			});

			if (!existingAssignment) {
				await prisma.facultySubject.create({
					data: {
						facultyId: faculty.id,
						subjectId: subjectId,
						isActive: true,
					},
				});
				assignmentsCreated++;
			}
		}
	}
	console.log(`✅ Seeded ${facultyCreated} faculty members with ${assignmentsCreated} subject assignments.`);

	// ═══════════════════════════════════════════════════════════════════════════
	// SEED SUMMARY
	// ═══════════════════════════════════════════════════════════════════════════
	
	console.log('\n════════════════════════════════════════════════════════════');
	console.log('  ATLAS SEED COMPLETE');
	console.log('════════════════════════════════════════════════════════════');
	console.log(`  School:     ${school.name} (ID: ${school.id})`);
	console.log(`  Subjects:   ${subjectSeeds.length} DepEd JHS learning areas`);
	console.log(`  Buildings:  ${buildingSeeds.length} campus buildings`);
	console.log(`  Rooms:      ${buildingSeeds.reduce((sum, b) => sum + b.rooms.length, 0)} teaching spaces`);
	console.log(`  Faculty:    ${facultyCreated} teachers`);
	console.log(`  Assignments: ${assignmentsCreated} subject qualifications`);
	console.log('════════════════════════════════════════════════════════════');
	console.log('\nNext Steps:');
	console.log('  1. Start EnrollPro (pnpm dev) for sections and student data');
	console.log('  2. Log in to EnrollPro as admin@deped.edu.ph / Admin2026!');
	console.log('  3. Navigate to ATLAS from EnrollPro to establish bridge token');
	console.log('  4. Or use stub mode (SECTION_SOURCE_MODE=stub) for standalone testing');
	console.log('════════════════════════════════════════════════════════════\n');
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
