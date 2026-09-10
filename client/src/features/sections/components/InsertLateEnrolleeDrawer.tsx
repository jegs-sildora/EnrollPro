import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="p-0 overflow-hidden border-none shadow-2xl flex flex-col h-full bg-background w-full sm:w-[600px] lg:w-[800px] max-w-none"
      >
        {/* Header — exactly matches StudentDetailPanel */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0 bg-primary font-bold relative">
          <div>
            <SheetTitle className="text-base sm:text-lg text-primary-foreground font-bold uppercase flex items-center gap-2">
              Insert Late Enrollee
            </SheetTitle>
            <SheetDescription className="text-sm text-primary-foreground/80 font-semibold uppercase">
              {gradeLevelName} — {sectionName}
            </SheetDescription>
          </div>
        </div>

        {/* Scrollable Content — matches StudentDetailPanel content area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 font-bold">
          {!selectedLearner ? (
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  placeholder="Search unsectioned learners by LRN or Last Name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 font-bold border-border shadow-sm focus:ring-primary/20 uppercase"
                  autoFocus
                />
              </div>

              {/* Learner Pool List */}
              <div className="bg-[hsl(var(--muted))] rounded-md border overflow-hidden">
                <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
                  {loading ? (
                    <div className="space-y-0 divide-y divide-border/50">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between gap-4 p-4">
                          <div className="space-y-2">
                            <Skeleton className="h-5 w-56" />
                            <Skeleton className="h-4 w-36" />
                          </div>
                          <Skeleton className="h-6 w-28 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : isSearching ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-3 text-center px-6">
                      <Search className="h-10 w-10 animate-pulse text-foreground/40" />
                      <div className="space-y-1">
                        <p className="text-lg font-bold text-foreground">
                          Searching...
                        </p>
                        <p className="text-base leading-tight font-bold text-foreground/60">
                          Scanning unsectioned records...
                        </p>
                      </div>
                    </div>
                  ) : filteredPool.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                      <AlertCircle className="h-8 w-8 text-foreground/30 mb-2" />
                      <p className="text-base leading-tight font-bold text-foreground">
                        No unsectioned learners found
                      </p>
                      <p className="text-base text-foreground/60 mt-1 max-w-[240px] font-semibold">
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
                                : "hover:bg-primary/5 cursor-pointer",
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="font-bold text-base leading-tight uppercase group-hover:text-primary transition-colors">
                                {learner.lastName}, {learner.firstName}
                              </span>
                              <span className="text-base font-bold text-foreground/70">
                                LRN: {learner.lrn || "PENDING"}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {learner.promotionGenAve != null ? (
                                <span className="text-sm font-bold uppercase text-foreground/70">
                                  GEN AVE: {learner.promotionGenAve.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-sm font-bold uppercase text-foreground/40">
                                  GEN AVE: —
                                </span>
                              )}
                              <div className="flex items-center gap-2">
                                {isTypeMismatch ? (
                                  <Badge
                                    variant="outline"
                                    className="text-sm font-bold uppercase border-red-200 text-red-600 bg-red-50"
                                  >
                                    Program Mismatch
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-sm font-bold uppercase"
                                  >
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
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected Learner Card — matches StudentDetailPanel summary block style */}
              <div className="bg-[hsl(var(--muted))] p-4 rounded-md border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground border-2 border-primary/20 shrink-0">
                      <span className="text-lg font-bold uppercase">
                        {selectedLearner.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-base uppercase leading-tight">
                        {selectedLearner.lastName}, {selectedLearner.firstName}
                      </h3>
                      <p className="text-sm font-bold text-foreground/70 uppercase mt-0.5">
                        LRN: {selectedLearner.lrn || "PENDING LRN"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLearner(null)}
                    className="text-sm font-bold uppercase text-foreground hover:text-foreground hover:bg-muted"
                  >
                    Change
                  </Button>
                </div>
              </div>

              {/* Section Info — matches StudentDetailPanel info rows */}
              <div className="bg-[hsl(var(--muted))] rounded-md border divide-y divide-border">
                <div className="grid grid-cols-[30%_70%]">
                  <div className="bg-muted text-foreground font-bold text-sm uppercase px-4 py-3 border-r border-border flex items-center">
                    Target Section
                  </div>
                  <div className="bg-card text-sm font-bold text-foreground px-4 py-3 flex flex-col">
                    <span className="uppercase">{sectionName}</span>
                    <span className="text-foreground/70 font-semibold">{gradeLevelName}</span>
                  </div>
                </div>
                <div className="grid grid-cols-[30%_70%]">
                  <div className="bg-muted text-foreground font-bold text-sm uppercase px-4 py-3 border-r border-border flex items-center">
                    Capacity
                  </div>
                  <div className="bg-card text-sm font-bold text-foreground px-4 py-3 flex flex-col">
                    <span>{enrolledCount} / {maxCapacity} enrolled</span>
                    <span className="text-emerald-600 font-semibold">
                      {maxCapacity - enrolledCount} available slot{maxCapacity - enrolledCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-[30%_70%]">
                  <div className="bg-muted text-foreground font-bold text-sm uppercase px-4 py-3 border-r border-border flex items-center">
                    Enroll Date
                  </div>
                  <div className="bg-card px-4 py-3">
                    <input
                      type="date"
                      value={officialEnrollmentDate}
                      max={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => setOfficialEnrollmentDate(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm leading-tight font-bold shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <p className="text-xs text-amber-700 font-bold mt-1">
                      Used for SF10 dateSectioned. Backdating allowed for DepEd compliance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {isAttendanceAtRisk && (
                <div className="flex items-start gap-3 p-4 rounded-md bg-red-50 border border-red-200">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-red-900 uppercase">
                      Attendance Risk
                    </p>
                    <p className="text-sm leading-relaxed text-red-800 font-semibold">
                      {elapsedSchoolDays} school days have already passed.
                      Learner may struggle to meet the 80% DepEd attendance
                      requirement. Ensure catch-up interventions are planned.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-4 rounded-md bg-amber-50 border border-amber-200">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-amber-900 uppercase">
                    Inline Slotting Protection
                  </p>
                  <p className="text-sm leading-relaxed text-amber-800 font-semibold">
                    This action will bypass the Batch Algorithm. The learner
                    will be added directly to the SF1 masterlist and synced to the
                    grading microservice.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — matches StudentDetailPanel footer style */}
        <div className="px-4 py-4 bg-muted/30 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={closeDrawer}
            className="font-bold uppercase text-sm h-10 px-4"
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedLearner || isSubmitting}
            onClick={handleSlotting}
            className="font-bold uppercase text-sm h-10 px-6 bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirm & Update SF1
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
