import React from "react";
import { useState } from "react";
import { format, differenceInYears } from "date-fns";
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
        className="flex items-center justify-between w-full p-3 font-bold text-sm cursor-pointer hover:bg-[hsl(var(--muted)/50)] transition-colors">
        <span>
          {isOpen ? "▾" : "▸"} {title}
        </span>
        <span
          className={`text-xs text-muted-foreground ${isOpen ? "opacity-60" : ""}`}>
          {isOpen ? "Expanded" : "Expand"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}>
            <div className="p-4 pt-4 text-sm border-t grid grid-cols-[140px_1fr] gap-x-2 gap-y-1.5 font-bold">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const isValid = (value: any) => {
  if (value === null || value === undefined || value === "") return false;
  const s = String(value).toUpperCase();
  return (
    s !== "N/A" &&
    s !== "INFORMATION NOT AVAILABLE" &&
    s !== "NONE" &&
    s !== "NULL"
  );
};

function DataItem({ label, value }: { label: string; value: any }) {
  if (!isValid(value)) return null;
  return (
    <>
      <span className="text-muted-foreground">{label}:</span>
      <span>{value}</span>
    </>
  );
}

export function PersonalInfo({ applicant }: { applicant: ApplicantDetail }) {
  const formattedBirthDate = applicant.birthDate
    ? format(new Date(applicant.birthDate), "MMMM d, yyyy")
    : null;

  const age = applicant.birthDate
    ? differenceInYears(new Date(), new Date(applicant.birthDate))
    : null;

  const fullName =
    `${applicant.lastName}, ${applicant.firstName} ${applicant.middleName || ""} ${applicant.suffix || ""}`.trim();

  // Visibility check
  if (
    !isValid(fullName) &&
    !isValid(formattedBirthDate) &&
    !isValid(age) &&
    !isValid(applicant.sex) &&
    !isValid(applicant.placeOfBirth) &&
    !isValid(applicant.religion) &&
    !isValid(applicant.motherTongue)
  ) {
    return null;
  }

  return (
    <CollapsibleSection title="Personal Information">
      <DataItem label="Full Name" value={fullName} />
      <DataItem label="Date of Birth" value={formattedBirthDate} />
      <DataItem label="Age" value={age} />
      <DataItem label="Sex at Birth" value={applicant.sex?.toUpperCase()} />
      <DataItem label="Place of Birth" value={applicant.placeOfBirth} />
      <DataItem label="Religion" value={applicant.religion} />
      <DataItem label="Mother Tongue" value={applicant.motherTongue} />
    </CollapsibleSection>
  );
}

export function AddressInfo({ applicant }: { applicant: ApplicantDetail }) {
  const addr = applicant.currentAddress || (applicant as any).address;

  const houseNoStreet =
    addr?.houseNo || addr?.street || (applicant as any).houseNoStreet;
  const sitio = addr?.sitio || (applicant as any).sitio;
  const barangay = addr?.barangay || (applicant as any).barangay;
  const cityMunicipality =
    addr?.cityMunicipality || (applicant as any).cityMunicipality;
  const province = addr?.province || (applicant as any).province;

  // Visibility check
  if (
    !isValid(houseNoStreet) &&
    !isValid(sitio) &&
    !isValid(barangay) &&
    !isValid(cityMunicipality) &&
    !isValid(province)
  ) {
    return null;
  }

  return (
    <CollapsibleSection title="Home Address">
      <DataItem label="House No/Street" value={houseNoStreet} />
      <DataItem label="Sitio/Purok" value={sitio} />
      <DataItem label="Barangay" value={barangay} />
      <DataItem label="City/Municipality" value={cityMunicipality} />
      <DataItem label="Province" value={province} />
    </CollapsibleSection>
  );
}

