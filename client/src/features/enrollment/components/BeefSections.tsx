import React from "react";
import { useState } from "react";
import { format, differenceInYears } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import type { ApplicantDetail } from "@/features/enrollment/hooks/useApplicationDetail";

import {
  User,
  MapPin,
  Users,
  GraduationCap,
  Tags,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { Badge } from "@/shared/ui/badge";

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border rounded-md mb-4 bg-[hsl(var(--card))] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3 font-bold text-sm cursor-pointer hover:bg-[hsl(var(--muted)/50)] transition-colors text-left group">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground group-hover:text-primary transition-colors">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
          {icon && <span className="text-primary">{icon}</span>}
          <span>{title}</span>
        </div>
        <span
          className={`text-[10px] uppercase tracking-widest text-muted-foreground ${isOpen ? "opacity-60" : ""}`}>
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}>
            <div className="p-4 pt-4 text-sm border-t grid grid-cols-[140px_1fr] gap-x-2 gap-y-2 font-bold">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const isValid = (value: unknown) => {
  if (value === null || value === undefined || value === "") return false;
  const s = String(value).toUpperCase();
  return (
    s !== "N/A" &&
    s !== "INFORMATION NOT AVAILABLE" &&
    s !== "NONE" &&
    s !== "NULL"
  );
};

function DataItem({
  label,
  value,
  mutedIfInvalid = false,
}: {
  label: string;
  value: unknown;
  mutedIfInvalid?: boolean;
}) {
  const valid = isValid(value);
  if (!valid && !mutedIfInvalid) return null;

  return (
    <>
      <span className="text-muted-foreground">{label}:</span>
      <span
        className={
          !valid ? "text-muted-foreground/50 italic font-medium" : "uppercase"
        }>
        {valid ? String(value) : "Not provided"}
      </span>
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
    <CollapsibleSection
      title="Personal Information"
      icon={<User className="h-4 w-4" />}>
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
  const addr = applicant.currentAddress || (applicant as unknown as { address: unknown }).address;

  const addrObj = (addr as unknown) as Record<string, unknown> | null;
  const applicantObj = applicant as unknown as Record<string, unknown>;

  const houseNoStreet =
    addrObj?.houseNo || addrObj?.street || applicantObj?.houseNoStreet;
  const sitio = addrObj?.sitio || applicantObj?.sitio;
  const barangay = addrObj?.barangay || applicantObj?.barangay;
  const cityMunicipality =
    addrObj?.cityMunicipality || applicantObj?.cityMunicipality;
  const province = addrObj?.province || applicantObj?.province;

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
    <CollapsibleSection
      title="Home Address"
      icon={<MapPin className="h-4 w-4" />}>
      <DataItem label="House No/Street" value={houseNoStreet} />
      <DataItem label="Sitio/Purok" value={sitio} />
      <DataItem label="Barangay" value={barangay} />
      <DataItem label="City/Municipality" value={cityMunicipality} />
      <DataItem label="Province" value={province} />
    </CollapsibleSection>
  );
}

export function GuardianContact({ applicant }: { applicant: ApplicantDetail }) {
  const applicantObj = applicant as unknown as { 
    fatherName?: Record<string, unknown>; 
    motherName?: Record<string, unknown>; 
    guardianInfo?: Record<string, unknown>; 
    primaryContact?: string;
  };
  const { fatherName, motherName, guardianInfo, primaryContact } = applicantObj;

  const getContactInfo = (label: string, info: Record<string, unknown> | undefined, isPrimary: boolean) => {
    const firstName = info?.firstName as string | undefined;
    const lastName = (info?.lastName || info?.maidenName) as string | undefined;

    const validName = isValid(firstName) || isValid(lastName);

    const fullName = !validName
      ? null
      : info?.maidenName
        ? `${firstName || ""} ${info.maidenName}`.trim()
        : `${firstName || ""} ${info?.lastName || ""}`.trim();

    return {
      label,
      fullName,
      isPrimary,
      details: [info?.contactNumber, info?.email]
        .filter((v) => isValid(v))
        .join(" | "),
      relationship:
        info?.relationship && info.relationship !== label.toUpperCase()
          ? (info.relationship as string)
          : null,
    };
  };

  const mother = getContactInfo(
    "Mother",
    motherName,
    primaryContact === "MOTHER",
  );
  const father = getContactInfo(
    "Father",
    fatherName,
    primaryContact === "FATHER",
  );
  const guardian = getContactInfo(
    "Guardian",
    guardianInfo,
    primaryContact === "GUARDIAN",
  );

  const renderContact = (c: { label: string; fullName: string | null; isPrimary: boolean; details: string; relationship: string | null }) => {
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
          {c.fullName ? (
            <span className="uppercase">{c.fullName}</span>
          ) : (
            <span className="text-muted-foreground/50 italic font-medium">
              Not provided
            </span>
          )}
          <span
            className={`text-xs font-medium ${c.details ? "text-muted-foreground" : "text-muted-foreground/50 italic"}`}>
            {c.details || "No contact info"}
            {c.relationship && ` (${c.relationship})`}
          </span>
        </div>
      </React.Fragment>
    );
  };

  return (
    <CollapsibleSection
      title="Parents & Guardian (SF1)"
      icon={<Users className="h-4 w-4" />}>
      {renderContact(mother)}
      {renderContact(father)}
      {renderContact(guardian)}
      <DataItem
        label="Primary Email"
        value={applicant.emailAddress}
        mutedIfInvalid
      />
    </CollapsibleSection>
  );
}

