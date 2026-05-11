import { format } from "date-fns";
import { User, ImageOff } from "lucide-react";
import type { LearnerProfile } from "../types";
import { useMemo } from "react";

interface Props {
  learner: LearnerProfile;
}

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

export function PersonalInfoSection({ learner }: Props) {
  const fullName =
    `${learner.lastName}, ${learner.firstName} ${learner.middleName || ""}${learner.suffix ? ` ${learner.suffix}` : ""}`.trim();

  const photoUrl = useMemo(() => {
    if (!learner.studentPhoto) return null;
    if (learner.studentPhoto.startsWith("http") || learner.studentPhoto.startsWith("data:")) return learner.studentPhoto;
    return `${API_BASE}${learner.studentPhoto}`;
  }, [learner.studentPhoto]);

  const formatCurriculumAcronym = (type?: string | null) => {
    if (!type) return "";
    const normalized = type.toUpperCase();
    if (normalized.includes("SCIENCE_TECHNOLOGY_AND_ENGINEERING")) return "STE";
    if (normalized.includes("REGULAR")) return "BEC";
    if (normalized.includes("ART")) return "SPA";
    if (normalized.includes("SPORTS")) return "SPS";
    if (normalized.includes("FOREIGN_LANGUAGE")) return "SPFL";
    if (normalized.includes("JOURNALISM")) return "SPJ";
    return type;
  };

  const curriculumLabel = formatCurriculumAcronym(learner.curriculum || learner.enrollment?.curriculum);

  const demographicInfo = [
    { label: "Date of Birth", value: format(new Date(learner.birthDate), "MMMM d, yyyy") },
    { label: "Sex", value: learner.sex },
    { label: "Mother Tongue", value: learner.motherTongue || "N/A" },
    { label: "Nationality", value: learner.nationality || "Filipino" },
    { label: "Religion", value: learner.religion || "N/A" },
  ];

  const addr = learner.currentAddress;
  const addressString = addr
    ? [
        addr.houseNumber,
        addr.street,
        addr.barangay ? `Brgy. ${addr.barangay}` : null,
        addr.municipality,
        addr.province,
      ]
        .filter(Boolean)
        .join(", ")
    : "N/A";

  return (
    <div className="space-y-8">
      {/* Digital ID Header Section */}
      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        {/* Profile Photo */}
        <div className="relative group shrink-0">
          <div className="w-36 h-36 md:w-40 md:h-40 rounded-xl overflow-hidden bg-muted flex items-center justify-center shadow-sm border-2 border-dashed">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-foreground p-4 text-center">
                <ImageOff className="h-8 w-8 opacity-40" />
                <span className="text-xs font-bold uppercase leading-tight px-2">
                  Photo missing. Contact Registrar.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Identity Details */}
        <div className="flex-1 flex flex-col items-center md:items-start justify-center pt-2">
          <h1 className="text-2xl md:text-3xl font-black  text-foreground text-center md:text-left">
            {fullName}
          </h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 mt-1">
            <span className="text-sm font-bold text-foreground uppercase ">
              LRN: {learner.lrn}
            </span>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <span className="text-sm font-bold text-primary uppercase ">
              {learner.gradeLevel?.name || "Grade —"} - {learner.enrollment?.section?.name || "Unassigned"}
              {curriculumLabel && ` (${curriculumLabel})`}
            </span>
          </div>
        </div>
      </div>

      {/* Demographic Grid */}
      <div className="space-y-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase  text-primary">
            Demographic Information
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
          {demographicInfo.map((item) => (
            <div key={item.label} className="flex flex-col">
              <span className="text-xs font-bold text-foreground uppercase ">
                {item.label}
              </span>
              <span className="text-sm font-bold text-foreground mt-1.5">
                {item.value}
              </span>
            </div>
          ))}
          <div className="flex flex-col col-span-2 md:col-span-3">
            <span className="text-xs font-bold text-foreground uppercase ">
              Current Address
            </span>
            <span className="text-sm font-bold text-foreground mt-1.5 leading-relaxed">
              {addressString}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
