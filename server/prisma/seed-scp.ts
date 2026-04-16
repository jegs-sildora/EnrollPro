import 'dotenv/config';
import {
	PrismaClient,
	ApplicantType,
	AssessmentKind,
} from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Default DepEd SCP Assessment Pipelines ──
const SCP_PIPELINES: Record<
	string,
	Array<{
		stepOrder: number;
		kind: AssessmentKind;
		label: string;
		description: string;
		isRequired: boolean;
	}>
> = {
	SCIENCE_TECHNOLOGY_AND_ENGINEERING: [
		{
			stepOrder: 1,
			kind: 'PRELIMINARY_EXAMINATION',
			label: 'Preliminary Examination (ESM)',
			description:
				'Written screening test: English, Science, Mathematics — determines eligibility for final exam',
			isRequired: true,
		},
		{
			stepOrder: 2,
			kind: 'FINAL_EXAMINATION',
			label: 'Final Examination',
			description:
				'Comprehensive written exam: 21st-century skills, critical thinking, and advanced problem-solving',
			isRequired: true,
		},
		{
			stepOrder: 3,
			kind: 'INTERVIEW',
			label: 'Interview',
			description:
				'Interest, mental alertness, readiness for rigorous curriculum',
			isRequired: true,
		},
	],
	SPECIAL_PROGRAM_IN_THE_ARTS: [
		{
			stepOrder: 1,
			kind: 'GENERAL_ADMISSION_TEST',
			label: 'General Admission Test',
			description: 'Written exam covering general knowledge and aptitude',
			isRequired: true,
		},
		{
			stepOrder: 2,
			kind: 'TALENT_AUDITION',
			label: 'Talent Audition / Performance',
			description: 'Live performance or portfolio per chosen art field',
			isRequired: true,
		},
		{
			stepOrder: 3,
			kind: 'INTERVIEW',
			label: 'Interview',
			description: 'Assess passion for the arts',
			isRequired: true,
		},
	],
	SPECIAL_PROGRAM_IN_SPORTS: [
		{
			stepOrder: 1,
			kind: 'PHYSICAL_FITNESS_TEST',
			label: 'Physical Fitness Test (PFT)',
			description: 'Agility, strength, and endurance tests',
			isRequired: true,
		},
		{
			stepOrder: 2,
			kind: 'SPORTS_SKILLS_TRYOUT',
			label: 'Sports Skills Demonstration (Tryout)',
			description: 'Sport-specific proficiency tryout',
			isRequired: true,
		},
		{
			stepOrder: 3,
			kind: 'INTERVIEW',
			label: 'Interview',
			description: 'Discipline, sportsmanship, and parental support',
			isRequired: true,
		},
	],
	SPECIAL_PROGRAM_IN_JOURNALISM: [
		{
			stepOrder: 1,
			kind: 'QUALIFYING_EXAMINATION',
			label: 'Qualifying Test',
			description:
				'English and Filipino proficiency, grammar, basic news writing',
			isRequired: true,
		},
		{
			stepOrder: 2,
			kind: 'SKILLS_ASSESSMENT',
			label: 'Skills Assessment (Writing Trials)',
			description:
				'On-the-spot writing: news lead, editorial, or feature story',
			isRequired: true,
		},
		{
			stepOrder: 3,
			kind: 'INTERVIEW',
			label: 'Interview',
			description: 'Communication skills and ethical awareness',
			isRequired: true,
		},
	],
	SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: [
		{
			stepOrder: 1,
			kind: 'STANDARDIZED_ADMISSION_TOOL',
			label: 'Standardized Admission Tool',
			description: 'Linguistic aptitude and readiness test',
			isRequired: true,
		},
		{
			stepOrder: 2,
			kind: 'INTERVIEW',
			label: 'Interview (with Parent/Guardian)',
			description: 'Validate documents and gauge commitment',
			isRequired: true,
		},
	],
	SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: [
		{
			stepOrder: 1,
			kind: 'APTITUDE_TEST',
			label: 'Aptitude Test',
			description:
				'Inclination towards IT, Agriculture, Home Economics, or Industrial Arts',
			isRequired: true,
		},
		{
			stepOrder: 2,
			kind: 'INTEREST_INVENTORY',
			label: 'Interest Inventory / Interview',
			description: 'Align student interests with specific shop offerings',
			isRequired: true,
		},
	],
};

