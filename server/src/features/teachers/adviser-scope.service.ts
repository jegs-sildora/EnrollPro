import { prisma } from "../../lib/prisma.js";

/**
 * Returns the gradeLevelId for the active advisory section of the given user.
 * Returns null if the user is not a teacher or has no active advisory section.
 */
export async function getAdviserGradeLevelId(
  userId: number,
  schoolYearId: number,
): Promise<number | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!teacher) return null;

  const adviser = await prisma.sectionAdviser.findFirst({
    where: {
      teacherId: teacher.id,
      status: "ACTIVE",
      section: { schoolYearId },
    },
    include: {
      section: true,
    },
  });

  if (!adviser || !adviser.section) return null;
  return adviser.section.gradeLevelId;
}
