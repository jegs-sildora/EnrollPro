import api from "@/shared/api/axiosInstance";

export interface PhilIriQueueItem {
  id: number;
  status: string;
  applicantType: string;
  learnerType: string | null;
  admissionChannel: string | null;
  learner: {
    id: number;
    lrn: string | null;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  gradeLevel: { id: number; name: string };
}

/** Extended item returned by the adviser (unified) queue. */
export interface AdviserQueueItem extends PhilIriQueueItem {
  readingProfileLevel: ReadingLevel | null;
}

export type ReadingLevel =
  | "INDEPENDENT"
  | "INSTRUCTIONAL"
  | "FRUSTRATION"
  | "NON_READER";

export async function fetchReadingAssessmentQueue(
  schoolYearId: number,
  search?: string,
): Promise<PhilIriQueueItem[]> {
  const params = new URLSearchParams({ schoolYearId: String(schoolYearId) });
  if (search) params.append("search", search);
  const res = await api.get<{ applications: PhilIriQueueItem[] }>(
    `/reading-assessment/queue?${params.toString()}`,
  );
  return res.data.applications;
}

/** Unified queue for TEACHER role — all SUBMITTED_BEEF | READY_FOR_ENROLLMENT. */
export async function fetchAdviserQueue(
  schoolYearId: number,
  search?: string,
): Promise<AdviserQueueItem[]> {
  const params = new URLSearchParams({ schoolYearId: String(schoolYearId) });
  if (search) params.append("search", search);
  const res = await api.get<{ applications: AdviserQueueItem[] }>(
    `/reading-assessment/adviser-queue?${params.toString()}`,
  );
  return res.data.applications;
}

export async function submitReadingLevel(
  applicationId: number,
  readingLevel: ReadingLevel,
): Promise<void> {
  await api.put(`/reading-assessment/${applicationId}`, { readingLevel });
}

// ── Continuing Learners ───────────────────────────────────────────────────────

export interface ContinuingQueueItem {
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
}

export interface ContinuingQueuePage {
  items: ContinuingQueueItem[];
  total: number;
}

/** Returns PENDING_CONFIRMATION CONTINUING learners for the adviser intake hub. */
export async function fetchContinuingQueue(
  schoolYearId: number,
  search?: string,
): Promise<ContinuingQueuePage> {
  const params = new URLSearchParams({ schoolYearId: String(schoolYearId) });
  if (search) params.append("search", search);
  const res = await api.get<ContinuingQueuePage>(
    `/reading-assessment/continuing-queue?${params.toString()}`,
  );
  return res.data;
}
