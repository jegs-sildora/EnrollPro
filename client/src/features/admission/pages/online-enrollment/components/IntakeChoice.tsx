import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { UserPlus, UserCheck, ArrowRight, HelpCircle, FileCheck, ClipboardList } from "lucide-react";

interface IntakeChoiceProps {
  onChoice: (choice: "NEW" | "RETURNING") => void;
}

export function IntakeChoice({ onChoice }: IntakeChoiceProps) {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-foreground uppercase">Welcome to Online Enrollment</h2>
        <p className="text-foreground font-semibold">To begin, please select the appropriate learner category.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card 
          className="group relative overflow-hidden border-2 transition-all hover:border-primary hover:shadow-xl cursor-pointer flex flex-col"
          onClick={() => onChoice("NEW")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UserPlus className="h-24 w-24" />
          </div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <UserPlus className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Incoming Grade 7, Transferees & Balik-Aral</CardTitle>
            <CardDescription className="text-foreground font-medium leading-relaxed">
              For new entrants to HNHS or learners resuming their studies after a gap year.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground">
                <FileCheck className="h-3 w-3" />
                Please prepare the following:
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  PSA Birth Certificate
                </li>
                <li className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  SF9 (Previous Report Card)
                </li>
              </ul>
            </div>
            <Button variant="outline" className="w-full h-12 group-hover:bg-primary group-hover:text-white transition-all font-bold">
              Fill out Enrollment Form (BEEF) <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden border-2 transition-all hover:border-emerald-600 hover:shadow-xl cursor-pointer flex flex-col"
          onClick={() => onChoice("RETURNING")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-600">
            <UserCheck className="h-24 w-24" />
          </div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UserCheck className="h-6 w-6 text-emerald-600 group-hover:text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Continuing Learners (Grades 8-10)</CardTitle>
            <CardDescription className="text-foreground font-medium leading-relaxed">
              For continuous HNHS learners moving up to the next grade level. No long forms required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600/70">
                <ClipboardList className="h-3 w-3" />
                Please prepare the following:
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  12-Digit Learner Reference Number (LRN)
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <Button variant="outline" className="w-full h-12 group-hover:bg-emerald-600 group-hover:text-white transition-all font-bold border-emerald-100 text-emerald-700">
                Submit Confirmation Slip <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex justify-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors cursor-help"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Don't know your child's LRN?
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4 shadow-2xl border-2" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-3">
                      <h4 className="font-black text-sm uppercase tracking-tight">Where to find the LRN?</h4>
                      <p className="text-sm text-foreground leading-relaxed font-medium">
                        You can find the 12-digit LRN on your child's <span className="text-primary font-bold">previous Report Card (SF9)</span> or <span className="text-primary font-bold">School ID</span>.
                      </p>
                      <div className="pt-3 border-t space-y-2">
                        <p className="text-[10px] font-black uppercase text-foreground tracking-widest">Still lost?</p>
                        <p className="text-xs font-bold text-foreground leading-normal">
                          Please contact your child's previous Class Adviser or the Registrar's Office for assistance.
                        </p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <p className="text-center text-xs font-black text-foreground uppercase tracking-widest">
        DepEd Order No. 017, s. 2025 Compliant Workflow
      </p>
    </div>
  );
}
