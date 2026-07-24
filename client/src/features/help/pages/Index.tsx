import { Link } from "react-router";
import {
  BookOpenCheck,
  CalendarSync,
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useAuthStore } from "@/store/auth.slice";

interface GuideSectionProps {
  icon: typeof BookOpenCheck;
  title: string;
  description: string;
  steps: string[];
  actionLabel?: string;
  actionTo?: string;
}

function GuideSection({
  icon: Icon,
  title,
  description,
  steps,
  actionLabel,
  actionTo,
}: GuideSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black uppercase text-foreground">{title}</h2>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-2 border-t border-border pt-4">
        {steps.map((step, index) => (
          <li
            key={step}
            className="flex gap-3 text-sm font-semibold leading-relaxed text-foreground">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-black text-primary">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {actionLabel && actionTo ? (
        <Button
          asChild
          variant="outline"
          className="mt-5 w-full font-black sm:w-auto">
          <Link to={actionTo}>
            {actionLabel}
            <ExternalLink className="ml-2 size-4" />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

export default function HelpDocumentation() {
  const roles = useAuthStore((state) => state.user?.roles ?? []);
  const canManageSchoolYear =
    roles.includes("SYSTEM_ADMIN") || roles.includes("HEAD_REGISTRAR");
  const canManagePersonnel = roles.includes("SYSTEM_ADMIN");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="font-black uppercase">
              EnrollPro Operations Guide
            </Badge>
          </div>
          <h1 className="text-2xl font-black uppercase text-foreground">
            Help & Documentation
          </h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-muted-foreground">
            Plain-language guidance for learner enrollment, class sectioning,
            school forms, and school-year rollover.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Actions remain subject to your assigned role.
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <GuideSection
          icon={BookOpenCheck}
          title="Learner Enrollment"
          description="Use the enrollment workspace for continuing learners, incoming Grade 7 learners, transferees, and authorized walk-in enrollment."
          steps={[
            "Check the learner identity and required school documents before enrollment.",
            "Enroll the learner only after the information is verified.",
            "Send enrolled learners to Class Sectioning and SF1 for class placement.",
          ]}
          actionLabel="Open Learner Enrollment"
          actionTo="/continuing-learners"
        />

        <GuideSection
          icon={ClipboardList}
          title="SF1 Class Masterlist"
          description="SF1 actions belong to one class section. The selected section and school year remain the official source of grade, program, and class placement."
          steps={[
            "Open Class Sections and select the correct grade level and section.",
            "Use SF1 Roster to preview an official spreadsheet before importing valid learner records.",
            "Review the class adviser, learner count, sex totals, and learner details before exporting the official SF1.",
          ]}
          actionLabel="Open Class Sections"
          actionTo="/sections"
        />

        <GuideSection
          icon={CalendarSync}
          title="School Year Rollover"
          description="Rollover is one controlled operation. It archives the completed year, carries eligible learners forward, copies empty section structures, and activates the approved new school year."
          steps={[
            "Synchronize final published learner outcomes from SMART and finalize every section.",
            "Record current SF5 forms, record the school-wide SF6, and approve the next school-year calendar.",
            "Review all readiness blockers before running rollover. The new sections must start without learners or advisers.",
          ]}
          actionLabel={
            canManageSchoolYear ? "Open School Year Settings" : undefined
          }
          actionTo={canManageSchoolYear ? "/settings?tab=school-year" : undefined}
        />

        <GuideSection
          icon={FileSpreadsheet}
          title="Personnel and SF7"
          description="Personnel Directory is EnrollPro's official staff record. ATLAS remains the source of teaching schedules used in SF7 reporting."
          steps={[
            "Keep the employee ID, appointment status, position, and educational qualifications complete.",
            "Preview SF7 roster uploads before committing matched personnel records.",
            "Synchronize teaching schedules from ATLAS before exporting the official SF7 compliance report.",
          ]}
          actionLabel={
            canManagePersonnel ? "Open Personnel Directory" : undefined
          }
          actionTo={canManagePersonnel ? "/teachers" : undefined}
        />
      </div>
    </div>
  );
}
