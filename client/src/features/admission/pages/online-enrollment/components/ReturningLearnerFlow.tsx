import {
  Card,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import {
  UserCheck,
  ArrowLeft,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router";

interface ReturningLearnerFlowProps {
  onBack: () => void;
}

/**
 * Repurposed Instruction Screen (DPA Compliant)
 * Instead of public LRN lookup, this informs users that confirmation
 * has been moved to the secure Learner Portal.
 */
export function ReturningLearnerFlow({
  onBack,
}: ReturningLearnerFlowProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
      <Button
        onClick={onBack}
        variant="ghost"
        className="group font-black uppercase text-slate-500 hover:text-foreground px-6">
        <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Selection
      </Button>

      <Card className="border-2 border-emerald-100 shadow-xl overflow-hidden bg-background">
        <div className="bg-emerald-600 px-6 py-10 text-white text-center">
          <ShieldAlert className="h-16 w-16 mx-auto mb-4 opacity-90" />
          <CardTitle className="text-3xl font-black uppercase tracking-tight">
            Secure Confirmation Required
          </CardTitle>
          <CardDescription className="text-emerald-50 font-bold mt-2 text-base">
            For your privacy and data security, continuing learner enrollment is now handled through the secure portal.
          </CardDescription>
        </div>

        <CardContent className="p-10 space-y-8">
          <div className="space-y-6 text-center max-w-2xl mx-auto">
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase">Important Privacy Update</h3>
              <p className="text-slate-600 font-bold leading-relaxed">
                To comply with the <span className="text-slate-900 underline decoration-emerald-500 underline-offset-4">Philippine Data Privacy Act (R.A. 10173)</span>, we have moved all student records behind a secure login.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-left space-y-4">
              <div className="flex items-start gap-4">
                 <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 font-black text-xs">1</div>
                 <p className="text-sm font-bold text-slate-700">Log in to the **Learner Portal** using your LRN and password.</p>
              </div>
              <div className="flex items-start gap-4">
                 <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 font-black text-xs">2</div>
                 <p className="text-sm font-bold text-slate-700">Confirm your intent to return for the upcoming school year.</p>
              </div>
              <div className="flex items-start gap-4">
                 <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 font-black text-xs">3</div>
                 <p className="text-sm font-bold text-slate-700">Update your specialization track (for incoming Grade 9).</p>
              </div>
            </div>

            <div className="pt-6">
              <Button
                onClick={() => navigate("/learner/login")}
                className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase gap-3 text-lg shadow-xl shadow-emerald-200 transition-all active:scale-[0.98]">
                <UserCheck className="h-6 w-6" />
                Log In to Secure Portal
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <p className="text-[10px] font-black uppercase text-slate-400 mt-4 tracking-widest">
                Need help? Contact the School Registrar's Office
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
