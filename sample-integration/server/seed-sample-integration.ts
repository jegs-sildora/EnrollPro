import "dotenv/config";
import {
  ApplicantType,
  PrismaClient,
  type Sex,
} from "../../server/src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";
import * as pg from "pg";

const SAMPLE_TEACHER_EMPLOYEE_PREFIX = "SINT-T";
const SAMPLE_STAFF_EMAIL_SUFFIX = "@sample.integration.local";
const SAMPLE_LEARNER_LRN_PREFIX = "2099";
const SAMPLE_SECTION_PREFIX = "SINT-";

const SAMPLE_STAFF_PASSWORD =
  process.env.SAMPLE_INTEGRATION_PASSWORD ?? "SampleIntegration2026!";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type SampleTeacher = {
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  specialization: string;
  email: string;
  contactNumber: string;
};

type SampleStaff = {
  firstName: string;
  lastName: string;
  middleName: string | null;
  role: "SYSTEM_ADMIN" | "REGISTRAR";
  designation: string;
  email: string;
  mobileNumber: string;
};

type SampleStudent = {
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: Sex;
  gradeName: "Grade 7" | "Grade 8" | "Grade 9" | "Grade 10";
  sectionName: string;
  applicantType: ApplicantType;
};

type GradeCode = "G7" | "G8" | "G9" | "G10";
type TeacherSeed = [string, string, string | null, string];
type StaffSeed = [string, string, SampleStaff["role"], string, string];
type StudentSeed = [
  string,
  string,
  string | null,
  Sex,
  GradeCode,
  string,
  ApplicantType,
];

const GRADE_NAME_BY_CODE: Record<GradeCode, SampleStudent["gradeName"]> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
};

const TEACHER_SEEDS: TeacherSeed[] = [
  ["Ana", "Ramos", null, "MATHEMATICS"],
  ["Mark", "Santos", "Luna", "SCIENCE"],
  ["Joy", "Dizon", null, "ENGLISH"],
  ["Paolo", "Mendoza", "Cruz", "FILIPINO"],
  ["Rhea", "Torres", null, "ARALING PANLIPUNAN"],
  ["Carlo", "Villanueva", "Reyes", "MAPEH"],
  ["Lea", "Garcia", null, "TLE"],
  ["Joel", "Navarro", "Perez", "VALUES EDUCATION"],
  ["Grace", "Aquino", null, "ICT"],
  ["Nico", "Flores", "Diaz", "ESP"],
];

const STAFF_SEEDS: StaffSeed[] = [
  ["System", "Admin One", "SYSTEM_ADMIN", "sysadmin1", "09180000001"],
  ["System", "Admin Two", "SYSTEM_ADMIN", "sysadmin2", "09180000002"],
  ["System", "Admin Three", "SYSTEM_ADMIN", "sysadmin3", "09180000003"],
  ["System", "Admin Four", "SYSTEM_ADMIN", "sysadmin4", "09180000004"],
  ["System", "Admin Five", "SYSTEM_ADMIN", "sysadmin5", "09180000005"],
  ["Registrar", "One", "REGISTRAR", "registrar1", "09180000006"],
  ["Registrar", "Two", "REGISTRAR", "registrar2", "09180000007"],
  ["Registrar", "Three", "REGISTRAR", "registrar3", "09180000008"],
  ["Registrar", "Four", "REGISTRAR", "registrar4", "09180000009"],
  ["Registrar", "Five", "REGISTRAR", "registrar5", "09180000010"],
];

