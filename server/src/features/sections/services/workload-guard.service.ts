import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../lib/AppError.js";

const RA_4670_MAXIMUM_TEACHING_LOAD_HOURS = 6;
const STANDARD_CLASS_DURATION_HOURS = 1;
const ADVISORY_LOAD_EQUIVALENT = 1;

/**
 * RA 4670 Workload Guard Engine.
 * Validates that a teacher's total teaching load (TLE classes + advisory) does not exceed 6 hours/day.
 * Returns true if assignment is valid, throws AppError if violation detected.
 */
export async function calculateTeacherWorkload(
  teacherId: number,
  schoolYearId: number,
  _newSectionStartTime?: Date,
  _newSectionEndTime?: Date,
): Promise<boolean> {
  // 1. Check if teacher is an active adviser
  const advisoryDesignations = await prisma.teacherDesignation.findMany({
    where: {
      teacherId,
      schoolYearId,
      isClassAdviser: true,
    },
  });

  const isCurrentlyAdviser = advisoryDesignations.length > 0;

  // 2. Count section adviserships
  const sectionAdviserCount = await prisma.sectionAdviser.findMany({
    where: {
      teacherId,
      schoolYearId,
      status: "ACTIVE",
    },
  });

  // 3. Calculate volume-based load
  // Each advisory = 1 hour, each TLE class = 1 hour
  const advisoryLoad = isCurrentlyAdviser ? ADVISORY_LOAD_EQUIVALENT : 0;
  const currentTleLoad = sectionAdviserCount.length * STANDARD_CLASS_DURATION_HOURS;
  const currentTotalLoad = advisoryLoad + currentTleLoad;

  // 4. Project load with new assignment
  const projectedTotalLoad = currentTotalLoad + STANDARD_CLASS_DURATION_HOURS;

  if (projectedTotalLoad > RA_4670_MAXIMUM_TEACHING_LOAD_HOURS) {
    throw new AppError(
      422,
      `RA 4670 Violation: Teacher would exceed 6-hour maximum teaching load. Current: ${currentTotalLoad}h + New: 1h = ${projectedTotalLoad}h > 6h.`,
      "RA_4670_VIOLATION",
    );
  }

  return true;
}
