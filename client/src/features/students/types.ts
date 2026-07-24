export interface HealthRecord {
  id: number;
  learnerId: number;
  schoolYearId: number;
  assessmentPeriod: "BOSY" | "EOSY";
  assessmentDate: string;
  weightKg: number;
  heightCm: number;
  notes: string | null;
  recordedById: number;
  recordedBy?: {
    firstName: string;
    lastName: string;
  } | null;
  schoolYear?: {
    yearLabel: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}
