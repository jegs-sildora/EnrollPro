import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  DOCUMENT_ID_OPTIONS,
  DOCUMENT_PHASE_OPTIONS,
  DOCUMENT_POLICY_OPTIONS,
  PHASE_ALL_VALUE,
} from "../constants";
import type {
  ScpConfig,
  ScpDocumentPhase,
  ScpDocumentPolicy,
  ScpDocumentRequirementDraft,
} from "../types";

interface DocumentRequirementsSectionProps {
  scp: ScpConfig;
  scpIndex: number;
  onAddDocumentRequirement: (scpIndex: number) => void;
  onRemoveDocumentRequirement: (
    scpIndex: number,
    requirementIndex: number,
  ) => void;
  onPatchDocumentRequirement: (
    scpIndex: number,
    requirementIndex: number,
    patch: Partial<ScpDocumentRequirementDraft>,
  ) => void;
}

export function DocumentRequirementsSection({
  scp,
  scpIndex,
  onAddDocumentRequirement,
  onRemoveDocumentRequirement,
  onPatchDocumentRequirement,
}: DocumentRequirementsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-bold uppercase tracking-wide">
          Requirements
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onAddDocumentRequirement(scpIndex)}>
          <Plus className="h-3.5 w-3.5" />
          Add Requirement
        </Button>
      </div>

      {scp.documentRequirements.length === 0 && (
        <p className="text-sm italic py-1 text-muted-foreground">
          No custom document matrix yet. Add rows and mark each requirement as
          Required, Optional, or Hidden.
        </p>
      )}

      <datalist id={`scp-doc-options-${scpIndex}`}>
        {DOCUMENT_ID_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>

      <div className="space-y-2">
        {scp.documentRequirements.map((requirement, requirementIdx) => (
          <div
            key={`${scp.scpType}-${requirementIdx}`}
            className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4 space-y-1">
                <Label className="text-sm font-bold uppercase">
                  Document ID
                </Label>
                <Input
                  list={`scp-doc-options-${scpIndex}`}
                  placeholder="e.g. MEDICAL_CERTIFICATE"
                  className="h-8 text-sm font-bold uppercase"
                  value={requirement.docId}
                  onChange={(event) =>
                    onPatchDocumentRequirement(scpIndex, requirementIdx, {
                      docId: event.target.value.toUpperCase(),
                    })
                  }
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <Label className="text-sm font-bold uppercase">Policy</Label>
                <Select
                  value={requirement.policy}
                  onValueChange={(value) =>
                    onPatchDocumentRequirement(scpIndex, requirementIdx, {
                      policy: value as ScpDocumentPolicy,
                    })
                  }>
                  <SelectTrigger className="h-8 text-sm font-bold uppercase">
                    <SelectValue placeholder="Policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_POLICY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-3 space-y-1">
                <Label className="text-sm font-bold uppercase">Phase</Label>
                <Select
                  value={requirement.phase ?? PHASE_ALL_VALUE}
                  onValueChange={(value) =>
                    onPatchDocumentRequirement(scpIndex, requirementIdx, {
                      phase:
                        value === PHASE_ALL_VALUE
                          ? null
                          : (value as ScpDocumentPhase),
                    })
                  }>
                  <SelectTrigger className="h-8 text-sm font-bold uppercase">
                    <SelectValue placeholder="Both Phases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PHASE_ALL_VALUE}>Both Phases</SelectItem>
                    {DOCUMENT_PHASE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 flex items-end justify-start md:justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full md:w-auto"
                  onClick={() =>
                    onRemoveDocumentRequirement(scpIndex, requirementIdx)
                  }>
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-bold uppercase">Notes</Label>
              <Input
                placeholder="Optional guidance shown during verification"
                className="h-8 text-sm font-bold"
                value={requirement.notes ?? ""}
                onChange={(event) =>
                  onPatchDocumentRequirement(scpIndex, requirementIdx, {
                    notes: event.target.value || null,
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
