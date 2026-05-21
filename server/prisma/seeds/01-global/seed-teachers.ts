import "dotenv/config";
import {
  PrismaClient,
  SectionAdviserStatus,
  Role,
  Sex,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";
import {
  DEPED_TEACHER_DEPARTMENT_VALUES,
  DEPED_TEACHER_SPECIALIZATION_VALUES,
  DEPED_TEACHER_SUBJECT_VALUES,
} from "@enrollpro/shared";

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
  assignmentTarget?: TeacherAssignmentTarget;
}

type TeacherAssignmentKind =
  | "STE"
  | "SPA_ARTS"
  | "SPS_SPORTS";

interface TeacherAssignmentTarget {
  kind: TeacherAssignmentKind;
  poolIndex: number;
}

const ATLAS_FACULTY: Faculty[] = [
  {
    employeeId: "2000001",
    firstName: "MARIA",
    lastName: "SANTOS",
    middleName: "SANTIAGO",
    deptCode: "FIL",
    subject: "FILIPINO",
    sex: "FEMALE",
    contactNumber: "0917-111-0001",
    specialization: "MAJOR IN FILIPINO",
  },
  {
    employeeId: "2000002",
    firstName: "JOSE",
    lastName: "REYES",
    middleName: "DE LEON",
    deptCode: "ENG",
    subject: "ENGLISH",
    sex: "MALE",
    contactNumber: "0917-111-0002",
    specialization: "MAJOR IN ENGLISH / APPLIED LINGUISTICS",
  },
  {
    employeeId: "2000003",
    firstName: "ANA",
    lastName: "DELA CRUZ",
    middleName: "BALTAZAR",
    deptCode: "MATH",
    subject: "MATHEMATICS",
    sex: "FEMALE",
    contactNumber: "0917-111-0003",
    specialization: "MAJOR IN MATHEMATICS",
  },
  {
    employeeId: "2000004",
    firstName: "MARK",
    lastName: "VILLANUEVA",
    middleName: "CASTILLO",
    deptCode: "SCI",
    subject: "SCIENCE",
    sex: "MALE",
    contactNumber: "0917-111-0004",
    specialization: "MAJOR IN GENERAL SCIENCE / BIOLOGY / CHEMISTRY / PHYSICS",
  },
  {
    employeeId: "2000005",
    firstName: "LIZA",
    lastName: "GARCIA",
    middleName: "SORIANO",
    deptCode: "AP",
    subject: "ARALING PANLIPUNAN",
    sex: "FEMALE",
    contactNumber: "0917-111-0005",
    specialization: "MAJOR IN SOCIAL STUDIES / HISTORY",
  },
  {
    employeeId: "2000006",
    firstName: "PAOLO",
    lastName: "CASTRO",
    middleName: "DEL ROSARIO",
    deptCode: "MAPEH",
    subject: "MAPEH",
    sex: "MALE",
    contactNumber: "0917-111-0006",
    specialization: "MAJOR IN MAPEH",
  },
  {
    employeeId: "2000007",
    firstName: "RICA",
    lastName: "MENDOZA",
    middleName: "VALDEZ",
    deptCode: "ESP",
    subject: "VALUES EDUCATION",
    sex: "FEMALE",
    contactNumber: "0917-111-0007",
    specialization: "MAJOR IN VALUES EDUCATION",
  },
  {
    employeeId: "2000008",
    firstName: "NEIL",
    lastName: "TORRES",
    middleName: "RODRIGUEZ",
    deptCode: "TLE",
    subject: "ICT",
    sex: "MALE",
    contactNumber: "0917-111-0008",
    specialization: "MAJOR IN ICT",
  },
  {
    employeeId: "2000009",
    firstName: "GRACE",
    lastName: "AQUINO",
    middleName: "PANGANIBAN",
    deptCode: "ESP",
    subject: "VALUES EDUCATION",
    sex: "FEMALE",
    contactNumber: "0917-111-0009",
    specialization: "MAJOR IN VALUES EDUCATION",
  },
  {
    employeeId: "2000010",
    firstName: "IVY",
    lastName: "FLORES",
    middleName: "IBARRA",
    deptCode: "MATH",
    subject: "MATHEMATICS",
    sex: "FEMALE",
    contactNumber: "0917-111-0010",
    specialization: "MAJOR IN MATHEMATICS",
  },
  {
    employeeId: "2000011",
    firstName: "JOMAR",
    lastName: "NAVARRO",
    middleName: "LUNA",
    deptCode: "SCI",
    subject: "SCIENCE",
    sex: "MALE",
    contactNumber: "0917-111-0011",
    specialization: "MAJOR IN BIOLOGY",
  },
  {
    employeeId: "2000012",
    firstName: "CELIA",
    lastName: "PASCUAL",
    middleName: "SILANG",
    deptCode: "ENG",
    subject: "ENGLISH",
    sex: "FEMALE",
    contactNumber: "0917-111-0012",
    specialization: "LITERATURE / CREATIVE WRITING",
  },
  {
    employeeId: "2000013",
    firstName: "RAMON",
    lastName: "LOPEZ",
    middleName: "MABINI",
    deptCode: "FIL",
    subject: "FILIPINO",
    sex: "MALE",
    contactNumber: "0917-111-0013",
    specialization: "MAJOR IN FILIPINO",
  },
  {
    employeeId: "2000014",
    firstName: "KATRINA",
    lastName: "SALAZAR",
    middleName: "BONIFACIO",
    deptCode: "AP",
    subject: "ARALING PANLIPUNAN",
    sex: "FEMALE",
    contactNumber: "0917-111-0014",
    specialization: "MAJOR IN SOCIAL STUDIES / HISTORY",
  },
  {
    employeeId: "2000015",
    firstName: "LOURDES",
    lastName: "VALDEZ",
    middleName: "JACINTO",
    deptCode: "MAPEH",
    subject: "MAPEH",
    sex: "FEMALE",
    contactNumber: "0917-111-0015",
    specialization: "MAJOR IN MUSIC EDUCATION",
  },
  {
    employeeId: "2000016",
    firstName: "HAROLD",
    lastName: "BAUTISTA",
    middleName: "DAGOHOY",
    deptCode: "ESP",
    subject: "VALUES EDUCATION",
    sex: "MALE",
    contactNumber: "0917-111-0016",
    specialization: "MAJOR IN VALUES EDUCATION",
  },
  {
    employeeId: "2000017",
    firstName: "MIKA",
    lastName: "RAMOS",
    middleName: "MALVAR",
    deptCode: "TLE",
    subject: "HOME ECONOMICS",
    sex: "FEMALE",
    contactNumber: "0917-111-0017",
    specialization: "MAJOR IN HOME ECONOMICS",
  },
  {
    employeeId: "2000018",
    firstName: "JONAS",
    lastName: "DOMINGO",
    middleName: "RECTO",
    deptCode: "MATH",
    subject: "MATHEMATICS",
    sex: "MALE",
    contactNumber: "0917-111-0018",
    specialization: "MAJOR IN MATHEMATICS (WITH STATISTICS BACKGROUND)",
  },
  {
    employeeId: "2000019",
    firstName: "ELLA",
    lastName: "RIVERA",
    middleName: "LAUREL",
    deptCode: "SCI",
    subject: "SCIENCE",
    sex: "FEMALE",
    contactNumber: "0917-111-0019",
    specialization: "MAJOR IN PHYSICS",
  },
  {
    employeeId: "2000020",
    firstName: "DARREN",
    lastName: "SERRANO",
    middleName: "ROXAS",
    deptCode: "ENG",
    subject: "ENGLISH",
    sex: "MALE",
    contactNumber: "0917-111-0020",
    specialization: "MASS COMMUNICATION",
  },
];

