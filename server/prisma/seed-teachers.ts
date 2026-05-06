import "dotenv/config";
import { PrismaClient, SectionAdviserStatus } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PH_FIRST_NAMES_MALE = ["JUAN", "JOSE", "MIGUEL", "CARLO", "RAFAEL", "PAOLO", "ANTONIO", "GABRIEL", "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", "JOSHUA", "ANGELO", "RICARDO", "FERDINAND", "RODRIGO", "MANUEL", "RAMON", "ELPIDIO"];
const PH_FIRST_NAMES_FEMALE = ["MARIA", "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "LIZA", "BEA", "CRISTINA", "PATRICIA", "ELENA", "ROSA", "TERESA", "IMELDA", "GLORIA", "CORAZON", "LOURDES"];
const PH_LAST_NAMES = ["DELA CRUZ", "REYES", "SANTOS", "GARCIA", "MENDOZA", "FERNANDEZ", "NAVARRO", "RAMOS", "BAUTISTA", "GONZALES", "TORRES", "VILLANUEVA", "CRUZ", "PASCUAL", "AQUINO", "MARCOS", "DUTERTE", "ESTRADA", "ARROYO", "MAGSAYSAY"];
const PH_MIDDLE_NAMES = ["SANTIAGO", "DE LEON", "BALTAZAR", "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "PANGANIBAN", "IBARRA", "LUNA", "SILANG"];

const PLANTILLA_POSITIONS = ["TEACHER I", "TEACHER II", "TEACHER III", "MASTER TEACHER I", "MASTER TEACHER II"];
const DESIGNATIONS = ["SUBJECT TEACHER", "CLASS ADVISER", "GRADE LEVEL COORDINATOR", "DEPARTMENT HEAD"];

const DEPARTMENT_SUBJECTS: Record<string, string[]> = {
  MATH: ["Mathematics"],
  SCI: ["Science"],
  ENG: ["English"],
  FIL: ["Filipino"],
  AP: ["Araling Panlipunan"],
  ESP: ["Edukasyon sa Pagpapakatao (EsP)"],
  MAPEH: ["Music", "Arts", "Physical Education", "Health"],
  TLE: ["Information and Communications Technology (ICT)", "Home Economics", "Agriculture", "Industrial Arts"]
};

async function main() {
  console.log("🌱 Seeding DepEd Teachers and Matching to Sections...");

  // 1. Get Context
  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { id: "desc" }
  });

  if (!activeYear) throw new Error("No valid school year found.");

  const departments = await prisma.department.findMany();
  if (departments.length === 0) {
    throw new Error("No departments found. Run main db:seed first.");
  }

  const sections = await prisma.section.findMany({
    where: { schoolYearId: activeYear.id },
    orderBy: [
      { gradeLevelId: "asc" },
      { sortOrder: "asc" }
    ]
  });

  console.log(`📊 Found ${sections.length} sections to match with advisers.`);

  const TEACHER_COUNT = 120;
  
  for (let i = 0; i < TEACHER_COUNT; i++) {
    const isMale = i % 2 === 0;
    const genderIndex = Math.floor(i / 2);
    
    const firstNameList = isMale ? PH_FIRST_NAMES_MALE : PH_FIRST_NAMES_FEMALE;
    const firstName = firstNameList[genderIndex % firstNameList.length];
    const lastName = PH_LAST_NAMES[Math.floor(genderIndex / firstNameList.length) % PH_LAST_NAMES.length];
    const middleName = PH_MIDDLE_NAMES[i % PH_MIDDLE_NAMES.length];
    
    const employeeId = `T-2026-${String(i + 1).padStart(4, '0')}`;
    const email = `${firstName.toLowerCase().replace(/\s/g, '.')}.${lastName.toLowerCase().replace(/\s/g, '.')}@deped.edu.ph`;
    
    const dept = departments[i % departments.length];
    const plantilla = PLANTILLA_POSITIONS[i % PLANTILLA_POSITIONS.length];
    
    // Designation Logic: Assign to section if available
    const sectionToAdvise = i < sections.length ? sections[i] : null;
    const designation = sectionToAdvise ? "CLASS ADVISER" : DESIGNATIONS[i % DESIGNATIONS.length];

    const teacherData = {
      employeeId,
      firstName,
      lastName,
      middleName,
      email,
      contactNumber: `0917${String(i + 1).padStart(7, '0')}`,
      specialization: `MAJOR IN ${dept.name.toUpperCase()}`,
      isActive: true,
      plantillaPosition: plantilla,
      designation: designation,
      departmentId: dept.id,
    };

    // 2. Upsert Teacher
    const teacher = await prisma.teacher.upsert({
      where: { employeeId },
      update: teacherData,
      create: teacherData,
    });

    // 3. Seed Qualified Subjects
    const subjects = DEPARTMENT_SUBJECTS[dept.code] || [];
    await prisma.teacherSubject.deleteMany({ where: { teacherId: teacher.id } });
    if (subjects.length > 0) {
      await prisma.teacherSubject.createMany({
        data: subjects.map(s => ({ teacherId: teacher.id, subject: s }))
      });
    }

    // 4. Create Teacher Designation (Advisory Assignment)
    if (sectionToAdvise) {
      await prisma.teacherDesignation.upsert({
        where: {
          uq_teacher_designations_teacher_sy: {
            teacherId: teacher.id,
            schoolYearId: activeYear.id
          }
        },
        update: {
          isClassAdviser: true,
          advisorySectionId: sectionToAdvise.id,
          effectiveFrom: activeYear.classOpeningDate || new Date(),
        },
        create: {
          teacherId: teacher.id,
          schoolYearId: activeYear.id,
          isClassAdviser: true,
          advisorySectionId: sectionToAdvise.id,
          effectiveFrom: activeYear.classOpeningDate || new Date(),
        }
      });

      // 5. Establish SectionAdviser relationship (REQUIRED FOR UI)
      await prisma.sectionAdviser.upsert({
        where: {
          id: -1 // We don't have a unique composite for SectionAdviser in schema but we can find existing by section/sy
        },
        create: {
          sectionId: sectionToAdvise.id,
          teacherId: teacher.id,
          schoolYearId: activeYear.id,
          effectiveFrom: activeYear.classOpeningDate || new Date(),
          status: "ACTIVE" as SectionAdviserStatus
        },
        update: {
          teacherId: teacher.id,
          status: "ACTIVE" as SectionAdviserStatus
        }
      }).catch(async () => {
        // Fallback since SectionAdviser doesn't have a simple unique constraint besides ID
        // First, mark others as HANDED_OVER for this section
        await prisma.sectionAdviser.updateMany({
          where: { sectionId: sectionToAdvise.id, schoolYearId: activeYear.id, status: "ACTIVE" },
          data: { status: "HANDED_OVER" }
        });
        
        // Then create new
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

    } else {
      // For non-advisers, still create a designation record
      await prisma.teacherDesignation.upsert({
        where: {
          uq_teacher_designations_teacher_sy: {
            teacherId: teacher.id,
            schoolYearId: activeYear.id
          }
        },
        update: {
          isClassAdviser: false,
          advisorySectionId: null,
          effectiveFrom: activeYear.classOpeningDate || new Date(),
        },
        create: {
          teacherId: teacher.id,
          schoolYearId: activeYear.id,
          isClassAdviser: false,
          advisorySectionId: null,
          effectiveFrom: activeYear.classOpeningDate || new Date(),
        }
      });
    }

    if (i % 20 === 0) console.log(`  - Processed ${i} teachers...`);
  }

  console.log(`✅ Seeded ${TEACHER_COUNT} teachers and matched ${sections.length} advisers to sections.`);
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
