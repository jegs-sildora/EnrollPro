import type { Request, Response } from "express"
import { z } from "zod"

import type { ApplicantType, ScpAssessmentResult, ScpAssessmentState } from "../../../generated/prisma/index.js"
import { AppError } from "../../../lib/AppError.js"
import { prisma } from "../../../lib/prisma.js"

const supportedProgramSchema = z.enum([
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
])

const scpAssessmentStateSchema = z.enum(["PENDING", "PASSED", "FAILED"])

const scpUpdateSchema = z.object({
  applicationId: z.number().int().positive(),
  requirementsStatus: scpAssessmentStateSchema,
  writtenExamStatus: scpAssessmentStateSchema,
  writtenExamScore: z.number().min(0).max(100).nullable(),
  interviewStatus: scpAssessmentStateSchema,
  assessmentResult: z.enum(["PENDING", "QUALIFIED", "WAITLISTED", "DISQUALIFIED"]).optional(),
}).superRefine((data, context) => {
  if (data.requirementsStatus !== "PASSED" && data.writtenExamStatus !== "PENDING") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["writtenExamStatus"],
      message: "Written exam cannot be taken if requirements are not passed.",
    })
  }
  if (data.writtenExamStatus !== "PASSED" && data.interviewStatus !== "PENDING") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["interviewStatus"],
      message: "Interview completion requires a passed written exam.",
    })
  }
})

const bulkScpUpdateSchema = z.object({
  program: supportedProgramSchema,
  updates: z.array(scpUpdateSchema).min(1),
})

