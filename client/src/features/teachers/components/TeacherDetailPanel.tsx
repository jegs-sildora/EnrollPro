import { memo, useMemo, useState, useEffect } from "react";
import {
  X,
  Mail,
  Smartphone,
  Briefcase,
  GraduationCap,
  Calendar,
  Fingerprint,
  Info,
  BadgeCheck,
  RefreshCw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/ui/sheet";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn, getAcademicDesignationColorClasses, getAncillaryRoleColorClasses } from "@/shared/lib/utils";
import type { Teacher } from "../types";
import { formatTeacherName } from "../utils";
import api from "@/shared/api/axiosInstance";

interface TeacherDetailPanelProps {
  teacher: Teacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TeacherDetailPanel = memo(function TeacherDetailPanel({
  teacher,
  open,
  onOpenChange,
}: TeacherDetailPanelProps) {
  // ATLAS-UX-001: Persist teacher data locally to allow for smooth exit animations
  const [displayTeacher, setDisplayTeacher] = useState<Teacher | null>(teacher);
  interface TeachingLoadItem {
    subjectName: string;
    subjectCode: string;
    sectionName: string;
    gradeLevel: string;
  }
  const [teachingLoad, setTeachingLoad] = useState<TeachingLoadItem[]>([]);
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (teacher) {
      setDisplayTeacher(teacher);
    }
  }, [teacher]);

  const activeTeacher = teacher || displayTeacher;

  // Fetch teaching load from ATLAS when teacher is viewed
  useEffect(() => {
    const fetchLoad = async () => {
      if (!teacher || !open) return;
      
      setLoadLoading(true);
      setLoadError(null);
      try {
        // Corrected endpoint path: /integration is mapped to integrationTriggerRoutes
        const res = await api.get(`/integration/atlas/faculty/${teacher.id}/teaching-load`);
        setTeachingLoad(res.data.data || []);
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        console.error("Failed to fetch teaching load", error);
        const status = error.response?.status;
        if (status === 404) {
          setLoadError("Integration Service Offline");
        } else if (status === 503) {
          setLoadError("ATLAS Connection Failed");
        } else {
          setLoadError("Sync Interrupted");
        }
      } finally {
        setLoadLoading(false);
      }
    };

    if (open && teacher) {
      fetchLoad();
    } else if (!open) {
      // Clear load when closing to avoid flickering on next open
      setTeachingLoad([]);
    }
  }, [teacher, open]);

  const accountStatus = useMemo(() => {
    if (!activeTeacher) return null;
    const ua = activeTeacher.userAccount;
    if (ua) {
      if (!ua.isActive) return { label: "Suspended", color: "text-rose-700 bg-rose-50 border-rose-200" };
      if (ua.mustChangePassword && !ua.lastLoginAt) return { label: "Provisioned", color: "text-amber-700 bg-amber-50 border-amber-200" };
      return { label: "SSO Active", color: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: "🌐" };
    }
    if (activeTeacher.isActive) return { label: "No Account", color: "text-rose-700 bg-rose-50 border-rose-200" };
    return { label: "No Account", color: "text-muted-foreground bg-muted border-muted-foreground/30" };
  }, [activeTeacher]);

  if (!activeTeacher) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl p-0 flex flex-col h-full border-l-0 overflow-hidden">
        <SheetHeader className="bg-primary px-6 py-6 space-y-1 relative shrink-0">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-white/10 flex items-center justify-center font-black text-white text-2xl uppercase border-2 border-white/20 shadow-xl">
              {activeTeacher.firstName.charAt(0)}{activeTeacher.lastName.charAt(0)}
            </div>
            <div className="space-y-0.5">
              <SheetTitle className="text-2xl font-black text-white uppercase leading-none">
                {formatTeacherName(activeTeacher)}
              </SheetTitle>
              <SheetDescription className="text-white/80 font-bold uppercase text-xs flex items-center gap-2">
                <Fingerprint className="size-3" />
                Employee ID: {activeTeacher.employeeId || "N/A"}
              </SheetDescription>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-muted/5">
          {/* Block 1: Current Status (Volatile) */}
          <div className="grid grid-cols-2 gap-px rounded-xl border bg-border overflow-hidden shadow-sm">
            <div className="p-4 bg-background space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Faculty Status</p>
              <div className="flex items-center gap-2">
                <div className={cn("size-2 rounded-full", activeTeacher.isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-slate-400")} />
                <span className="font-bold text-sm uppercase">{activeTeacher.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
            <div className="p-4 bg-background space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground">System Access</p>
              <Badge variant="outline" className={cn("text-[10px] font-black uppercase px-2 h-5 border whitespace-nowrap gap-1", accountStatus?.color)}>
                {accountStatus?.icon && <span>{accountStatus.icon}</span>}
                {accountStatus?.label}
              </Badge>
            </div>
          </div>

          {/* Block 2: Academic & HR Profile (Semi-Permanent) */}
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase text-primary flex items-center gap-2">
              <GraduationCap className="size-4" />
              Academic & HR Profile
            </h3>
            <div className="rounded-xl border bg-background overflow-hidden divide-y">
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Department</p>
                  <p className="font-bold text-sm uppercase text-primary">{activeTeacher.department || "Unassigned"}</p>
                </div>
                <div className="space-y-1 border-l pl-4">
                  <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Specialization</p>
                  <p className="font-bold text-sm uppercase">{activeTeacher.specialization || "Generalist"}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Block 3: Current SY Assignments (Highly Volatile) */}
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase text-primary flex items-center gap-2">
              <Briefcase className="size-4" />
              Current SY Assignments
            </h3>
            <div className="rounded-xl border bg-background overflow-hidden divide-y">
              {/* Primary Designation & Advisory */}
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Primary Designation</p>
                  <div className="pt-1">
                     {activeTeacher.designation?.isClassAdviser ? (
                        <Badge variant="outline" className={cn("text-xs font-black uppercase px-2 h-6 border-none", getAcademicDesignationColorClasses("CLASS ADVISER"))}>
                          Class Adviser
                        </Badge>
                      ) : (
                        <span className="text-sm font-bold uppercase text-slate-500">Subject Teacher</span>
                      )}
                  </div>
                </div>
                <div className="space-y-1 border-l pl-4">
                  <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Advisory Section</p>
                  {activeTeacher.designation?.advisorySection ? (
                    <div className="space-y-0.5">
                      <p className="font-black text-sm text-primary uppercase">{activeTeacher.designation.advisorySection.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{activeTeacher.designation.advisorySection.gradeLevelName}</p>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-400 italic pt-1">None assigned</p>
                  )}
                </div>
              </div>

              {/* Teaching Load (Dynamic data from ATLAS integration) */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Subject Teaching Load</p>
                  {loadLoading ? (
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-primary animate-pulse">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      SYNCING ATLAS...
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[9px] font-bold border-dashed border-primary/30 text-primary/60 bg-primary/5">
                      {loadError ? "SYNC FAILED" : "LIVE FROM ATLAS"}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  {loadLoading ? (
                    <div className="space-y-2">
                      <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
                      <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
                    </div>
                  ) : teachingLoad.length > 0 ? (
                    <div className="grid gap-2">
                      {teachingLoad.map((load, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black uppercase text-primary leading-none">{load.subjectName}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{load.subjectCode}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-xs uppercase text-foreground leading-none">{load.sectionName}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{load.gradeLevel}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg border-2 border-dashed bg-muted/30 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">
                        {loadError ? "ATLAS Service Unavailable" : "No Load Data Found"}
                      </p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 leading-tight max-w-[240px]">
                        {loadError 
                          ? "We couldn't connect to the ATLAS scheduling engine. Please verify connectivity in the Integration Hub." 
                          : "Detailed section-subject loading is managed via ATLAS. Ensure this faculty is assigned to sections in ATLAS."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Ancillary Roles */}
              {activeTeacher.designation?.ancillaryRoles && activeTeacher.designation.ancillaryRoles.length > 0 && (
                <div className="p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Ancillary Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {activeTeacher.designation.ancillaryRoles.map((role) => (
                      <Badge key={role} variant="outline" className={cn("text-[10px] font-bold uppercase px-2 h-5 border-none", getAncillaryRoleColorClasses(role))}>
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Block 4: Contact & Meta (Permanent) */}
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase text-primary flex items-center gap-2">
              <Info className="size-4" />
              Contact Information
            </h3>
            <div className="rounded-xl border bg-background divide-y">
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <Mail className="size-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Email</p>
                    <p className="font-bold text-xs truncate">{activeTeacher.email || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-l pl-4">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <Smartphone className="size-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[10px] font-black uppercase text-muted-foreground leading-none">Mobile</p>
                    <p className="font-bold text-xs">{activeTeacher.contactNumber || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* System Audit */}
          <div className="pt-4 flex items-center justify-center gap-6 text-[10px] font-bold uppercase text-muted-foreground/60">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3" />
              Created {new Date(activeTeacher.createdAt).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="size-3" />
              EnrollPro Verified Faculty
            </div>
          </div>
        </div>

        <div className="p-4 bg-background border-t flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1 font-bold uppercase" onClick={() => onOpenChange(false)}>
            Close View
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
});
