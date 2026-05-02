import { GraduationCap, Info } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { ScpConfig, ScpGradeRequirementRule } from "../types";

interface GradeRequirementsSectionProps {
  scp: ScpConfig;
  scpIndex: number;
  onUpdateGradeRequirements: (
    index: number,
    rules: ScpGradeRequirementRule[],
  ) => void;
}

function extractMinAverage(
  rules: ScpGradeRequirementRule[] | null | undefined,
  ruleType: "GENERAL_AVERAGE_MIN" | "SUBJECT_AVERAGE_MIN",
): number {
  if (Array.isArray(rules)) {
    const rule = rules.find((r) => r.ruleType === ruleType);
    if (rule?.minAverage != null && Number.isFinite(rule.minAverage)) {
      return rule.minAverage;
    }
  } else if (rules && typeof rules === "object" && !Array.isArray(rules)) {
    // Handle legacy object format
    const legacy = rules as unknown as { minimumGeneralAverage?: number };
    if (
      ruleType === "GENERAL_AVERAGE_MIN" &&
      typeof legacy.minimumGeneralAverage === "number"
    ) {
      return legacy.minimumGeneralAverage;
    }
  }
  return 85;
}

function buildRules(
  isSte: boolean,
  subjectAverageMin: number,
): ScpGradeRequirementRule[] {
  const rules: ScpGradeRequirementRule[] = [];

  if (isSte) {
    rules.push({
      ruleType: "SUBJECT_AVERAGE_MIN",
      minAverage: subjectAverageMin,
      subjects: ["ENGLISH", "SCIENCE", "MATHEMATICS"],
      subjectThresholds: [],
    });
  }

  return rules;
}

export function GradeRequirementsSection({
  scp,
  scpIndex,
  onUpdateGradeRequirements,
}: GradeRequirementsSectionProps) {
  const isSte = scp.scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
  const currentRules = scp.gradeRequirements ?? [];

  const subjectAverageMin = extractMinAverage(
    currentRules,
    "SUBJECT_AVERAGE_MIN",
  );

  const handleSubjectAverageChange = (raw: string) => {
    const parsed =
      raw === "" ? 85 : Math.min(100, Math.max(0, parseFloat(raw) || 85));
    const next = buildRules(isSte, parsed);
    onUpdateGradeRequirements(scpIndex, next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-primary" />
        <Label className="text-sm font-bold uppercase tracking-wide">
          Grade Requirements
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {isSte && (
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Minimum Subject Average — Eng, Sci & Math (%)
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={subjectAverageMin}
              onChange={(e) => handleSubjectAverageChange(e.target.value)}
              className="h-9 text-sm font-bold"
              placeholder="85"
            />
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              Grade 6 average across Q1–Q3 for English, Science, and
              Mathematics.
            </p>
          </div>
        )}

        {!isSte && (
          <p className="text-xs font-semibold italic text-muted-foreground py-2">
            No specific grade average requirements are defined for this program
            type.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Learners who do not meet the minimum grade requirements will be
        automatically blocked from selecting this SCP track during online early
        registration.
      </p>
    </div>
  );
}
