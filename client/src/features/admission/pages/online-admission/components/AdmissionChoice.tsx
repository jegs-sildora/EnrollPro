import { useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { ArrowRight, ClipboardList, FileCheck, Search, FileSignature, AlertCircle } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";

interface AdmissionChoiceProps {
  onChoice: (choice: "APPLY" | "TRACK") => void;
}

export function AdmissionChoice({ onChoice }: AdmissionChoiceProps) {
  const { activeSchoolYearLabel, steEnabled, spaEnabled, spsEnabled } = useSettingsStore();

  const activePrograms = [
    steEnabled ? "STE" : null,
    spaEnabled ? "SPA" : null,
    spsEnabled ? "SPS" : null,
  ].filter(Boolean) as string[];

  const programListFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const formattedPrograms = programListFormatter.format(activePrograms);
  const programText = formattedPrograms ? ` (${formattedPrograms})` : "";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center text-center gap-4">
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 font-extrabold text-emerald-800 ring-1 ring-inset ring-emerald-600/20 uppercase tracking-wide">
          {activeSchoolYearLabel ? `S.Y. ${activeSchoolYearLabel} • ` : ""}ADMISSIONS OPEN
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground uppercase tracking-tight">
          Special Curricular Programs (SCP) Admission
        </h1>
        <p className="text-lg text-foreground font-bold max-w-4xl leading-relaxed">
          Welcome! This portal is exclusively for incoming Grade 7 applicants applying for specialized programs{programText}.
        </p>
        
        <div className="mt-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm max-w-5xl text-left">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <p className="text-sm font-bold leading-relaxed">
            Note: If you are enrolling in the Regular Basic Education (BEC) program, do not apply here. Please wait for the official enrollment period.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className="group relative overflow-hidden border-2 transition-all hover:border-primary hover:shadow-xl cursor-pointer flex flex-col"
          onClick={() => onChoice("APPLY")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileSignature className="h-24 w-24" />
          </div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <FileSignature className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-extrabold">
              Submit Admission Form
            </CardTitle>
            <CardDescription className="text-foreground leading-relaxed">
              Apply for Special Curricular Programs{programText}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-base font-bold uppercase text-emerald-600">
                  <ClipboardList className="h-3 w-3" />
                  Instructions:
                </div>
                <p className="text-base font-bold text-emerald-900 leading-relaxed">
                  Fill out the digital admission form completely. Ensure all details match your official documents before submitting.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-base font-bold uppercase text-foreground">
                  <FileCheck className="h-3 w-3" />
                  Please prepare the following:
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-base leading-tight font-bold text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    PSA Birth Certificate
                  </li>
                  <li className="flex items-center gap-2 text-base leading-tight font-bold text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    SF9 (Previous Report Card)
                  </li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 group-hover:bg-primary group-hover:text-primary-foreground transition-all font-bold border-primary/20 text-primary hover:text-primary-foreground hover:bg-primary"
              >
                Start Application <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group relative overflow-hidden border-2 transition-all hover:border-emerald-600 hover:shadow-xl cursor-pointer flex flex-col"
          onClick={() => onChoice("TRACK")}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-600">
            <Search className="h-24 w-24" />
          </div>
          <CardHeader className="pb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-primary-foreground transition-colors">
              <Search className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-extrabold">
              Track Application
            </CardTitle>
            <CardDescription className="text-foreground leading-relaxed">
              Check the status of your submitted application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-base font-bold uppercase text-emerald-600">
                  <ClipboardList className="h-3 w-3" />
                  Instructions:
                </div>
                <p className="text-base font-bold text-emerald-900 leading-relaxed">
                  Enter the tracking number provided to you after submitting the admission form to see your current status.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-base font-bold uppercase text-foreground">
                  <FileCheck className="h-3 w-3" />
                  Please prepare the following:
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-base leading-tight font-bold text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Tracking Number
                  </li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 group-hover:bg-emerald-600 group-hover:text-primary-foreground hover:bg-emerald-600 hover:text-primary-foreground transition-all font-bold border-emerald-100 text-emerald-700"
              >
                Track Status <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
