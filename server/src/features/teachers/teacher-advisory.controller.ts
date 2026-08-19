import type { NextFunction, Request, Response } from "express"
import { AppError } from "../../lib/AppError.js"
import { prisma } from "../../lib/prisma.js"

export async function getTeacherAdvisory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true },
    })

    if (!teacher) {
      throw new AppError(404, "Teacher profile not found for this user.")
    }

    const adviser = await prisma.sectionAdviser.findFirst({
      where: {
        teacherId: teacher.id,
        status: "ACTIVE",
        section: { schoolYearId: req.schoolYearId! },
      },
      include: {
        section: { include: { gradeLevel: true } },
      },
    })

    if (!adviser) {
      throw new AppError(404, "Active advisory section not found for this teacher.")
    }

    const records = await prisma.enrollmentRecord.findMany({
      where: { sectionId: adviser.section.id },
      include: {
        enrollmentApplication: { include: { learner: true } },
      },
      orderBy: [
        { enrollmentApplication: { learner: { sex: "asc" } } },
        { enrollmentApplication: { learner: { lastName: "asc" } } },
        { enrollmentApplication: { learner: { firstName: "asc" } } },
      ],
    })

    res.json({
      section: adviser.section,
      records: records.map((record) => ({
        ...record,
        finalAverage:
          record.finalAverage === null ? null : Number(record.finalAverage),
      })),
    })
  } catch (error) {
    next(error)
  }
}
