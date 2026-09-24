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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import { X } from "lucide-react";
import { cn, getGradeLevelSolidBgStyles } from "@/shared/lib/utils";
import type { SectionFormState, TeacherOption } from "../types";

type SectionFormField = keyof SectionFormState;

interface SectionFormModalProps {
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

export const SectionFormModal = memo(function SectionFormModal({
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
}: SectionFormModalProps) {
  const { panelPercentage, isDesktopViewport, startResizing, startResizingRight } = useResizablePanel(40, { centered: true });
  const submitLabel = mode === "create" ? "Create Section" : "Save Changes";
  const submittingLabel = mode === "create" ? "Creating..." : "Saving...";

  const initials = gradeLevelName ? gradeLevelName.replace(/[^0-9]/g, "") || "GL" : "S";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        aria-describedby={undefined}
        className="p-0 flex flex-col h-[90vh] md:h-[95vh] border overflow-visible w-full sm:w-auto sm:max-w-none max-w-[95vw]"
        style={isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined}
      >
        {/* Left Resize Handle */}
        <div
          onMouseDown={startResizing}
          className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group rounded-l-md"
        >
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        {/* Right Resize Handle */}
        <div
          onMouseDown={startResizingRight}
          className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group rounded-r-md"
        >
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background rounded-md">

        <div className={cn("px-6 py-5 relative shrink-0 border-b border-border shadow-sm flex items-center justify-between text-white", getGradeLevelSolidBgStyles(gradeLevelName))}>
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-white text-xl uppercase border border-white/30 shadow-md">
              {initials}
            </div>
            <div className="space-y-0.5">
              <DialogTitle className={cn("font-bold text-white uppercase leading-none", mode === "edit" ? "text-xl" : "text-base")}>
                {mode === "edit" ? `EDIT SECTION ${formData.name || ""}`.trim() : title}
              </DialogTitle>
              {mode === "create" && (
                <DialogDescription className="text-base font-bold text-white/90 uppercase tracking-wide flex items-center gap-1.5 mt-1.5">
                  <Library className="size-3" />
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X strokeWidth={3} className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">
            <div className="space-y-4">
              {/* 1. SECTION IDENTITY */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="px-5 py-4 font-bold uppercase text-base tracking-wide text-foreground border-b border-border">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    1. Section Identity
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="font-bold text-base uppercase">
                          Grade Level
                        </Label>
                        <Input
                          value={gradeLevelName || "N/A"}
                          readOnly
                          className="font-bold bg-muted/50 uppercase"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="font-bold text-base uppercase">Curricular Program</Label>
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
                    </div>

                    <div className="space-y-2">
                      <Label className="font-bold text-base uppercase">Section Name *</Label>
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
                        className="font-bold text-base placeholder:text-foreground/30 uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. ADVISORY & CAPACITY */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="px-5 py-4 font-bold uppercase text-base tracking-wide text-foreground border-b border-border">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    2. Advisory & Capacity
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <div className="flex gap-4 w-full">
                    <div className="space-y-2 w-[70%]">
                      <Label className="font-bold text-base uppercase">Class Adviser</Label>
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

                    <div className="space-y-2 w-[30%]">
                      <Label className="font-bold text-base uppercase">Max Capacity *</Label>
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
                          className="h-10 w-full rounded-md text-center font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-transparent"
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
              className="w-full sm:w-auto font-bold uppercase">
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !canSubmit}
              className="w-full sm:w-auto font-bold uppercase px-8">
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
        </div>
      </DialogContent>
    </Dialog>
  );
});
