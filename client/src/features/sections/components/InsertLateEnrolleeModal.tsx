import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Search,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { sileo } from "sileo";

interface UnsectionedLearner {
  id: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  applicantType: string;
  learnerType: string;
}

interface InsertLateEnrolleeModalProps {
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

export function InsertLateEnrolleeModal({
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
}: InsertLateEnrolleeModalProps) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [pool, setPool] = useState<UnsectionedLearner[]>([]);
  const [selectedLearner, setSelectedLearner] =
    useState<UnsectionedLearner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPool = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sections/unsectioned-pool/${gradeLevelId}`, {
        params: { schoolYearId },
      });
      setPool(res.data.pool);
    } catch (err: unknown) {
      console.error("Pool fetch failed", err);
      sileo.error({
        title: "Load Error",
        description: "Could not retrieve the unsectioned learner pool.",
      });
    } finally {
      setLoading(false);
    }
  }, [gradeLevelId, schoolYearId]);

  useEffect(() => {
    if (open) {
      void fetchPool();
      setSelectedLearner(null);
      setSearch("");
    }
  }, [open, fetchPool]);

  const filteredPool = pool.filter((l) => {
    const fullName = `${l.lastName} ${l.firstName}`.toLowerCase();
    const lrn = (l.lrn || "").toLowerCase();
    const s = search.toLowerCase();
    return fullName.includes(s) || lrn.includes(s);
  });

  const handleSlotting = async () => {
    if (!selectedLearner) return;
    setIsSubmitting(true);
    try {
      await api.post(`/sections/${sectionId}/inline-slot`, {
        enrollmentApplicationId: selectedLearner.id,
      });

      sileo.success({
        title: "Learner Slotted",
        description: `${selectedLearner.lastName}, ${selectedLearner.firstName} has been added to ${sectionName}. SF1 and Grading systems updated.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response.data
              ?.message
          : "An unexpected error occurred during manual sectioning.";
      sileo.error({
        title: "Slotting Failed",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isScpSection = programType !== "REGULAR";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase ">
                Insert Late Enrollee
              </DialogTitle>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                Target: {gradeLevelName} - {sectionName}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 bg-background">
          {!selectedLearner ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search unsectioned learners by LRN or Last Name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 font-bold border-border shadow-sm focus:ring-primary/20"
                  autoFocus
                />
              </div>

              <div className="border border-border rounded-xl overflow-hidden shadow-sm max-h-[300px] overflow-y-auto bg-card">
                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
                      Scanning LIS Pool...
                    </p>
                  </div>
                ) : filteredPool.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-bold text-muted-foreground">
                      No unsectioned learners found
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1 max-w-[240px]">
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
                            <span className="font-black text-sm uppercase group-hover:text-primary transition-colors">
                              {learner.lastName}, {learner.firstName}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground ">
                              LRN: {learner.lrn || "PENDING"}
                            </span>
                          </div>
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
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      LRN: {selectedLearner.lrn || "PENDING LRN"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLearner(null)}
                  className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground">
                  Change
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                    Target Section
                  </p>
                  <p className="font-black text-sm uppercase">{sectionName}</p>
                  <p className="text-xs font-bold text-muted-foreground mt-0.5">
                    {gradeLevelName}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                    Section Status
                  </p>
                  <p className="font-black text-sm uppercase">
                    {enrolledCount} / {maxCapacity}
                  </p>
                  <p className="text-xs font-bold text-emerald-600 mt-0.5">
                    Available Slots: {maxCapacity - enrolledCount}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-black text-amber-900 uppercase">
                    Inline Slotting Protection
                  </p>
                  <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
                    This action will bypass the Batch Algorithm. The learner
                    will be added directly to the SF1 roster and synced to the
                    grading microservice.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between sm:justify-between">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            S.M.A.R.T. Integration Active
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="font-bold uppercase text-xs">
              Cancel
            </Button>
            <Button
              disabled={!selectedLearner || isSubmitting}
              onClick={handleSlotting}
              className="font-bold uppercase text-xs px-6">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm & Update SF1
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
