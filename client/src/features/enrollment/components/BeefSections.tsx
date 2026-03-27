import { useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import type { ApplicantDetail } from "@/features/enrollment/hooks/useApplicationDetail";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function CollapsibleSection({ title, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border rounded-md mb-4 bg-[hsl(var(--card))] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3 font-bold text-sm cursor-pointer hover:bg-[hsl(var(--muted)/50)] transition-colors"
      >
        <span>{isOpen ? "▾" : "▸"} {title}</span>
        <span className={`text-xs text-muted-foreground ${isOpen ? 'opacity-60' : ''}`}>
          {isOpen ? "Expanded" : "Expand"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            <div className="p-4 pt-4 text-sm border-t grid grid-cols-[120px_1fr] gap-1 font-bold">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PersonalInfo({ applicant }: { applicant: ApplicantDetail }) {
  return (
    <CollapsibleSection title="Personal Information">
      <span className="text-muted-foreground">Date of Birth:</span>
      <span>{format(new Date(applicant.birthDate), "MMMM d, yyyy")}</span>

      <span className="text-muted-foreground">Sex:</span>
      <span className="uppercase">{applicant.sex?.toLowerCase() ?? "N/A"}</span>

      <span className="text-muted-foreground">Place of Birth:</span>
      <span>{applicant.placeOfBirth || "N/A"}</span>

      <span className="text-muted-foreground">Religion:</span>
      <span>{applicant.religion || "N/A"}</span>
    </CollapsibleSection>
  );
}

export function GuardianContact({ applicant }: { applicant: ApplicantDetail }) {
  const c = applicant.motherName?.contactNumber || applicant.fatherName?.contactNumber || applicant.guardianInfo?.contactNumber || "N/A";
  const name = applicant.guardianInfo?.firstName ? `${applicant.guardianInfo.firstName} ${applicant.guardianInfo.lastName}` : (applicant.motherName?.firstName ? `${applicant.motherName.firstName} ${applicant.motherName.lastName}` : "N/A");

  return (
    <CollapsibleSection title="Guardian & Contact">
      <span className="text-muted-foreground">Primary Name:</span>
      <span>{name}</span>

      <span className="text-muted-foreground">Contact:</span>
      <span>{c}</span>

      <span className="text-muted-foreground">Email:</span>
      <span>{applicant.emailAddress || "N/A"}</span>
    </CollapsibleSection>
  );
}

export function PreviousSchool({ applicant }: { applicant: ApplicantDetail }) {
  return (
    <CollapsibleSection title="Previous School">
      <span className="text-muted-foreground">School Name:</span>
      <span>{applicant.lastSchoolName || "N/A"}</span>

      <span className="text-muted-foreground">School ID:</span>
      <span>{applicant.lastSchoolId || "N/A"}</span>

      <span className="text-muted-foreground">Grade Completed:</span>
      <span>{applicant.lastGradeCompleted || "N/A"}</span>
    </CollapsibleSection>
  );
}

export function Classifications({ applicant }: { applicant: ApplicantDetail }) {
  return (
    <CollapsibleSection title="Classifications">
      <span className="text-muted-foreground">IP Community:</span>
      <span>{applicant.isIpCommunity ? `YES (${applicant.ipGroupName})` : "NO"}</span>

      <span className="text-muted-foreground">4Ps:</span>
      <span>{applicant.is4PsBeneficiary ? `YES (${applicant.householdId4Ps})` : "NO"}</span>

      <span className="text-muted-foreground">Disability:</span>
      <span>{applicant.isLearnerWithDisability ? "YES" : "NO  "}</span>
    </CollapsibleSection>
  );
}
