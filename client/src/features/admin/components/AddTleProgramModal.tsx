import { cn } from "@/shared/lib/utils";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";

export interface TLEProgramFormState {
  name: string;
  category: string;
  trackType: string;
  isActive: boolean;
}

interface AddTleProgramModalProps {
  open: boolean;
  submitting: boolean;
  editProgramName?: string;
  form: TLEProgramFormState;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onChange: (next: TLEProgramFormState) => void;
}

const SPECIALIZATION_CATEGORIES = [
  { value: "HOME_ECONOMICS", label: "Home Economics (HE)" },
  { value: "ICT", label: "Information & Communications Technology (ICT)" },
  { value: "INDUSTRIAL_ARTS", label: "Industrial Arts (IA)" },
  { value: "AGRI_FISHERY_ARTS", label: "Agri-Fishery Arts (AFA)" },
];

const EXPLORATORY_CATEGORIES = [
  { value: "ICT", label: "Information & Communications Technology (ICT)" },
  { value: "HOME_ECONOMICS", label: "Home Economics (HE)" },
  { value: "INDUSTRIAL_ARTS", label: "Industrial Arts (IA)" },
  { value: "AGRI_FISHERY_ARTS", label: "Agri-Fishery Arts (AFA)" },
  { value: "GENERAL", label: "General / Multi-Sector" },
];

const TRACK_TYPE_OPTIONS = [
  {
    value: "SPECIALIZATION",
    label: "Specialization",
    sublabel: "Grades 9 & 10",
    description: "Deep-dive elective for the secondary cycle. Feeds TLE sectioning.",
  },
  {
    value: "EXPLORATORY",
    label: "Exploratory",
    sublabel: "Grades 7 & 8",
    description: "Rotation-based exploration. Never assigned to G9/G10 workflows.",
  },
];

export function AddTleProgramModal({
  open,
  submitting,
  editProgramName,
  form,
  onOpenChange,
  onCancel,
  onSubmit,
  onChange,
}: AddTleProgramModalProps) {
  const isEdit = Boolean(editProgramName);
  const isExploratory = form.trackType === "EXPLORATORY";
  const categoryOptions = isExploratory ? EXPLORATORY_CATEGORIES : SPECIALIZATION_CATEGORIES;

  const handleTrackTypeChange = (next: string) => {
    // Clear category on track-type switch to prevent cross-type mismatches
    onChange({ ...form, trackType: next, category: "" });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="font-black uppercase text-base">
            {isEdit ? "Edit TLE Program" : "Add TLE Program"}
          </SheetTitle>
          <SheetDescription className="font-bold text-sm">
            {isEdit
              ? `Updating "${editProgramName}"`
              : "Create a global TLE curriculum entry for the catalog."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          {/* ── Step 1: Track Type (first — gates everything else) ── */}
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase">Track Type *</Label>
            <div className="grid grid-cols-2 gap-2">
              {TRACK_TYPE_OPTIONS.map((opt) => {
                const selected = form.trackType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isEdit}
                    onClick={() => handleTrackTypeChange(opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border-2 px-3 py-2.5 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-white hover:border-primary/40",
                      isEdit && "opacity-60 cursor-not-allowed",
                    )}>
                    <span className="text-xs font-black uppercase leading-none">
                      {opt.label}
                    </span>
                    <span className="text-[10px] font-bold text-primary leading-none mt-0.5">
                      {opt.sublabel}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground leading-tight mt-1">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {isEdit && (
              <p className="text-[10px] font-bold text-amber-600">
                Track Type cannot be changed after creation.
              </p>
            )}
          </div>

          {/* ── Step 2: Program Name ── */}
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase">Program Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder={
                isExploratory
                  ? "e.g., Exploratory ICT — Computing"
                  : "e.g., HE - Cookery"
              }
              className="font-bold"
            />
          </div>

          {/* ── Step 3: Category / Sector ── */}
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase">
              {isExploratory ? "Sector / General *" : "Category *"}
            </Label>
            {isExploratory && (
              <p className="text-[10px] font-bold text-muted-foreground">
                Exploratory subjects can span multiple sectors. Choose "General" if the module is cross-sectoral.
              </p>
            )}
            <Select
              value={form.category}
              onValueChange={(v) => onChange({ ...form, category: v })}>
              <SelectTrigger className="font-bold">
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem
                    key={c.value}
                    value={c.value}
                    className="font-bold text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Edit-only: Status ── */}
          {isEdit && (
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">Status</Label>
              <Select
                value={form.isActive ? "active" : "inactive"}
                onValueChange={(v) =>
                  onChange({ ...form, isActive: v === "active" })
                }>
                <SelectTrigger className="font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" className="font-bold text-xs">
                    Active
                  </SelectItem>
                  <SelectItem value="inactive" className="font-bold text-xs">
                    Inactive
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <SheetFooter className="border-t pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="font-bold uppercase">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              submitting || !form.name.trim() || !form.category || !form.trackType
            }
            className="font-black uppercase">
            {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Program"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