export function GuardianContact({ applicant }: { applicant: ApplicantDetail }) {
  const { fatherName, motherName, guardianInfo, primaryContact } =
    applicant as any;

  const getContactInfo = (label: string, info: any, isPrimary: boolean) => {
    if (!info) return null;
    const firstName = info.firstName;
    const lastName = info.lastName || info.maidenName;

    if (!isValid(firstName) || !isValid(lastName)) return null;

    const fullName = info.maidenName
      ? `${firstName} ${info.maidenName}`
      : `${firstName} ${info.lastName}`;

    return {
      label,
      fullName,
      isPrimary,
      details: [info.contactNumber, info.email]
        .filter((v) => isValid(v))
        .join(" | "),
      relationship:
        info.relationship && info.relationship !== label.toUpperCase()
          ? info.relationship
          : null,
    };
  };

  const mother = getContactInfo("Mother", motherName, primaryContact === "MOTHER");
  const father = getContactInfo("Father", fatherName, primaryContact === "FATHER");
  const guardian = getContactInfo("Guardian", guardianInfo, primaryContact === "GUARDIAN");

  // Visibility check
  if (!mother && !father && !guardian && !isValid(applicant.emailAddress)) {
    return null;
  }

  const renderContact = (c: any) => {
    if (!c) return null;
    return (
      <React.Fragment key={c.label}>
        <span className="text-muted-foreground flex items-center gap-1.5">
          {c.label}:
          {c.isPrimary && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded leading-none">
              PRIMARY
            </span>
          )}
        </span>
        <div className="flex flex-col">
          <span className="uppercase">{c.fullName}</span>
          <span className="text-xs text-muted-foreground font-medium">
            {c.details || "No contact info"}
            {c.relationship && ` (${c.relationship})`}
          </span>
        </div>
      </React.Fragment>
    );
  };

  return (
    <CollapsibleSection title="Parents & Guardian">
      {renderContact(mother)}
      {renderContact(father)}
      {renderContact(guardian)}
      <DataItem label="Primary Email" value={applicant.emailAddress} />
    </CollapsibleSection>
  );
}

export function PreviousSchool({ applicant }: { applicant: ApplicantDetail }) {
  // Visibility check
  if (
    !isValid(applicant.lastSchoolName) &&
    !isValid(applicant.lastSchoolId) &&
    !isValid(applicant.lastGradeCompleted) &&
    !isValid(applicant.schoolYearLastAttended) &&
    !isValid(applicant.lastSchoolAddress) &&
    !isValid(applicant.lastSchoolType)
  ) {
    return null;
  }

  return (
    <CollapsibleSection title="Previous School">
      <DataItem label="School Name" value={applicant.lastSchoolName} />
      <DataItem label="School ID" value={applicant.lastSchoolId} />
      <DataItem label="Grade Completed" value={applicant.lastGradeCompleted} />
      <DataItem
        label="Year Attended"
        value={applicant.schoolYearLastAttended}
      />
      <DataItem label="School Address" value={applicant.lastSchoolAddress} />
      <DataItem label="School Type" value={applicant.lastSchoolType} />
    </CollapsibleSection>
  );
}

export function Classifications({ applicant }: { applicant: ApplicantDetail }) {
  const learnerType = applicant.learnerType?.replace("_", " ");
  const ipInfo = applicant.isIpCommunity
    ? `YES (${applicant.ipGroupName || "No Group"})`
    : null;
  const p4sInfo = applicant.is4PsBeneficiary
    ? `YES (${applicant.householdId4Ps || "No ID"})`
    : null;
  const disability = applicant.isLearnerWithDisability ? "YES" : null;
  const balikAral = applicant.isBalikAral
    ? `YES (Last: ${applicant.lastYearEnrolled})`
    : null;

  // Visibility check
  if (
    !isValid(learnerType) &&
    !isValid(ipInfo) &&
    !isValid(p4sInfo) &&
    !isValid(disability) &&
    !isValid(balikAral)
  ) {
    return null;
  }

  return (
    <CollapsibleSection title="Classifications">
      <DataItem label="Learner Type" value={learnerType} />
      <DataItem label="IP Community" value={ipInfo} />
      <DataItem label="4Ps Beneficiary" value={p4sInfo} />

      {disability && (
        <>
          <span className="text-muted-foreground">Disability:</span>
          <div className="flex flex-col">
            <span>YES</span>
            {applicant.disabilityTypes?.length > 0 && (
              <span className="text-xs text-muted-foreground font-medium">
                Types: {applicant.disabilityTypes.join(", ")}
              </span>
            )}
          </div>
        </>
      )}

      <DataItem label="Balik-Aral" value={balikAral} />
    </CollapsibleSection>
  );
}
