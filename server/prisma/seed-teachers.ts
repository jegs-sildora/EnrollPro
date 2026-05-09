import "dotenv/config";
import { PrismaClient, SectionAdviserStatus, Role, Sex } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface Faculty {
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  deptCode: string;
  subject: string;
  sex: Sex;
  contactNumber: string;
  specialization: string;
}

const ATLAS_FACULTY: Faculty[] = [
  { employeeId: '100001', firstName: 'MARIA', lastName: 'SANTOS', middleName: 'SANTIAGO', deptCode: 'FIL', subject: 'Filipino', sex: 'FEMALE', contactNumber: '0917-111-0001', specialization: 'MAJOR IN FILIPINO' },
  { employeeId: '100002', firstName: 'JOSE', lastName: 'REYES', middleName: 'DE LEON', deptCode: 'ENG', subject: 'English', sex: 'MALE', contactNumber: '0917-111-0002', specialization: 'MAJOR IN ENGLISH' },
  { employeeId: '100003', firstName: 'ANA', lastName: 'DELA CRUZ', middleName: 'BALTAZAR', deptCode: 'MATH', subject: 'Mathematics', sex: 'FEMALE', contactNumber: '0917-111-0003', specialization: 'MAJOR IN MATHEMATICS' },
  { employeeId: '100004', firstName: 'MARK', lastName: 'VILLANUEVA', middleName: 'CASTILLO', deptCode: 'SCI', subject: 'Science', sex: 'MALE', contactNumber: '0917-111-0004', specialization: 'MAJOR IN GENERAL SCIENCE' },
  { employeeId: '100005', firstName: 'LIZA', lastName: 'GARCIA', middleName: 'SORIANO', deptCode: 'AP', subject: 'Araling Panlipunan', sex: 'FEMALE', contactNumber: '0917-111-0005', specialization: 'MAJOR IN SOCIAL STUDIES' },
  { employeeId: '100006', firstName: 'PAOLO', lastName: 'CASTRO', middleName: 'DEL ROSARIO', deptCode: 'MAPEH', subject: 'MAPEH', sex: 'MALE', contactNumber: '0917-111-0006', specialization: 'MAJOR IN PHYSICAL EDUCATION' },
  { employeeId: '100007', firstName: 'RICA', lastName: 'MENDOZA', middleName: 'VALDEZ', deptCode: 'ESP', subject: 'Edukasyon sa Pagpapakatao (EsP)', sex: 'FEMALE', contactNumber: '0917-111-0007', specialization: 'MAJOR IN VALUES EDUCATION' },
  { employeeId: '100008', firstName: 'NEIL', lastName: 'TORRES', middleName: 'RODRIGUEZ', deptCode: 'TLE', subject: 'Information and Communications Technology (ICT)', sex: 'MALE', contactNumber: '0917-111-0008', specialization: 'MAJOR IN ICT' },
  { employeeId: '100009', firstName: 'GRACE', lastName: 'AQUINO', middleName: 'PANGANIBAN', deptCode: 'GUIDANCE', subject: 'Homeroom Guidance', sex: 'FEMALE', contactNumber: '0917-111-0009', specialization: 'MAJOR IN GUIDANCE AND COUNSELING' },
  { employeeId: '100010', firstName: 'IVY', lastName: 'FLORES', middleName: 'IBARRA', deptCode: 'MATH', subject: 'Mathematics', sex: 'FEMALE', contactNumber: '0917-111-0010', specialization: 'MAJOR IN MATHEMATICS' },
  { employeeId: '100011', firstName: 'JOMAR', lastName: 'NAVARRO', middleName: 'LUNA', deptCode: 'SCI', subject: 'Science', sex: 'MALE', contactNumber: '0917-111-0011', specialization: 'MAJOR IN BIOLOGY' },
  { employeeId: '100012', firstName: 'CELIA', lastName: 'PASCUAL', middleName: 'SILANG', deptCode: 'ENG', subject: 'English', sex: 'FEMALE', contactNumber: '0917-111-0012', specialization: 'MAJOR IN LITERATURE' },
  { employeeId: '100013', firstName: 'RAMON', lastName: 'LOPEZ', middleName: 'MABINI', deptCode: 'FIL', subject: 'Filipino', sex: 'MALE', contactNumber: '0917-111-0013', specialization: 'MAJOR IN FILIPINO' },
  { employeeId: '100014', firstName: 'KATRINA', lastName: 'SALAZAR', middleName: 'BONIFACIO', deptCode: 'AP', subject: 'Araling Panlipunan', sex: 'FEMALE', contactNumber: '0917-111-0014', specialization: 'MAJOR IN HISTORY' },
  { employeeId: '100015', firstName: 'LOURDES', lastName: 'VALDEZ', middleName: 'JACINTO', deptCode: 'MAPEH', subject: 'MAPEH', sex: 'FEMALE', contactNumber: '0917-111-0015', specialization: 'MAJOR IN MUSIC' },
  { employeeId: '100016', firstName: 'HAROLD', lastName: 'BAUTISTA', middleName: 'DAGOHOY', deptCode: 'ESP', subject: 'Edukasyon sa Pagpapakatao (EsP)', sex: 'MALE', contactNumber: '0917-111-0016', specialization: 'MAJOR IN PHILOSOPHY' },
  { employeeId: '100017', firstName: 'MIKA', lastName: 'RAMOS', middleName: 'MALVAR', deptCode: 'TLE', subject: 'Home Economics', sex: 'FEMALE', contactNumber: '0917-111-0017', specialization: 'MAJOR IN HOME ECONOMICS' },
  { employeeId: '100018', firstName: 'JONAS', lastName: 'DOMINGO', middleName: 'RECTO', deptCode: 'MATH', subject: 'Mathematics', sex: 'MALE', contactNumber: '0917-111-0018', specialization: 'MAJOR IN APPLIED MATH' },
  { employeeId: '100019', firstName: 'ELLA', lastName: 'RIVERA', middleName: 'LAUREL', deptCode: 'SCI', subject: 'Science', sex: 'FEMALE', contactNumber: '0917-111-0019', specialization: 'MAJOR IN PHYSICS' },
  { employeeId: '100020', firstName: 'DARREN', lastName: 'SERRANO', middleName: 'ROXAS', deptCode: 'ENG', subject: 'English', sex: 'MALE', contactNumber: '0917-111-0020', specialization: 'MAJOR IN COMMUNICATIONS' },
];

