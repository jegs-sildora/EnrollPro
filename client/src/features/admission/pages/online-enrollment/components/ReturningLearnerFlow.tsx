import { useState, useEffect } from "react";
import { Card, CardTitle, CardContent, CardDescription} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Badge } from "@/shared/ui/badge";
import { CheckCircle2, UserCheck, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { sileo } from "sileo";

interface ReturningLearnerFlowProps {
  onBack: () => void;
  onSuccess: (data: any) => void;
}

export function ReturningLearnerFlow({ onBack, onSuccess }: ReturningLearnerFlowProps) {
  const { activeSchoolYearId, activeSchoolYearLabel } = useSettingsStore();
  const [lrn, setLrn] = useState("");
  const [loading, setLoading] = useState(false);
  const [learner, setLearner] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLookup = async () => {
    if (lrn.length !== 12) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/learner/lookup?lrn=${lrn}`);
      setLearner(res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError("Learner record not found. Please verify the LRN or proceed as a New Student.");
      } else {
        toastApiError(err);
      }
      setLearner(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lrn.length === 12) {
      void handleLookup();
    } else {
      setLearner(null);
      setError(null);
    }
  }, [lrn]);

  const handleSubmit = async () => {
    if (!learner || !activeSchoolYearId) return;
    setSubmitting(true);
    try {
      const glRes = await api.get("/school-years/grade-levels", {
        params: { schoolYearId: activeSchoolYearId }
      });
      
      const gradeLevels = glRes.data.gradeLevels || [];
      const prevNumMatch = learner.previousGradeLevel.match(/\d+/);
      const prevNum = prevNumMatch ? parseInt(prevNumMatch[0]) : 7;
      const targetNum = prevNum + 1;
      
      const targetGradeLevel = gradeLevels.find((gl: any) => {
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

      const res = await api.post("/enrollment/confirm-slip", {
        learnerId: learner.id,
        schoolYearId: activeSchoolYearId,
        gradeLevelId: targetGradeLevel.id,
      });

      sileo.success({
        title: "Confirmation Received!",
        description: `Your child's enrollment for ${activeSchoolYearLabel || "S.Y. 2026-2027"} has been confirmed.`
      });

      onSuccess(res.data.application);
    } catch (err) {
      toastApiError(err as any);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
      <Button 
        onClick={onBack} 
        className="group font-black uppercase tracking-widest bg-emerald-600 text-white shadow-md transition-all px-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
        Back to Selection
      </Button>

      <Card className="border-2 border-emerald-100 shadow-xl overflow-hidden bg-background">
        <div className="bg-emerald-600 px-6 py-8 text-white text-center">
          <UserCheck className="h-12 w-12 mx-auto mb-4" />
          <CardTitle className="text-2xl font-black uppercase">Continuing Learner Confirmation</CardTitle>
          <CardDescription className="text-white font-semibold mt-2">
            Streamlined enrollment for learners moving up to the next grade level.
          </CardDescription>
        </div>

        <CardContent className="p-8 space-y-8">
          <div className="space-y-3">
            <Label className="text-sm font-black uppercase tracking-widest text-foreground">
              1. Enter Learner's 12-Digit LRN
            </Label>
            <div className="relative">
              <Input
                value={lrn}
                onChange={(e) => setLrn(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="101234567890"
                className="h-16 text-3xl font-black tracking-[0.2em] text-center border-2 border-border focus-visible:ring-emerald-500"
              />
              {loading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold animate-in zoom-in-95 duration-200">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          {learner && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-100 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 opacity-70">Learner Profile Found</span>
                    <h3 className="text-2xl font-black text-foreground uppercase leading-none mt-1">
                      {learner.lastName}, {learner.firstName}
                    </h3>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-bold uppercase text-[10px]">
                    {learner.promotionStatus}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-muted-foreground">Previous Grade</span>
                    <p className="font-bold text-foreground">{learner.previousGradeLevel} • {learner.previousSection}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-muted-foreground">Gen. Average</span>
                    <p className="font-bold text-emerald-700">{learner.previousGenAve?.toFixed(2) || "N/A"}</p>
                  </div>
                </div>

                {learner.hasPsaBirthCertificate && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-100/50 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <p className="text-[10px] font-bold text-emerald-800">
                      PSA Birth Certificate already on file and verified.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-start space-x-3 p-4 bg-muted/20 rounded-xl border border-border">
                <Checkbox 
                  id="confirm-enroll" 
                  checked={isConfirmed}
                  onCheckedChange={(checked) => setIsConfirmed(checked === true)}
                  className="mt-1 border-emerald-500 data-[state=checked]:bg-emerald-600"
                />
                <Label htmlFor="confirm-enroll" className="text-sm font-bold leading-relaxed cursor-pointer select-none text-foreground">
                  I hereby confirm the enrollment of this learner for the School Year {activeSchoolYearLabel || "2026-2027"}. 
                  I certify that all information in the existing records is still accurate.
                </Label>
              </div>

              <Button 
                className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wide gap-3 text-xl shadow-xl shadow-emerald-200 disabled:opacity-50"
                disabled={!isConfirmed || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <UserCheck className="h-7 w-7" />
                    Submit Confirmation ⚡
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
