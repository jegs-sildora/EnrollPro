import { format } from "date-fns";
import type { ApplicantDetail } from "@/hooks/useApplicationDetail";

export function PersonalInfo({ applicant }: { applicant: ApplicantDetail }) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden border rounded-md mb-2 bg-[hsl(var(--card))]">
      <summary className="flex items-center justify-between cursor-pointer p-3 font-semibold text-sm">
        <span>▸ Personal Info</span>
        <span className="text-xs text-muted-foreground group-open:hidden">Expand</span>
      </summary>
      <div className="p-3 pt-0 text-sm border-t grid grid-cols-[120px_1fr] gap-1">
        <span className="text-muted-foreground">Date of Birth:</span>
        <span>{format(new Date(applicant.birthDate), "MMMM d, yyyy")}</span>

        <span className="text-muted-foreground">Sex:</span>
        <span className="capitalize">{applicant.sex.toLowerCase()}</span>

        <span className="text-muted-foreground">Place of Birth:</span>
        <span>{applicant.placeOfBirth || "N/A"}</span>

        <span className="text-muted-foreground">Religion:</span>
        <span>{applicant.religion || "N/A"}</span>
      </div>
    </details>
  );
}

export function GuardianContact({ applicant }: { applicant: ApplicantDetail }) {
  const c = applicant.motherName?.contactNumber || applicant.fatherName?.contactNumber || applicant.guardianInfo?.contactNumber || "N/A";
  const name = applicant.guardianInfo?.firstName ? `${applicant.guardianInfo.firstName} ${applicant.guardianInfo.lastName}` : (applicant.motherName?.firstName ? `${applicant.motherName.firstName} ${applicant.motherName.lastName}` : "N/A");

  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden border rounded-md mb-2 bg-[hsl(var(--card))]">
      <summary className="flex items-center justify-between cursor-pointer p-3 font-semibold text-sm">
        <span>▸ Guardian & Contact</span>
        <span className="text-xs text-muted-foreground group-open:hidden">Expand</span>
      </summary>
      <div className="p-3 pt-0 text-sm border-t grid grid-cols-[120px_1fr] gap-1">
        <span className="text-muted-foreground">Primary Name:</span>
        <span>{name}</span>

        <span className="text-muted-foreground">Contact:</span>
        <span>{c}</span>

        <span className="text-muted-foreground">Email:</span>
        <span>{applicant.emailAddress || "N/A"}</span>
      </div>
    </details>
  );
}

export function PreviousSchool({ applicant }: { applicant: ApplicantDetail }) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden border rounded-md mb-2 bg-[hsl(var(--card))]">
      <summary className="flex items-center justify-between cursor-pointer p-3 font-semibold text-sm">
        <span>▸ Previous School</span>
        <span className="text-xs text-muted-foreground group-open:hidden">Expand</span>
      </summary>
      <div className="p-3 pt-0 text-sm border-t grid grid-cols-[120px_1fr] gap-1">
        <span className="text-muted-foreground">School Name:</span>
        <span>{applicant.lastSchoolName || "N/A"}</span>

        <span className="text-muted-foreground">School ID:</span>
        <span>{applicant.lastSchoolId || "N/A"}</span>

        <span className="text-muted-foreground">Grade Completed:</span>
        <span>{applicant.lastGradeCompleted || "N/A"}</span>
      </div>
    </details>
  );
}

export function Classifications({ applicant }: { applicant: ApplicantDetail }) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden border rounded-md mb-2 bg-[hsl(var(--card))]">
      <summary className="flex items-center justify-between cursor-pointer p-3 font-semibold text-sm">
        <span>▸ Classifications</span>
        <span className="text-xs text-muted-foreground group-open:hidden">Expand</span>
      </summary>
      <div className="p-3 pt-0 text-sm border-t grid grid-cols-[120px_1fr] gap-1">
        <span className="text-muted-foreground">IP Community:</span>
        <span>{applicant.isIpCommunity ? `Yes (${applicant.ipGroupName})` : "No"}</span>

        <span className="text-muted-foreground">4Ps:</span>
        <span>{applicant.is4PsBeneficiary ? `Yes (${applicant.householdId4Ps})` : "No"}</span>

        <span className="text-muted-foreground">Disability:</span>
        <span>{applicant.isLearnerWithDisability ? "Yes" : "No"}</span>
      </div>
    </details>
  );
}
