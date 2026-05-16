import "dotenv/config";
import {
  PrismaClient,
  Role,
  Sex,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEEDED_DESIGNATION = "TLE INSTRUCTOR (SEEDED)";
const DEFAULT_PASSWORD = "DepEd2026!";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── TLE Faculty Roster ───────────────────────────────────────────────────────
// One real sample PH teacher per programCode.
// specialization strings intentionally contain the program name / shorthand so
// the server-side teacher-filter (ILIKE contains) resolves the instructor when
// a section form requests eligible TLE teachers for that program.

interface TleFaculty {
  programCode: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: Sex;
  contactNumber: string;
  specialization: string;
}

const TLE_FACULTY: TleFaculty[] = [
  // ── Home Economics ─────────────────────────────────────────────────────────
  {
    programCode: "HE-COOK",
    employeeId: "2900101",
    firstName: "ROSALINDA",
    lastName: "FERNANDEZ",
    middleName: "SANTOS",
    sex: "FEMALE",
    contactNumber: "0917-900-1001",
    specialization:
      "MAJOR IN HOME ECONOMICS (COOKERY / FOOD AND BEVERAGE SERVICES)",
  },
  {
    programCode: "HE-BPA",
    employeeId: "2900102",
    firstName: "TERESITA",
    lastName: "AQUINO",
    middleName: "RAMOS",
    sex: "FEMALE",
    contactNumber: "0917-900-1002",
    specialization: "MAJOR IN HOME ECONOMICS (BREAD AND PASTRY ARTS)",
  },
  {
    programCode: "HE-BCNC",
    employeeId: "2900103",
    firstName: "FLORDELIZA",
    lastName: "BAUTISTA",
    middleName: "OCAMPO",
    sex: "FEMALE",
    contactNumber: "0917-900-1003",
    specialization:
      "MAJOR IN HOME ECONOMICS (BREAD AND CAKE-MAKING / COMMERCIAL COOKING)",
  },
  {
    programCode: "HE-BPP",
    employeeId: "2900104",
    firstName: "ERLINDA",
    lastName: "CRUZ",
    middleName: "REYES",
    sex: "FEMALE",
    contactNumber: "0917-900-1004",
    specialization: "MAJOR IN HOME ECONOMICS (BREAD AND PASTRY PRODUCTION)",
  },
  {
    programCode: "HE-CGV",
    employeeId: "2900105",
    firstName: "MARICEL",
    lastName: "SANTOS",
    middleName: "GUERRERO",
    sex: "FEMALE",
    contactNumber: "0917-900-1005",
    specialization: "MAJOR IN HOME ECONOMICS (CAREGIVING)",
  },
  {
    programCode: "HE-DRES",
    employeeId: "2900106",
    firstName: "PRISCILLA",
    lastName: "VILLANUEVA",
    middleName: "DELA CRUZ",
    sex: "FEMALE",
    contactNumber: "0917-900-1006",
    specialization: "MAJOR IN HOME ECONOMICS (DRESSMAKING / TAILORING)",
  },

  // ── Agri-Fishery Arts ──────────────────────────────────────────────────────
  {
    programCode: "AFA-ACP",
    employeeId: "2900201",
    firstName: "RODRIGO",
    lastName: "SALAZAR",
    middleName: "BERNARDO",
    sex: "MALE",
    contactNumber: "0917-900-2001",
    specialization: "MAJOR IN AGRI-FISHERY ARTS (AQUACULTURE)",
  },
  {
    programCode: "AFA-AP",
    employeeId: "2900202",
    firstName: "EDUARDO",
    lastName: "GARCIA",
    middleName: "LOPEZ",
    sex: "MALE",
    contactNumber: "0917-900-2002",
    specialization: "MAJOR IN AGRI-FISHERY ARTS (ANIMAL PRODUCTION)",
  },
  {
    programCode: "AFA-CP",
    employeeId: "2900203",
    firstName: "DANILO",
    lastName: "MENDOZA",
    middleName: "CABRERA",
    sex: "MALE",
    contactNumber: "0917-900-2003",
    specialization: "MAJOR IN AGRI-FISHERY ARTS (CROP PRODUCTION)",
  },
  {
    programCode: "AFA-FA",
    employeeId: "2900204",
    firstName: "BENJAMIN",
    lastName: "TORRES",
    middleName: "REYES",
    sex: "MALE",
    contactNumber: "0917-900-2004",
    specialization: "MAJOR IN AGRI-FISHERY ARTS (FISHERY ARTS)",
  },
  {
    programCode: "AFA-SP",
    employeeId: "2900205",
    firstName: "RENATO",
    lastName: "CASTILLO",
    middleName: "NAVARRO",
    sex: "MALE",
    contactNumber: "0917-900-2005",
    specialization: "MAJOR IN AGRI-FISHERY ARTS (SWINE PRODUCTION)",
  },

  // ── ICT ────────────────────────────────────────────────────────────────────
  {
    programCode: "ICT-CSS",
    employeeId: "2900301",
    firstName: "NOEL",
    lastName: "SORIANO",
    middleName: "CASTRO",
    sex: "MALE",
    contactNumber: "0917-900-3001",
    specialization: "MAJOR IN ICT (COMPUTER SYSTEMS SERVICING)",
  },
  {
    programCode: "ICT-GEN",
    employeeId: "2900302",
    firstName: "ARJAY",
    lastName: "PASCUAL",
    middleName: "DELA TORRE",
    sex: "MALE",
    contactNumber: "0917-900-3002",
    specialization: "MAJOR IN INFORMATION AND COMMUNICATIONS TECHNOLOGY",
  },
  {
    programCode: "ICT-ANIM",
    employeeId: "2900303",
    firstName: "JESSA",
    lastName: "LABARRETE",
    middleName: "MORALES",
    sex: "FEMALE",
    contactNumber: "0917-900-3003",
    specialization: "MAJOR IN ICT (ANIMATION / DIGITAL ARTS)",
  },
  {
    programCode: "ICT-PROG",
    employeeId: "2900304",
    firstName: "KENNETH",
    lastName: "RAMOS",
    middleName: "IGNACIO",
    sex: "MALE",
    contactNumber: "0917-900-3004",
    specialization: "MAJOR IN ICT (COMPUTER PROGRAMMING)",
  },
  {
    programCode: "ICT-TD",
    employeeId: "2900305",
    firstName: "MARIA LUZ",
    lastName: "EVANGELISTA",
    middleName: "TAN",
    sex: "FEMALE",
    contactNumber: "0917-900-3005",
    specialization:
      "MAJOR IN ICT (TECHNICAL DRAFTING / COMPUTER-AIDED DESIGN)",
  },

  // ── Industrial Arts ────────────────────────────────────────────────────────
  {
    programCode: "IA-CARP",
    employeeId: "2900401",
    firstName: "ARNULFO",
    lastName: "DE LOS SANTOS",
    middleName: "REYES",
    sex: "MALE",
    contactNumber: "0917-900-4001",
    specialization: "MAJOR IN INDUSTRIAL ARTS (CARPENTRY)",
  },
  {
    programCode: "IA-EI",
    employeeId: "2900402",
    firstName: "RICARDO",
    lastName: "IBARRA",
    middleName: "FONTAINE",
    sex: "MALE",
    contactNumber: "0917-900-4002",
    specialization:
      "MAJOR IN INDUSTRIAL ARTS (ELECTRICAL INSTALLATION AND MAINTENANCE)",
  },
  {
    programCode: "IA-EIM",
    employeeId: "2900403",
    firstName: "NESTOR",
    lastName: "LIM",
    middleName: "CORDERO",
    sex: "MALE",
    contactNumber: "0917-900-4003",
    specialization: "MAJOR IN INDUSTRIAL ARTS (ELECTRONICS AND COMMUNICATIONS)",
  },
  {
    programCode: "IA-ELEC",
    employeeId: "2900404",
    firstName: "VICENTE",
    lastName: "MACARAEG",
    middleName: "SANTOS",
    sex: "MALE",
    contactNumber: "0917-900-4004",
    specialization: "MAJOR IN INDUSTRIAL ARTS (ELECTRICITY)",
  },
  {
    programCode: "IA-PLUM",
    employeeId: "2900405",
    firstName: "GUILLERMO",
    lastName: "RECTO",
    middleName: "VASQUEZ",
    sex: "MALE",
    contactNumber: "0917-900-4005",
    specialization: "MAJOR IN INDUSTRIAL ARTS (PLUMBING)",
  },
  {
    programCode: "IA-SMAW",
    employeeId: "2900406",
    firstName: "MARCELO",
    lastName: "TAGALOG",
    middleName: "FERRER",
    sex: "MALE",
    contactNumber: "0917-900-4006",
    specialization:
      "MAJOR IN INDUSTRIAL ARTS (WELDING TECHNOLOGY / SHIELDED METAL ARC WELDING)",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic fallback employeeId for programs not in TLE_FACULTY */
function fallbackEmployeeId(programId: number): string {
  return `29${String(programId).padStart(5, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    "📋 Seeding TLE teachers from saved TLE programs (real PH sample data)...",
  );

  const tlePrograms = await prisma.tLEProgram.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, programCode: true },
  });

  if (tlePrograms.length === 0) {
    console.log("No TLE programs found. Run db:seed first.");
    return;
  }

  const tleDepartment = await prisma.department.findFirst({
    where: {
      OR: [
        { code: { equals: "TLE", mode: "insensitive" } },
        { name: { contains: "TLE", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  // Build a lookup map: programCode → faculty record
  const facultyByCode = new Map<string, TleFaculty>(
    TLE_FACULTY.map((f) => [f.programCode, f]),
  );

  const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const program of tlePrograms) {
    const faculty = facultyByCode.get(program.programCode ?? "");

    // If no static entry exists, generate a deterministic fallback so every
    // program still gets an eligible instructor in the filter dropdown.
    const employeeId = faculty?.employeeId ?? fallbackEmployeeId(program.id);
    const firstName = faculty?.firstName ?? "TLE";
    const lastName =
      faculty?.lastName ??
      program.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .slice(0, 50);
    const middleName = faculty?.middleName ?? null;
    const sex: Sex = faculty?.sex ?? "FEMALE";
    const contactNumber =
      faculty?.contactNumber ??
      `0999-${String(program.id).padStart(3, "0")}-0000`;
    const specialization =
      faculty?.specialization ??
      `MAJOR IN TLE (${program.name.toUpperCase()})`;

    if (!faculty) {
      console.log(
        `  ⚠ No static entry for "${program.programCode}" (${program.name}) — using deterministic fallback.`,
      );
    }

    const cleanFirst = firstName.toLowerCase().replace(/\s+/g, "");
    const cleanLast = lastName.toLowerCase().replace(/[\s.]+/g, "");
    const email = `${cleanFirst}.${cleanLast}@deped.edu.ph`;

    // ── Teacher upsert ──────────────────────────────────────────────────────
    const teacher = await prisma.teacher.upsert({
      where: { employeeId },
      update: {
        firstName,
        lastName,
        middleName,
        email,
        sex,
        specialization,
        designation: SEEDED_DESIGNATION,
        departmentId: tleDepartment?.id ?? null,
        contactNumber,
        isActive: true,
      },
      create: {
        employeeId,
        firstName,
        lastName,
        middleName,
        email,
        sex,
        specialization,
        designation: SEEDED_DESIGNATION,
        departmentId: tleDepartment?.id ?? null,
        contactNumber,
        isActive: true,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        employeeId: true,
      },
    });

    // Track created vs updated (createdAt === updatedAt on first insert)
    if (teacher.createdAt.getTime() === teacher.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }

    // ── User / login account ────────────────────────────────────────────────
    const user = await prisma.user.upsert({
      where: { employeeId: teacher.employeeId },
      update: {
        firstName,
        lastName,
        middleName,
        email,
        sex,
        role: "TEACHER" as Role,
        accountName: teacher.employeeId,
        designation: SEEDED_DESIGNATION,
        isActive: true,
      },
      create: {
        firstName,
        lastName,
        middleName,
        email,
        password: defaultPasswordHash,
        employeeId: teacher.employeeId,
        accountName: teacher.employeeId,
        role: "TEACHER" as Role,
        sex,
        designation: SEEDED_DESIGNATION,
        isActive: true,
      },
      select: { id: true },
    });

    // Link teacher profile → user account
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { userId: user.id },
    });

    // ── Qualified subjects ──────────────────────────────────────────────────
    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacher.id },
    });
    await prisma.teacherSubject.createMany({
      data: [
        { teacherId: teacher.id, subject: "TLE" },
        { teacherId: teacher.id, subject: program.name },
      ],
      skipDuplicates: true,
    });

    console.log(
      `  ✓ ${lastName}, ${firstName} → ${program.programCode ?? program.name}`,
    );
  }

  console.log(
    `\n✅ TLE teacher seed complete. Created: ${created} | Updated: ${updated} | Fallback: ${skipped}`,
  );
  console.log(`🔑 Demo login password for all seeded TLE teachers: ${DEFAULT_PASSWORD}`);
  console.log(`   Account name = Employee ID (e.g. 2900101)`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
