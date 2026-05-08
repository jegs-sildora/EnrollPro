import "dotenv/config";
import { PrismaClient, SectionAdviserStatus, Role } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. EXACT MIRROR OF ATLAS `seed.js` FACULTY (The "Golden 20")
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

const FILIPINO_FIRST_NAMES = [
  'Juan', 'Pedro', 'Leonora', 'Antonio', 'Corazon', 'Ricardo', 'Leticia', 'Benjamen', 'Teresita', 'Diosdado', 
  'Imelda', 'Ferdinand', 'Cory', 'Ramon', 'Gloria', 'Joseph', 'Rodrigo', 'Sara', 'Bongbong', 'Isko', 
  'Vico', 'Leni', 'Kiko', 'Manny', 'Ping', 'Bato', 'Bong', 'Alan', 'Pia', 'Loren', 
  'Chiz', 'Jinggoy', 'Joel', 'Risa', 'Win', 'Sonny', 'Migz', 'Cynthia', 'Nancy', 'Koko', 
  'Francis', 'Pilo', 'Rafael', 'Ernesto', 'Orlando', 'Salvador', 'Efren', 'Tito', 'Vic', 'Joey'
];

const FILIPINO_LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Tomas', 'Andrada', 
  'Sarmiento', 'Castillo', 'Villanueva', 'Ramos', 'Castro', 'Luna', 'Agoncillo', 'Silang', 'Mabini', 'Bonifacio', 
  'Rizal', 'Jacinto', 'del Pilar', 'Aquino', 'Marcos', 'Duterte', 'Robredo', 'Domagoso', 'Sotto', 'Poe', 
  'Ejercito', 'Hontiveros', 'Gatchalian', 'Angara', 'Villar', 'Zubiri', 'Cayetano', 'Binay', 'Pimentel', 'Pangilinan', 
  'Lacson', 'Pacquiao', 'Dela Rosa', 'Go', 'Tolentino', 'Recto', 'Escudero', 'Legarda', 'Lapid', 'Revilla'
];

const DEPARTMENTS_WEIGHTED = [
  { code: 'ENG', subject: 'English', weight: 15 },
  { code: 'MATH', subject: 'Mathematics', weight: 15 },
  { code: 'SCI', subject: 'Science', weight: 15 },
  { code: 'FIL', subject: 'Filipino', weight: 12 },
  { code: 'AP', subject: 'Araling Panlipunan', weight: 12 },
  { code: 'MAPEH', subject: 'MAPEH', weight: 12 },
  { code: 'TLE', subject: 'TLE', weight: 10 },
  { code: 'ESP', subject: 'Edukasyon sa Pagpapakatao (EsP)', weight: 8 },
  { code: 'GUIDANCE', subject: 'Homeroom Guidance', weight: 2 },
];

const PLANTILLA_POSITIONS = [
  { title: 'TEACHER I', weight: 40 },
  { title: 'TEACHER II', weight: 30 },
  { title: 'TEACHER III', weight: 20 },
  { title: 'MASTER TEACHER I', weight: 7 },
  { title: 'MASTER TEACHER II', weight: 3 },
];

function getRandomFromWeighted(items: any[]) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    if (random < item.weight) return item;
    random -= item.weight;
  }
  return items[0];
}