const PH_FIRST_NAMES_MALE = [
  "JUAN", "MIGUEL", "CARLO", "RAFAEL", "ANTONIO", "GABRIEL", "MATEO", "DIEGO", "EMMANUEL", "CHRISTIAN", 
  "JOSHUA", "ANGELO", "RICARDO", "FERDINAND", "RODRIGO", "MANUEL", "BENIGNO", "ELPIDIO", "SERGIO", "DIOSDADO", 
  "JOSEPH", "VICENTE", "ANDRES", "EMILIO", "APOLINARIO", "MARCELO", "GREGORIO", "JUANCHO", "ALBERTO", "RENATO", 
  "EDUARDO", "ROBERTO", "FRANCISCO", "ARTHUR", "REYNALDO", "ROMEO", "RAMON", "JULIO", "CESAR", "ERNESTO", 
  "FELIPE", "GUILLERMO", "HOMER", "IGNACIO", "JAIME", "LEONARDO", "MARIANO", "NESTOR", "ORLANDO", "PABLO", 
  "QUINTIN", "ROLANDO", "SALVADOR", "TOMAS", "URBANO", "VICTOR", "WILFREDO", "XAVIER", "YURI", "ZACARIAS", 
  "ALFONSO", "BERNARDO", "CORNELIO", "DOMINGO", "EFREN", "FIDEL", "GILBERTO"
];
const PH_FIRST_NAMES_FEMALE = [
  "ANGELICA", "PRINCESS", "JASMINE", "NICOLE", "GABRIELA", "SOFIA", "ISABELLA", "BEA", "CRISTINA", "PATRICIA", 
  "ELENA", "ROSA", "TERESA", "IMELDA", "GLORIA", "REMEDIOS", "CARMELA", "JOSEFINA", "PERLA", "AURORA", 
  "ESTRELLA", "CORAZON", "LOURDES", "CRISTETA", "FELICIDAD", "LEONOR", "MARIA", "CONCEPCION", "SALVACION", "PURISIMA",
  "ANITA", "BELEN", "CARMEN", "DOLORES", "EVANGELINE", "FLORDELIZA", "GENOVEVA", "HELEN", "IRENE", "JULIETA", 
  "KRISTINE", "LEONILA", "MILAGROS", "NATIVIDAD", "OFELIA", "PACITA", "QUINTINA", "ROSARIO", "SOCORRO", "TRINIDAD", 
  "URSULA", "VIRGINIA", "WENDY", "XYZA", "YOLANDA", "ZENAIDA", "ALICIA", "BEATRIZ", "CATALINA", "DINAH", 
  "EULALIA", "FLORENCIA"
];
const PH_LAST_NAMES = [
  "FERNANDEZ", "NAVARRO", "GONZALES", "VILLANUEVA", "CRUZ", "PASCUAL", "AQUINO", "MARCOS", "DUTERTE", "ESTRADA", 
  "ARROYO", "MAGSAYSAY", "QUIRINO", "OSMEÑA", "MACAPAGAL", "QUEZON", "MAGNO", "BALTAZAR", "SANTIAGO", "DE LEON", 
  "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "PANGANIBAN", "IBARRA", "LUNA", "SILANG",
  "GARCIA", "MENDOZA", "REYES", "BAUTISTA", "TORRES", "RAMOS", "FLORES", "DOMINGO", "TOLENTINO", "DELA CRUZ", "SANTOS", 
  "OCAMPO", "AGUILAR", "ALVAREZ", "BERNARDO", "CABRERA", "DIAZ", "EVANGELISTA", "FAJARDO", "GOMEZ", "HERNANDEZ", 
  "IGNACIO", "JAVIER", "LACSON", "MALLARI", "NATIVIDAD", "ORTEGA", "PEREZ", "QUIAMBAO", "RIVERA", "SALAZAR", "TAYAG", 
  "UMALI", "VERGARA", "YAP", "ZAMORA", "ALCANTARA", "BELTRAN", "CORTEZ", "DAVID", "ENRIQUEZ", "FRANCISCO", "GUTIERREZ", 
  "ILAGAN", "JACINTO", "LAUREL", "MACALINTAL", "NICOLAS", "PADA", "QUINTO", "ROXAS", "SALVADOR", "TUASON", "URBANO", 
  "VALENCIA", "YAMBAO", "ZARATE"
];
const PH_MIDDLE_NAMES = [
  "SANTIAGO", "DE LEON", "BALTAZAR", "CASTILLO", "SORIANO", "DEL ROSARIO", "VALDEZ", "RODRIGUEZ", "PANGANIBAN", 
  "IBARRA", "LUNA", "SILANG", "AGONCILLO", "MAGBANUA", "TECSON", "LLANES", "ESCODA", "VILLA", "GUERRERO", "HERNANDEZ", 
  "TOLENTINO", "ABELLA", "GARCIA", "MENDOZA", "REYES", "BAUTISTA", "TORRES", "RAMOS", "FLORES", "DOMINGO", 
  "DELA CRUZ", "SANTOS", "OCAMPO", "AGUILAR", "ALVAREZ", "BERNARDO", "CABRERA", "DIAZ", "EVANGELISTA", "FAJARDO", 
  "GOMEZ", "IGNACIO", "JAVIER", "LACSON", "MALLARI", "NATIVIDAD", "ORTEGA", "PEREZ", "QUIAMBAO", "RIVERA", "SALAZAR", 
  "TAYAG", "UMALI", "VERGARA", "YAP", "ZAMORA"
];

