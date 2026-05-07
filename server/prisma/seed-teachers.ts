import "dotenv/config";
import { PrismaClient, SectionAdviserStatus, Role } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. EXACT MIRROR OF ATLAS `seed.js` FACULTY
// This ensures perfect sync between EnrollPro and ATLAS for the demo environment.
const ATLAS_FACULTY = [
  { id: 'T-0001', first: 'Maria', last: 'Santos', deptCode: 'FIL', subject: 'Filipino' },
  { id: 'T-0002', first: 'Jose', last: 'Reyes', deptCode: 'ENG', subject: 'English' },
  { id: 'T-0003', first: 'Ana', last: 'Dela Cruz', deptCode: 'MATH', subject: 'Mathematics' },
  { id: 'T-0004', first: 'Mark', last: 'Villanueva', deptCode: 'SCI', subject: 'Science' },
  { id: 'T-0005', first: 'Liza', last: 'Garcia', deptCode: 'AP', subject: 'Araling Panlipunan' },
  { id: 'T-0006', first: 'Paolo', last: 'Castro', deptCode: 'MAPEH', subject: 'MAPEH' },
  { id: 'T-0007', first: 'Rica', last: 'Mendoza', deptCode: 'ESP', subject: 'Edukasyon sa Pagpapakatao (EsP)' },
  { id: 'T-0008', first: 'Neil', last: 'Torres', deptCode: 'TLE', subject: 'Information and Communications Technology (ICT)' },
  { id: 'T-0009', first: 'Grace', last: 'Aquino', deptCode: 'GUIDANCE', subject: 'Homeroom Guidance' },
  { id: 'T-0010', first: 'Ivy', last: 'Flores', deptCode: 'MATH', subject: 'Mathematics' },
  { id: 'T-0011', first: 'Jomar', last: 'Navarro', deptCode: 'SCI', subject: 'Science' },
  { id: 'T-0012', first: 'Celia', last: 'Pascual', deptCode: 'ENG', subject: 'English' },
  { id: 'T-0013', first: 'Ramon', last: 'Lopez', deptCode: 'FIL', subject: 'Filipino' },
  { id: 'T-0014', first: 'Katrina', last: 'Salazar', deptCode: 'AP', subject: 'Araling Panlipunan' },
  { id: 'T-0015', first: 'Lourdes', last: 'Valdez', deptCode: 'MAPEH', subject: 'MAPEH' },
  { id: 'T-0016', first: 'Harold', last: 'Bautista', deptCode: 'ESP', subject: 'Edukasyon sa Pagpapakatao (EsP)' },
  { id: 'T-0017', first: 'Mika', last: 'Ramos', deptCode: 'TLE', subject: 'Home Economics' },
  { id: 'T-0018', first: 'Jonas', last: 'Domingo', deptCode: 'MATH', subject: 'Mathematics' },
  { id: 'T-0019', first: 'Ella', last: 'Rivera', deptCode: 'SCI', subject: 'Science' },
  { id: 'T-0020', first: 'Darren', last: 'Serrano', deptCode: 'ENG', subject: 'English' },
];

async function main() {
  console.log("🌱 Seeding DepEd Teachers (ATLAS Mirror) & Login Credentials...");

  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found.");

  const departments = await prisma.department.findMany();
  const sections = await prisma.section.findMany({
    where: { schoolYearId: activeYear.id },
    orderBy: [{ gradeLevelId: "asc" }, { sortOrder: "asc" }]
  });

  // Default password for all teacher logins during the demo
  const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 10);

  for (let i = 0; i < ATLAS_FACULTY.length; i++) {
    const faculty = ATLAS_FACULTY[i];
    
    // 1. Format DepEd standard email (firstname.lastname@deped.edu.ph)
    const cleanFirst = faculty.first.toLowerCase().replace(/\s/g, '');
    const cleanLast = faculty.last.toLowerCase().replace(/\s/g, '');
    const email = `${cleanFirst}.${cleanLast}@deped.edu.ph`;

    // Map department code to database ID
    const dept = departments.find(d => d.code === faculty.deptCode) || departments[0];
    
    const sectionToAdvise = i < sections.length ? sections[i] : null;
    const designation = sectionToAdvise ? "CLASS ADVISER" : "SUBJECT TEACHER";

    // 2. CREATE SYSTEM LOGIN CREDENTIAL (USERS TABLE)
    await prisma.user.upsert({
      where: { email: email },
      update: {
        firstName: faculty.first,
        lastName: faculty.last,
        employeeId: faculty.id,
        role: "TEACHER" as Role,
      },
      create: {
        firstName: faculty.first,
        lastName: faculty.last,
        email: email,
        password: defaultPasswordHash,
        employeeId: faculty.id,
        role: "TEACHER" as Role,
        isActive: true,
      }
    });

    // 3. CREATE TEACHER PROFILE
    const teacher = await prisma.teacher.upsert({
      where: { employeeId: faculty.id },
      update: {
        firstName: faculty.first,
        lastName: faculty.last,
        email: email,
        specialization: `MAJOR IN ${dept?.name?.toUpperCase() || faculty.subject.toUpperCase()}`,
        designation: designation,
        departmentId: dept?.id,
      },
      create: {
        employeeId: faculty.id,
        firstName: faculty.first,
        lastName: faculty.last,
        email: email,
        specialization: `MAJOR IN ${dept?.name?.toUpperCase() || faculty.subject.toUpperCase()}`,
        isActive: true,
        plantillaPosition: "TEACHER I",
        designation: designation,
        departmentId: dept?.id,
      },
    });

    // 4. SEED QUALIFIED SUBJECTS
    await prisma.teacherSubject.deleteMany({ where: { teacherId: teacher.id } });
    await prisma.teacherSubject.create({
      data: { teacherId: teacher.id, subject: faculty.subject }
    });

    // 5. ASSIGN ADVISORY SECTIONS (Required for EOSY UI to function)
    if (sectionToAdvise) {
      await prisma.sectionAdviser.upsert({
        where: { id: -1 }, // Fallback logic
        create: {
          sectionId: sectionToAdvise.id,
          teacherId: teacher.id,
          schoolYearId: activeYear.id,
          effectiveFrom: activeYear.classOpeningDate || new Date(),
          status: "ACTIVE" as SectionAdviserStatus
        },
        update: { teacherId: teacher.id, status: "ACTIVE" as SectionAdviserStatus }
      }).catch(async () => {
        await prisma.sectionAdviser.updateMany({
          where: { sectionId: sectionToAdvise.id, schoolYearId: activeYear.id, status: "ACTIVE" },
          data: { status: "HANDED_OVER" }
        });
        await prisma.sectionAdviser.create({
          data: {
            sectionId: sectionToAdvise.id,
            teacherId: teacher.id,
            schoolYearId: activeYear.id,
            effectiveFrom: activeYear.classOpeningDate || new Date(),
            status: "ACTIVE" as SectionAdviserStatus
          }
        });
      });
    }

    console.log(`  ✅ Seeded: ${faculty.id} | ${email}`);
  }

  console.log(`\n🎉 Successfully synchronized ${ATLAS_FACULTY.length} ATLAS teachers into EnrollPro.`);
  console.log(`🔑 Demo Login Password for all teachers: DepEd2026!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });