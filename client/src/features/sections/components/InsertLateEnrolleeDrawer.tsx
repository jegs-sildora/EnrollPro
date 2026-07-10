import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Search,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";
import { sileo } from "sileo";
import { useSettingsStore } from "@/store/settings.slice";
import { differenceInBusinessDays, format } from "date-fns";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { isAxiosError } from "axios";

interface UnsectionedLearner {
  id: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  applicantType: string;
  learnerType: string;
  promotionGenAve: number | null;
}

interface UnsectionedPoolResponse {
  pool?: UnsectionedLearner[];
  learners?: UnsectionedLearner[];
}

interface InlineSlotErrorResponse {
  message?: string;
  sectionName?: string;
}

interface InsertLateEnrolleeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: number;
  sectionName: string;
  gradeLevelId: number;
  gradeLevelName: string;
  maxCapacity: number;
  enrolledCount: number;
  programType: string;
  schoolYearId: number;
  onSuccess: () => void;
}

export default function InsertLateEnrolleeDrawer({
  open,
  onOpenChange,
  sectionId,
  sectionName,
  gradeLevelId,
  gradeLevelName,
  maxCapacity,
  enrolledCount,
  programType,
  schoolYearId,
  onSuccess,
}: InsertLateEnrolleeDrawerProps) {
  const { classOpeningDate } = useSettingsStore();
  const {
    inputValue: search,
    setInputValue: setSearch,
    activeFilter: activeSearch,
    isSearching,
    clearSearch,
  } = useDebouncedSearch();
  const [loading, setLoading] = useState(false);
  const [pool, setPool] = useState<UnsectionedLearner[]>([]);
  const [selectedLearner, setSelectedLearner] =
    useState<UnsectionedLearner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [officialEnrollmentDate, setOfficialEnrollmentDate] = useState(
    () => format(new Date(), "yyyy-MM-dd"),
  );

  const elapsedSchoolDays = useMemo(() => {
    if (!classOpeningDate) return 0;
    const start = new Date(classOpeningDate);
    const today = new Date();
    if (today <= start) return 0;
    return differenceInBusinessDays(today, start);
  }, [classOpeningDate]);

  const isAttendanceAtRisk = elapsedSchoolDays > 20;

  const fetchPool = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<UnsectionedPoolResponse>(
        `/sections/unsectioned-pool/${gradeLevelId}`,
        {
          params: { schoolYearId },
        },
      );
      setPool(res.data.pool ?? res.data.learners ?? []);
    } catch (err: unknown) {
      console.error("Pool fetch failed", err);
      const message = isAxiosError<InlineSlotErrorResponse>(err)
        ? err.response?.data?.message ?? "Could not retrieve the unsectioned learner pool."
        : "Could not retrieve the unsectioned learner pool.";
      sileo.error({
        title: "Load Error",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [gradeLevelId, schoolYearId]);

  useEffect(() => {
    if (open) {
      void fetchPool();
      setSelectedLearner(null);
      clearSearch();
      setOfficialEnrollmentDate(format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, fetchPool, clearSearch]);

  const filteredPool = pool.filter((l) => {
    const fullName = `${l.lastName} ${l.firstName}`.toLowerCase();
    const lrn = (l.lrn || "").toLowerCase();
    const s = activeSearch.toLowerCase();
    return fullName.includes(s) || lrn.includes(s);
  });

  const handleSlotting = async () => {
    if (!selectedLearner) return;
    setIsSubmitting(true);
    try {
      await api.post(`/sections/${sectionId}/inline-slot`, {
        enrollmentApplicationId: selectedLearner.id,
        officialEnrollmentDate,
      });

      sileo.success({
        title: "Learner Slotted",
        description: `${selectedLearner.lastName}, ${selectedLearner.firstName} has been added to ${sectionName}. SF1 and Grading systems updated.`,
      });

      onSuccess();
      closeDrawer();
    } catch (err: unknown) {
      const status = isAxiosError<InlineSlotErrorResponse>(err)
        ? err.response?.status
        : undefined;
      const message = isAxiosError<InlineSlotErrorResponse>(err)
        ? err.response?.data?.message ?? "An unexpected error occurred during manual sectioning."
        : "An unexpected error occurred during manual sectioning.";
      if (status === 409) {
        sileo.error({
          title: "Section at Capacity",
          description: `${message} — Use the capacity override option if administratively approved.`,
        });
      } else {
        sileo.error({ title: "Slotting Failed", description: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isScpSection = programType !== "REGULAR";
  const closeDrawer = () => {
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
      <SheetContent
        showClose={false}
        className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl flex flex-col h-full bg-background">
        <SheetHeader className="px-6 py-4 bg-primary shrink-0 border-b border-primary/20 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-foreground/10 rounded-lg text-primary-foreground border border-primary-foreground/20">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-lg font-black uppercase text-primary-foreground">
                Insert Late Enrollee
              </SheetTitle>
              <SheetDescription className="text-base text-primary-foreground uppercase font-extrabold mt-0.5">
                {gradeLevelName} — {sectionName}
              </SheetDescription>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={closeDrawer}
            className="size-9 shrink-0 rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            aria-label="Close insert late enrollee panel">
            <X className="size-4" />
          </Button>
        </SheetHeader>

        <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-background">
          {!selectedLearner ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  placeholder="Search unsectioned learners by LRN or Last Name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 font-extrabold border-border shadow-sm focus:ring-primary/20"
                  autoFocus
                />
              </div>

              <div className="border border-border rounded-xl overflow-hidden shadow-sm max-h-[300px] overflow-y-auto bg-card">
                {loading ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-56" />
                          <Skeleton className="h-4 w-36" />
                        </div>
                        <Skeleton className="h-9 w-28 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : isSearching ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-center px-6">
                    <Search className="h-10 w-10 animate-pulse text-slate-400" />
                    <div className="space-y-1">
                      <p className="text-lg font-extrabold text-slate-500">
                        Searching...
                      </p>
                      <p className="text-base leading-tight font-extrabold text-slate-400">
                        Scanning unsectioned records...
                      </p>
                    </div>
                  </div>
                ) : filteredPool.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                    <AlertCircle className="h-8 w-8 text-foreground/30 mb-2" />
                    <p className="text-base leading-tight font-extrabold text-foreground">
                      No unsectioned learners found
                    </p>
                    <p className="text-base text-foreground/60 mt-1 max-w-[240px]">
                      Ensure learners have passed verification and are marked
                      "Ready for Sectioning".
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filteredPool.map((learner) => {
                      const isTypeMismatch =
                        isScpSection && learner.applicantType !== programType;

                      return (
                        <button
                          key={learner.id}
                          disabled={isTypeMismatch}
                          onClick={() => setSelectedLearner(learner)}
                          className={cn(
                            "w-full px-4 py-3 flex items-center justify-between transition-colors text-left group",
                            isTypeMismatch
                              ? "opacity-50 grayscale cursor-not-allowed bg-muted/10"
                              : "hover:bg-muted/50 cursor-pointer",
                          )}>
                          <div className="flex flex-col">
                            <span className="font-black text-base leading-tight uppercase group-hover:text-primary transition-colors">
                              {learner.lastName}, {learner.firstName}
                            </span>
                            <span className="text-base font-extrabold text-foreground ">
                              LRN: {learner.lrn || "PENDING"}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {learner.promotionGenAve != null ? (
                              <span className="text-[10px] font-black uppercase text-foreground/70">
                                GEN AVE: {learner.promotionGenAve.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold uppercase text-foreground/40">
                                GEN AVE: —
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              {isTypeMismatch ? (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] font-black uppercase border-red-200 text-red-600 bg-red-50">
                                  Program Mismatch
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] font-black uppercase">
                                  {learner.applicantType?.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-6 border-2 border-primary/20 rounded-2xl bg-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20">
                    <span className="text-lg font-black uppercase">
                      {selectedLearner.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase leading-none">
                      {selectedLearner.lastName}, {selectedLearner.firstName}
                    </h3>
                    <p className="text-base font-extrabold text-foreground uppercase  mt-1">
                      LRN: {selectedLearner.lrn || "PENDING LRN"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLearner(null)}
                  className="text-base font-extrabold uppercase text-foreground hover:text-foreground">
                  Change
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <p className="text-base font-black text-foreground uppercase  mb-1">
                    Target Section
                  </p>
                  <p className="font-black text-base leading-tight uppercase">{sectionName}</p>
                  <p className="text-base font-extrabold text-foreground mt-0.5">
                    {gradeLevelName}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <p className="text-base font-black text-foreground uppercase  mb-1">
                    Section Status
                  </p>
                  <p className="font-black text-base leading-tight uppercase">
                    {enrolledCount} / {maxCapacity}
                  </p>
                  <p className="text-base font-extrabold text-emerald-600 mt-0.5">
                    Available Slots: {maxCapacity - enrolledCount}
                  </p>
                </div>
              </div>

              {isAttendanceAtRisk && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-base font-black text-red-900 uppercase">
                      Attendance Risk
                    </p>
                    <p className="text-[11px] leading-relaxed text-red-800 font-extrabold">
                      {elapsedSchoolDays} school days have already passed.
                      Learner may struggle to meet the 80% DepEd attendance
                      requirement. Ensure catch-up interventions are planned.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-base font-black text-amber-900 uppercase">
                    Inline Slotting Protection
                  </p>
                  <p className="text-[11px] leading-relaxed text-amber-800 font-extrabold">
                    This action will bypass the Batch Algorithm. The learner
                    will be added directly to the SF1 masterlist and synced to the
                    grading microservice.
                  </p>
                </div>
              </div>

              {/* Official Enrollment Date — required for SF10/dateSectioned */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-foreground">
                  Official Enrollment Date *
                </label>
                <input
                  type="date"
                  value={officialEnrollmentDate}
                  max={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setOfficialEnrollmentDate(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base leading-tight font-extrabold shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-[10px] text-amber-700 font-extrabold">
                  Used for SF10 dateSectioned. Backdating allowed for DepEd compliance.
                </p>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={closeDrawer}
            className="font-extrabold uppercase text-sm h-10 px-4">
            Cancel
          </Button>
          <Button
            disabled={!selectedLearner || isSubmitting}
            onClick={handleSlotting}
            className="font-extrabold uppercase text-sm h-10 px-6 bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4  mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirm & Update SF1
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