// Global unique name registry to ensure absolutely no repeats
const GLOBAL_USED_EMAIL_KEYS = new Set<string>();
const GLOBAL_USED_FULL_NAMES = new Set<string>();

for (const f of ATLAS_FACULTY) {
  const fullNameKey = `${f.firstName}|${f.lastName}|${f.middleName ?? ""}`.toUpperCase();
  const emailKey = `${f.firstName.toLowerCase().replace(/\\s/g, "")}.${f.lastName.toLowerCase().replace(/\\s/g, "")}`;
  GLOBAL_USED_FULL_NAMES.add(fullNameKey);
  GLOBAL_USED_EMAIL_KEYS.add(emailKey);
}

function generateUniqueName(seed: number, sex: Sex) {
  const firstNames = sex === "MALE" ? PH_FIRST_NAMES_MALE : PH_FIRST_NAMES_FEMALE;
  let attempts = 0;
  while (true) {
    const fnIdx = (seed + attempts * 13) % firstNames.length;
    const lnIdx = (seed * 3 + attempts * 17) % PH_LAST_NAMES.length;
    const mnIdx = (seed * 5 + attempts * 19) % PH_MIDDLE_NAMES.length;

    const firstName = firstNames[fnIdx];
    const lastName = PH_LAST_NAMES[lnIdx];
    const middleName = PH_MIDDLE_NAMES[mnIdx];
    
    const fullNameKey = `${firstName}|${lastName}|${middleName}`.toUpperCase();
    const emailKey = `${firstName.toLowerCase().replace(/\\s/g, "")}.${lastName.toLowerCase().replace(/\\s/g, "")}`;

    if (!GLOBAL_USED_FULL_NAMES.has(fullNameKey) && !GLOBAL_USED_EMAIL_KEYS.has(emailKey)) {
      GLOBAL_USED_FULL_NAMES.add(fullNameKey);
      GLOBAL_USED_EMAIL_KEYS.add(emailKey);
      return { firstName, lastName, middleName };
    }
    attempts++;
  }
}

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

