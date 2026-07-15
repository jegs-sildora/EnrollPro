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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/shared/ui/sheet";
import type { SectionFormState, TeacherOption } from "../types";

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
}: SectionFormSheetProps) {
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
            <div className="size-14 rounded-2xl bg-primary-foreground/10 flex items-center justify-center font-extrabold text-primary-foreground text-xl uppercase border border-primary-foreground/20 shadow-md">
              {initials}
            </div>
            <div className="space-y-0.5">
              <SheetTitle className="text-base font-extrabold text-primary-foreground uppercase leading-none">
                {title}
              </SheetTitle>
              <SheetDescription className="text-base font-extrabold text-primary-foreground/80 uppercase tracking-wide flex items-center gap-1.5 mt-1.5">
                <Library className="size-3" />
                {description}
              </SheetDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">
            <div className="space-y-4">
              {/* 1. SECTION IDENTITY */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground border-b border-border">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    1. Section Identity
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="font-extrabold text-base uppercase">
                          Grade Level
                        </Label>
                        <Input
                          value={gradeLevelName || "N/A"}
                          readOnly
                          className="font-extrabold bg-muted/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="font-extrabold text-base uppercase">Curriculum Program</Label>
                        <Select
                          value={formData.curriculumProgram}
                          onValueChange={(value) =>
                            onFieldChange("curriculumProgram", value)
                          }>
                          <SelectTrigger className="font-extrabold">
                            <SelectValue placeholder="Select Program" />
                          </SelectTrigger>
                          <SelectContent>
                            {programOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="font-extrabold uppercase text-base">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-extrabold text-base uppercase">Section Name *</Label>
                      <Input
                        placeholder="e.g., Rizal, Mabini, Aristotle"
                        value={formData.name}
                        onChange={(event) =>
                          onFieldChange("name", event.target.value)
                        }
                        onBlur={() => {
                          const trimmed = formData.name.trim();
                          const titleCased = trimmed.replace(
                            /\w\S*/g,
                            (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
                          );
                          onFieldChange("name", titleCased);
                        }}
                        className="font-extrabold text-base placeholder:text-foreground/30"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. ADVISORY & CAPACITY */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="px-5 py-4 font-extrabold uppercase text-base tracking-wide text-foreground border-b border-border">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    2. Advisory & Capacity
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <div className="flex gap-4 w-full">
                    <div className="space-y-2 w-[70%]">
                      <Label className="font-extrabold text-base uppercase">Class Adviser</Label>
                      <Select
                        value={formData.adviserId}
                        onValueChange={(value) => onFieldChange("adviserId", value)}
                        disabled={loadingTeachers}>
                        <SelectTrigger className="font-extrabold uppercase">
                          <SelectValue
                            placeholder={
                              loadingTeachers
                                ? "Loading Teachers..."
                                : "Select Adviser"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="font-extrabold uppercase">
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

                    <div className="space-y-2 w-[30%]">
                      <Label className="font-extrabold text-base uppercase">Max Capacity *</Label>
                      <div className="flex items-center w-full">
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
                          className="h-10 w-full rounded-md text-center font-extrabold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-transparent"
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
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto font-extrabold uppercase">
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !canSubmit}
              className="w-full sm:w-auto font-extrabold uppercase px-8">
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
