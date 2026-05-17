import "dotenv/config";
import {
  PrismaClient,
  ApplicantType,
  Sex,
  FamilyRelationship,
  AddressType,
  LearnerType,
  ApplicationStatus,
  ReadingProfileLevel,
  SectionAdviserStatus,
  Role,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import * as bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const defaultPinHash = bcrypt.hashSync("DepEd2026!", 10);

const PROGRAMS = [
  {
    type: "SPECIAL_PROGRAM_IN_THE_ARTS" as ApplicantType,
    name: "SPA",
  },
  {
    type: "SPECIAL_PROGRAM_IN_SPORTS" as ApplicantType,
    name: "SPS",
  },
];

const PH_FIRST_NAMES_MALE = [
  "JUAN",
  "JOSE",
  "MIGUEL",
  "CARLO",
  "RAFAEL",
  "PAOLO",
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
  "RAMON",
  "ELPIDIO",
  "SERGIO",
  "DIOSDADO",
  "JOSEPH",
];
const PH_FIRST_NAMES_FEMALE = [
  "MARIA",
  "ANGELICA",
  "PRINCESS",
  "JASMINE",
  "NICOLE",
  "GABRIELA",
  "SOFIA",
  "ISABELLA",
  "LIZA",
  "BEA",
  "CRISTINA",
  "PATRICIA",
  "ELENA",
  "ROSA",
  "TERESA",
  "IMELDA",
  "GLORIA",
  "LOURDES",
  "REMEDIOS",
  "CARMELA",
  "JOSEFINA",
  "PERLA",
  "AURORA",
  "ESTRELLA",
];
const PH_LAST_NAMES = [
  "DELA CRUZ",
  "REYES",
  "SANTOS",
  "GARCIA",
  "MENDOZA",
  "FERNANDEZ",
  "NAVARRO",
  "RAMOS",
  "BAUTISTA",
  "GONZALES",
  "TORRES",
  "VILLANUEVA",
  "CRUZ",
  "PASCUAL",
  "AQUINO",
  "MARCOS",
  "ESTRADA",
  "ARROYO",
  "MAGSAYSAY",
  "MACAPAGAL",
  "ROXAS",
  "QUEZON",
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
];

const PH_CITIES = [
  "QUEZON CITY",
  "MANILA",
  "CALOOCAN",
  "DAVAO CITY",
  "CEBU CITY",
  "ZAMBOANGA CITY",
  "ANTIPOLO",
  "PASIG",
  "TAGUIG",
  "VALENZUELA",
  "DASMARIÑAS",
  "BACOOR",
  "IMUS",
  "LAS PIÑAS",
];
const PH_MOTHER_TONGUES = [
  "TAGALOG",
  "CEBUANO",
  "ILOCANO",
  "HILIGAYNON",
  "WARAY",
  "BIKOL",
  "KAPAMPANGAN",
  "PANGASINAN",
  "CHAVACANO",
  "MAGUINDANAON",
];
const PH_BARANGAYS = [
  "BARANGAY 1",
  "BARANGAY 2",
  "SAN ISIDRO",
  "STA. LUCIA",
  "SANTO NIÑO",
  "CONCEPCION",
  "MALANDAY",
  "POBLACION",
  "SAN JOSE",
  "SAN ROQUE",
];

const MAPEH_ARTS_SPECIALIZATIONS = [
  "MAJOR IN MUSIC EDUCATION",
  "FINE ARTS",
  "THEATER / PERFORMING ARTS",
  "DANCE",
];

const MAPEH_SPORTS_SPECIALIZATIONS = [
  "SPORTS SCIENCE",
  "CERTIFIED SPECIALIST COACH",
  "MAJOR IN PHYSICAL EDUCATION",
];

function isArtsSpecialization(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.toUpperCase();
  return (
    normalized.includes("ART") ||
    normalized.includes("MUSIC") ||
    normalized.includes("DANCE") ||
    normalized.includes("THEATER") ||
    normalized.includes("PERFORMING")
  );
}

function isSportsSpecialization(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.toUpperCase();
  return (
    normalized.includes("SPORT") ||
    normalized.includes("PHYSICAL EDUCATION") ||
    normalized.includes("COACH")
  );
}

function sortUniqueIds(ids: number[]): number[] {
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

function toUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

function buildLrn(sectionId: number, sequence: number): string {
  return `1226${(sectionId % 1000).toString().padStart(3, "0")}${(sequence % 100000).toString().padStart(5, "0")}`;
}

function buildTrackingNumber(
  programPrefix: string,
  yearLabel: string,
  sectionId: number,
  sequence: number,
): string {
  const startYear = yearLabel.split("-")[0];
  return `${programPrefix}-${startYear}-${(sectionId % 1000).toString().padStart(3, "0")}${(sequence % 100).toString().padStart(2, "0")}`;
}

async function assignSectionAdviser(
  sectionId: number,
  teacherId: number,
  schoolYearId: number,
  effectiveFrom: Date,
) {
  // A teacher can only advise one section per school year (DB unique constraint).
  const existingForTeacher = await prisma.sectionAdviser.findFirst({
    where: {
      teacherId,
      schoolYearId,
    },
  });

  if (existingForTeacher) {
    if (
      existingForTeacher.sectionId === sectionId &&
      existingForTeacher.status !== "ACTIVE"
    ) {
      await prisma.sectionAdviser.update({
        where: { id: existingForTeacher.id },
        data: {
          status: "ACTIVE" as SectionAdviserStatus,
          effectiveFrom,
          effectiveTo: null,
          handoverReason: null,
        },
      });
    }
    return;
  }

  const existing = await prisma.sectionAdviser.findFirst({
    where: {
      sectionId,
      schoolYearId,
      status: "ACTIVE" as SectionAdviserStatus,
    },
  });

  if (existing && existing.teacherId === teacherId) {
    return;
  }

  if (existing && existing.teacherId !== teacherId) {
    await prisma.sectionAdviser.update({
      where: { id: existing.id },
      data: {
        status: "HANDED_OVER" as SectionAdviserStatus,
        effectiveTo: new Date(),
        handoverReason: "Seed Update",
      },
    });
  }

  await prisma.sectionAdviser.create({
    data: {
      sectionId,
      teacherId,
      schoolYearId,
      effectiveFrom,
      status: "ACTIVE" as SectionAdviserStatus,
    },
  });
}

async function seedEnrolledLearners(params: {
  sectionId: number;
  gradeLevelId: number;
  gradeValue: number;
  schoolYearId: number;
  yearLabel: string;
  programType: ApplicantType;
  count: number;
  adminId: number;
}) {
  const {
    sectionId,
    gradeLevelId,
    gradeValue,
    schoolYearId,
    yearLabel,
    programType,
    count,
    adminId,
  } = params;

  for (let i = 0; i < count; i++) {
    const sequence = i + 1;
    const sex: Sex = sequence % 2 === 0 ? "FEMALE" : "MALE";
    const nameIndex = sequence + sectionId * 31;
    const firstPool =
      sex === "MALE" ? PH_FIRST_NAMES_MALE : PH_FIRST_NAMES_FEMALE;

    const firstName = firstPool[nameIndex % firstPool.length];
    const lastName = PH_LAST_NAMES[(nameIndex + 13) % PH_LAST_NAMES.length];
    const middleName =
      PH_MIDDLE_NAMES[(nameIndex + 7) % PH_MIDDLE_NAMES.length];

    const lrn = buildLrn(sectionId, sequence);
    const birthYear = 2026 - (gradeValue + 6);

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {
        firstName,
        lastName,
        middleName,
        sex,
        birthdate: toUtcNoon(birthYear, sequence % 12, 15),
        placeOfBirth: PH_CITIES[sequence % PH_CITIES.length],
        religion: "ROMAN CATHOLIC",
        motherTongue: PH_MOTHER_TONGUES[sequence % PH_MOTHER_TONGUES.length],
        isIpCommunity: sequence % 50 === 0,
        is4PsBeneficiary: sequence % 15 === 0,
        psaBirthCertNumber: `PSA-12-${lrn}`,
        previousGenAve:
          programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 92 : 86,
        promotionStatus: "PROMOTED",
      },
      create: {
        lrn,
        firstName,
        lastName,
        middleName,
        sex,
        birthdate: toUtcNoon(birthYear, sequence % 12, 15),
        placeOfBirth: PH_CITIES[sequence % PH_CITIES.length],
        religion: "ROMAN CATHOLIC",
        motherTongue: PH_MOTHER_TONGUES[sequence % PH_MOTHER_TONGUES.length],
        isIpCommunity: sequence % 50 === 0,
        is4PsBeneficiary: sequence % 15 === 0,
        psaBirthCertNumber: `PSA-12-${lrn}`,
        previousGenAve:
          programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? 92 : 86,
        promotionStatus: "PROMOTED",
        isPendingLrnCreation: false,
      },
    });

    const user = await prisma.user.upsert({
      where: { accountName: lrn },
      update: { firstName, lastName, middleName },
      create: {
        firstName,
        lastName,
        middleName,
        accountName: lrn,
        password: defaultPinHash,
        role: "LEARNER" as Role,
        sex,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (!learner.userId) {
      await prisma.learner.update({
        where: { id: learner.id },
        data: { userId: user.id },
      });
    }

    const trackingNumber = buildTrackingNumber(
      programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
        ? "STE"
        : programType === "SPECIAL_PROGRAM_IN_THE_ARTS"
          ? "SPA"
          : "SPS",
      yearLabel,
      sectionId,
      sequence,
    );

    const application = await prisma.enrollmentApplication.upsert({
      where: { trackingNumber },
      update: {
        learnerId: learner.id,
        gradeLevelId,
        schoolYearId,
        applicantType: programType,
        learnerType: "CONTINUING" as LearnerType,
        status: "OFFICIALLY_ENROLLED" as ApplicationStatus,
        portalPin: defaultPinHash,
      },
      create: {
        learnerId: learner.id,
        gradeLevelId,
        schoolYearId,
        applicantType: programType,
        learnerType: "CONTINUING" as LearnerType,
        status: "OFFICIALLY_ENROLLED" as ApplicationStatus,
        trackingNumber,
        isPrivacyConsentGiven: true,
        admissionChannel: "F2F",
        encodedById: adminId,
        readingProfileLevel: "INDEPENDENT" as ReadingProfileLevel,
        guardianRelationship: "MOTHER",
        portalPin: defaultPinHash,
        familyMembers: {
          create: [
            {
              relationship: "MOTHER" as FamilyRelationship,
              firstName:
                PH_FIRST_NAMES_FEMALE[
                  (nameIndex + 5000) % PH_FIRST_NAMES_FEMALE.length
                ],
              lastName:
                PH_LAST_NAMES[(nameIndex + 5000) % PH_LAST_NAMES.length],
              middleName:
                PH_MIDDLE_NAMES[(nameIndex + 5000) % PH_MIDDLE_NAMES.length],
              contactNumber: `0922${String(nameIndex + 5000)
                .padStart(7, "0")
                .slice(-7)}`,
              occupation: "HOUSEWIFE",
            },
            {
              relationship: "FATHER" as FamilyRelationship,
              firstName:
                PH_FIRST_NAMES_MALE[
                  (nameIndex + 3000) % PH_FIRST_NAMES_MALE.length
                ],
              lastName:
                PH_LAST_NAMES[(nameIndex + 3000) % PH_LAST_NAMES.length],
              middleName:
                PH_MIDDLE_NAMES[(nameIndex + 3000) % PH_MIDDLE_NAMES.length],
              contactNumber: `0917${String(nameIndex + 3000)
                .padStart(7, "0")
                .slice(-7)}`,
              occupation: "EMPLOYEE",
            },
            {
              relationship: "GUARDIAN" as FamilyRelationship,
              firstName,
              lastName,
              middleName,
              contactNumber: `0998${String(nameIndex + 7000)
                .padStart(7, "0")
                .slice(-7)}`,
              occupation: "GUARDIAN",
            },
          ],
        },
        addresses: {
          create: [
            {
              addressType: "CURRENT" as AddressType,
              houseNoStreet: `${100 + (sequence % 900)} Street`,
              barangay: PH_BARANGAYS[sequence % PH_BARANGAYS.length],
              cityMunicipality: PH_CITIES[sequence % PH_CITIES.length],
              province: "METRO MANILA",
              zipCode: "1100",
            },
          ],
        },
      },
    });

    await prisma.enrollmentRecord.upsert({
      where: { enrollmentApplicationId: application.id },
      update: {
        schoolYearId,
        sectionId,
        enrolledById: adminId,
        learnerId: learner.id,
      },
      create: {
        enrollmentApplicationId: application.id,
        schoolYearId,
        sectionId,
        enrolledById: adminId,
        learnerId: learner.id,
        enrolledAt: new Date(),
        confirmationConsent: true,
      },
    });
  }
}

async function main() {
  const targetYear = await prisma.schoolYear.findUnique({
    where: { yearLabel: "2026-2027" },
  });

  if (!targetYear) {
    throw new Error(
      "School year 2026-2027 not found. Run db:seed-2026-2027 first.",
    );
  }

  const admin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
  });
  if (!admin) {
    throw new Error("No SYSTEM_ADMIN found.");
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } },
    orderBy: { displayOrder: "asc" },
  });

  const scpConfigs = await prisma.scpProgramConfig.findMany({
    where: {
      schoolYearId: targetYear.id,
      scpType: {
        in: PROGRAMS.map((p) => p.type).concat(
          "SCIENCE_TECHNOLOGY_AND_ENGINEERING" as ApplicantType,
        ),
      },
    },
    select: { id: true, scpType: true },
  });

  const scpConfigMap = new Map(scpConfigs.map((c) => [c.scpType, c.id]));

  const mapehDepartment = await prisma.department.findFirst({
    where: {
      OR: [
        { code: { equals: "MAPEH", mode: "insensitive" } },
        { name: { contains: "MAPEH", mode: "insensitive" } },
      ],
    },
  });

  const allActiveTeachers = await prisma.teacher.findMany({
    where: { isActive: true },
    select: { id: true, departmentId: true, specialization: true },
  });

  const existingAdvisers = await prisma.sectionAdviser.findMany({
    where: {
      schoolYearId: targetYear.id,
      status: "ACTIVE" as SectionAdviserStatus,
    },
    select: { teacherId: true, sectionId: true },
  });

  const usedTeacherIds = new Set(
    existingAdvisers.map((adviser) => adviser.teacherId),
  );

  const allActiveTeacherIds = sortUniqueIds(
    allActiveTeachers.map((teacher) => teacher.id),
  );
  const mapehTeacherIds = sortUniqueIds(
    allActiveTeachers
      .filter((teacher) => teacher.departmentId === mapehDepartment?.id)
      .map((teacher) => teacher.id),
  );
  const mapehArtsTeacherIds = sortUniqueIds(
    allActiveTeachers
      .filter(
        (teacher) =>
          teacher.departmentId === mapehDepartment?.id &&
          (MAPEH_ARTS_SPECIALIZATIONS.includes(teacher.specialization ?? "") ||
            isArtsSpecialization(teacher.specialization)),
      )
      .map((teacher) => teacher.id),
  );
  const mapehSportsTeacherIds = sortUniqueIds(
    allActiveTeachers
      .filter(
        (teacher) =>
          teacher.departmentId === mapehDepartment?.id &&
          (MAPEH_SPORTS_SPECIALIZATIONS.includes(teacher.specialization ?? "") ||
            isSportsSpecialization(teacher.specialization)),
      )
      .map((teacher) => teacher.id),
  );

  const pickAdviserId = (...pools: number[][]): number | null => {
    for (const pool of pools) {
      for (const id of pool) {
        if (!usedTeacherIds.has(id)) {
          usedTeacherIds.add(id);
          return id;
        }
      }
    }
    return null;
  };

  for (const gradeLevel of gradeLevels) {
    const gradeValue = parseInt(gradeLevel.name.split(" ")[1]);

    for (const program of PROGRAMS) {
      const scpConfigId = scpConfigMap.get(program.type) ?? null;

      for (const suffix of ["A", "B"]) {
        const sectionName = `${program.name} ${suffix}`;
        const section = await prisma.section.upsert({
          where: {
            uq_sections_name_grade_sy: {
              name: sectionName,
              gradeLevelId: gradeLevel.id,
              schoolYearId: targetYear.id,
            },
          },
          update: {
            programType: program.type,
            maxCapacity: 35,
            sortOrder: suffix === "A" ? 1 : 2,
            scpProgramConfigId: scpConfigId,
            sectionRank: null,
          },
          create: {
            name: sectionName,
            gradeLevelId: gradeLevel.id,
            schoolYearId: targetYear.id,
            programType: program.type,
            maxCapacity: 35,
            sortOrder: suffix === "A" ? 1 : 2,
            scpProgramConfigId: scpConfigId,
            sectionRank: null,
          },
        });

        const isSpa = program.type === "SPECIAL_PROGRAM_IN_THE_ARTS";
        const isSps = program.type === "SPECIAL_PROGRAM_IN_SPORTS";
        const adviserId = isSpa
          ? pickAdviserId(
            mapehArtsTeacherIds,
            mapehTeacherIds,
            allActiveTeacherIds,
          )
          : isSps
            ? pickAdviserId(
              mapehSportsTeacherIds,
              mapehTeacherIds,
              allActiveTeacherIds,
            )
            : pickAdviserId(allActiveTeacherIds);

        if (adviserId != null) {
          await assignSectionAdviser(
            section.id,
            adviserId,
            targetYear.id,
            targetYear.classOpeningDate || new Date(),
          );
        }

        const currentCount = await prisma.enrollmentRecord.count({
          where: { sectionId: section.id, schoolYearId: targetYear.id },
        });
        const needed = Math.max(0, section.maxCapacity - currentCount);
        if (needed > 0) {
          await seedEnrolledLearners({
            sectionId: section.id,
            gradeLevelId: gradeLevel.id,
            gradeValue,
            schoolYearId: targetYear.id,
            yearLabel: targetYear.yearLabel,
            programType: program.type,
            count: needed,
            adminId: admin.id,
          });
        }
      }
    }
  }

  const grade7 = gradeLevels.find((g) => g.name === "Grade 7");
  if (grade7) {
    const steSections = await prisma.section.findMany({
      where: {
        schoolYearId: targetYear.id,
        gradeLevelId: grade7.id,
        programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
      },
      select: { id: true, maxCapacity: true },
      orderBy: { sortOrder: "asc" },
    });

    for (const section of steSections) {
      const currentCount = await prisma.enrollmentRecord.count({
        where: { sectionId: section.id, schoolYearId: targetYear.id },
      });
      const needed = Math.max(0, section.maxCapacity - currentCount);
      if (needed > 0) {
        await seedEnrolledLearners({
          sectionId: section.id,
          gradeLevelId: grade7.id,
          gradeValue: 7,
          schoolYearId: targetYear.id,
          yearLabel: targetYear.yearLabel,
          programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
          count: needed,
          adminId: admin.id,
        });
      }
    }
  }

  console.log("Seed other SCP complete.");
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
