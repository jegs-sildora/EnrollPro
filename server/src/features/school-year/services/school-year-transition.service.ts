import type {
  AcademicStatus,
  EosyStatus,
} from "../../../generated/prisma/index.js"

interface RolloverDestinationInput {
  eosyStatus: EosyStatus
  sourceGradeOrder: number
}

export type RolloverDestination =
  | {
      kind: "PENDING_CONFIRMATION"
      targetGradeOrder: number
      academicStatus: AcademicStatus
      isRemedialRequired: boolean
    }
  | { kind: "JHS_COMPLETER" }
  | {
      kind: "REMEDIAL_HOLD"
      targetGradeOrder: 10
      academicStatus: "CONDITIONALLY_PROMOTED"
      isRemedialRequired: true
    }
  | { kind: "ARCHIVE_ONLY" }

export function resolveRolloverDestination({
  eosyStatus,
  sourceGradeOrder,
}: RolloverDestinationInput): RolloverDestination {
  if (eosyStatus === "TRANSFERRED_OUT" || eosyStatus === "DROPPED_OUT") {
    return { kind: "ARCHIVE_ONLY" }
  }

  if (sourceGradeOrder === 10 && eosyStatus === "PROMOTED") {
    return { kind: "JHS_COMPLETER" }
  }

  if (
    sourceGradeOrder === 10
    && eosyStatus === "CONDITIONALLY_PROMOTED"
  ) {
    return {
      kind: "REMEDIAL_HOLD",
      targetGradeOrder: 10,
      academicStatus: "CONDITIONALLY_PROMOTED",
      isRemedialRequired: true,
    }
  }

  if (eosyStatus === "RETAINED") {
    return {
      kind: "PENDING_CONFIRMATION",
      targetGradeOrder: sourceGradeOrder,
      academicStatus: "RETAINED",
      isRemedialRequired: false,
    }
  }

  if (eosyStatus === "CONDITIONALLY_PROMOTED") {
    return {
      kind: "PENDING_CONFIRMATION",
      targetGradeOrder: sourceGradeOrder + 1,
      academicStatus: "CONDITIONALLY_PROMOTED",
      isRemedialRequired: true,
    }
  }

  return {
    kind: "PENDING_CONFIRMATION",
    targetGradeOrder: sourceGradeOrder + 1,
    academicStatus: "PROMOTED",
    isRemedialRequired: false,
  }
}
