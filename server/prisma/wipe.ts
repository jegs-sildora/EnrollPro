import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
	console.log(
		'âš ï¸ Starting data wipe (preserving Users and SchoolSettings)...',
	);

	try {
		// 1. Delete logs and transient data
		await prisma.emailLog.deleteMany({});
		console.log('âœ… Email logs cleared.');

		await prisma.auditLog.deleteMany({});
		console.log('âœ… Audit logs cleared.');

		// 2. Delete student-related data (Children tables first)
		await prisma.healthRecord.deleteMany({});
		console.log('âœ… Health records cleared.');

		await prisma.enrollment.deleteMany({});
		console.log('âœ… Enrollments cleared.');

		await prisma.document.deleteMany({});
		console.log('âœ… Documents cleared.');

		await prisma.requirementChecklist.deleteMany({});
		console.log('âœ… Requirement checklists cleared.');

		// 3. Delete Applicants
		await prisma.applicant.deleteMany({});
		console.log('âœ… Applicants cleared.');

		// 4. Delete Section data
		await prisma.section.deleteMany({});
		console.log('âœ… Sections cleared.');

		// 5. Delete Curriculum/Setup data (preserving SchoolYear if referenced might be tricky, but we'll try)
		// Note: ScpConfig, Strand, GradeLevel have onDelete: Cascade or foreign keys to SchoolYear.
		await prisma.scpConfig.deleteMany({});
		await prisma.strand.deleteMany({});
		await prisma.gradeLevel.deleteMany({});
		await prisma.department.deleteMany({});
		await prisma.teacher.deleteMany({}); // Clearing teachers as they are student-related records
		console.log('âœ… Curriculum and Teacher data cleared.');

		// 6. Optionally clear SchoolYears?
		// If we keep SchoolSettings, we should probably keep the SchoolYears too,
		// otherwise the activeSchoolYearId will point to nothing.
		// However, if the user wants a "fresh migration" feel, they usually want to clear SYs.
		// Let's check if any SchoolYear is currently set as active.
		const settings = await prisma.schoolSettings.findFirst();
		if (settings?.activeSchoolYearId) {
			console.log(
				'â„¹ï¸ Preserving SchoolYears to maintain SchoolSettings integrity.',
			);
		} else {
			await prisma.schoolYear.deleteMany({});
			console.log('âœ… School years cleared.');
		}

		console.log('\nâœ¨ Database data reset successful!');
		console.log('   Preserved: Users, SchoolSettings.');
	} catch (error) {
		console.error('â Œ Error during wipe:', error);
		process.exit(1);
	}
}

main().finally(async () => {
	await prisma.$disconnect();
});
