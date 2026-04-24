import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { UserPlus, UserCheck, ArrowRight } from "lucide-react";

interface IntakeChoiceProps {
  onChoice: (choice: "NEW" | "RETURNING") => void;
}

export function IntakeChoice({ onChoice }: IntakeChoiceProps) {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Welcome to Online Enrollment</h2>
        <p className="text-slate-500 font-medium">To begin, please select the appropriate learner category.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card 
          className="group relative overflow-hidden border-2 transition-all hover:border-primary hover:shadow-xl cursor-pointer"
          onClick={() => onChoice("NEW")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UserPlus className="h-24 w-24" />
          </div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <UserPlus className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold">New Student / Transferee</CardTitle>
            <CardDescription className="text-slate-500 font-medium leading-relaxed">
              For incoming Grade 7 learners or students from other schools (Grade 8-10) who haven't studied here before.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full h-12 group-hover:bg-primary group-hover:text-white transition-all font-bold">
              Start New Enrollment <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden border-2 transition-all hover:border-emerald-600 hover:shadow-xl cursor-pointer"
          onClick={() => onChoice("RETURNING")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-600">
            <UserCheck className="h-24 w-24" />
          </div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UserCheck className="h-6 w-6 text-emerald-600 group-hover:text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Returning Student</CardTitle>
            <CardDescription className="text-slate-500 font-medium leading-relaxed">
              For existing learners (Grade 7-9 last year) returning for the next grade level. Requires LRN.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full h-12 group-hover:bg-emerald-600 group-hover:text-white transition-all font-bold border-emerald-100 text-emerald-700">
              Process Confirmation Slip <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <p className="text-center text-xs font-black text-slate-400 uppercase tracking-widest">
        DepEd Order No. 017, s. 2025 Compliant Workflow
      </p>
    </div>
  );
}