const DEPARTMENTS_WEIGHTED = [
  { code: "ENG", weight: 15 },
  { code: "MATH", weight: 15 },
  { code: "SCI", weight: 15 },
  { code: "FIL", weight: 12 },
  { code: "AP", weight: 12 },
  { code: "MAPEH", weight: 12 },
  { code: "TLE", weight: 11 },
  { code: "ESP", weight: 8 },
];

const TARGET_DEPT_COUNTS: Record<string, number> = {
  SCI: 19,
  MATH: 22,
  ENG: 22,
  TLE: 22,
  FIL: 16,
  ESP: 11,
  MAPEH: 21,
  AP: 13,
};

const PLANTILLA_SEQUENCE: string[] = [
  ...Array(40).fill("TEACHER I"),
  ...Array(30).fill("TEACHER II"),
  ...Array(20).fill("TEACHER III"),
  ...Array(7).fill("MASTER TEACHER I"),
  ...Array(3).fill("MASTER TEACHER II"),
];

const STE_ADVISER_SPECIALIZATIONS = [
  "ENVIRONMENTAL SCIENCE",
  "RESEARCH I",
  "BASIC STATISTICS",
  "RESEARCH II",
  "ADVANCED STATISTICS",
  "BIOTECHNOLOGY",
  "RESEARCH III",
  "ADVANCED PHYSICS",
];

