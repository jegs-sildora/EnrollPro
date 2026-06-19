import { memo } from "react";
import { Check, Plus, Minus, Users, Info, Library } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import {
  Sheet,
  SheetContent,
} from "@/shared/ui/sheet";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/shared/ui/accordion";
import type { SectionFormState, TeacherOption } from "../types";

const TLE_REQUIRED_DISPLAY_ORDERS = [9, 10];

interface TLEProgramOption {
  id: number;
  name: string;
  category: string;
}

type SectionFormField = keyof SectionFormState;

interface SectionFormSheetProps {
  mode: "create" | "edit";
  open: boolean;
  title: string;
  description: string;
  formData: SectionFormState;
  submitting: boolean;
  canSubmit: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (field: SectionFormField, value: string | number | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
  programOptions: { value: string; label: string }[];
  teachers: TeacherOption[];
  loadingTeachers?: boolean;
  gradeLevelName?: string;
  gradeLevelDisplayOrder?: number;
  tlePrograms?: TLEProgramOption[];
  /** When set, locks the section type and hides the radio toggle.
   *  HOMEROOM → forces HOME_ROOM mode; TLE_LAB → forces TLE_LABORATORY mode. */
  defaultMode?: "HOMEROOM" | "TLE_LAB";
}

export const SectionFormSheet = memo(function SectionFormSheet({
  mode,
  open,
  title,
  description,
  formData,
  submitting,
  canSubmit,
  onOpenChange,
  onFieldChange,
  onCancel,
  onSubmit,
  programOptions,
  teachers,
  loadingTeachers = false,
  gradeLevelName,
  gradeLevelDisplayOrder = 0,
  tlePrograms = [],
  defaultMode,
}: SectionFormSheetProps) {
  const isGrade9Or10 = TLE_REQUIRED_DISPLAY_ORDERS.includes(
    gradeLevelDisplayOrder,
  );
  // When defaultMode is set, override isTleLaboratory accordingly
  const isTleLaboratory =
    defaultMode === "TLE_LAB"
      ? true
      : defaultMode === "HOMEROOM"
        ? false
        : isGrade9Or10 && formData.sectionType === "TLE_LABORATORY";
  // Show the section-type radio only when there is no forced mode
  const showSectionTypeRadio = !defaultMode && isGrade9Or10;
  const selectedTleProgram =
    isTleLaboratory && formData.tleProgramId != null
      ? tlePrograms.find((program) => program.id === formData.tleProgramId)
      : null;
  const selectedTleProgramName = selectedTleProgram?.name ?? "";

  const submitLabel = mode === "create" ? "Create Section" : "Save Changes";
  const submittingLabel = mode === "create" ? "Creating..." : "Saving...";

  const initials = gradeLevelName ? gradeLevelName.replace(/[^0-9]/g, "") || "GL" : "S";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
      <SheetContent
        className="p-0 flex flex-col h-full border-l-0 overflow-hidden bg-background">

        {/* Sticky Header with Accent */}
        <div className="bg-primary px-6 py-5 relative shrink-0 border-b border-border shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-primary-foreground/10 flex items-center justify-center font-black text-primary-foreground text-xl uppercase border border-primary-foreground/20 shadow-md">
              {initials}
            </div>
            <div className="space-y-0.5">
              <h2 className="text-base font-black text-primary-foreground uppercase leading-none">
                {title}
              </h2>
              <p className="text-base font-black text-primary-foreground/80 uppercase tracking-wide flex items-center gap-1.5 mt-1.5">
                <Library className="size-3" />
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">
            <Accordion
              type="multiple"
              defaultValue={["identity", "advisory"]}
              className="space-y-4"
            >
              {/* 1. SECTION IDENTITY */}
              <AccordionItem
                value="identity"
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
              >
                <AccordionTrigger className="px-5 py-4 font-black uppercase text-base tracking-wide text-foreground hover:no-underline hover:bg-muted/10">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    1. Section Identity
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                  <div className="space-y-4 pt-2">
                    {showSectionTypeRadio && (
                      <div className="space-y-2">
                        <Label className="font-bold text-base uppercase">Section Type</Label>
                        <RadioGroup
                          value={formData.sectionType}
                          onValueChange={(value) =>
                            onFieldChange("sectionType", value)
                          }
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          <div className="flex items-center gap-2 rounded-md border p-3">
                            <RadioGroupItem
                              value="HOME_ROOM"
                              id="section-type-home-room"
                            />
                            <Label
                              htmlFor="section-type-home-room"
                              className="font-bold text-base uppercase cursor-pointer"
                            >
                              Home Room
                            </Label>
                          </div>
                          <div className="flex items-center gap-2 rounded-md border p-3">
                            <RadioGroupItem
                              value="TLE_LABORATORY"
                              id="section-type-tle-laboratory"
                            />
                            <Label
                              htmlFor="section-type-tle-laboratory"
                              className="font-bold text-base uppercase cursor-pointer"
                            >
                              TLE Laboratory
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="font-bold text-base uppercase">
                          Grade Level
                        </Label>
                        <Input
                          value={gradeLevelName || "N/A"}
                          readOnly
                          className="font-bold bg-muted/50"
                        />
                      </div>

                      {!isTleLaboratory && (
                        <div className="space-y-2">
                          <Label className="font-bold text-base uppercase">Curriculum Program</Label>
                          <Select
                            value={formData.curriculumProgram}
                            onValueChange={(value) =>
                              onFieldChange("curriculumProgram", value)
                            }>
                            <SelectTrigger className="font-bold">
                              <SelectValue placeholder="Select Program" />
                            </SelectTrigger>
                            <SelectContent>
                              {programOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  className="font-bold uppercase text-base">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {isTleLaboratory && (
                      <div className="space-y-2">
                        <Label className="font-bold text-base uppercase">TLE Specialization *</Label>
                        <Select
                          value={
                            formData.tleProgramId != null
                              ? String(formData.tleProgramId)
                              : ""
                          }
                          onValueChange={(v) =>
                            onFieldChange("tleProgramId", Number(v))
                          }>
                          <SelectTrigger className="font-bold">
                            <SelectValue placeholder="Select TLE Program" />
                          </SelectTrigger>
                          <SelectContent>
                            {tlePrograms.map((p) => (
                              <SelectItem
                                key={p.id}
                                value={String(p.id)}
                                className="font-bold text-base">
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="font-bold text-base uppercase">Section Name *</Label>
                      <Input
                        placeholder={
                          isTleLaboratory
                            ? selectedTleProgramName
                              ? `e.g., ${selectedTleProgramName} - A`
                              : "Select a TLE Specialization first"
                            : "e.g., Rizal, Mabini, Aristotle"
                        }
                        value={formData.name}
                        onChange={(event) =>
                          onFieldChange("name", event.target.value)
                        }
                        className="font-black uppercase text-base placeholder:text-foreground/30"
                      />
                      <p className="text-[10px] text-foreground font-bold italic">
                        {isTleLaboratory
                          ? `* Specialization is pre-filled. Append a letter to complete the name (e.g., ${selectedTleProgramName || "[Program]"} - A).`
                          : ''}
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 2. ADVISORY & CAPACITY */}
              <AccordionItem
                value="advisory"
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
              >
                <AccordionTrigger className="px-5 py-4 font-black uppercase text-base tracking-wide text-foreground hover:no-underline hover:bg-muted/10">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    2. Advisory & Capacity
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 pt-2 border-t border-border">
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="font-bold text-base uppercase">{isTleLaboratory ? "TLE Instructor" : "Class Adviser"}</Label>
                      <Select
                        value={formData.adviserId}
                        onValueChange={(value) => onFieldChange("adviserId", value)}
                        disabled={loadingTeachers}>
                        <SelectTrigger className="font-bold uppercase">
                          <SelectValue
                            placeholder={
                              loadingTeachers
                                ? "Loading Teachers..."
                                : "Select Adviser"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="font-bold uppercase">
                          <SelectItem value="none">Unassigned / To Follow</SelectItem>
                          {teachers.map((t) => (
                            <SelectItem
                              key={t.id}
                              value={t.id.toString()}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-bold text-base uppercase">Maximum Capacity *</Label>
                      <div className="flex items-center max-w-[600px]">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-r-none border-r-0"
                          onClick={() =>
                            onFieldChange(
                              "maxCapacity",
                              Math.max(1, formData.maxCapacity - 1),
                            )
                          }>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          value={formData.maxCapacity}
                          onChange={(e) =>
                            onFieldChange(
                              "maxCapacity",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="h-10 w-full rounded-none text-center font-black text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-transparent"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-l-none border-l-0"
                          onClick={() =>
                            onFieldChange("maxCapacity", formData.maxCapacity + 1)
                          }>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="border-t px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto font-bold uppercase">
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !canSubmit}
              className="w-full sm:w-auto font-black uppercase px-8">
              {submitting ? (
                submittingLabel
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
});
