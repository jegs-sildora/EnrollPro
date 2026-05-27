import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, Minus, Users, Info } from "lucide-react";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
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
//   const tleSectionSuffix = isTleLaboratory
//     ? extractTleSectionSuffix(formData.name, selectedTleProgramName)
//     : "";
  const [panelPercentage, setPanelPercentage] = useState(40);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true,
  );
  const isResizing = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 640);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isResizing.current || !isDesktopViewport) {
        return;
      }

      const newWidthPercent =
        ((window.innerWidth - event.clientX) / window.innerWidth) * 100;
      if (newWidthPercent > 25 && newWidthPercent < 90) {
        setPanelPercentage(newWidthPercent);
      }
    },
    [isDesktopViewport],
  );

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    if (!isDesktopViewport) {
      return;
    }

    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing, { once: true });
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, isDesktopViewport, stopResizing]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mouseup", stopResizing);
      stopResizing();
    };
  }, [stopResizing]);

  const submitLabel = mode === "create" ? "Create Section" : "Save Changes";
  const submittingLabel = mode === "create" ? "Creating..." : "Saving...";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 flex flex-row border-l overflow-visible w-screen sm:w-auto sm:max-w-none"
        style={
          isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
        }>
        <div
          onMouseDown={startResizing}
          className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group">
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <SheetHeader className="space-y-1 border-b bg-primary px-6 py-4 pr-14 shrink-0">
            <SheetTitle className="text-2xl text-primary-foreground font-black uppercase">
              {title}
            </SheetTitle>
            <SheetDescription className="text-primary-foreground font-bold">
              {description}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Section Identity
                </h3>
                <p className="text-xs text-foreground/70 font-bold">
                  Basic identification for this class roster.
                </p>
              </header>

              {showSectionTypeRadio && (
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase">Section Type</Label>
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
                        className="font-bold text-xs uppercase cursor-pointer"
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
                        className="font-bold text-xs uppercase cursor-pointer"
                      >
                        TLE Laboratory
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase">
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
                    <Label className="font-bold text-xs uppercase">
                      Curricular Program *
                    </Label>
                    <Select
                      value={formData.programType}
                      onValueChange={(value) =>
                        onFieldChange("programType", value)
                      }>
                      <SelectTrigger className="font-bold">
                        <SelectValue placeholder="Select Program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="font-bold uppercase text-xs">
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
                  <Label className="font-bold text-xs uppercase">
                    TLE Specialization *
                  </Label>
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
                          className="font-bold text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase">
                  Section Name *
                </Label>
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
                    : '* Avoid using grade level prefix (e.g., use "Rizal" instead of "Grade 7 Rizal").'}
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-md border p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Advisory & Capacity
                </h3>
                <p className="text-xs text-foreground/70 font-bold">
                  Faculty assignment and enrollment limits.
                </p>
              </header>

              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase">
                  {isTleLaboratory ? "TLE Instructor" : "Class Adviser"}
                </Label>
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
                <p className="text-[10px] text-foreground font-bold italic">
                  - Showing available teachers eligible for section assignment.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase">
                  Maximum Capacity *
                </Label>
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
            </section>
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
