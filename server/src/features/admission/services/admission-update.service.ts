import { AppError } from "../../../lib/AppError.js";
import type { PrismaClient, ApplicationStatus } from "../../../generated/prisma/index.js";

export function createAdmissionUpdateService(prisma: PrismaClient) {
  async function updateApplicationStatus(id: number, status: ApplicationStatus, extraData: any = {}) {
    // Try Enrollment table first
    const enrollment = await prisma.enrollmentApplication.findUnique({
      where: { id },
      select: { id: true }
    });

    if (enrollment) {
      return prisma.enrollmentApplication.update({
        where: { id },
        data: { status, ...extraData }
      });
    }

    // Fallback to Early Registration table
    const earlyReg = await prisma.earlyRegistrationApplication.findUnique({
      where: { id },
      select: { id: true }
    });

    if (earlyReg) {
      return prisma.earlyRegistrationApplication.update({
        where: { id },
        data: { status, ...extraData }
      });
    }

    throw new AppError(404, "Application not found");
  }

  return { updateApplicationStatus };
}
