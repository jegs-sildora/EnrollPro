import "dotenv/config";
import {
  PrismaClient,
  ApplicantType,
  type ApplicationStatus,
} from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type SampleStudent = {
  firstName: string;
  middleName: string;
  lastName: string;
  sex: "MALE" | "FEMALE";
  gradeName: "Grade 7" | "Grade 8" | "Grade 9" | "Grade 10";
  applicantType: ApplicantType;
  status: ApplicationStatus;
  sectionName?: string;
};

const SAMPLE_STUDENTS: SampleStudent[] = [
  {
    firstName: "Juan",
    middleName: "Santos",
    lastName: "Dela Cruz",
    sex: "MALE",
    gradeName: "Grade 7",
    applicantType: "REGULAR",
    status: "ENROLLED",
    sectionName: "G7-RIZAL",
  },
  {
    firstName: "Maria",
    middleName: "Reyes",
    lastName: "Villanueva",
    sex: "FEMALE",
    gradeName: "Grade 7",
    applicantType: "REGULAR",
    status: "ENROLLED",
    sectionName: "G7-BONIFACIO",
  },
  {
    firstName: "Miguel",
    middleName: "Garcia",
    lastName: "Torres",
    sex: "MALE",
    gradeName: "Grade 7",
    applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    status: "ENROLLED",
    sectionName: "G7-STE-A",
  },
  {
    firstName: "Jasmine",
    middleName: "Flores",
    lastName: "Mendoza",
    sex: "FEMALE",
    gradeName: "Grade 7",
    applicantType: "SPECIAL_PROGRAM_IN_THE_ARTS",
    status: "ENROLLED",
    sectionName: "G7-SPA-A",
  },
  {
    firstName: "Paolo",
    middleName: "Bautista",
    lastName: "Ramos",
    sex: "MALE",
    gradeName: "Grade 7",
    applicantType: "SPECIAL_PROGRAM_IN_SPORTS",
    status: "READY_FOR_ENROLLMENT",
  },
  {
    firstName: "Nicole",
    middleName: "Aquino",
    lastName: "Navarro",
    sex: "FEMALE",
    gradeName: "Grade 8",
    applicantType: "REGULAR",
    status: "TEMPORARILY_ENROLLED",
  },
  {
    firstName: "Carlo",
    middleName: "Valdez",
    lastName: "Fernandez",
    sex: "MALE",
    gradeName: "Grade 8",
    applicantType: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
    status: "ENROLLED",
    sectionName: "G8-SPFL-A",
  },
  {
    firstName: "Angelica",
    middleName: "Castro",
    lastName: "Gonzales",
    sex: "FEMALE",
    gradeName: "Grade 9",
    applicantType: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    status: "ENROLLED",
    sectionName: "G9-SPTVE-A",
  },
];

const PROGRAM_PREFIX: Record<ApplicantType, string> = {
  REGULAR: "REG",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
};

function toContactNumber(sequence: number) {
  const lastNineDigits = String(100000000 + sequence).slice(-9);
  return `09${lastNineDigits}`;
}

function toBirthdate(sequence: number) {
  const birthMonth = (sequence % 12) + 1;
  const birthDay = ((sequence * 2) % 28) + 1;
  return new Date(
    `2012-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
  );
}

function toEmail(firstName: string, lastName: string, sequence: number) {
  const safeFirst = firstName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const safeLast = lastName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${safeFirst}.${safeLast}${sequence}@example.com`;
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
      name: params.sectionName,
      gradeLevelId: params.gradeLevelId,
      programType: params.applicantType,
      maxCapacity: 40,
    },
    select: { id: true },
  });
}