const SPA_ARTS_ADVISER_SPECIALIZATIONS = [
  "MUSIC EDUCATION",
  "FINE ARTS",
  "THEATER / PERFORMING ARTS",
  "DANCE",
  "LITERATURE / CREATIVE WRITING",
  "MUSIC EDUCATION",
  "FINE ARTS",
  "THEATER / PERFORMING ARTS",
];

const SPS_ADVISER_SPECIALIZATIONS = [
  "MAJOR IN PHYSICAL EDUCATION",
  "SPORTS SCIENCE",
  "CERTIFIED SPECIALIST COACH",
  "SPORTS COACHING",
  "INDIVIDUAL / DUAL SPORTS",
  "TEAM SPORTS",
  "SPORTS OFFICIATING",
  "SPORTS SCIENCE",
];

function buildFacultyTemplate(params: {
  employeeId: string;
  seedIndex: number;
  deptCode: string;
  subject: string;
  specialization: string;
  assignmentTarget?: TeacherAssignmentTarget;
}): Faculty {
  const sex: Sex = params.seedIndex % 2 === 0 ? "FEMALE" : "MALE";
  const { firstName, lastName, middleName } = generateUniqueName(params.seedIndex, sex);

  return {
    employeeId: params.employeeId,
    firstName,
    lastName,
    middleName,
    deptCode: params.deptCode,
    subject: params.subject,
    sex,
    contactNumber: `0917-910-${String(1000 + params.seedIndex).padStart(4, "0")}`,
    specialization: params.specialization,
    assignmentTarget: params.assignmentTarget,
  };
}

