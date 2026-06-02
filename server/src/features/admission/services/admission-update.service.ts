import { AppError } from "../../../lib/AppError.js";
import type { PrismaClient, ApplicationStatus } from "../../../generated/prisma/index.js";

export function createAdmissionUpdateService(prisma: PrismaClient) {
  async function updateApplicationStatus(
    id: number,
    status: ApplicationStatus,
    extraData: Record<string, unknown> = {},
  ) {
    // Try Enrollment table
    const enrollment = await prisma.enrollmentApplication.findUnique({
      where: { id },
      select: { id: true },
    });

    if (enrollment) {
      return prisma.enrollmentApplication.update({
        where: { id },
        data: { status, ...extraData },
      });
    }

    throw new AppError(404, "Application not found");
  }

  return { updateApplicationStatus };
}
