export interface GradeLevelBreakdown {
  id: number
  name: string
  current: number
  male: number
  female: number
  late: number
  dropped: number
  feeder: number
  transferee: number
  balikAral: number
}

export interface IntakeDemographic {
  category: string
  count: number
}

export interface DailyIntakePoint {
  date: string
  online: number
  f2f: number
}

export interface RetentionSegment {
  name: string
  value: number
}

export interface GradeLevelFinalizationItem {
  id: number
  name: string
  total: number
  finalized: number
  percent: number
}

export interface HistoricalSummary {
  promotedTotal: number
  conditionallyPromotedTotal: number
  retainedTotal: number
  jhsCompletersTotal: number
  jhsCompletersMale: number
  jhsCompletersFemale: number
  transferredOutTotal: number
  droppedOutTotal: number
}

export interface DashboardStats {
  systemPhase: string
  isArchived: boolean
  classroomDeficitDetected: boolean
  dailyIntakeVelocity: Array<DailyIntakePoint>
  intakeDemographics: Array<IntakeDemographic>
  kpiHeader: {
    pendingTotal: number
    unassignedTotal: number
    deficientTotal: number
    enrolledTotal: number
  }
  summaryRibbon: {
    totalEnrollment: number
    activeFaculty: number
    enrolledSections: number
    pendingSystemValidations: number
  }
  curriculumDistribution: Array<{
    programType: string
    label: string
    count: number
    isSpecialProgram: boolean
  }>
  intakePipeline: Array<{
    gradeLevelId: number
    gradeLevelName: string
    displayOrder: number
    continuingLearners: number
    walkIn: number
    transferee: number
  }>
  sectionSaturation: Array<{
    id: number
    name: string
    gradeLevelName: string
    programType: string
    capacity: number
    enrolled: number
    utilizationPercent: number
    isOverCapacity: boolean
  }>
  sf1Compliance: {
    invalidLrn: number
    missingBirthdate: number
    missingMotherTongue: number
    missingCurrentAddress: number
    missingGuardianContact: number
    affectedLearners: number
  }
  activeTally: {
    verifiedBosyBaseline: number
    lateAdmissions: number
    officiallyDropped: number
    activeTotal: number
  }
  eosyReadiness: {
    pendingSections: number
    incompleteLearnerOutcomes: number
    conditionallyPromoted: number
    retained: number
    promotionCompletionPercent: number
    sf5Ready: boolean
    sf6Ready: boolean
  }
  classesOngoing: {
    lateIntakeCount: number
    overdueDocumentsCount: number
    activeSchoolTallyBOSY: number
    activeSchoolTallyLate: number
    hasSectionLoadDisparity: boolean
  }
  eosyStats: {
    eosyFinalizedSections: number
    eosyPendingSections: number
    promotedTotal: number
    retainedTotal: number
    irregularTotal: number
    learnerRetention: Array<RetentionSegment>
    gradeLevelFinalization: Array<GradeLevelFinalizationItem>
    activeLearnersCount: number
    transferredLearnersCount: number
    droppedLearnersCount: number
  }
  historicalSummary: HistoricalSummary
  criticalSections: Array<{
    id: string
    name: string
    capacity: number
    enrolled: number
  }>
  totalSections: number
  gradeLevelBreakdown: Array<GradeLevelBreakdown>
}
