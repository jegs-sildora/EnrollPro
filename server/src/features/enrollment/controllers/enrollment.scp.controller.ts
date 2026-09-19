import type { Request, Response } from "express"
import { z } from "zod"

import type { ApplicantType, ScpAssessmentResult } from "../../../generated/prisma/index.js"
import { AppError } from "../../../lib/AppError.js"
import { prisma } from "../../../lib/prisma.js"

const supportedProgramSchema = z.enum([
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
])

const scpUpdateSchema = z.object({
  applicationId: z.number().int().positive(),
  hasPassedRequirements: z.boolean(),
  hasWrittenExam: z.boolean(),
  writtenExamScore: z.number().min(0).max(100).nullable(),
  hasInterview: z.boolean(),
  assessmentResult: z.enum(["PENDING", "QUALIFIED", "DISQUALIFIED"]).optional(),
}).superRefine((data, context) => {
  if (!data.hasPassedRequirements && data.hasWrittenExam) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hasWrittenExam"],
      message: "Written exam cannot be taken if requirements are not passed.",
    })
  }
  if (!data.hasWrittenExam && data.hasInterview) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hasInterview"],
      message: "Interview completion requires a written exam.",
    })
  }
})

const bulkScpUpdateSchema = z.object({
  updates: z.array(scpUpdateSchema).min(1),
})

function getAssessmentResult(
  hasPassedRequirements: boolean,
  hasWrittenExam: boolean,
  hasInterview: boolean,
): ScpAssessmentResult {
  if (!hasPassedRequirements) return "DISQUALIFIED"
  if (!hasWrittenExam) return "PENDING"
  return hasInterview ? "QUALIFIED" : "DISQUALIFIED"
}

async function getEnabledPrograms(): Promise<ApplicantType[]> {
  const settings = await prisma.schoolSetting.findFirst({
    select: { steEnabled: true, spaEnabled: true, spsEnabled: true },
  })
  if (!settings) return []

  const programs: ApplicantType[] = []
  if (settings.steEnabled) programs.push("SCIENCE_TECHNOLOGY_AND_ENGINEERING")
  if (settings.spaEnabled) programs.push("SPECIAL_PROGRAM_IN_THE_ARTS")
  if (settings.spsEnabled) programs.push("SPECIAL_PROGRAM_IN_SPORTS")
  return programs
}

export const getScpApplicants = async (req: Request, res: Response): Promise<void> => {
  const schoolYearId = req.query.schoolYearId
    ? Number(req.query.schoolYearId)
    : req.schoolYearId

  if (!schoolYearId || !Number.isInteger(schoolYearId)) {
    throw new AppError(400, "Active school year not found.")
  }

  const enabledPrograms = await getEnabledPrograms()
  const requestedProgram = req.query.program
    ? supportedProgramSchema.parse(req.query.program)
    : null

  if (requestedProgram && !enabledPrograms.includes(requestedProgram)) {
    throw new AppError(400, "The selected Special Curricular Program is not active.")
  }

  const programs = requestedProgram ? [requestedProgram] : enabledPrograms
  if (programs.length === 0) {
    res.json([])
    return
  }

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: { in: ["PENDING_VERIFICATION", "READY_FOR_SECTIONING"] },
      applicantType: { in: programs },
    },
    include: {
      learner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          lrn: true,
          sex: true,
          studentPhoto: true,
        },
      },
      scpProfile: true,
    },
    orderBy: [
      { learner: { lastName: "asc" } },
      { learner: { firstName: "asc" } },
    ],
  })

  res.json(applications)
}

export const bulkSaveScpAssessments = async (req: Request, res: Response): Promise<void> => {
  const schoolYearId = req.schoolYearId
  if (!schoolYearId) {
    throw new AppError(400, "Active school year not found.")
  }

  const { updates } = bulkScpUpdateSchema.parse(req.body)
  const enabledPrograms = await getEnabledPrograms()
  const applicationIds = updates.map(({ applicationId }) => applicationId)
  const eligibleApplications = await prisma.enrollmentApplication.count({
    where: {
      id: { in: applicationIds },
      schoolYearId,
      applicantType: { in: enabledPrograms },
      scpProfile: { isNot: null },
    },
  })

  if (eligibleApplications !== new Set(applicationIds).size) {
    throw new AppError(400, "One or more applicants cannot be assessed for this school year.")
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.enrollmentScpProfile.update({
        where: { applicationId: update.applicationId },
        data: {
          hasPassedRequirements: update.hasPassedRequirements,
          hasWrittenExam: update.hasPassedRequirements && update.hasWrittenExam,
          writtenExamScore: update.hasPassedRequirements && update.hasWrittenExam ? update.writtenExamScore : null,
          hasInterview: update.hasPassedRequirements && update.hasWrittenExam && update.hasInterview,
          assessmentResult: getAssessmentResult(update.hasPassedRequirements, update.hasWrittenExam, update.hasInterview),
        },
      }),
    ),
  )

  res.json({ message: "Assessments updated successfully.", updatedCount: updates.length })
}
