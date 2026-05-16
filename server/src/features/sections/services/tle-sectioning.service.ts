import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../lib/AppError.js";

/**
 * Fetch TLE Instructors for a given TLE Program (Personnel Sync).
 * Filters: Teachers whose specialization contains the TLE program name (case-insensitive).
 * Note: Teacher model has no direct tleProgramId FK; specialization string is the link.
 */
export async function fetchTleInstructorsForProgram(
  tleProgramId: number,
  schoolYearId: number,
) {
  const tleProgram = await prisma.tLEProgram.findUnique({
    where: { id: tleProgramId },
    select: { name: true },
  });

  const instructors = await prisma.teacher.findMany({
    where: {
      AND: [
        { specialization: { not: null } },
        ...(tleProgram
          ? [{ specialization: { contains: tleProgram.name, mode: "insensitive" as const } }]
          : []),
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return instructors;
}

/**
 * Fetch unsectioned TLE candidates (SCP Guard enforced).
 * Returns only REGULAR applicants (excludes STE, SPAS, SPS, SPIJ, SPFL, SPTVE).
 * Status filter: tleStatus = 'READY_FOR_TLE_SECTIONING'.
 */
export async function fetchTleUnsectionedPool(
  schoolYearId: number,
  gradeLevelId?: number,
  tleProgramId?: number,
) {
  const candidates = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      tleStatus: "READY_FOR_TLE_SECTIONING",
      applicantType: "REGULAR", // SCP Guard: exclude special programs
      enrollmentRecord: null,
      ...(gradeLevelId && { gradeLevelId }),
      ...(tleProgramId && { tleProgramId }),
    },
    include: {
      learner: {
        select: {
          id: true,
          lrn: true,
          firstName: true,
          lastName: true,
          middleName: true,
          sex: true,
          previousGenAve: true,
        },
      },
      gradeLevel: { select: { id: true, name: true, displayOrder: true } },
      tleProgram: { select: { id: true, name: true } },
    },
    orderBy: { learner: { lastName: "asc" } },
  });

  return candidates;
}

/**
 * Fetch section with full telemetry.
 */
export async function fetchSectionTelemetry(sectionId: number) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      gradeLevel: { select: { id: true, displayOrder: true, name: true } },
      tleProgram: { select: { id: true, name: true } },
      advisers: {
        where: { status: "ACTIVE" },
        include: { 
          teacher: { 
            select: { 
              firstName: true, 
              lastName: true,
              user: { select: { id: true } }
            } 
          } 
        },
      },
      enrollmentRecords: {
        include: { learner: { select: { sex: true } } },
      },
    },
  });

  if (!section) {
    throw new AppError(404, "Section not found.");
  }

  const boys = section.enrollmentRecords.filter(
    (r) => r.learner.sex === "MALE",
  ).length;
  const girls = section.enrollmentRecords.filter(
    (r) => r.learner.sex === "FEMALE",
  ).length;

  return {
    ...section,
    enrollmentCount: section.enrollmentRecords.length,
    genderBreakdown: { boys, girls },
    adviser: section.advisers[0]?.teacher ?? null,
  };
}
