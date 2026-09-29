import type { AcademicStatus } from "../../generated/prisma/index.js"

interface TransfereeDetailsSource {
  previousSchool: {
    schoolName: string | null
    schoolId: string | null
    transferCertificateNo: string | null
    generalAverage: number | null
    lastGradeCompleted: string | null
  } | null
  academicStatus: AcademicStatus
  backSubjects: Array<{ subjectCode: string }>
  isMissingSf9: boolean
  isTemporarilyEnrolled: boolean
  learner: { hasPsaBirthCertificate: boolean }
}

function nonEmpty(value: string | null | undefined): string | null {
  return value?.trim() || null
}

export function smartTransfereeDetails(source: TransfereeDetailsSource) {
  if (source.backSubjects.length > 2) {
    throw new Error("Transferee has more than two back subjects")
  }

  return {
    previousSchoolName: nonEmpty(source.previousSchool?.schoolName),
    originatingSchoolId: nonEmpty(source.previousSchool?.schoolId),
    transferCertificateNo: nonEmpty(source.previousSchool?.transferCertificateNo),
    previousGenAve: source.previousSchool?.generalAverage ?? null,
    lastGradeCompleted: nonEmpty(source.previousSchool?.lastGradeCompleted),
    sf9EligibilityStatus: source.academicStatus,
    conditionalSubjectCodes: source.backSubjects.map((subject) => subject.subjectCode),
    hasSf9: !source.isMissingSf9,
    hasPsa: source.learner.hasPsaBirthCertificate,
    isTemporarilyEnrolled: source.isTemporarilyEnrolled,
  }
}
