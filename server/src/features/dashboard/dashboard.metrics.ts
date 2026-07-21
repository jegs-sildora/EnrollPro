export interface ActiveTallyRecord {
  isLateEnrollee: boolean
  dropOutDate: Date | null
  transferOutDate: Date | null
}

export interface ActiveTallyMetric {
  verifiedBosyBaseline: number
  lateAdmissions: number
  officiallyDropped: number
  activeTotal: number
}

export function calculateActiveTally(
  records: ActiveTallyRecord[],
): ActiveTallyMetric {
  const schoolRecords = records.filter((record) => !record.transferOutDate)
  const verifiedBosyBaseline = schoolRecords.filter(
    (record) => !record.isLateEnrollee,
  ).length
  const lateAdmissions = schoolRecords.filter(
    (record) => record.isLateEnrollee,
  ).length
  const officiallyDropped = schoolRecords.filter(
    (record) => Boolean(record.dropOutDate),
  ).length

  return {
    verifiedBosyBaseline,
    lateAdmissions,
    officiallyDropped,
    activeTotal: Math.max(
      0,
      verifiedBosyBaseline + lateAdmissions - officiallyDropped,
    ),
  }
}

export function calculateUtilizationPercent(
  enrolled: number,
  capacity: number,
): number {
  return capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0
}

export function countDistinctLearners(
  learnerGroups: Iterable<Iterable<number>>,
): number {
  const learnerIds = new Set<number>()
  for (const group of learnerGroups) {
    for (const learnerId of group) learnerIds.add(learnerId)
  }
  return learnerIds.size
}
