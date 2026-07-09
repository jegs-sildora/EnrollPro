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

export interface MovementTrendPoint {
  month: string
  transferredIn: number
  transferredOut: number
  droppedOut: number
}

export interface DropoutDistributionPoint {
  reason: string
  count: number
}

export interface ComplianceSegment {
  name: string
  value: number
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
  v85Stats: {
    lateIntakeCount: number
    pendingSF10Count: number
    overdueDocumentsCount: number
    activeSchoolTallyBOSY: number
    activeSchoolTallyLate: number
    hasSectionLoadDisparity: boolean
    isTemporaryAdmissionExpired: boolean
    expiredTemporaryAdmissionsCount: number
    movementTrend: Array<MovementTrendPoint>
    dropoutDistribution: Array<DropoutDistributionPoint>
    documentCompliance: Array<ComplianceSegment>
    sf4Vitals: {
      transferredIn: number
      transferredOut: number
      droppedOut: number
    }
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
