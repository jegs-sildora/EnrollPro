export interface BOSYReadiness {
  schoolYearId: number;
  schoolYearLabel: string;
  isEosyFinalized: boolean;
  irregularBlockerCount: number;
  pendingConfirmationCount: number;
  readyForSectioningCount: number;
  enrolledCount: number;
  jhsCompleterCount: number;
  droppedCount: number;
}

export interface BOSYQueueItem {
  applicationId: number;
  trackingNumber: string | null;
  status: string;
  learnerId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gradeLevelId: number;
  gradeLevelName: string;
  gradeLevelDisplayOrder: number;
  academicStatus: string | null;
  priorSectionName: string | null;
  priorAdviserName: string | null;
  tleProgramId: number | null;
  tleProgramName: string | null;
  tleProgramCategory: string | null;
  tleStatus: string | null;
}

export interface JHSCompleter {
  learnerId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  lastGradeLevel: string | null;
  lastYearEnrolled: string | null;
  lastSectionName: string | null;
}

export interface BOSYQueuePage {
  items: BOSYQueueItem[];
  total: number;
  page: number;
  limit: number;
}

export interface BulkConfirmResult {
  confirmed: number[];
  failed: Array<{ id: number; reason: string }>;
}

export interface JHSCompleterPage {
  items: JHSCompleter[];
  total: number;
  page: number;
  limit: number;
}

export interface TLEProgram {
  id: number;
  name: string;
  programCode: string;
  category: string;
  isActive: boolean;
}