const STUDENT_SEEDS: StudentSeed[] = [
  ["Juan", "Dela Cruz", "Santos", "MALE", "G7", "RIZAL", "REGULAR"],
  ["Maria", "Villanueva", "Reyes", "FEMALE", "G7", "BONIFACIO", "REGULAR"],
  [
    "Miguel",
    "Torres",
    "Garcia",
    "MALE",
    "G7",
    "STE-A",
    "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  ],
  ["Jasmine", "Mendoza", "Flores", "FEMALE", "G8", "MABINI", "REGULAR"],
  [
    "Paolo",
    "Ramos",
    "Bautista",
    "MALE",
    "G8",
    "SPFL-A",
    "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  ],
  ["Nicole", "Navarro", "Aquino", "FEMALE", "G9", "LUNA", "REGULAR"],
  [
    "Carlo",
    "Fernandez",
    "Valdez",
    "MALE",
    "G9",
    "SPA-A",
    "SPECIAL_PROGRAM_IN_THE_ARTS",
  ],
  ["Angelica", "Gonzales", "Castro", "FEMALE", "G10", "MABINI", "REGULAR"],
  [
    "Dennis",
    "Lopez",
    "Soriano",
    "MALE",
    "G10",
    "SPS-A",
    "SPECIAL_PROGRAM_IN_SPORTS",
  ],
  [
    "Faith",
    "Ortega",
    "Lim",
    "FEMALE",
    "G10",
    "SPTVE-A",
    "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
  ],
];

const SAMPLE_TEACHERS: SampleTeacher[] = TEACHER_SEEDS.map(
  ([firstName, lastName, middleName, specialization], index) => ({
    employeeId: `${SAMPLE_TEACHER_EMPLOYEE_PREFIX}-${String(index + 1).padStart(3, "0")}`,
    firstName,
    lastName,
    middleName,
    specialization,
    email: `${firstName.toLowerCase()}.${lastName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")}${SAMPLE_STAFF_EMAIL_SUFFIX}`,
    contactNumber: `091700000${String(index + 1).padStart(2, "0")}`,
  }),
);

const SAMPLE_STAFF: SampleStaff[] = STAFF_SEEDS.map(
  ([firstName, lastName, role, emailLocalPart, mobileNumber]) => ({
    firstName,
    lastName,
    middleName: null,
    role,
    designation: role === "SYSTEM_ADMIN" ? "SYSTEM ADMINISTRATOR" : "REGISTRAR",
    email: `${emailLocalPart}${SAMPLE_STAFF_EMAIL_SUFFIX}`,
    mobileNumber,
  }),
);

const SAMPLE_STUDENTS: SampleStudent[] = STUDENT_SEEDS.map(
  ([
    firstName,
    lastName,
    middleName,
    sex,
    gradeCode,
    sectionSuffix,
    applicantType,
  ]) => ({
    firstName,
    lastName,
    middleName,
    sex,
    gradeName: GRADE_NAME_BY_CODE[gradeCode],
    sectionName: `${SAMPLE_SECTION_PREFIX}-${gradeCode}-${sectionSuffix}`,
    applicantType,
  }),
);

async function getActiveSchoolYear() {
  const activeYear = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, yearLabel: true },
  });

  if (!activeYear) {
    throw new Error(
      "No ACTIVE school year found. Run db:seed first and activate a school year.",
    );
  }

  const settings = await prisma.schoolSetting.findFirst({
    select: { id: true, activeSchoolYearId: true },
  });

  if (settings && settings.activeSchoolYearId !== activeYear.id) {
    await prisma.schoolSetting.update({
      where: { id: settings.id },
      data: { activeSchoolYearId: activeYear.id },
    });
  }

  return activeYear;
}

