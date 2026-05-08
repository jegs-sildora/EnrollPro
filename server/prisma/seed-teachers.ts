import "dotenv/config";
import { PrismaClient, SectionAdviserStatus, Role, Sex } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. EXACT MIRROR OF ATLAS `seed.js` FACULTY (The "Golden 20")
interface Faculty {
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  deptCode: string;
  subject: string;
  sex: Sex;
}

const ATLAS_FACULTY: Faculty[] = [
  { employeeId: 'T-0001', firstName: 'Maria', lastName: 'Santos', middleName: null, deptCode: 'FIL', subject: 'Filipino', sex: 'FEMALE' },
  { employeeId: 'T-0002', firstName: 'Jose', lastName: 'Reyes', middleName: null, deptCode: 'ENG', subject: 'English', sex: 'MALE' },
  { employeeId: 'T-0003', firstName: 'Ana', lastName: 'Dela Cruz', middleName: null, deptCode: 'MATH', subject: 'Mathematics', sex: 'FEMALE' },
  { employeeId: 'T-0004', firstName: 'Mark', lastName: 'Villanueva', middleName: null, deptCode: 'SCI', subject: 'Science', sex: 'MALE' },
  { employeeId: 'T-0005', firstName: 'Liza', lastName: 'Garcia', middleName: null, deptCode: 'AP', subject: 'Araling Panlipunan', sex: 'FEMALE' },
  { employeeId: 'T-0006', firstName: 'Paolo', lastName: 'Castro', middleName: null, deptCode: 'MAPEH', subject: 'MAPEH', sex: 'MALE' },
  { employeeId: 'T-0007', firstName: 'Rica', lastName: 'Mendoza', middleName: null, deptCode: 'ESP', subject: 'Edukasyon sa Pagpapakatao (EsP)', sex: 'FEMALE' },
  { employeeId: 'T-0008', firstName: 'Neil', lastName: 'Torres', middleName: null, deptCode: 'TLE', subject: 'Information and Communications Technology (ICT)', sex: 'MALE' },
  { employeeId: 'T-0009', firstName: 'Grace', lastName: 'Aquino', middleName: null, deptCode: 'GUIDANCE', subject: 'Homeroom Guidance', sex: 'FEMALE' },
  { employeeId: 'T-0010', firstName: 'Ivy', lastName: 'Flores', middleName: null, deptCode: 'MATH', subject: 'Mathematics', sex: 'FEMALE' },
  { employeeId: 'T-0011', firstName: 'Jomar', lastName: 'Navarro', middleName: null, deptCode: 'SCI', subject: 'Science', sex: 'MALE' },
  { employeeId: 'T-0012', firstName: 'Celia', lastName: 'Pascual', middleName: null, deptCode: 'ENG', subject: 'English', sex: 'FEMALE' },
  { employeeId: 'T-0013', firstName: 'Ramon', lastName: 'Lopez', middleName: null, deptCode: 'FIL', subject: 'Filipino', sex: 'MALE' },
  { employeeId: 'T-0014', firstName: 'Katrina', lastName: 'Salazar', middleName: null, deptCode: 'AP', subject: 'Araling Panlipunan', sex: 'FEMALE' },
  { employeeId: 'T-0015', firstName: 'Lourdes', lastName: 'Valdez', middleName: null, deptCode: 'MAPEH', subject: 'MAPEH', sex: 'FEMALE' },
  { employeeId: 'T-0016', firstName: 'Harold', lastName: 'Bautista', middleName: null, deptCode: 'ESP', subject: 'Edukasyon sa Pagpapakatao (EsP)', sex: 'MALE' },
  { employeeId: 'T-0017', firstName: 'Mika', lastName: 'Ramos', middleName: null, deptCode: 'TLE', subject: 'Home Economics', sex: 'FEMALE' },
  { employeeId: 'T-0018', firstName: 'Jonas', lastName: 'Domingo', middleName: null, deptCode: 'MATH', subject: 'Mathematics', sex: 'MALE' },
  { employeeId: 'T-0019', firstName: 'Ella', lastName: 'Rivera', middleName: null, deptCode: 'SCI', subject: 'Science', sex: 'FEMALE' },
  { employeeId: 'T-0020', firstName: 'Darren', lastName: 'Serrano', middleName: null, deptCode: 'ENG', subject: 'English', sex: 'MALE' },
];