const PH_FIRST_NAMES_MALE = ["JUAN", "MIGUEL", "CARLO", "RAFAEL", "ANTONIO", "GABRIEL", "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", "JOSHUA", "ANGELO", "RICARDO", "FERDINAND", "RODRIGO", "MANUEL", "BENIGNO", "ELPIDIO", "SERGIO", "DIOSDADO", "JOSEPH", "VICENTE", "ANDRES", "EMILIO", "APOLINARIO", "MARCELO", "GREGORIO", "JUANCHO", "ALBERTO", "RENATO", "EDUARDO", "ROBERTO", "FRANCISCO"];
const PH_FIRST_NAMES_FEMALE = ["ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "BEA", "CRISTINA", "PATRICIA", "ELENA", "ROSA", "TERESA", "IMELDA", "GLORIA", "REMEDIOS", "CARMELA", "JOSEFINA", "PERLA", "AURORA", "ESTRELLA", "CORAZON", "LOURDES", "CRISTETA", "FELICIDAD", "LEONOR", "MARIA", "CONCEPCION", "SALVACION", "PURISIMA"];
const PH_LAST_NAMES = ["FERNANDEZ", "NAVARRO", "GONZALES", "VILLANUEVA", "CRUZ", "PASCUAL", "AQUINO", "MARCOS", "DUTERTE", "ESTRADA", "ARROYO", "MAGSAYSAY", "QUIRINO", "OSMEÑA", "MACAPAGAL", "QUEZON", "MAGNO", "BALTAZAR", "SANTIAGO", "DE LEON", "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "PANGANIBAN", "IBARRA", "LUNA", "SILANG"];
const PH_MIDDLE_NAMES = ["SANTIAGO", "DE LEON", "BALTAZAR", "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "PANGANIBAN", "IBARRA", "LUNA", "SILANG", "AGONCILLO", "MAGBANUA", "TECSON", "LLANES", "ESCODA", "VILLA", "GUERRERO", "HERNANDEZ", "TOLENTINO", "ABELLA"];

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

function generateRandomEmployeeId(usedIds: Set<string>): string {
  let id = "";
  do {
    id = Math.floor(100000 + Math.random() * 900000).toString();
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

function generateRandomContactNumber(): string {
  const providers = ["0917", "0918", "0927", "0935", "0945", "0956", "0966", "0977"];
  const provider = providers[Math.floor(Math.random() * providers.length)];
  const mid = Math.floor(100 + Math.random() * 899).toString();
  const last = Math.floor(1000 + Math.random() * 8999).toString();
  return `${provider}-${mid}-${last}`;
}

async function main() {
  console.log("🌱 Scaling Faculty Roster: Generating 140+ UNIQUE DepEd Teachers (No Numbers in Emails)...");

  // 0. CLEANUP: Remove existing teachers and their login accounts to prevent ID/Email conflicts
  console.log("🧹 Cleaning up existing faculty data...");
  const existingTeachers = await prisma.teacher.findMany({ select: { employeeId: true } });
  const teacherEmployeeIds = existingTeachers.map(t => t.employeeId).filter(Boolean);
  
  if (teacherEmployeeIds.length > 0) {
    await prisma.user.deleteMany({
      where: { 
        OR: [
          { employeeId: { in: teacherEmployeeIds } },
          { role: "TEACHER" }
        ]
      }
    });
    // This will cascade delete SectionAdviser, TeacherSubject, TeacherDesignation if defined in schema
    // If not cascade, we might need manual deletes. Based on typical prisma setups, let's be safe.
    await prisma.teacherSubject.deleteMany({});
    await prisma.teacherDesignation.deleteMany({});
    await prisma.sectionAdviser.deleteMany({});
    await prisma.teacher.deleteMany({});
  }

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

  const totalTarget = 142;
  const teachersToSeed: Faculty[] = [];
  
  const usedNames = new Set<string>();
  const usedEmailKeys = new Set<string>(); // Tracks firstName.lastName pairs
  const usedEmployeeIds = new Set<string>();

  // 1. Process Atlas Faculty
  ATLAS_FACULTY.forEach(f => {
    const fullNameKey = `${f.firstName}|${f.lastName}|${f.middleName ?? ""}`.toUpperCase();
    const emailKey = `${f.firstName.toLowerCase()}.${f.lastName.toLowerCase()}`;
    
    usedNames.add(fullNameKey);
    usedEmailKeys.add(emailKey);
    usedEmployeeIds.add(f.employeeId);
    
    teachersToSeed.push(f);
  });

  // 2. Generate remaining teachers with strict uniqueness
  console.log("🔀 Shuffling name pools for maximum variety...");
  
  for (let i = teachersToSeed.length + 1; i <= totalTarget; i++) {
    let sex: Sex = "MALE";
    let firstName = "";
    let lastName = "";
    let middleName = "";
    let fullNameKey = "";
    let emailKey = "";

    // Keep generating until we find a name pair that produces a unique, number-less email local part
    // AND a unique full name combination.
    let attempts = 0;
    do {
      sex = Math.random() > 0.5 ? "MALE" as Sex : "FEMALE" as Sex;
      const firstNames = sex === "MALE" ? PH_FIRST_NAMES_MALE : PH_FIRST_NAMES_FEMALE;
      
      firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      lastName = PH_LAST_NAMES[Math.floor(Math.random() * PH_LAST_NAMES.length)];
      middleName = PH_MIDDLE_NAMES[Math.floor(Math.random() * PH_MIDDLE_NAMES.length)];
      
      fullNameKey = `${firstName}|${lastName}|${middleName}`.toUpperCase();
      emailKey = `${firstName.toLowerCase().replace(/\s/g, '')}.${lastName.toLowerCase().replace(/\s/g, '')}`;
      
      attempts++;
      if (attempts > 5000) {
          throw new Error("Exhausted name combinations while maintaining strict email and full name uniqueness.");
      }
    } while (usedEmailKeys.has(emailKey) || usedNames.has(fullNameKey));

    usedNames.add(fullNameKey);
    usedEmailKeys.add(emailKey);
    
    const dept = getRandomFromWeighted(DEPARTMENTS_WEIGHTED);
    const employeeId = generateRandomEmployeeId(usedEmployeeIds);
    
    teachersToSeed.push({
      employeeId,
      firstName,
      lastName,
      middleName,
      deptCode: dept.code,
      subject: dept.subject,
      sex: sex,
      contactNumber: generateRandomContactNumber(),
      specialization: `MAJOR IN ${dept?.name?.toUpperCase() || dept.subject.toUpperCase()}`
    });
  }

  console.log(`🚀 Provisioning ${teachersToSeed.length} Faculty accounts...`);

  const firstAdmin = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });

  for (let i = 0; i < teachersToSeed.length; i++) {
    const faculty = teachersToSeed[i];
    
    // Ensure all names are strictly UPPERCASE
    const firstNameUpper = faculty.firstName.trim().toUpperCase();
    const lastNameUpper = faculty.lastName.trim().toUpperCase();
    const middleNameUpper = faculty.middleName ? faculty.middleName.trim().toUpperCase() : null;

    // Format unique email (guaranteed unique by generator logic above)
    const cleanFirst = firstNameUpper.toLowerCase().replace(/\s/g, '');
    const cleanLast = lastNameUpper.toLowerCase().replace(/\s/g, '');
    const email = `${cleanFirst}.${cleanLast}@deped.edu.ph`;

    const dept = departments.find(d => d.code === faculty.deptCode) || departments[0];
    const isClassAdviser = i < sections.length;
    const designationStr = isClassAdviser ? "CLASS ADVISER" : "SUBJECT TEACHER";
    const position = getRandomFromWeighted(PLANTILLA_POSITIONS).title;

    // STEP 1: CREATE TEACHER PROFILE
    const teacher = await prisma.teacher.upsert({
      where: { employeeId: faculty.employeeId },
      update: {
        firstName: firstNameUpper,
        lastName: lastNameUpper,
        middleName: middleNameUpper,
        email: email,
        sex: faculty.sex,
        specialization: faculty.specialization,
        designation: designationStr,
        departmentId: dept?.id,
        plantillaPosition: position,
        contactNumber: faculty.contactNumber,
      },
      create: {
        employeeId: faculty.employeeId,
        firstName: firstNameUpper,
        lastName: lastNameUpper,
        middleName: middleNameUpper,
        email: email,
        sex: faculty.sex,
        specialization: faculty.specialization,
        isActive: true,
        plantillaPosition: position,
        designation: designationStr,
        departmentId: dept?.id,
        contactNumber: faculty.contactNumber,
      },
    });

    // STEP 2: PROVISION LOGIN ACCOUNT
    await prisma.user.upsert({
      where: { employeeId: teacher.employeeId },
      update: {
        firstName: firstNameUpper,
        lastName: lastNameUpper,
        middleName: middleNameUpper,
        email: teacher.email,
        sex: teacher.sex,
        role: "TEACHER" as Role,
      },
      create: {
        firstName: firstNameUpper,
        lastName: lastNameUpper,
        middleName: middleNameUpper,
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

    // STEP 4: SEED TEACHER DESIGNATION
    const advisorySectionId = isClassAdviser ? sections[i].id : null;
    
    await prisma.teacherDesignation.upsert({
      where: {
        uq_teacher_designations_teacher_sy: {
          teacherId: teacher.id,
          schoolYearId: activeYear.id,
        }
      },
      update: {
        isClassAdviser: isClassAdviser,
        advisorySectionId: advisorySectionId,
        ancillaryRoles: [],
        effectiveFrom: activeYear.classOpeningDate,
        effectiveTo: activeYear.classEndDate,
        updatedById: firstAdmin?.id,
      },
      create: {
        teacherId: teacher.id,
        schoolYearId: activeYear.id,
        isClassAdviser: isClassAdviser,
        advisorySectionId: advisorySectionId,
        ancillaryRoles: [],
        effectiveFrom: activeYear.classOpeningDate,
        effectiveTo: activeYear.classEndDate,
        updatedById: firstAdmin?.id,
      }
    });

    // STEP 5: SYNC SECTION ADVISER LEDGER
    if (isClassAdviser) {
      const section = sections[i];
      
      const existingAdviser = await prisma.sectionAdviser.findFirst({
        where: { sectionId: section.id, schoolYearId: activeYear.id, status: "ACTIVE" }
      });

      if (existingAdviser && existingAdviser.teacherId !== teacher.id) {
        await prisma.sectionAdviser.update({
          where: { id: existingAdviser.id },
          data: { 
            status: "HANDED_OVER" as SectionAdviserStatus,
            effectiveTo: new Date(),
            handoverReason: "Seed Update"
          }
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
    } else {
      await prisma.sectionAdviser.updateMany({
        where: {
          teacherId: teacher.id,
          schoolYearId: activeYear.id,
          status: "ACTIVE"
        },
        data: {
          status: "REVOKED" as SectionAdviserStatus,
          effectiveTo: new Date(),
          handoverReason: "Seed Update (Role Change)"
        }
      });
    }

    if ((i + 1) % 20 === 0 || i === teachersToSeed.length - 1) {
      console.log(`  📊 Progress: ${i + 1}/${teachersToSeed.length} Faculty members fully provisioned.`);
    }
  }

  console.log(`\n🎉 Successfully scaled and synced ${teachersToSeed.length} UNIQUE teachers.`);
  console.log(`✅ No repeating names or numbers in emails. Employee IDs are 6-digit numeric.`);
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
