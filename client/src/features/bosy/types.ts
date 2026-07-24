export interface BOSYReadiness {
  schoolYearId: number;
  schoolYearLabel: string;
  isEosyFinalized: boolean;
  irregularBlockerCount: number;
  pendingConfirmationCount: number;
  confirmedReadyCount: number;
  temporarilyEnrolledCount: number;
  readyForSectioningCount: number;
  enrolledCount: number;
  jhsCompleterCount: number;
  transferRequestCount: number;
}

export type BOSYQueueState =
  | "PENDING"
  | "CONFIRMED"
  | "TEMPORARY"
  | "TRANSFER_REQUEST";

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
  isRemedialRequired: boolean;
  isTemporarilyEnrolled: boolean;
  credentialStatus: "COMPLETE" | "PENDING";
  missingDocuments: string[];
  priorSectionName: string | null;
  priorAdviserName: string | null;
  priorYearGenAve: number | null;
  priorYearDeficiencyNote: string | null;
}

export interface BOSYQueuePage {
  items: BOSYQueueItem[];
  total: number;
  page: number;
  limit: number;
}

export interface BulkConfirmResult {
  confirmed: number[];
  readyForSectioning: number[];
  temporarilyEnrolled: number[];
  failed: Array<{ id: number; reason: string }>;
}

export interface ConfirmReturnResult {
  applicationId: number;
  status: string;
  intakeState: "CONFIRMED" | "TEMPORARY";
  missingDocuments: string[];
}