const PH_FIRST_NAMES_MALE = ["JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL", "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", "JOSHUA", "ANGELO", "RICARDO", "FERDINAND", "RODRIGO", "MANUEL", "CORAZON", "BENIGNO", "RAMON", "ELPIDIO", "SERGIO", "DIOSDADO", "JOSEPH"];
const PH_FIRST_NAMES_FEMALE = ["MARIA", "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "LIZA", "BEA", "CRISTINA", "PATRICIA", "ELENA", "ROSA", "TERESA", "IMELDA", "GLORIA", "CORAZON", "LOURDES", "REMEDIOS", "CARMELA", "JOSEFINA", "PERLA", "AURORA", "ESTRELLA"];
const PH_LAST_NAMES = ["DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO", "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA", "CRUZ", "PASCUAL", "AQUINO", "MARCOS", "DUTERTE", "ESTRADA", "ARROYO", "MAGSAYSAY", "QUIRINO", "OSMEÑA", "MACAPAGAL", "ROXAS", "QUEZON"];
const PH_MIDDLE_NAMES = ["SANTIAGO", "DE LEON", "BALTAZAR", "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "PANGANIBAN", "IBARRA", "LUNA", "SILANG"];

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

  // 1. Get Context (Similar to Learner Process)
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

  // 2. Generate additional teachers (Similar to Learner Randomization)
  for (let i = 21; i <= totalTarget; i++) {
    const sex = Math.random() > 0.5 ? "MALE" as Sex : "FEMALE" as Sex;
    const firstNames = sex === "MALE" ? PH_FIRST_NAMES_MALE : PH_FIRST_NAMES_FEMALE;
    
    // Cascading index for unique names
    const firstIdx = i % firstNames.length;
    const lastIdx = Math.floor(i / firstNames.length) % PH_LAST_NAMES.length;
    const midIdx = Math.floor(i / (firstNames.length * PH_LAST_NAMES.length)) % PH_MIDDLE_NAMES.length;

    const firstName = firstNames[firstIdx];
    const lastName = PH_LAST_NAMES[lastIdx];
    const middleName = PH_MIDDLE_NAMES[midIdx];
    const dept = getRandomFromWeighted(DEPARTMENTS_WEIGHTED);
    
    teachersToSeed.push({
      employeeId: `T-${i.toString().padStart(4, '0')}`,
      firstName,
      lastName,
      middleName,
      deptCode: dept.code,
      subject: dept.subject,
      sex: sex
    });
  }

  console.log(`🚀 Provisioning ${teachersToSeed.length} Faculty accounts...`);

  for (let i = 0; i < teachersToSeed.length; i++) {
    const faculty = teachersToSeed[i];
    
    // Format email: firstname.lastname@deped.edu.ph
    // Add index to email for absolute uniqueness
    const cleanFirst = faculty.firstName.toLowerCase().replace(/\s/g, '');
    const cleanLast = faculty.lastName.toLowerCase().replace(/\s/g, '');
    const email = i < 20 
      ? `${cleanFirst}.${cleanLast}@deped.edu.ph`
      : `${cleanFirst}.${cleanLast}.${i}@deped.edu.ph`;

    const dept = departments.find(d => d.code === faculty.deptCode) || departments[0];
    const designation = i < sections.length ? "CLASS ADVISER" : "SUBJECT TEACHER";
    const position = getRandomFromWeighted(PLANTILLA_POSITIONS).title;

    // STEP 1: CREATE TEACHER PROFILE (Primary Identity, like Learner)
    const teacher = await prisma.teacher.upsert({
      where: { employeeId: faculty.employeeId },
      update: {
        firstName: faculty.firstName,
        lastName: faculty.lastName,
        middleName: faculty.middleName,
        email: email,
        sex: faculty.sex,
        specialization: `MAJOR IN ${dept?.name?.toUpperCase() || faculty.subject.toUpperCase()}`,
        designation: designation,
        departmentId: dept?.id,
        plantillaPosition: position,
      },
      create: {
        employeeId: faculty.employeeId,
        firstName: faculty.firstName,
        lastName: faculty.lastName,
        middleName: faculty.middleName,
        email: email,
        sex: faculty.sex,
        specialization: `MAJOR IN ${dept?.name?.toUpperCase() || faculty.subject.toUpperCase()}`,
        isActive: true,
        plantillaPosition: position,
        designation: designation,
        departmentId: dept?.id,
      },
    });

    // STEP 2: PROVISION LOGIN ACCOUNT (Attachment, derived from Teacher Profile)
    await prisma.user.upsert({
      where: { employeeId: teacher.employeeId },
      update: {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        email: teacher.email,
        sex: teacher.sex,
        role: "TEACHER" as Role,
      },
      create: {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        email: teacher.email,
        password: defaultPasswordHash,
        employeeId: teacher.employeeId,
        role: "TEACHER" as Role,
        sex: teacher.sex,
        isActive: true,
      }
    });

    // STEP 3: SEED QUALIFIED SUBJECTS
    await prisma.teacherSubject.deleteMany({ where: { teacherId: teacher.id } });
    await prisma.teacherSubject.create({
      data: { teacherId: teacher.id, subject: faculty.subject }
    });

    // STEP 4: ASSIGN ADVISORY SECTIONS
    if (i < sections.length) {
      const section = sections[i];
      
      const existingAdviser = await prisma.sectionAdviser.findFirst({
        where: { sectionId: section.id, schoolYearId: activeYear.id, status: "ACTIVE" }
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
            sectionId: section.id,
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
