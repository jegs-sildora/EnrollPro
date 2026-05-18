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

const TLE_CATEGORIES = [
  { value: "HOME_ECONOMICS", label: "Home Economics (HE)" },
  { value: "ICT", label: "Information & Communications Technology (ICT)" },
  { value: "INDUSTRIAL_ARTS", label: "Industrial Arts (IA)" },
  { value: "AGRI_FISHERY_ARTS", label: "Agri-Fishery Arts (AFA)" },
];

const TLE_TRACK_TYPES = [
  { value: "EXPLORATORY", label: "Exploratory (G7-8)" },
  { value: "SPECIALIZATION", label: "Specialization (G9-10)" },
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
              ? `Updating \"${editProgramName}\"`
              : "Create a global TLE curriculum program template."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase">Program Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="e.g., HE - Cookery"
              className="font-bold"
            />
          </div>

          {/* programCode removed — not used anymore */}

          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase">Category *</Label>
            <Select
              value={form.category}
              onValueChange={(v) => onChange({ ...form, category: v })}>
              <SelectTrigger className="font-bold">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TLE_CATEGORIES.map((c) => (
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

          <div className="space-y-2">
            <Label className="font-bold text-xs uppercase">Track Type *</Label>
            <Select
              value={form.trackType}
              onValueChange={(v) => onChange({ ...form, trackType: v })}>
              <SelectTrigger className="font-bold">
                <SelectValue placeholder="Select track type" />
              </SelectTrigger>
              <SelectContent>
                {TLE_TRACK_TYPES.map((t) => (
                  <SelectItem
                    key={t.value}
                    value={t.value}
                    className="font-bold text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  <SelectItem
                    value="active"
                    className="font-bold text-xs">
                    Active
                  </SelectItem>
                  <SelectItem
                    value="inactive"
                    className="font-bold text-xs">
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