async function main() {
  console.log("🌱 Scaling Faculty Roster: Generating 140+ DepEd Teachers...");

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

  const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 10);

  const totalTarget = 142; // Around 140+
  const teachersToSeed = [...ATLAS_FACULTY];

  // Generate additional teachers
  for (let i = 21; i <= totalTarget; i++) {
    // Use modulo and floor to ensure unique name combinations (up to 2,500 before repeating)
    const first = FILIPINO_FIRST_NAMES[i % FILIPINO_FIRST_NAMES.length];
    const last = FILIPINO_LAST_NAMES[Math.floor(i / FILIPINO_FIRST_NAMES.length) % FILIPINO_LAST_NAMES.length];
    const dept = getRandomFromWeighted(DEPARTMENTS_WEIGHTED);
    
    teachersToSeed.push({
      id: `T-${i.toString().padStart(4, '0')}`,
      first,
      last,
      deptCode: dept.code,
      subject: dept.subject
    });
  }

  console.log(`🚀 Provisioning ${teachersToSeed.length} Faculty accounts...`);

  for (let i = 0; i < teachersToSeed.length; i++) {
    const faculty = teachersToSeed[i];
    
    // Format email: firstname.lastname@deped.edu.ph
    const cleanFirst = faculty.first.toLowerCase().replace(/\s/g, '');
    const cleanLast = faculty.last.toLowerCase().replace(/\s/g, '');
    const email = `${cleanFirst}.${cleanLast}@deped.edu.ph`;

    const dept = departments.find(d => d.code === faculty.deptCode) || departments[0];
    
    // Assign sections based on availability (86 sections)
    const sectionToAdvise = i < sections.length ? sections[i] : null;
    const designation = sectionToAdvise ? "CLASS ADVISER" : "SUBJECT TEACHER";
    const position = getRandomFromWeighted(PLANTILLA_POSITIONS).title;

    // 1. CREATE SYSTEM LOGIN CREDENTIAL
    // Use employeeId as the stable identifier for teachers in the User table
    await prisma.user.upsert({
      where: { employeeId: faculty.id },
      update: {
        firstName: faculty.first,
        lastName: faculty.last,
        email: email, // Update email in case the generation logic changed
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

    // 2. CREATE TEACHER PROFILE
    const teacher = await prisma.teacher.upsert({
      where: { employeeId: faculty.id },
      update: {
        firstName: faculty.first,
        lastName: faculty.last,
        email: email,
        specialization: `MAJOR IN ${dept?.name?.toUpperCase() || faculty.subject.toUpperCase()}`,
        designation: designation,
        departmentId: dept?.id,
        plantillaPosition: position,
      },
      create: {
        employeeId: faculty.id,
        firstName: faculty.first,
        lastName: faculty.last,
        email: email,
        specialization: `MAJOR IN ${dept?.name?.toUpperCase() || faculty.subject.toUpperCase()}`,
        isActive: true,
        plantillaPosition: position,
        designation: designation,
        departmentId: dept?.id,
      },
    });

    // 3. SEED QUALIFIED SUBJECTS
    await prisma.teacherSubject.deleteMany({ where: { teacherId: teacher.id } });
    await prisma.teacherSubject.create({
      data: { teacherId: teacher.id, subject: faculty.subject }
    });

    // 4. ASSIGN ADVISORY SECTIONS
    if (sectionToAdvise) {
      // Find existing active adviser for this section
      const existingAdviser = await prisma.sectionAdviser.findFirst({
        where: { sectionId: sectionToAdvise.id, schoolYearId: activeYear.id, status: "ACTIVE" }
      });

      if (existingAdviser && existingAdviser.teacherId !== teacher.id) {
        await prisma.sectionAdviser.update({
          where: { id: existingAdviser.id },
          data: { status: "HANDED_OVER" }
        });
      }

      if (!existingAdviser || existingAdviser.teacherId !== teacher.id) {
        await prisma.sectionAdviser.create({
          data: {
            sectionId: sectionToAdvise.id,
            teacherId: teacher.id,
            schoolYearId: activeYear.id,
            effectiveFrom: activeYear.classOpeningDate || new Date(),
            status: "ACTIVE" as SectionAdviserStatus
          }
        });
      }
    }

    if ((i + 1) % 20 === 0 || i === teachersToSeed.length - 1) {
      console.log(`  📊 Progress: ${i + 1}/${teachersToSeed.length} Faculty members seeded.`);
    }
  }

  console.log(`\n🎉 Successfully scaled to ${teachersToSeed.length} teachers.`);
  console.log(`✅ All 86 sections now have a Class Adviser assigned.`);
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