function getAssessmentResult(
  requirementsStatus: ScpAssessmentState,
  writtenExamStatus: ScpAssessmentState,
  interviewStatus: ScpAssessmentState,
): ScpAssessmentResult {
  if (requirementsStatus === "FAILED" || writtenExamStatus === "FAILED" || interviewStatus === "FAILED") return "DISQUALIFIED"
  if (requirementsStatus === "PENDING" || writtenExamStatus === "PENDING" || interviewStatus === "PENDING") return "PENDING"
  return "QUALIFIED"
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

  const { program, updates } = bulkScpUpdateSchema.parse(req.body)
  const enabledPrograms = await getEnabledPrograms()
  
  if (!enabledPrograms.includes(program)) {
    throw new AppError(400, "The selected Special Curricular Program is not active.")
  }

  const schoolYear = await prisma.schoolYear.findUnique({ where: { id: schoolYearId } })
  if (
    (program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && schoolYear?.steRosterLocked) ||
    (program === "SPECIAL_PROGRAM_IN_THE_ARTS" && schoolYear?.spaRosterLocked) ||
    (program === "SPECIAL_PROGRAM_IN_SPORTS" && schoolYear?.spsRosterLocked)
  ) {
    throw new AppError(403, "The roster for this program has been locked and cannot be modified.")
  }

  const applicationIds = updates.map(({ applicationId }) => applicationId)
  const eligibleApplications = await prisma.enrollmentApplication.count({
    where: {
      id: { in: applicationIds },
      schoolYearId,
      applicantType: program,
      scpProfile: { isNot: null },
    },
  })

  if (eligibleApplications !== new Set(applicationIds).size) {
    throw new AppError(400, "One or more applicants cannot be assessed for this school year.")
  }

  await prisma.$transaction(async (tx) => {
    // 1. Initial save of edits
    await Promise.all(
      updates.map((update) =>
        tx.enrollmentScpProfile.update({
          where: { applicationId: update.applicationId },
          data: {
            requirementsStatus: update.requirementsStatus,
            writtenExamStatus: update.requirementsStatus === "PASSED" ? update.writtenExamStatus : "PENDING",
            writtenExamScore: update.requirementsStatus === "PASSED" && update.writtenExamStatus !== "PENDING" ? update.writtenExamScore : null,
            interviewStatus: update.requirementsStatus === "PASSED" && update.writtenExamStatus === "PASSED" ? update.interviewStatus : "PENDING",
          },
        }),
      )
    )

    // 2. Fetch all profiles for the given program
    const allProfiles = await tx.enrollmentScpProfile.findMany({
      where: {
        application: {
          schoolYearId,
          applicantType: program,
          status: { in: ["PENDING_VERIFICATION", "READY_FOR_SECTIONING"] },
        },
      },
    })

    // 3. Get Capacity
    const settings = await tx.schoolSetting.findFirst()
    let maxSlots = 0
    if (program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") maxSlots = settings?.steCapacity ?? 0
    else if (program === "SPECIAL_PROGRAM_IN_THE_ARTS") maxSlots = settings?.spaCapacity ?? 0
    else if (program === "SPECIAL_PROGRAM_IN_SPORTS") maxSlots = settings?.spsCapacity ?? 0

    // 4. Rank and update
    const eligible = []
    const ineligible = []
    for (const p of allProfiles) {
      if (p.requirementsStatus === "PASSED" && p.writtenExamStatus === "PASSED" && p.interviewStatus === "PASSED") {
        eligible.push(p)
      } else {
        ineligible.push(p)
      }
    }

    eligible.sort((a, b) => {
      const scoreDiff = (b.writtenExamScore ?? 0) - (a.writtenExamScore ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      return (b.grade5GeneralAverage ?? 0) - (a.grade5GeneralAverage ?? 0)
    })

    const finalUpdates = []

    for (let i = 0; i < eligible.length; i++) {
      const newStatus = i < maxSlots ? "QUALIFIED" : "WAITLISTED"
      if (eligible[i].assessmentResult !== newStatus) {
        finalUpdates.push(
          tx.enrollmentScpProfile.update({
            where: { id: eligible[i].id },
            data: { assessmentResult: newStatus },
          })
        )
      }
    }

    for (const p of ineligible) {
      const newStatus = getAssessmentResult(p.requirementsStatus, p.writtenExamStatus, p.interviewStatus)
      if (p.assessmentResult !== newStatus) {
        finalUpdates.push(
          tx.enrollmentScpProfile.update({
            where: { id: p.id },
            data: { assessmentResult: newStatus },
          })
        )
      }
    }

    if (finalUpdates.length > 0) {
      await Promise.all(finalUpdates)
    }
  })

  res.json({ message: "Assessments updated successfully.", updatedCount: updates.length })
}

export const lockScpRoster = async (req: Request, res: Response): Promise<void> => {
  const schoolYearId = req.schoolYearId
  if (!schoolYearId) {
    throw new AppError(400, "Active school year not found.")
  }

  const { program } = z.object({ program: supportedProgramSchema }).parse(req.body)
  const enabledPrograms = await getEnabledPrograms()
  
  if (!enabledPrograms.includes(program)) {
    throw new AppError(400, "The selected Special Curricular Program is not active.")
  }

  const updateData: any = {}
  if (program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") updateData.steRosterLocked = true
  if (program === "SPECIAL_PROGRAM_IN_THE_ARTS") updateData.spaRosterLocked = true
  if (program === "SPECIAL_PROGRAM_IN_SPORTS") updateData.spsRosterLocked = true

  await prisma.schoolYear.update({
    where: { id: schoolYearId },
    data: updateData
  })

  // We could broadcastSettingsInvalidation here if needed, but the frontend will rely on useMutation invalidation or SSE.
  res.json({ message: "Roster successfully locked." })
}

export const unlockScpRoster = async (req: Request, res: Response): Promise<void> => {
  const schoolYearId = req.schoolYearId
  if (!schoolYearId) {
    throw new AppError(400, "Active school year not found.")
  }

  const { program } = z.object({ program: supportedProgramSchema }).parse(req.body)
  const enabledPrograms = await getEnabledPrograms()
  
  if (!enabledPrograms.includes(program)) {
    throw new AppError(400, "The selected Special Curricular Program is not active.")
  }

  const updateData: any = {}
  if (program === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") updateData.steRosterLocked = false
  if (program === "SPECIAL_PROGRAM_IN_THE_ARTS") updateData.spaRosterLocked = false
  if (program === "SPECIAL_PROGRAM_IN_SPORTS") updateData.spsRosterLocked = false

  await prisma.schoolYear.update({
    where: { id: schoolYearId },
    data: updateData
  })

  res.json({ message: "Roster successfully unlocked." })
}

export const forfeitScpSlot = async (req: Request, res: Response): Promise<void> => {
  const schoolYearId = req.schoolYearId
  if (!schoolYearId) {
    throw new AppError(400, "Active school year not found.")
  }

  const applicationId = parseInt(req.params.applicationId as string, 10)
  if (isNaN(applicationId)) {
    throw new AppError(400, "Invalid application ID.")
  }

  await prisma.$transaction(async (tx) => {
    const scpProfile = await tx.enrollmentScpProfile.findUnique({
      where: { applicationId },
      include: { application: true }
    })

    if (!scpProfile || scpProfile.assessmentResult !== "QUALIFIED") {
      throw new AppError(400, "Only qualified applicants can be forfeited.")
    }
    
    if (scpProfile.application.schoolYearId !== schoolYearId) {
      throw new AppError(400, "Application belongs to a different school year.")
    }

    const program = scpProfile.application.assignedProgram
    if (!program) {
      throw new AppError(400, "Applicant does not have an assigned program.")
    }

    // 1. Mark as forfeited
    await tx.enrollmentScpProfile.update({
      where: { id: scpProfile.id },
      data: { assessmentResult: "FORFEITED" }
    })

    // 2. Find next waitlisted
    const nextWaitlisted = await tx.enrollmentScpProfile.findFirst({
      where: {
        application: {
          schoolYearId,
          assignedProgram: program,
          status: { notIn: ["REJECTED", "WITHDRAWN", "DROPPED"] }
        },
        assessmentResult: "WAITLISTED",
      },
      orderBy: [
        { writtenExamScore: "desc" },
        { grade5GeneralAverage: "desc" }
      ]
    })

    // 3. Promote if found
    if (nextWaitlisted) {
      await tx.enrollmentScpProfile.update({
        where: { id: nextWaitlisted.id },
        data: { assessmentResult: "QUALIFIED" }
      })
    }
  })

  res.json({ message: "Slot successfully forfeited." })
}
