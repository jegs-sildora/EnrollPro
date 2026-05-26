export const queryKeys = {
  publicSettings: ["settings", "public"] as const,
  studentsFilters: (schoolYearId: number) => ["students", "filters", schoolYearId] as const,
  studentsSummary: (schoolYearId: number) => ["students", "summary", schoolYearId] as const,
  studentsList: (params: Record<string, string | number>) => ["students", "list", params] as const,
  studentDetail: (studentId: number) => ["students", "detail", studentId] as const,
  teachersList: (schoolYearId: number | null) => ["teachers", "list", schoolYearId] as const,
  teachersSections: (schoolYearId: number) => ["teachers", "sections", schoolYearId] as const,
  homeroomSections: (schoolYearId: number) => ["homerooms", "sections", schoolYearId] as const,
  homeroomPrograms: (schoolYearId: number) => ["homerooms", "programs", schoolYearId] as const,
  homeroomAdviserCandidates: (schoolYearId: number) =>
    ["homerooms", "adviser-candidates", schoolYearId] as const,
  homeroomTeachers: (schoolYearId: number, excludeSectionId: number | null) =>
    ["homerooms", "teachers", schoolYearId, excludeSectionId] as const,
  learnerProfile: ["learner", "profile"] as const,
  learnerAcademicHistory: ["learner", "academic-history"] as const,
  // High-velocity live queues
  adviserQueue: (schoolYearId: number, search?: string) =>
    ["adviser", "queue", schoolYearId, search ?? ""] as const,
  continuingQueue: (schoolYearId: number, search?: string) =>
    ["reading-assessment", "continuing-queue", schoolYearId, search ?? ""] as const,
  sectioningPool: () => ["sectioning", "pool"] as const,
  sectioningSections: () => ["sectioning", "sections"] as const,
};