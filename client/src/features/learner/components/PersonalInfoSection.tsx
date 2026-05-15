import { format } from "date-fns";
import { User, ImageOff, MapPin, Calendar, Fingerprint, Briefcase } from "lucide-react";
import type { LearnerProfile } from "../types";
import { useMemo } from "react";
import { cn } from "@/shared/lib/utils";

interface Props {
  learner: LearnerProfile;
  profileBadge?: {
    label: string;
    className: string;
  } | null;
}

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

export function PersonalInfoSection({ learner, profileBadge }: Props) {
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
    <div className="relative overflow-hidden bg-white">
      {/* Visual Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8" />
      
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 p-8 md:p-10 relative z-10">
        {/* Profile Photo - Hero Style */}
        <div className="relative group shrink-0">
          <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center shadow-xl ring-4 ring-white border-2 border-slate-100">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={fullName}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-300 p-6 text-center">
                <ImageOff className="h-12 w-12 opacity-20" />
                <span className="text-[10px] font-black uppercase leading-tight tracking-widest px-2">
                  Photo missing
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Identity Details - Condensed & Clean */}
        <div className="flex-1 space-y-6 text-center lg:text-left pt-2">
          <div className="space-y-1">
             <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
               <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                {fullName}
              </h1>
              {curriculumLabel && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-primary/10 text-primary uppercase w-fit mx-auto lg:mx-0">
                  {curriculumLabel}
                </span>
              )}
                {profileBadge && (
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase w-fit mx-auto lg:mx-0",
                      profileBadge.className,
                    )}>
                    {profileBadge.label}
                  </span>
                )}
             </div>
             <p className="text-sm font-bold text-muted-foreground flex items-center justify-center lg:justify-start gap-2">
               <Fingerprint className="h-4 w-4" />
               LRN: <span className="text-foreground">{learner.lrn}</span>
             </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            <HeroDetail 
              icon={User} 
              label="Grade & Section" 
              value={`${learner.gradeLevel?.name || "Grade —"} - ${learner.enrollment?.section?.name || "To Be Assigned"}`} 
              highlight 
            />
            
            {/* TLE SPECIALIZATION - Explicitly displayed as requested */}
            {(learner.enrollment?.tleProgramName || learner.pendingConfirmation?.tleProgramName) && (
               <HeroDetail 
                  icon={Briefcase} 
                  label="TLE Specialization" 
                  value={learner.enrollment?.tleProgramName || learner.pendingConfirmation?.tleProgramName || "N/A"} 
                  highlight 
               />
            )}

            <HeroDetail 
              icon={Calendar} 
              label="Date of Birth" 
              value={format(new Date(learner.birthDate), "MMMM d, yyyy")} 
            />
            
            <HeroDetail 
              icon={MapPin} 
              label="Current Address" 
              value={addressString} 
              noTruncate
              className="sm:col-span-2 lg:col-span-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroDetail({ 
  icon: Icon, 
  label, 
  value, 
  highlight, 
  noTruncate,
  className 
}: { 
  icon: React.ElementType, 
  label: string, 
  value: string, 
  highlight?: boolean,
  noTruncate?: boolean,
  className?: string 
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1.5">
          {label}
        </span>
        <span className={cn(
          "text-sm font-bold leading-tight",
          noTruncate ? "whitespace-normal break-words" : "truncate",
          highlight ? "text-primary" : "text-slate-700"
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}
