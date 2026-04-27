import { useState, useEffect, useRef } from "react";
import { Search, CheckCircle2, UserCheck, Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import api from "@/shared/api/axiosInstance";
import axios from "axios";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";

interface LearnerLookup {
  id: number;
  lrn: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  previousGradeLevel: string;
  previousSection: string;
  previousGenAve: number | null;
  promotionStatus: string | null;
}

interface ConfirmationSlipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  activeSchoolYearId: number | null;
}

export function ConfirmationSlipModal({
  open,
  onOpenChange,
  onSuccess,
  activeSchoolYearId,
}: ConfirmationSlipModalProps) {
  const [lrn, setLrn] = useState("");
  const [loading, setLoading] = useState(false);
  const [learner, setLearner] = useState<LearnerLookup | null>(null);
  const [confirming, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLrn("");
      setLearner(null);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (lrn.length === 12) {
      void handleLookup(lrn);
    } else {
      setLearner(null);
      setError(null);
    }
  }, [lrn]);

  const handleLookup = async (lookupLrn: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/learner/lookup?lrn=${lookupLrn}`);
      setLearner(res.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError("Learner not found. Please verify the LRN.");
      } else {
        toastApiError(err as any);
      }
      setLearner(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!learner || !activeSchoolYearId) return;

    setSaving(true);
    try {
      // Determine target grade level based on previous
      // For HNHS, we assume promotion to next level. 
      // In a real system, we'd fetch GradeLevelId for (previous + 1)
      
      // For Phase 1 demo, we'll fetch all grade levels for active SY and find the next one
      const glRes = await api.get("/school-years/grade-levels", {
        params: { schoolYearId: activeSchoolYearId }
      });
      
      const gradeLevels = glRes.data.gradeLevels || [];
      const prevNumMatch = learner.previousGradeLevel.match(/\d+/);
      const prevNum = prevNumMatch ? parseInt(prevNumMatch[0]) : 7;
      const targetNum = prevNum + 1;
      
      const targetGradeLevel = gradeLevels.find((gl: { name: string; id: number }) => {
        const numMatch = gl.name.match(/\d+/);
        return numMatch && parseInt(numMatch[0]) === targetNum;
      });

      if (!targetGradeLevel) {
        sileo.error({
          title: "Grade Level Error",
          description: `Could not find Grade ${targetNum} for the active school year.`
        });
        return;
      }

      await api.post("/enrollment/confirm-slip", {
        learnerId: learner.id,
        schoolYearId: activeSchoolYearId,
        gradeLevelId: targetGradeLevel.id,
      });

      sileo.success({
        title: "Enrollment Confirmed",
        description: `${learner.firstName} ${learner.lastName} is now ready for sectioning.`
      });

      onSuccess?.();
      // Reset for next entry
      setLrn("");
      setLearner(null);
      inputRef.current?.focus();
    } catch (err: unknown) {
      toastApiError(err as any);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-emerald-600 px-6 py-4 text-white">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">Process Confirmation Slip</DialogTitle>
            </div>
            <DialogDescription className="text-emerald-100 text-xs font-medium">
              Rapid enrollment for promoted returning learners (DO 017, s. 2025)
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex justify-between">
              1. Scan or Type 12-Digit LRN
              {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </label>
            <Input
              ref={inputRef}
              value={lrn}
              onChange={(e) => setLrn(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="e.g. 101234567890"
              className="h-14 text-2xl font-black tracking-[0.2em] text-center border-2 focus-visible:ring-emerald-500"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs font-bold">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {learner && (
            <Card className="border-2 border-emerald-100 bg-emerald-50/30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-emerald-100/50 px-4 py-2 border-b border-emerald-100 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Learner Found
                </span>
                <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-200 font-bold uppercase text-[9px]">
                  {learner.promotionStatus}
                </Badge>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex flex-col">
                  <span className="text-xl font-black text-slate-900 uppercase">
                    {learner.lastName}, {learner.firstName} {learner.middleName}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Previous: {learner.previousGradeLevel} • {learner.previousSection}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col p-2 bg-white rounded border border-emerald-100">
                    <span className="text-[9px] font-black text-muted-foreground uppercase">Gen Average</span>
                    <span className="text-lg font-black text-emerald-700">
                      {learner.previousGenAve?.toFixed(2) || "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col p-2 bg-white rounded border border-emerald-100">
                    <span className="text-[9px] font-black text-muted-foreground uppercase">Promotion</span>
                    <span className="text-lg font-black text-emerald-700">
                      {learner.promotionStatus === "PROMOTED" ? "YES" : "NO"}
                    </span>
                  </div>
                </div>

                <Button 
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wide gap-2 text-lg shadow-lg"
                  onClick={handleConfirm}
                  disabled={confirming}
                >
                  {confirming ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <UserCheck className="h-6 w-6" />
                      Confirm Enrollment ⚡
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {!learner && !loading && !error && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-20">
              <Search className="h-12 w-12" />
              <p className="text-sm font-bold uppercase tracking-widest">Awaiting LRN Input</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