async function ensureGradeLevel(params: {
  schoolYearId: number;
  gradeName: "Grade 7" | "Grade 8" | "Grade 9" | "Grade 10";
}) {
  const existing = await prisma.gradeLevel.findFirst({
    where: {
      schoolYearId: params.schoolYearId,
      name: params.gradeName,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const displayOrder = Number.parseInt(
    params.gradeName.replace("Grade ", ""),
    10,
  );

  return prisma.gradeLevel.create({
    data: {
      schoolYearId: params.schoolYearId,
      name: params.gradeName,
      displayOrder,
    },
    select: { id: true },
  });
}

async function ensureSection(params: {
  gradeLevelId: number;
  sectionName: string;
  applicantType: ApplicantType;
}) {
  const existing = await prisma.section.findFirst({
    where: {
      gradeLevelId: params.gradeLevelId,
      name: params.sectionName,
      programType: params.applicantType,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.section.create({
    data: {
      gradeLevelId: params.gradeLevelId,
      name: params.sectionName,
      programType: params.applicantType,
      maxCapacity: 45,
    },
    select: { id: true },
  });
}

async function seedTeachers() {
  let created = 0;
  let updated = 0;

  for (const teacher of SAMPLE_TEACHERS) {
    const existing = await prisma.teacher.findUnique({
      where: { employeeId: teacher.employeeId },
      select: { id: true },
    });

    await prisma.teacher.upsert({
      where: { employeeId: teacher.employeeId },
      update: {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        specialization: teacher.specialization,
        email: teacher.email,
        contactNumber: teacher.contactNumber,
        isActive: true,
      },
      create: {
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        specialization: teacher.specialization,
        email: teacher.email,
        contactNumber: teacher.contactNumber,
        isActive: true,
      },
    });

    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
}

async function seedStaffUsers() {
  const hashedPassword = await bcrypt.hash(SAMPLE_STAFF_PASSWORD, 12);

  let created = 0;
  let updated = 0;

  for (const user of SAMPLE_STAFF) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        designation: user.designation,
        mobileNumber: user.mobileNumber,
        role: user.role,
        isActive: true,
        password: hashedPassword,
      },
      create: {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        designation: user.designation,
        mobileNumber: user.mobileNumber,
        email: user.email,
        password: hashedPassword,
        role: user.role,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  const operator = await prisma.user.findFirst({
    where: {
      email: {
        endsWith: SAMPLE_STAFF_EMAIL_SUFFIX,
      },
      role: {
        in: ["SYSTEM_ADMIN", "REGISTRAR"],
      },
    },
    select: { id: true },
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });

  if (!operator) {
    throw new Error("Unable to resolve sample operator user.");
  }

  return {
    created,
    updated,
    operatorId: operator.id,
  };
}

async function seedStudents(params: {
  schoolYearId: number;
  operatorId: number;
}) {
  let created = 0;
  let updated = 0;

  const yearToken = new Date().getFullYear();

  for (let i = 0; i < SAMPLE_STUDENTS.length; i++) {
    const student = SAMPLE_STUDENTS[i];
    const sequence = i + 1;

    const gradeLevel = await ensureGradeLevel({
      schoolYearId: params.schoolYearId,
      gradeName: student.gradeName,
    });

    const section = await ensureSection({
      gradeLevelId: gradeLevel.id,
      sectionName: student.sectionName,
      applicantType: student.applicantType,
    });

    const lrn = `${SAMPLE_LEARNER_LRN_PREFIX}${String(sequence).padStart(8, "0")}`;

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
        sex: student.sex,
        disabilityTypes: [],
      },
      create: {
        lrn,
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
        sex: student.sex,
        birthdate: new Date(
          `2012-01-${String((sequence % 28) + 1).padStart(2, "0")}`,
        ),
        disabilityTypes: [],
      },
      select: { id: true },
    });

    const trackingNumber = `SINT-ENR-${yearToken}-${String(sequence).padStart(4, "0")}`;

    const existingApplication = await prisma.enrollmentApplication.findUnique({
      where: { trackingNumber },
      select: { id: true },
    });

    const application = existingApplication
      ? await prisma.enrollmentApplication.update({
          where: { id: existingApplication.id },
          data: {
            learnerId: learner.id,
            schoolYearId: params.schoolYearId,
            gradeLevelId: gradeLevel.id,
            status: "ENROLLED",
            learnerType: "NEW_ENROLLEE",
            applicantType: student.applicantType,
            admissionChannel: "F2F",
            learningModalities: ["FACE_TO_FACE"],
            isPrivacyConsentGiven: true,
            guardianRelationship: "PARENT",
            hasNoMother: false,
            hasNoFather: false,
            encodedById: params.operatorId,
          },
          select: { id: true },
        })
      : await prisma.enrollmentApplication.create({
          data: {
            learnerId: learner.id,
            schoolYearId: params.schoolYearId,
            gradeLevelId: gradeLevel.id,
            status: "ENROLLED",
            trackingNumber,
            learnerType: "NEW_ENROLLEE",
            applicantType: student.applicantType,
            admissionChannel: "F2F",
            learningModalities: ["FACE_TO_FACE"],
            isPrivacyConsentGiven: true,
            guardianRelationship: "PARENT",
            hasNoMother: false,
            hasNoFather: false,
            encodedById: params.operatorId,
          },
          select: { id: true },
        });

    await prisma.enrollmentRecord.upsert({
      where: { enrollmentApplicationId: application.id },
      update: {
        schoolYearId: params.schoolYearId,
        sectionId: section.id,
        enrolledById: params.operatorId,
      },
      create: {
        enrollmentApplicationId: application.id,
        schoolYearId: params.schoolYearId,
        sectionId: section.id,
        enrolledById: params.operatorId,
      },
    });

    if (existingApplication) {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
}

async function main() {
  const schoolYear = await getActiveSchoolYear();

  const teacherStats = await seedTeachers();
  const staffStats = await seedStaffUsers();
  const studentStats = await seedStudents({
    schoolYearId: schoolYear.id,
    operatorId: staffStats.operatorId,
  });

  console.log("\nSample integration seed complete.");
  console.log(`School Year: ${schoolYear.yearLabel}`);
  console.log(
    `Teachers -> created: ${teacherStats.created}, updated: ${teacherStats.updated}`,
  );
  console.log(
    `Staff -> created: ${staffStats.created}, updated: ${staffStats.updated}`,
  );
  console.log(
    `Students -> created: ${studentStats.created}, updated: ${studentStats.updated}`,
  );
  console.log(`Sample staff password: ${SAMPLE_STAFF_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Sample integration seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