export function PreviousSchool({ applicant }: { applicant: ApplicantDetail }) {
  const formattedAve = isValid(applicant.generalAverage)
    ? Number(applicant.generalAverage).toFixed(2)
    : null;

  const readingProfile = (applicant as unknown as { readingProfileLevel?: string }).readingProfileLevel?.replace(
    "_",
    " ",
  );

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
    <CollapsibleSection
      title="Previous School"
      icon={<GraduationCap className="h-4 w-4" />}>
      <DataItem label="School Name" value={applicant.lastSchoolName} />
      <DataItem label="School ID" value={applicant.lastSchoolId} />
      <DataItem label="Grade Completed" value={applicant.lastGradeCompleted} />
      <DataItem
        label="Year Attended"
        value={applicant.schoolYearLastAttended}
      />
      <DataItem label="School Address" value={applicant.lastSchoolAddress} />
      <DataItem label="School Type" value={applicant.lastSchoolType} />
      <DataItem label="General Average" value={formattedAve} />
      <DataItem label="Reading Profile" value={readingProfile} />
    </CollapsibleSection>
  );
}

export function Classifications({ applicant }: { applicant: ApplicantDetail }) {
  const learnerType = applicant.learnerType?.replace("_", " ");
  const isIp = Boolean(applicant.isIpCommunity);
  const is4Ps = Boolean(applicant.is4PsBeneficiary);
  const isPwd = Boolean(applicant.isLearnerWithDisability);
  const isBalikAral = Boolean(applicant.isBalikAral);

  return (
    <CollapsibleSection
      title="Classifications"
      icon={<Tags className="h-4 w-4" />}>
      <DataItem label="Learner Type" value={learnerType} />

      <span className="text-muted-foreground">IP Community:</span>
      <div>
        {isIp ? (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
            ✓ IP Member ({applicant.ipGroupName || "No Group"})
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-muted-foreground/50 border-muted">
            ✕ Not an IP Member
          </Badge>
        )}
      </div>

      <span className="text-muted-foreground">4Ps Beneficiary:</span>
      <div>
        {is4Ps ? (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
            ✓ 4Ps Beneficiary ({applicant.householdId4Ps || "No ID"})
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-muted-foreground/50 border-muted">
            ✕ Not a 4Ps Beneficiary
          </Badge>
        )}
      </div>

      <span className="text-muted-foreground">Disability:</span>
      <div>
        {isPwd ? (
          <div className="space-y-2">
            <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200">
              ✓ Has Disability
            </Badge>
            {applicant.disabilityTypes?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {applicant.disabilityTypes.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="border-rose-200 text-rose-700 h-5 px-1.5 text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Badge
            variant="outline"
            className="text-muted-foreground/50 border-muted">
            ✕ No Disability
          </Badge>
        )}
      </div>

      <span className="text-muted-foreground">Balik-Aral:</span>
      <div>
        {isBalikAral ? (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
            ✓ Returning (Last: {applicant.lastYearEnrolled})
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-muted-foreground/50 border-muted">
            ✕ No
          </Badge>
        )}
      </div>
    </CollapsibleSection>
  );
}
