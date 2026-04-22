import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { SCP_TYPES } from "../constants";
import type {
  ScpConfig,
  ScpGradeRequirementRule,
  ScpStepConfig,
} from "../types";
import { AdmissionStepsSection } from "./AdmissionStepsSection";
import { GradeRequirementsSection } from "./GradeRequirementsSection";
import { ProgramSpecificFieldsSection } from "./ProgramSpecificFieldsSection";

interface ScpProgramCardProps {
  scp: ScpConfig;
  scpIndex: number;
  scpYearStart: Date;
  scpYearEnd: Date;
  onUpdateScpField: (
    index: number,
    field: keyof ScpConfig,
    value: string | boolean | number | string[] | null,
  ) => void;
  onUpdateStep: (
    scpIndex: number,
    stepIndex: number,
    field: keyof ScpStepConfig,
    value: string | boolean | number | null,
  ) => void;
  onUpdateGradeRequirements: (
    index: number,
    rules: ScpGradeRequirementRule[],
  ) => void;
}

export function ScpProgramCard({
  scp,
  scpIndex,
  scpYearStart,
  scpYearEnd,
  onUpdateScpField,
  onUpdateStep,
  onUpdateGradeRequirements,
}: ScpProgramCardProps) {
  const isSteProgram = scp.scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-3 bg-muted border-b">
        <div className="flex items-center gap-3">
          <Switch
            checked={scp.isOffered ?? false}
            onCheckedChange={(checked) =>
              onUpdateScpField(scpIndex, "isOffered", checked)
            }
          />
          <span className="text-sm font-bold">
            {SCP_TYPES.find((type) => type.value === scp.scpType)?.label ||
              scp.scpType}
          </span>
        </div>
        {scp.isOffered && (
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20">
            ACTIVE
          </Badge>
        )}
      </div>

      {scp.isOffered && (
        <div className="p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-0">
          <AdmissionStepsSection
            scp={scp}
            scpIndex={scpIndex}
            scpYearStart={scpYearStart}
            scpYearEnd={scpYearEnd}
            isSteProgram={isSteProgram}
            onUpdateScpField={onUpdateScpField}
            onUpdateStep={onUpdateStep}
          />

          <GradeRequirementsSection
            scp={scp}
            scpIndex={scpIndex}
            onUpdateGradeRequirements={onUpdateGradeRequirements}
          />

          <ProgramSpecificFieldsSection
            scp={scp}
            scpIndex={scpIndex}
            onUpdateScpField={onUpdateScpField}
          />
        </div>
      )}
    </div>
  );
}