function buildFacultyPool(params: {
  baseEmployeeId: number;
  seedOffset: number;
  deptCode: string;
  subject: string;
  specializations: string[];
  assignmentKind: TeacherAssignmentKind;
}): Faculty[] {
  return params.specializations.map((specialization, index) =>
    buildFacultyTemplate({
      employeeId: String(params.baseEmployeeId + index).padStart(7, "0"),
      seedIndex: params.seedOffset + index,
      deptCode: params.deptCode,
      subject: params.subject,
      specialization,
      assignmentTarget: {
        kind: params.assignmentKind,
        poolIndex: index,
      },
    }),
  );
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

async function main() {
  console.log(
    "≡ƒî▒ Scaling Faculty Roster: Generating 140+ UNIQUE DepEd Teachers...",
  );

  // 0. CLEANUP: Remove existing teachers and their login accounts to prevent ID/Email conflicts
  console.log("≡ƒº╣ Cleaning up existing faculty data...");

  await prisma.user.deleteMany({ where: { role: "TEACHER" } });

  await prisma.teacherSubject.deleteMany({});
  await prisma.teacherDesignation.deleteMany({});
  await prisma.sectionAdviser.deleteMany({});
  await prisma.teacher.deleteMany({});

  const demoStartYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2025-2026" },
  });

  if (!demoStartYear)
    throw new Error(
      "Timeline failure: 2025-2026 not found. Run base seed first.",
    );

  // Fetch ALL school years for persistent teacher assignments (2022-2025)
  const allSchoolYears = await prisma.schoolYear.findMany({
    where: {
      yearLabel: {
        in: ["2022-2023", "2023-2024", "2024-2025", "2025-2026"],
      },
    },
    orderBy: { yearLabel: "asc" },
  });

  if (allSchoolYears.length === 0) {
    throw new Error("No school years found in database.");
  }

  const departments = await prisma.department.findMany();
  // Fetch sections for 2025-2026 (primary year for identifying class advisers)
  const sections = await prisma.section.findMany({
    where: { schoolYearId: demoStartYear.id },
    orderBy: [{ gradeLevelId: "asc" }, { sortOrder: "asc" }],
  });

  // Fetch sections for ALL school years for persistent assignment
  const sectionsByYear = new Map<number, typeof sections>();
  for (const schoolYear of allSchoolYears) {
    const yearSections = await prisma.section.findMany({
      where: { schoolYearId: schoolYear.id },
      orderBy: [{ gradeLevelId: "asc" }, { sortOrder: "asc" }],
    });
    sectionsByYear.set(schoolYear.id, yearSections);
  }



  const steSpecialFaculty = buildFacultyPool({
    baseEmployeeId: 3100000,
    seedOffset: 200,
    deptCode: "SCI",
    subject: "SCIENCE",
    specializations: STE_ADVISER_SPECIALIZATIONS,
    assignmentKind: "STE",
  });

  const spaSpecialFaculty = buildFacultyPool({
    baseEmployeeId: 3200000,
    seedOffset: 300,
    deptCode: "MAPEH",
    subject: "MAPEH",
    specializations: SPA_ARTS_ADVISER_SPECIALIZATIONS,
    assignmentKind: "SPA_ARTS",
  });

  const spsSpecialFaculty = buildFacultyPool({
    baseEmployeeId: 3300000,
    seedOffset: 400,
    deptCode: "MAPEH",
    subject: "MAPEH",
    specializations: SPS_ADVISER_SPECIALIZATIONS,
    assignmentKind: "SPS_SPORTS",
  });

  const teachersToSeed: Faculty[] = [
    ...ATLAS_FACULTY,
    ...steSpecialFaculty,
    ...spaSpecialFaculty,
    ...spsSpecialFaculty,
  ];

  const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 10);

  const dynamicTleSpecializations = DEPARTMENT_DATA.TLE.specializations;

  // Fetch all existing users from DB to prevent email collisions with non-teacher users (Admins, Registrars, etc.)
  const existingUsers = await prisma.user.findMany({ select: { email: true } });
  existingUsers.forEach((u) => {
    if (u.email) {
      const parts = u.email.split("@")[0].toLowerCase();
      GLOBAL_USED_EMAIL_KEYS.add(parts);
    }
  });

  // 2. Generate remaining teachers deterministically to strictly meet exact counts
  console.log("≡ƒöÇ Building deterministic name roster matching exact department counts...");

  const currentCounts: Record<string, number> = {};
  for (const f of teachersToSeed) {
    currentCounts[f.deptCode] = (currentCounts[f.deptCode] || 0) + 1;
  }

  let localIdx = 0;
  for (const [deptCode, target] of Object.entries(TARGET_DEPT_COUNTS)) {
    const current = currentCounts[deptCode] || 0;
    const needed = target - current;
    
    if (needed > 0) {
      const deptInfo = DEPARTMENT_DATA[deptCode as keyof typeof DEPARTMENT_DATA];
      const specializationPool = deptCode === "TLE" ? dynamicTleSpecializations : deptInfo.specializations;
      
      for (let i = 0; i < needed; i++) {
        const sex: Sex = localIdx % 2 === 0 ? "FEMALE" : "MALE";
        const { firstName, lastName, middleName } = generateUniqueName(1000 + localIdx, sex);

        const specialization = specializationPool[localIdx % specializationPool.length];
        const employeeId = (2000020 + localIdx + 1).toString();
        const contactNumber = `0917-${String(200 + localIdx).padStart(3, "0")}-${String(1000 + localIdx).padStart(4, "0")}`;

        teachersToSeed.push({
          employeeId,
          firstName,
          lastName,
          middleName,
          deptCode,
          subject: deptInfo.subject,
          sex,
          contactNumber,
          specialization,
        });
        localIdx++;
      }
    } else if (needed < 0) {
      console.warn(`  ΓÜá∩╕Å Already have more ${deptCode} teachers than target (${current} > ${target}). Skipping generation.`);
    }
  }

  const usedEmployeeIds = new Set<string>();
  const existingUsersForIds = await prisma.user.findMany({ select: { employeeId: true } });
  existingUsersForIds.forEach((u) => { if (u.employeeId) usedEmployeeIds.add(u.employeeId); });
  const existingTeachersForIds = await prisma.teacher.findMany({ select: { employeeId: true } });
  existingTeachersForIds.forEach((t) => usedEmployeeIds.add(t.employeeId));

  for (const f of teachersToSeed) {
    f.employeeId = generateUniqueEmployeeId(usedEmployeeIds);
  }

  console.log(`≡ƒÜÇ Provisioning ${teachersToSeed.length} Faculty accounts...`);

  const firstAdmin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });
  const demoYearSections = sectionsByYear.get(demoStartYear.id) || [];
  const demoYearRegularSections = demoYearSections.filter(
    (section) => section.programType === "REGULAR",
  );
  let regularSectionCursor = 0;

  for (let i = 0; i < teachersToSeed.length; i++) {
    const faculty = teachersToSeed[i];

    // Ensure all names are strictly UPPERCASE
    const firstNameUpper = faculty.firstName.trim().toUpperCase();
    const lastNameUpper = faculty.lastName.trim().toUpperCase();
    const middleNameUpper = faculty.middleName
      ? faculty.middleName.trim().toUpperCase()
      : null;

    // Format unique email (guaranteed unique by generator logic above)
    const cleanFirst = firstNameUpper.toLowerCase().replace(/\s/g, "");
    const cleanLast = lastNameUpper.toLowerCase().replace(/\s/g, "");
    const email = `${cleanFirst}.${cleanLast}@deped.edu.ph`;

    const dept =
      departments.find((d) => d.code === faculty.deptCode) || departments[0];
    const assignmentTarget = faculty.assignmentTarget ?? null;
    const regularSectionIndex =
      assignmentTarget || regularSectionCursor >= demoYearRegularSections.length
        ? null
        : regularSectionCursor++;

    const designationStr =
      assignmentTarget || regularSectionIndex !== null
        ? "CLASS ADVISER"
        : "SUBJECT TEACHER";
    const position = PLANTILLA_SEQUENCE[i % PLANTILLA_SEQUENCE.length];

    const resolveAdvisorySectionId = (schoolYearId: number) => {
      const yearSections = sectionsByYear.get(schoolYearId) || [];
      const regularSections = yearSections.filter(
        (section) => section.programType === "REGULAR",
      );
      const steSections = yearSections.filter(
        (section) => section.programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      );
      const spaSections = yearSections.filter(
        (section) => section.programType === "SPECIAL_PROGRAM_IN_THE_ARTS",
      );
      const spsSections = yearSections.filter(
        (section) => section.programType === "SPECIAL_PROGRAM_IN_SPORTS",
      );

      if (!assignmentTarget) {
        return regularSectionIndex !== null
          ? regularSections[regularSectionIndex]?.id ?? null
          : null;
      }

      if (assignmentTarget.kind === "STE") {
        return steSections[assignmentTarget.poolIndex]?.id ?? null;
      }

      if (assignmentTarget.kind === "SPA_ARTS") {
        return spaSections[assignmentTarget.poolIndex]?.id ?? null;
      }

      if (assignmentTarget.kind === "SPS_SPORTS") {
        return spsSections[assignmentTarget.poolIndex]?.id ?? null;
      }

      return null;
    };

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
    const user = await prisma.user.upsert({
      where: { employeeId: teacher.employeeId },
      update: {
        firstName: firstNameUpper,
        lastName: lastNameUpper,
        middleName: middleNameUpper,
        email: teacher.email,
        sex: teacher.sex,
        role: "TEACHER" as Role,
        designation: designationStr,
        accountName: teacher.employeeId,
      },
      create: {
        firstName: firstNameUpper,
        lastName: lastNameUpper,
        middleName: middleNameUpper,
        email: teacher.email,
        password: defaultPasswordHash,
        employeeId: teacher.employeeId,
        accountName: teacher.employeeId,
        role: "TEACHER" as Role,
        sex: teacher.sex,
        isActive: true,
        designation: designationStr,
      },
      select: { id: true },
    });

    // CRITICAL: Link the teacher profile to the user account
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { userId: user.id },
    });

    // STEP 3: SEED QUALIFIED SUBJECTS
    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacher.id },
    });
    await prisma.teacherSubject.create({
      data: { teacherId: teacher.id, subject: faculty.subject },
    });

    // STEP 4: SEED TEACHER DESIGNATION FOR ALL SCHOOL YEARS
    for (const schoolYear of allSchoolYears) {
      const advisorySectionId = resolveAdvisorySectionId(schoolYear.id);

      await prisma.teacherDesignation.upsert({
        where: {
          uq_teacher_designations_teacher_sy: {
            teacherId: teacher.id,
            schoolYearId: schoolYear.id,
          },
        },
        update: {
          isClassAdviser: advisorySectionId !== null,
          advisorySectionId: advisorySectionId,
          ancillaryRoles: [],
          effectiveFrom: schoolYear.classOpeningDate,
          effectiveTo: schoolYear.classEndDate,
          updatedById: firstAdmin?.id,
        },
        create: {
          teacherId: teacher.id,
          schoolYearId: schoolYear.id,
          isClassAdviser: advisorySectionId !== null,
          advisorySectionId: advisorySectionId,
          ancillaryRoles: [],
          effectiveFrom: schoolYear.classOpeningDate,
          effectiveTo: schoolYear.classEndDate,
          updatedById: firstAdmin?.id,
        },
      });

      // STEP 5: SYNC SECTION ADVISER LEDGER (create for all years if class adviser)
      if (advisorySectionId) {
        const existingAdviser = await prisma.sectionAdviser.findFirst({
          where: {
            sectionId: advisorySectionId,
            schoolYearId: schoolYear.id,
            status: "ACTIVE",
          },
        });

        if (existingAdviser && existingAdviser.teacherId !== teacher.id) {
          await prisma.sectionAdviser.update({
            where: { id: existingAdviser.id },
            data: {
              status: "HANDED_OVER" as SectionAdviserStatus,
              effectiveTo: new Date(),
              handoverReason: "Seed Update",
            },
          });
        }

        if (!existingAdviser || existingAdviser.teacherId !== teacher.id) {
          await prisma.sectionAdviser.create({
            data: {
              sectionId: advisorySectionId,
              teacherId: teacher.id,
              schoolYearId: schoolYear.id,
              effectiveFrom: schoolYear.classOpeningDate || new Date(),
              status: "ACTIVE" as SectionAdviserStatus,
            },
          });
        }
      } else if (schoolYear.id === demoStartYear.id) {
        // Revoke adviser role in current year if not a class adviser
        await prisma.sectionAdviser.updateMany({
          where: {
            teacherId: teacher.id,
            schoolYearId: schoolYear.id,
            status: "ACTIVE",
          },
          data: {
            status: "REVOKED" as SectionAdviserStatus,
            effectiveTo: new Date(),
            handoverReason: "Seed Update (Role Change)",
          },
        });
      }
    }

    if ((i + 1) % 20 === 0 || i === teachersToSeed.length - 1) {
      console.log(
        `  ≡ƒôè Progress: ${i + 1}/${teachersToSeed.length} Faculty members fully provisioned.`,
      );
    }
  }

  console.log(
    `\n≡ƒÄë Successfully scaled and synced ${teachersToSeed.length} UNIQUE teachers.`,
  );
  console.log(
    `Γ£à No repeating names or numbers in emails. Employee IDs are 7-digit numeric.`,
  );
  console.log(`≡ƒöæ Demo Login Password for all teachers: DepEd2026!`);
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
