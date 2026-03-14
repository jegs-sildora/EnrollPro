import 'dotenv/config';
import { PrismaClient, Sex, ApplicationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function generateLRN(): string {
  const year = '10';
  const region = '06';
  const division = '34';
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${year}${region}${division}${random}`;
}

function generatePhoneNumber(): string {
  const prefixes = ['0917', '0918', '0919', '0920', '0921', '0922', '0923', '0925', '0926', '0927'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `${prefix}-${suffix.slice(0, 3)}-${suffix.slice(3)}`;
}

async function main() {
  console.log('🌱 Starting Grade 10 student data seeding...\n');

  // Create registrar user if not exists
  const registrarEmail = 'registrar@hnhs.edu.ph';
  let registrar = await prisma.user.findUnique({ where: { email: registrarEmail } });
  
  if (!registrar) {
    const hashedPassword = await bcrypt.hash('registrar123', 12);
    registrar = await prisma.user.create({
      data: {
        name: 'Regina Cruz',
        email: registrarEmail,
        password: hashedPassword,
        role: 'REGISTRAR',
      },
    });
    console.log('✓ Created registrar user');
  }

  // Get or create active academic year
  let academicYear = await prisma.academicYear.findFirst({
    where: { isActive: true },
  });

  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        yearLabel: '2026-2027',
        status: 'ACTIVE',
        isActive: true,
        classOpeningDate: new Date('2026-06-16'),
        classEndDate: new Date('2027-03-31'),
        earlyRegOpenDate: new Date('2026-01-31'),
        earlyRegCloseDate: new Date('2026-02-27'),
        enrollOpenDate: new Date('2026-06-09'),
        enrollCloseDate: new Date('2026-06-14'),
      },
    });
    console.log('✓ Created academic year 2026-2027');
  }

  // Create Grade 10 only
  let gradeLevel = await prisma.gradeLevel.findFirst({
    where: {
      name: 'Grade 10',
      academicYearId: academicYear.id,
    },
  });

  if (!gradeLevel) {
    gradeLevel = await prisma.gradeLevel.create({
      data: {
        name: 'Grade 10',
        displayOrder: 4,
        academicYearId: academicYear.id,
      },
    });
  }
  console.log('✓ Created/verified Grade 10');

  // Create sections named after Philippine National Heroes
  const heroSectionNames = ['Rizal', 'Bonifacio', 'Mabini'];
  const sections = [];

  for (const sectionName of heroSectionNames) {
    let section = await prisma.section.findFirst({
      where: {
        name: sectionName,
        gradeLevelId: gradeLevel.id,
      },
    });

    if (!section) {
      section = await prisma.section.create({
        data: {
          name: sectionName,
          maxCapacity: 45,
          gradeLevelId: gradeLevel.id,
        },
      });
    }
    sections.push(section);
  }
  console.log('✓ Created/verified 3 sections (Rizal, Bonifacio, Mabini)');

  // Generate 3 Grade 10 students (1 per section)
  const studentData = [
    {
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      middleName: 'Santos',
      sex: Sex.MALE,
      section: sections[0], // Rizal
    },
    {
      firstName: 'Maria',
      lastName: 'Garcia',
      middleName: 'Reyes',
      sex: Sex.FEMALE,
      section: sections[1], // Bonifacio
    },
    {
      firstName: 'Pedro',
      lastName: 'Mendoza',
      middleName: 'Torres',
      sex: Sex.MALE,
      section: sections[2], // Mabini
    },
  ];

  let totalCreated = 0;
  const usedLRNs = new Set<string>();

  for (const student of studentData) {
    let lrn = generateLRN();
    while (usedLRNs.has(lrn)) {
      lrn = generateLRN();
    }
    usedLRNs.add(lrn);

    const birthDate = new Date(2011, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const barangays = ['San Antonio', 'San Jose', 'Poblacion', 'San Miguel', 'Santa Cruz'];
    const barangay = barangays[Math.floor(Math.random() * barangays.length)];
    const address = `${Math.floor(Math.random() * 500) + 1} Brgy. ${barangay}, Hinigaran, Negros Occidental`;
    const parentName = `${student.sex === Sex.MALE ? 'Rosa' : 'Carlos'} ${student.lastName}`;
    const phoneNumber = generatePhoneNumber();
    const email = `${student.lastName.toLowerCase().replace(' ', '')}${Math.floor(Math.random() * 1000)}@gmail.com`;

    const trackingYear = academicYear.yearLabel.split('-')[0];
    const trackingSeq = (totalCreated + 1).toString().padStart(5, '0');
    const trackingNumber = `HNS-${trackingYear}-${trackingSeq}`;

    try {
      const applicant = await prisma.applicant.create({
        data: {
          lrn,
          lastName: student.lastName,
          firstName: student.firstName,
          middleName: student.middleName,
          suffix: null,
          birthDate,
          sex: student.sex,
          address,
          parentGuardianName: parentName,
          parentGuardianContact: phoneNumber,
          emailAddress: email,
          trackingNumber,
          status: ApplicationStatus.APPROVED,
          gradeLevelId: gradeLevel.id,
          strandId: null,
          academicYearId: academicYear.id,
        },
      });

      await prisma.enrollment.create({
        data: {
          applicantId: applicant.id,
          sectionId: student.section.id,
          academicYearId: academicYear.id,
          enrolledById: registrar.id,
        },
      });

      console.log(`✓ Created: ${student.firstName} ${student.lastName} (${student.section.name})`);
      totalCreated++;
    } catch (error) {
      console.error(`Error creating student: ${error}`);
    }
  }

  console.log(`\n✅ Successfully seeded ${totalCreated} Grade 10 students`);
  console.log(`📊 Distribution: 1 student per section (Rizal, Bonifacio, Mabini)`);
  console.log(`🏫 Sections: ${sections.length} total sections`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
