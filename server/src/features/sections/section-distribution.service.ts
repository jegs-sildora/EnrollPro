import type {
  ApplicantType,
  Sex,
} from "../../generated/prisma/index.js"
import {
  getAutoDraftProgramType,
  type LearnerType,
} from "@enrollpro/shared"

export interface DistributionLearner {
  applicationId: number
  sex: Sex
  generalAverage: number
  learnerType: LearnerType
  isBalikAral: boolean
  applicantType: ApplicantType
  assignedProgram: ApplicantType | null
}

export interface DistributionSection {
  id: number
  sortOrder: number
  maxCapacity: number
  currentCount: number
  programType: ApplicantType
}

export interface SectionAssignment {
  applicationId: number
  sectionId: number
}

interface BuildBalancedSectionAssignmentsInput {
  learners: DistributionLearner[]
  sections: DistributionSection[]
}

function sortByAverage(
  first: DistributionLearner,
  second: DistributionLearner,
): number {
  return (
    second.generalAverage - first.generalAverage
    || first.applicationId - second.applicationId
  )
}

function interleaveBySex(
  learners: DistributionLearner[],
): DistributionLearner[] {
  const males = learners
    .filter((learner) => learner.sex === "MALE")
    .sort(sortByAverage)
  const females = learners
    .filter((learner) => learner.sex === "FEMALE")
    .sort(sortByAverage)
  const result: DistributionLearner[] = []

  let maleIndex = 0
  let femaleIndex = 0
  let preferMale = males.length >= females.length

  while (maleIndex < males.length || femaleIndex < females.length) {
    const preferred = preferMale ? males[maleIndex] : females[femaleIndex]
    const fallback = preferMale ? females[femaleIndex] : males[maleIndex]
    const selected = preferred ?? fallback

    if (!selected) break

    result.push(selected)
    if (selected.sex === "MALE") maleIndex += 1
    else femaleIndex += 1
    preferMale = !preferMale
  }

  return result
}

function buildSerpentineSlots(
  sections: DistributionSection[],
): number[] {
  const ordered = [...sections].sort(
    (first, second) =>
      first.sortOrder - second.sortOrder || first.id - second.id,
  )
  const remainingBySection = new Map(
    ordered.map((section) => [
      section.id,
      Math.max(0, section.maxCapacity - section.currentCount),
    ]),
  )
  const slots: number[] = []
  let forward = true

  while (
    ordered.some(
      (section) => (remainingBySection.get(section.id) ?? 0) > 0,
    )
  ) {
    const pass = forward ? ordered : [...ordered].reverse()
    for (const section of pass) {
      const remaining = remainingBySection.get(section.id) ?? 0
      if (remaining <= 0) continue
      slots.push(section.id)
      remainingBySection.set(section.id, remaining - 1)
    }
    forward = !forward
  }

  return slots
}

export function buildBalancedSectionAssignments({
  learners,
  sections,
}: BuildBalancedSectionAssignmentsInput): SectionAssignment[] {
  const programTypes = Array.from(
    new Set(learners.map((learner) => getAutoDraftProgramType(learner))),
  )
  const assignments: SectionAssignment[] = []

  for (const programType of programTypes) {
    const programLearners = interleaveBySex(
      learners.filter(
        (learner) => getAutoDraftProgramType(learner) === programType,
      ),
    )
    const programSections = sections.filter(
      (section) => section.programType === programType,
    )
    const slots = buildSerpentineSlots(programSections)

    for (const [index, learner] of programLearners.entries()) {
      const sectionId = slots[index]
      if (sectionId === undefined) break
      assignments.push({
        applicationId: learner.applicationId,
        sectionId,
      })
    }
  }

  return assignments
}
