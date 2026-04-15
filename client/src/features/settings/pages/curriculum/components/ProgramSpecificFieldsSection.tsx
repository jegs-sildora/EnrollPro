import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { ScpConfig } from "../types";

interface ProgramSpecificFieldsSectionProps {
  scp: ScpConfig;
  scpIndex: number;
  onUpdateScpField: (
    index: number,
    field: keyof ScpConfig,
    value: string | boolean | number | string[] | null,
  ) => void;
}

export function ProgramSpecificFieldsSection({
  scp,
  scpIndex,
  onUpdateScpField,
}: ProgramSpecificFieldsSectionProps) {
  if (scp.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-bold">Art Fields</Label>
        <Input
          placeholder="Visual Arts, Music, Theatre Arts, Creative Writing..."
          className="h-9 text-sm"
          value={scp.artFields.join(", ")}
          onChange={(event) =>
            onUpdateScpField(
              scpIndex,
              "artFields",
              event.target.value.split(",").map((value) => value.trim()),
            )
          }
        />
        <p className="text-sm /60">Separate multiple fields with commas</p>
      </div>
    );
  }

  if (scp.scpType === "SPECIAL_PROGRAM_IN_SPORTS") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-bold ">Sports Offered</Label>
        <Input
          placeholder="Basketball, Volleyball, Archery, Swimming..."
          className="h-9 text-sm"
          value={scp.sportsList.join(", ")}
          onChange={(event) =>
            onUpdateScpField(
              scpIndex,
              "sportsList",
              event.target.value.split(",").map((value) => value.trim()),
            )
          }
        />
        <p className="text-sm /60">Separate multiple sports with commas</p>
      </div>
    );
  }

  if (scp.scpType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-bold ">Languages Offered</Label>
        <Input
          placeholder="Spanish, Japanese, French, Mandarin..."
          className="h-9 text-sm"
          value={scp.languages.join(", ")}
          onChange={(event) =>
            onUpdateScpField(
              scpIndex,
              "languages",
              event.target.value.split(",").map((value) => value.trim()),
            )
          }
        />
        <p className="text-sm /60">Separate multiple languages with commas</p>
      </div>
    );
  }

  return null;
}