async function seedStudents() {
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, yearLabel: true },
  });

  if (!schoolYear) {
    throw new Error(
      "No active school year found. Run db:seed first and make sure one school year is ACTIVE.",
    );
  }

  const operator = await prisma.user.findFirst({
    where: { OR: [{ role: "SYSTEM_ADMIN" }, { role: "REGISTRAR" }] },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (!operator) {
    throw new Error(
      "No SYSTEM_ADMIN or REGISTRAR user found. Run db:seed first.",
    );
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { schoolYearId: schoolYear.id },
    select: { id: true, name: true },
  });

  const gradeByName = new Map(gradeLevels.map((g) => [g.name, g.id]));
  const year = new Date().getFullYear();

  let createdEnrollments = 0;
  let updatedEnrollments = 0;

  for (let index = 0; index < SAMPLE_STUDENTS.length; index++) {
    const sample = SAMPLE_STUDENTS[index];
    const sequence = index + 1;

    const gradeLevelId = gradeByName.get(sample.gradeName);
    if (!gradeLevelId) {
      throw new Error(
        `Missing grade level ${sample.gradeName} for active school year ${schoolYear.yearLabel}.`,
      );
    }

    const lrn = `200000${String(sequence).padStart(6, "0")}`;
    const contactNumber = toContactNumber(sequence);
    const birthdate = toBirthdate(sequence);
    const email = toEmail(sample.firstName, sample.lastName, sequence);

    const learner = await prisma.learner.upsert({
      where: { lrn },
      update: {
        firstName: sample.firstName,
        middleName: sample.middleName,
        lastName: sample.lastName,
        birthdate,
        sex: sample.sex,
        disabilityTypes: [],
      },
      create: {
        lrn,
        firstName: sample.firstName,
        middleName: sample.middleName,
        lastName: sample.lastName,
        birthdate,
        sex: sample.sex,
        disabilityTypes: [],
      },
      select: { id: true },
    });

    const earlyRegTracking = `EREG-${year}-S${String(sequence).padStart(4, "0")}`;

    const earlyReg = await prisma.earlyRegistrationApplication.upsert({
      where: {
        uq_early_reg_per_sy: {
          learnerId: learner.id,
          schoolYearId: schoolYear.id,
        },
      },
      update: {
        trackingNumber: earlyRegTracking,
        gradeLevelId,
        applicantType: sample.applicantType,
        learnerType: "NEW_ENROLLEE",
        status: sample.status,
        channel: "F2F",
        contactNumber,
        email,
        guardianRelationship: "PARENT",
        hasNoMother: false,
        hasNoFather: false,
        isPrivacyConsentGiven: true,
        encodedById: operator.id,
      },
      create: {
        learnerId: learner.id,
        schoolYearId: schoolYear.id,
        gradeLevelId,
        trackingNumber: earlyRegTracking,
        applicantType: sample.applicantType,
        learnerType: "NEW_ENROLLEE",
        status: sample.status,
        channel: "F2F",
        contactNumber,
        email,
        guardianRelationship: "PARENT",
        hasNoMother: false,
        hasNoFather: false,
        isPrivacyConsentGiven: true,
        encodedById: operator.id,
      },
      select: { id: true },
    });

    const enrollmentTracking = `${PROGRAM_PREFIX[sample.applicantType]}-${year}-${String(sequence).padStart(5, "0")}`;

    const existingEnrollment = await prisma.enrollmentApplication.findUnique({
      where: { trackingNumber: enrollmentTracking },
      select: { id: true },
    });

    const enrollment = existingEnrollment
      ? await prisma.enrollmentApplication.update({
          where: { id: existingEnrollment.id },
          data: {
            learnerId: learner.id,
            earlyRegistrationId: earlyReg.id,
            schoolYearId: schoolYear.id,
            gradeLevelId,
            applicantType: sample.applicantType,
            learnerType: "NEW_ENROLLEE",
            status: sample.status,
            admissionChannel: "F2F",
            learningModalities: ["FACE_TO_FACE"],
            isPrivacyConsentGiven: true,
            guardianRelationship: "PARENT",
            hasNoMother: false,
            hasNoFather: false,
            encodedById: operator.id,
          },
          select: { id: true },
        })
      : await prisma.enrollmentApplication.create({
          data: {
            learnerId: learner.id,
            earlyRegistrationId: earlyReg.id,
            schoolYearId: schoolYear.id,
            gradeLevelId,
            applicantType: sample.applicantType,
            learnerType: "NEW_ENROLLEE",
            status: sample.status,
            admissionChannel: "F2F",
            trackingNumber: enrollmentTracking,
            learningModalities: ["FACE_TO_FACE"],
            isPrivacyConsentGiven: true,
            guardianRelationship: "PARENT",
            hasNoMother: false,
            hasNoFather: false,
            encodedById: operator.id,
          },
          select: { id: true },
        });

    if (existingEnrollment) {
      updatedEnrollments++;
    } else {
      createdEnrollments++;
    }

    const checklistByEarlyReg = await prisma.applicationChecklist.findUnique({
      where: { earlyRegistrationId: earlyReg.id },
      select: { id: true, enrollmentId: true },
    });

    const checklistByEnrollment = await prisma.applicationChecklist.findUnique({
      where: { enrollmentId: enrollment.id },
      select: { id: true, earlyRegistrationId: true },
    });

    if (checklistByEarlyReg && checklistByEnrollment) {
      if (checklistByEarlyReg.id !== checklistByEnrollment.id) {
        await prisma.applicationChecklist.delete({
          where: { id: checklistByEnrollment.id },
        });

        await prisma.applicationChecklist.update({
          where: { id: checklistByEarlyReg.id },
          data: {
            enrollmentId: enrollment.id,
          },
        });
      } else if (
        checklistByEarlyReg.enrollmentId !== enrollment.id ||
        checklistByEnrollment.earlyRegistrationId !== earlyReg.id
      ) {
        await prisma.applicationChecklist.update({
          where: { id: checklistByEarlyReg.id },
          data: {
            earlyRegistrationId: earlyReg.id,
            enrollmentId: enrollment.id,
          },
        });
      }
    } else if (checklistByEarlyReg) {
      if (checklistByEarlyReg.enrollmentId !== enrollment.id) {
        await prisma.applicationChecklist.update({
          where: { id: checklistByEarlyReg.id },
          data: { enrollmentId: enrollment.id },
        });
      }
    } else if (checklistByEnrollment) {
      if (checklistByEnrollment.earlyRegistrationId !== earlyReg.id) {
        await prisma.applicationChecklist.update({
          where: { id: checklistByEnrollment.id },
          data: { earlyRegistrationId: earlyReg.id },
        });
      }
    } else {
      await prisma.applicationChecklist.create({
        data: {
          earlyRegistrationId: earlyReg.id,
          enrollmentId: enrollment.id,
        },
      });
    }

    await prisma.applicationFamilyMember.deleteMany({
      where: { enrollmentId: enrollment.id },
    });

    await prisma.applicationFamilyMember.createMany({
      data: [
        {
          enrollmentId: enrollment.id,
          relationship: "MOTHER",
          firstName: "Maria",
          lastName: sample.lastName,
          middleName: null,
          contactNumber,
          email,
          occupation: "Vendor",
        },
        {
          enrollmentId: enrollment.id,
          relationship: "FATHER",
          firstName: "Jose",
          lastName: sample.lastName,
          middleName: null,
          contactNumber,
          email: null,
          occupation: "Driver",
        },
      ],
    });

    await prisma.applicationAddress.deleteMany({
      where: { enrollmentId: enrollment.id },
    });

    await prisma.applicationAddress.createMany({
      data: [
        {
          enrollmentId: enrollment.id,
          addressType: "CURRENT",
          houseNoStreet: `${300 + sequence}`,
          street: "Mabini Street",
          barangay: "Poblacion",
          cityMunicipality: "Tandag City",
          province: "Surigao del Sur",
          country: "PHILIPPINES",
          zipCode: "8300",
        },
        {
          enrollmentId: enrollment.id,
          addressType: "PERMANENT",
          houseNoStreet: `${300 + sequence}`,
          street: "Mabini Street",
          barangay: "Poblacion",
          cityMunicipality: "Tandag City",
          province: "Surigao del Sur",
          country: "PHILIPPINES",
          zipCode: "8300",
        },
      ],
    });

    if (sample.applicantType !== "REGULAR") {
      await prisma.enrollmentProgramDetail.upsert({
        where: { applicationId: enrollment.id },
        update: {
          scpType: sample.applicantType,
          artField:
            sample.applicantType === "SPECIAL_PROGRAM_IN_THE_ARTS"
              ? "VISUAL_ARTS"
              : null,
          foreignLanguage:
            sample.applicantType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"
              ? "MANDARIN"
              : null,
          sportsList:
            sample.applicantType === "SPECIAL_PROGRAM_IN_SPORTS"
              ? ["BASKETBALL"]
              : [],
        },
        create: {
          applicationId: enrollment.id,
          scpType: sample.applicantType,
          artField:
            sample.applicantType === "SPECIAL_PROGRAM_IN_THE_ARTS"
              ? "VISUAL_ARTS"
              : null,
          foreignLanguage:
            sample.applicantType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"
              ? "MANDARIN"
              : null,
          sportsList:
            sample.applicantType === "SPECIAL_PROGRAM_IN_SPORTS"
              ? ["BASKETBALL"]
              : [],
        },
      });
    } else {
      await prisma.enrollmentProgramDetail.deleteMany({
        where: { applicationId: enrollment.id },
      });
    }

    if (sample.status === "ENROLLED") {
      const section = await ensureSection({
        gradeLevelId,
        sectionName:
          sample.sectionName ?? `${sample.gradeName.replace("Grade ", "G")}-A`,
        applicantType: sample.applicantType,
      });

      await prisma.enrollmentRecord.upsert({
        where: { enrollmentApplicationId: enrollment.id },
        update: {
          sectionId: section.id,
          schoolYearId: schoolYear.id,
          enrolledById: operator.id,
        },
        create: {
          enrollmentApplicationId: enrollment.id,
          sectionId: section.id,
          schoolYearId: schoolYear.id,
          enrolledById: operator.id,
        },
      });

      const existingBosy = await prisma.healthRecord.findFirst({
        where: {
          learnerId: learner.id,
          schoolYearId: schoolYear.id,
          assessmentPeriod: "BOSY",
        },
        select: { id: true },
      });

      if (existingBosy) {
        await prisma.healthRecord.update({
          where: { id: existingBosy.id },
          data: {
            assessmentDate: new Date(),
            weightKg: 42 + sequence,
            heightCm: 145 + sequence,
            recordedById: operator.id,
          },
        });
      } else {
        await prisma.healthRecord.create({
          data: {
            learnerId: learner.id,
            schoolYearId: schoolYear.id,
            assessmentPeriod: "BOSY",
            assessmentDate: new Date(),
            weightKg: 42 + sequence,
            heightCm: 145 + sequence,
            recordedById: operator.id,
          },
        });
      }
    } else {
      await prisma.enrollmentRecord.deleteMany({
        where: { enrollmentApplicationId: enrollment.id },
      });
    }

    console.log(
      `Seeded sample student ${enrollmentTracking} (${sample.status}).`,
    );
  }

  console.log(
    `Student seeding complete. Created: ${createdEnrollments}, Updated: ${updatedEnrollments}.`,
  );
}

async function main() {
  try {
    await seedStudents();
  } catch (error) {
    console.error("ERROR during student seeding:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
