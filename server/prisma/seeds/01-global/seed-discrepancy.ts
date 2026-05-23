/**
 * seed-discrepancy.ts
 *
 * Aligns each department's teacher count to the stakeholder-approved baseline.
 * - Delta > 0  → creates exactly `delta` new Teacher + User records
 * - Delta < 0  → logs a warning; DOES NOT delete or modify any existing record
 * - Delta = 0  → logs that the department is already at baseline and skips
 *
 * Safe to run multiple times: counts are re-read from the DB on each run.
 */

import "dotenv/config";
import {
  PrismaClient,
  Role,
  Sex,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Stakeholder-approved baseline counts per department
// ---------------------------------------------------------------------------
const BASELINE: Record<string, number> = {
  SCI: 19,
  MATH: 22,
  ENG: 22,
  TLE: 22,
  FIL: 16,
  ESP: 11,
  MAPEH: 21,
  AP: 13,
};

// ---------------------------------------------------------------------------
// Department metadata (subject label + specialization pool)
// ---------------------------------------------------------------------------
const DEPARTMENT_DATA: Record<
  string,
  { subject: string; specializations: string[] }
> = {
  ENG: {
    subject: "ENGLISH",
    specializations: [
      "MAJOR IN ENGLISH / APPLIED LINGUISTICS",
      "LITERATURE / CREATIVE WRITING",
      "MASS COMMUNICATION",
      "JOURNALISM",
      "MAJOR IN ENGLISH (CAMPUS JOURNALISM)",
    ],
  },
  MATH: {
    subject: "MATHEMATICS",
    specializations: [
      "MAJOR IN MATHEMATICS",
      "MAJOR IN MATHEMATICS (WITH STATISTICS BACKGROUND)",
    ],
  },
  SCI: {
    subject: "SCIENCE",
    specializations: [
      "MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS",
      "MAJOR IN PHYSICS",
      "MAJOR IN CHEMISTRY",
      "MAJOR IN BIOLOGY",
    ],
  },
  FIL: {
    subject: "FILIPINO",
    specializations: [
      "MAJOR IN FILIPINO",
      "MAJOR IN FILIPINO (CAMPUS JOURNALISM)",
    ],
  },
  AP: {
    subject: "ARALING PANLIPUNAN",
    specializations: ["MAJOR IN SOCIAL STUDIES / HISTORY"],
  },
  MAPEH: {
    subject: "MAPEH",
    specializations: [
      "MAJOR IN MAPEH",
      "MAJOR IN MUSIC EDUCATION",
      "MAJOR IN PHYSICAL EDUCATION",
      "FINE ARTS",
      "THEATER / PERFORMING ARTS",
      "DANCE",
      "SPORTS SCIENCE",
      "CERTIFIED SPECIALIST COACH",
    ],
  },
  TLE: {
    subject: "TLE",
    specializations: [
      "MAJOR IN HOME ECONOMICS",
      "MAJOR IN INDUSTRIAL ARTS",
      "MAJOR IN AGRI-FISHERY ARTS",
      "MAJOR IN ICT",
    ],
  },
  ESP: {
    subject: "VALUES EDUCATION",
    specializations: ["MAJOR IN VALUES EDUCATION"],
  },
};

// ---------------------------------------------------------------------------
// PH name pools (same as seed-teachers.ts)
// ---------------------------------------------------------------------------
const PH_FIRST_NAMES_MALE = [
  "JUAN",
  "MIGUEL",
  "CARLO",
  "RAFAEL",
  "ANTONIO",
  "GABRIEL",
  "MATEO",
  "DIEGO",
  "EMMANUEL",
  "CHRISTIAN",
  "JOSHUA",
  "ANGELO",
  "RICARDO",
  "FERDINAND",
  "RODRIGO",
  "MANUEL",
  "BENIGNO",
  "ELPIDIO",
  "SERGIO",
  "DIOSDADO",
  "JOSEPH",
  "VICENTE",
  "ANDRES",
  "EMILIO",
  "APOLINARIO",
  "MARCELO",
  "GREGORIO",
  "JUANCHO",
  "ALBERTO",
  "RENATO",
  "EDUARDO",
  "ROBERTO",
  "FRANCISCO",
  "ARTHUR",
  "REYNALDO",
  "ROMEO",
  "RAMON",
  "JULIO",
  "CESAR",
  "ERNESTO",
  "FELIPE",
  "GUILLERMO",
  "HOMER",
  "IGNACIO",
  "JAIME",
  "LEONARDO",
  "MARIANO",
  "NESTOR",
  "ORLANDO",
  "PABLO",
  "QUINTIN",
  "ROLANDO",
  "SALVADOR",
  "TOMAS",
  "URBANO",
  "VICTOR",
  "WILFREDO",
  "XAVIER",
  "YURI",
  "ZACARIAS",
  "ALFONSO",
  "BERNARDO",
  "CORNELIO",
  "DOMINGO",
  "EFREN",
  "FIDEL",
  "GILBERTO",
];
const PH_FIRST_NAMES_FEMALE = [
  "ANGELICA",
  "PRINCESS",
  "JASMINE",
  "NICOLE",
  "GABRIELA",
  "SOFIA",
  "ISABELLA",
  "BEA",
  "CRISTINA",
  "PATRICIA",
  "ELENA",
  "ROSA",
  "TERESA",
  "IMELDA",
  "GLORIA",
  "REMEDIOS",
  "CARMELA",
  "JOSEFINA",
  "PERLA",
  "AURORA",
  "ESTRELLA",
  "CORAZON",
  "LOURDES",
  "CRISTETA",
  "FELICIDAD",
  "LEONOR",
  "MARIA",
  "CONCEPCION",
  "SALVACION",
  "PURISIMA",
  "ANITA",
  "BELEN",
  "CARMEN",
  "DOLORES",
  "EVANGELINE",
  "FLORDELIZA",
  "GENOVEVA",
  "HELEN",
  "IRENE",
  "JULIETA",
  "KRISTINE",
  "LEONILA",
  "MILAGROS",
  "NATIVIDAD",
  "OFELIA",
  "PACITA",
  "QUINTINA",
  "ROSARIO",
  "SOCORRO",
  "TRINIDAD",
  "URSULA",
  "VIRGINIA",
  "WENDY",
  "XYZA",
  "YOLANDA",
  "ZENAIDA",
  "ALICIA",
  "BEATRIZ",
  "CATALINA",
  "DINAH",
  "EULALIA",
  "FLORENCIA",
];
const PH_LAST_NAMES = [
  "FERNANDEZ",
  "NAVARRO",
  "GONZALES",
  "VILLANUEVA",
  "CRUZ",
  "PASCUAL",
  "AQUINO",
  "MARCOS",
  "DUTERTE",
  "ESTRADA",
  "ARROYO",
  "MAGSAYSAY",
  "QUIRINO",
  "OSMEÑA",
  "MACAPAGAL",
  "QUEZON",
  "MAGNO",
  "BALTAZAR",
  "SANTIAGO",
  "DE LEON",
  "CASTILLO",
  "SORIANO",
  "DEL ROSARIO",
  "VALDEZ",
  "RODRIGUEZ",
  "PANGANIBAN",
  "IBARRA",
  "LUNA",
  "SILANG",
  "GARCIA",
  "MENDOZA",
  "REYES",
  "BAUTISTA",
  "TORRES",
  "RAMOS",
  "FLORES",
  "DOMINGO",
  "TOLENTINO",
  "DELA CRUZ",
  "SANTOS",
  "OCAMPO",
  "AGUILAR",
  "ALVAREZ",
  "BERNARDO",
  "CABRERA",
  "DIAZ",
  "EVANGELISTA",
  "FAJARDO",
  "GOMEZ",
  "HERNANDEZ",
  "IGNACIO",
  "JAVIER",
  "LACSON",
  "MALLARI",
  "NATIVIDAD",
  "ORTEGA",
  "PEREZ",
  "QUIAMBAO",
  "RIVERA",
  "SALAZAR",
  "TAYAG",
  "UMALI",
  "VERGARA",
  "YAP",
  "ZAMORA",
  "ALCANTARA",
  "BELTRAN",
  "CORTEZ",
  "DAVID",
  "ENRIQUEZ",
  "FRANCISCO",
  "GUTIERREZ",
  "ILAGAN",
  "JACINTO",
  "LAUREL",
  "MACALINTAL",
  "NICOLAS",
  "PADA",
  "QUINTO",
  "ROXAS",
  "SALVADOR",
  "TUASON",
  "URBANO",
  "VALENCIA",
  "YAMBAO",
  "ZARATE",
];
const PH_MIDDLE_NAMES = [
  "SANTIAGO",
  "DE LEON",
  "BALTAZAR",
  "CASTILLO",
  "SORIANO",
  "DEL ROSARIO",
  "VALDEZ",
  "RODRIGUEZ",
  "PANGANIBAN",
  "IBARRA",
  "LUNA",
  "SILANG",
  "AGONCILLO",
  "MAGBANUA",
  "TECSON",
  "LLANES",
  "ESCODA",
  "VILLA",
  "GUERRERO",
  "HERNANDEZ",
  "TOLENTINO",
  "ABELLA",
  "GARCIA",
  "MENDOZA",
  "REYES",
  "BAUTISTA",
  "TORRES",
  "RAMOS",
  "FLORES",
  "DOMINGO",
  "DELA CRUZ",
  "SANTOS",
  "OCAMPO",
  "AGUILAR",
  "ALVAREZ",
  "BERNARDO",
  "CABRERA",
  "DIAZ",
  "EVANGELISTA",
  "FAJARDO",
  "GOMEZ",
  "IGNACIO",
  "JAVIER",
  "LACSON",
  "MALLARI",
  "NATIVIDAD",
  "ORTEGA",
  "PEREZ",
  "QUIAMBAO",
  "RIVERA",
  "SALAZAR",
  "TAYAG",
  "UMALI",
  "VERGARA",
  "YAP",
  "ZAMORA",
];

const PLANTILLA_SEQUENCE: string[] = [
  ...Array(40).fill("TEACHER I"),
  ...Array(30).fill("TEACHER II"),
  ...Array(20).fill("TEACHER III"),
  ...Array(7).fill("MASTER TEACHER I"),
  ...Array(3).fill("MASTER TEACHER II"),
];

// ---------------------------------------------------------------------------
// Uniqueness registries (populated from DB before any generation)
// ---------------------------------------------------------------------------
const USED_EMAIL_KEYS = new Set<string>();
const USED_FULL_NAMES = new Set<string>();

function generateUniqueName(
  seed: number,
  sex: Sex,
): { firstName: string; lastName: string; middleName: string } {
  const firstNames =
    sex === "MALE" ? PH_FIRST_NAMES_MALE : PH_FIRST_NAMES_FEMALE;
  let attempts = 0;
  while (true) {
    const fnIdx = (seed + attempts * 13) % firstNames.length;
    const lnIdx = (seed * 3 + attempts * 17) % PH_LAST_NAMES.length;
    const mnIdx = (seed * 5 + attempts * 19) % PH_MIDDLE_NAMES.length;

    const firstName = firstNames[fnIdx];
    const lastName = PH_LAST_NAMES[lnIdx];
    const middleName = PH_MIDDLE_NAMES[mnIdx];

    const fullNameKey = `${firstName}|${lastName}|${middleName}`.toUpperCase();
    const emailKey = `${firstName.toLowerCase().replace(/\s/g, "")}.${lastName.toLowerCase().replace(/\s/g, "")}`;

    if (!USED_FULL_NAMES.has(fullNameKey) && !USED_EMAIL_KEYS.has(emailKey)) {
      USED_FULL_NAMES.add(fullNameKey);
      USED_EMAIL_KEYS.add(emailKey);
      return { firstName, lastName, middleName };
    }
    attempts++;
  }
}

function generateUniqueEmployeeId(usedIds: Set<string>): string {
  while (true) {
    const id = Math.floor(1000000 + Math.random() * 9000000).toString();
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(
    "🔧 Discrepancy Seed: Aligning department faculty counts to stakeholder baseline...\n",
  );

  // 1. Load existing teacher data into uniqueness registries
  const existingTeachers = await prisma.teacher.findMany({
    select: {
      employeeId: true,
      email: true,
      firstName: true,
      lastName: true,
      middleName: true,
    },
  });

  const usedEmployeeIds = new Set<string>(
    existingTeachers.map((t) => t.employeeId),
  );

  existingTeachers.forEach((t) => {
    USED_EMAIL_KEYS.add(t.email.split("@")[0].toLowerCase());
    const fullNameKey =
      `${t.firstName}|${t.lastName}|${t.middleName ?? ""}`.toUpperCase();
    USED_FULL_NAMES.add(fullNameKey);
  });

  // Also guard against collisions with non-teacher user emails
  const existingUserEmails = await prisma.user.findMany({
    select: { email: true },
  });
  existingUserEmails.forEach((u) => {
    if (u.email) USED_EMAIL_KEYS.add(u.email.split("@")[0].toLowerCase());
  });

  // 2. Fetch departments
  const departments = await prisma.department.findMany();

  // 3. Count teachers per department code
  const deptCounts = await prisma.teacher.groupBy({
    by: ["departmentId"],
    _count: { id: true },
  });
  const deptIdToCode = new Map(departments.map((d) => [d.id, d.code]));
  const currentCounts: Record<string, number> = {};
  for (const row of deptCounts) {
    if (row.departmentId !== null) {
      const code = deptIdToCode.get(row.departmentId);
      if (code) currentCounts[code] = row._count.id;
    }
  }

  const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 10);

  // Offset seed high enough to avoid name collisions with seed-teachers.ts (which uses 0–4999)
  let nameSeed = 5000;
  let plantillaIdx = 0;
  let totalAdded = 0;

  console.log("Department Alignment Report:");
  console.log("─".repeat(56));

  for (const [deptCode, target] of Object.entries(BASELINE)) {
    const current = currentCounts[deptCode] ?? 0;
    const delta = target - current;
    const dept = departments.find((d) => d.code === deptCode);

    if (!dept) {
      console.warn(
        `  WARN  ${deptCode.padEnd(6)}  dept not found in DB — skipping`,
      );
      continue;
    }

    if (delta === 0) {
      console.log(
        `  ✅    ${deptCode.padEnd(6)}  ${current} / ${target}  [already at baseline]`,
      );
      continue;
    }

    if (delta < 0) {
      console.warn(
        `  ⚠️    ${deptCode.padEnd(6)}  ${current} / ${target}  [${Math.abs(delta)} above baseline — manual review required]`,
      );
      continue;
    }

    // delta > 0: add missing teachers
    const deptInfo = DEPARTMENT_DATA[deptCode];
    console.log(
      `  ➕    ${deptCode.padEnd(6)}  ${current} / ${target}  [adding ${delta} teacher(s)]`,
    );

    for (let i = 0; i < delta; i++) {
      const sex: Sex = nameSeed % 2 === 0 ? "FEMALE" : "MALE";
      const { firstName, lastName, middleName } = generateUniqueName(
        nameSeed,
        sex,
      );
      const specialization =
        deptInfo.specializations[nameSeed % deptInfo.specializations.length];
      const employeeId = generateUniqueEmployeeId(usedEmployeeIds);
      const contactNumber = `0917-${String(500 + nameSeed).slice(-3)}-${String(2000 + nameSeed).slice(-4)}`;
      const cleanFirst = firstName.toLowerCase().replace(/\s/g, "");
      const cleanLast = lastName.toLowerCase().replace(/\s/g, "");
      const email = `${cleanFirst}.${cleanLast}@deped.edu.ph`;
      const plantillaPosition =
        PLANTILLA_SEQUENCE[plantillaIdx % PLANTILLA_SEQUENCE.length];

      // Step 1: Create teacher record
      const teacher = await prisma.teacher.create({
        data: {
          employeeId,
          firstName,
          lastName,
          middleName,
          email,
          sex,
          specialization,
          isActive: true,
          designation: "SUBJECT TEACHER",
          departmentId: dept.id,
          contactNumber,
          plantillaPosition,
        },
      });

      // Step 2: Create user login account
      const user = await prisma.user.create({
        data: {
          employeeId,
          firstName,
          lastName,
          middleName,
          email,
          password: defaultPasswordHash,
          role: "TEACHER" as Role,
          sex,
          isActive: true,
          designation: "SUBJECT TEACHER",
          accountName: employeeId,
        },
        select: { id: true },
      });

      // Step 3: Link user account to teacher profile
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { userId: user.id },
      });

      nameSeed++;
      plantillaIdx++;
      totalAdded++;
    }
  }

  console.log("─".repeat(56));
  console.log(
    `\n✅ Done. ${totalAdded} teacher(s) added across all departments.`,
  );
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