async function seed() {
	try {
		// 1. Get active school year
		const schoolYear = await prisma.schoolYear.findFirst({
			where: { status: 'ACTIVE' },
		});

		if (!schoolYear) {
			throw new Error(
				'No active school year found. Please ensure the school year is seeded and set to ACTIVE before running this script.',
			);
		}

		console.log(`Using School Year: ${schoolYear.yearLabel}`);

		// 2. Find Grade 7 Level
		const grade7 = await prisma.gradeLevel.findFirst({
			where: { schoolYearId: schoolYear.id, name: 'Grade 7' },
		});

		if (!grade7) {
			throw new Error(
				'Grade Level "Grade 7" not found for the active school year.',
			);
		}

		// 3. Get an admin user for encoding
		const admin = await prisma.user.findFirst({
			where: { role: 'SYSTEM_ADMIN' },
		});

		if (!admin) {
			throw new Error('No SYSTEM_ADMIN user found to encode applications.');
		}

		// 4. Seed SCP Configs with pipeline steps
		const scpTypes = [
			ApplicantType.SCIENCE_TECHNOLOGY_AND_ENGINEERING,
			ApplicantType.SPECIAL_PROGRAM_IN_THE_ARTS,
			ApplicantType.SPECIAL_PROGRAM_IN_SPORTS,
			ApplicantType.SPECIAL_PROGRAM_IN_JOURNALISM,
			ApplicantType.SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE,
			ApplicantType.SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION,
		];

		const philippineFirstNames = [
			'Juan',
			'Maria',
			'Jose',
			'Angelica',
			'Miguel',
			'Princess',
			'Carlo',
			'Jasmine',
			'Rafael',
			'Nicole',
			'Paolo',
			'Gabriela',
		];

		const philippineMiddleNames = [
			'Santos',
			'Reyes',
			'Garcia',
			'Cruz',
			'Mendoza',
			'Aquino',
			'Flores',
			'Navarro',
			'Torres',
			'Bautista',
			'Castro',
			'Valdez',
		];

		const philippineLastNames = [
			'Dela Cruz',
			'Reyes',
			'Santos',
			'Garcia',
			'Mendoza',
			'Fernandez',
			'Navarro',
			'Ramos',
			'Bautista',
			'Gonzales',
			'Torres',
			'Villanueva',
		];

		let globalCounter = 1;

		for (const scpType of scpTypes) {
			const existingConfig = await prisma.scpProgramConfig.findUnique({
				where: {
					uq_scp_program_configs_type: {
						schoolYearId: schoolYear.id,
						scpType,
					},
				},
			});

			let configId: number;

			if (!existingConfig) {
				const config = await prisma.scpProgramConfig.create({
					data: {
						schoolYearId: schoolYear.id,
						scpType,
						isOffered: true,
					},
				});
				configId = config.id;

				const pipeline = SCP_PIPELINES[scpType] ?? [];
				if (pipeline.length > 0) {
					await prisma.scpProgramStep.createMany({
						data: pipeline.map((step) => ({
							scpProgramConfigId: config.id,
							stepOrder: step.stepOrder,
							kind: step.kind,
							label: step.label,
							description: step.description,
							isRequired: step.isRequired,
						})),
					});
				}

				console.log(
					`✅ Created SCP Config for ${scpType} with ${pipeline.length} pipeline steps`,
				);
			} else {
				configId = existingConfig.id;
				console.log(`ℹ️  SCP Config for ${scpType} already exists, skipping`);
			}

			// 5. Seed 3 Students per SCP
			for (let i = 1; i <= 3; i++) {
				const seedNumber = globalCounter;
				let prefix = 'REG';
				if (scpType === 'SCIENCE_TECHNOLOGY_AND_ENGINEERING') {
					prefix = 'STE';
				} else if (scpType === 'SPECIAL_PROGRAM_IN_THE_ARTS') {
					prefix = 'SPA';
				} else if (scpType === 'SPECIAL_PROGRAM_IN_SPORTS') {
					prefix = 'SPS';
				} else if (scpType === 'SPECIAL_PROGRAM_IN_JOURNALISM') {
					prefix = 'SPJ';
				} else if (scpType === 'SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE') {
					prefix = 'SPFL';
				} else if (scpType === 'SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION') {
					prefix = 'SPTVE';
				}

				const trackingNumber = `${prefix}-2026-${seedNumber.toString().padStart(5, '0')}`;
				globalCounter++;

				const firstName =
					philippineFirstNames[(seedNumber - 1) % philippineFirstNames.length];
				const middleName =
					philippineMiddleNames[
						(seedNumber - 1) % philippineMiddleNames.length
					];
				const lastName =
					philippineLastNames[(seedNumber - 1) % philippineLastNames.length];
				const lrn = `190000${seedNumber.toString().padStart(6, '0')}`;
				const sex = seedNumber % 2 === 0 ? 'FEMALE' : 'MALE';

				// Birthdate approx 12-13 years before 2026
				const birthMonth = (seedNumber % 12) + 1;
				const birthDay = ((seedNumber * 3) % 28) + 1;
				const birthDate = new Date(
					`2014-${birthMonth.toString().padStart(2, '0')}-${birthDay
						.toString()
						.padStart(2, '0')}`,
				);

				const existingApplicant = await prisma.applicant.findUnique({
					where: { trackingNumber },
				});

				if (!existingApplicant) {
					await prisma.applicant.create({
						data: {
							trackingNumber,
							lrn,
							firstName,
							middleName,
							lastName,
							sex,
							birthDate,
							applicantType: scpType,
							gradeLevelId: grade7.id,
							schoolYearId: schoolYear.id,
							status: 'SUBMITTED',
							admissionChannel: 'F2F',
							encodedById: admin.id,
							programDetail: {
								create: {
									scpType,
									artField:
										scpType === 'SPECIAL_PROGRAM_IN_THE_ARTS' ? 'DANCE' : null,
									foreignLanguage:
										scpType === 'SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE'
											? 'MANDARIN'
											: null,
									sportsList:
										scpType === 'SPECIAL_PROGRAM_IN_SPORTS'
											? ['BASKETBALL']
											: [],
								},
							},
						},
					});
					console.log(
						`   ✅ Seeded student ${i} for ${scpType}: ${trackingNumber}`,
					);
				} else {
					// Ensure existing seeded students are SUBMITTED and have LRN/full PH name
					await prisma.applicant.update({
						where: { id: existingApplicant.id },
						data: {
							status: 'SUBMITTED',
							lrn,
							firstName,
							middleName,
							lastName,
						},
					});
					console.log(
						`   ℹ️  Student ${trackingNumber} already exists, updated status/profile`,
					);
				}
			}
		}

		console.log('Seeding completed!');
	} catch (error) {
		console.error('ERROR during seeding:', error);
	} finally {
		await prisma.$disconnect();
		await pool.end();
	}
}

seed();
