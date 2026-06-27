import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import {
  UserPlus,
  UserCheck,
  ArrowRight,
  FileCheck,
  ClipboardList,
} from "lucide-react";

interface IntakeChoiceProps {
  onChoice: (choice: "NEW" | "RETURNING") => void;
}

export function IntakeChoice({ onChoice }: IntakeChoiceProps) {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-foreground uppercase">
          Welcome to Online Enrollment
        </h2>
        <h3 className="text-foreground font-extrabold">
          To begin, please select the appropriate learner category.
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className="group relative overflow-hidden border-2 transition-all hover:border-primary hover:shadow-xl cursor-pointer flex flex-col"
          onClick={() => onChoice("NEW")}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UserPlus className="h-24 w-24" />
          </div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <UserPlus className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-extrabold">
              Incoming Grade 7, Transferees & Returning (Balik-Aral)
            </CardTitle>
            <CardDescription className="text-foreground font-extrabold leading-relaxed">
              For new entrants or learners resuming their studies after
              a gap year.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-base font-extrabold uppercase text-emerald-600/70">
                  <ClipboardList className="h-3 w-3" />
                  Instructions:
                </div>
                <p className="text-base font-extrabold text-emerald-900 leading-relaxed">
                  Please fill out the digital form completely. Ensure all details match your official documents before submitting.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-base font-extrabold uppercase  text-foreground">
                  <FileCheck className="h-3 w-3" />
                  Please prepare the following:
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-base leading-tight font-extrabold text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    PSA Birth Certificate
                  </li>
                  <li className="flex items-center gap-2 text-base leading-tight font-extrabold text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    SF9 (Previous Report Card)
                  </li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 group-hover:bg-primary group-hover:text-white transition-all font-extrabold border-primary/20 text-primary">
                Fill out Enrollment Form (BEEF){" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-2 transition-all hover:border-emerald-600 hover:shadow-xl flex flex-col">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-600">
            <UserCheck className="h-24 w-24" />
          </div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UserCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-extrabold">
              Continuing Learners (Grades 8–10)
            </CardTitle>
            <CardDescription className="text-foreground font-extrabold leading-relaxed">
              For existing students moving up to the next grade level.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-base font-extrabold uppercase text-emerald-600/70">
                  <ClipboardList className="h-3 w-3" />
                  Instructions:
                </div>
                <p className="text-base font-extrabold text-emerald-900 leading-relaxed">
                  Do not fill out online forms. Please submit your physical, signed Confirmation Slip directly to your designated Class Adviser during enrollment week.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-base font-extrabold uppercase  text-foreground">
                  <FileCheck className="h-3 w-3" />
                  Please prepare the following:
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-base leading-tight font-extrabold text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Signed Confirmation Slip
                  </li>
                  <li className="flex items-center gap-2 text-base leading-tight font-extrabold text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    SF9 (Previous Report Card)
                  </li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 group-hover:bg-emerald-600 group-hover:text-white hover:bg-emerald-600 hover:text-white transition-all font-extrabold border-emerald-100 text-emerald-700"
                asChild>
                <a href="/Confirmation%20Slip.pdf" download="Confirmation_Slip.pdf">
                  Download Blank Confirmation Slip (PDF) <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
