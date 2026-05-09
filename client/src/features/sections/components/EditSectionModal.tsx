import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
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
import { Plus, Minus, Check } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";

interface Teacher {
  id: number;
  name: string;
  employeeId: string | null;
}

interface SectionItem {
  id: number;
  name: string;
  sortOrder: number;
  programType: string;
  isHomogeneous: boolean;
  maxCapacity: number;
  enrolledCount: number;
  advisingTeacher: { id: number; name: string } | null;
}

interface EditSectionModalProps {
  section: SectionItem | null;
  onOpenChange: (open: boolean) => void;
  schoolYearId: number;
  onSuccess: () => void;
}

const PROGRAM_TYPE_OPTIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE" },
  { value: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA" },
  { value: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS" },
  { value: "SPECIAL_PROGRAM_IN_JOURNALISM", label: "SPJ" },
  { value: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE", label: "SPFL" },
  {
    value: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    label: "SPTVE",
  },
];

const SECTION_ACRONYMS = new Set(["STE", "SPA", "SPS", "SPJ", "SPFL", "SPTVE"]);

function formatSectionLabel(rawSection: string | null | undefined): string {
  if (!rawSection) return "-";

  let sectionName = rawSection.trim();
  if (!sectionName) return "-";

  if (sectionName.includes("--")) {
    const segments = sectionName.split("--").filter(Boolean);
    sectionName = segments[segments.length - 1] || sectionName;
  }

  sectionName = sectionName
    .replace(/^G(?:RADE)?\s*\d+\s*[-_ ]*/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sectionName) return rawSection;

  return sectionName
    .split(/(\s|-)/)
    .map((part) => {
      if (part === " " || part === "-") return part;

      const upperPart = part.toUpperCase();
      if (SECTION_ACRONYMS.has(upperPart) || /^\d+[A-Z]*$/.test(upperPart)) {
        return upperPart;
      }

      if (upperPart.length <= 1) return upperPart;
      return `${upperPart.charAt(0)}${upperPart.slice(1).toLowerCase()}`;
    })
    .join("");
}

export function EditSectionModal({
  section,
  onOpenChange,
  schoolYearId,
  onSuccess,
}: EditSectionModalProps) {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [programType, setProgramType] = useState<string>("REGULAR");
  const [adviserId, setAdviserId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  useEffect(() => {
    const fetchAvailableTeachers = async () => {
      if (!section || !schoolYearId) return;
      setLoadingTeachers(true);
      try {
        const res = await api.get(
          `/sections/teachers?schoolYearId=${schoolYearId}&excludeSectionId=${section.id}`,
        );
        setAvailableTeachers(res.data.teachers);
      } catch (err) {
        console.error("Failed to fetch available teachers", err);
      } finally {
        setLoadingTeachers(false);
      }
    };

    if (section) {
      setName(section.name); // Use raw name to preserve prefixes
      setSortOrder(String(section.sortOrder ?? ""));
      setCapacity(section.maxCapacity.toString());
      setProgramType(section.programType ?? "REGULAR");
      setAdviserId(
        section.advisingTeacher
          ? section.advisingTeacher.id.toString()
          : "none",
      );
      void fetchAvailableTeachers();
    }
  }, [section, schoolYearId]);

  const handleEdit = async () => {
    if (!section || !name.trim()) return;
    setSubmitting(true);
    try {
      // Defensive update: Only send fields that have actually changed
      const payload: any = {};
      if (name.trim() !== section.name) payload.name = name.trim();
      if (parseInt(capacity) !== section.maxCapacity)
        payload.maxCapacity = parseInt(capacity);
      if (programType !== section.programType) payload.programType = programType;

      const currentAdviserId = section.advisingTeacher
        ? section.advisingTeacher.id.toString()
        : "none";
      if (adviserId !== currentAdviserId) {
        payload.advisingTeacherId =
          adviserId === "none" ? null : parseInt(adviserId);
      }

      const orderNum = parseInt(sortOrder, 10);
      if (!isNaN(orderNum) && orderNum !== section.sortOrder) {
        payload.sortOrder = orderNum;
      }

      // If nothing changed, just close
      if (Object.keys(payload).length === 0) {
        onOpenChange(false);
        return;
      }

      await api.put(`/sections/${section.id}`, payload);
      sileo.success({
        title: "Section details updated",
        description: `Saved changes for ${name.trim()}.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const apiError = err as { response?: { data?: { message?: string } } };
      sileo.error({
        title: "Section update failed",
        description:
          apiError.response?.data?.message ||
          "Your changes were not saved. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!section}
      onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-2">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold uppercase tracking-tight">
            Edit Section
          </DialogTitle>
          <p className="text-sm text-foreground font-bold">
            Update configuration for {formatSectionLabel(section?.name)} in the active school year.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section Identity Group */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase  text-primary flex items-center gap-2">
              Section Identity
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-foreground">
                  Section Name *
                </Label>
                <Input
                  placeholder="e.g. Rizal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 font-black uppercase tracking-wide border-primary/20 focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-foreground">
                  Program *
                </Label>
                <Select
                  value={programType}
                  onValueChange={setProgramType}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAM_TYPE_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Advisory & Capacity Group */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase  text-primary flex items-center gap-2">
              Advisory & Capacity
            </h3>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-foreground">
                Class Adviser
              </Label>
              <Select
                value={adviserId}
                onValueChange={setAdviserId}
                disabled={loadingTeachers}>
                <SelectTrigger className="h-10 font-bold uppercase">
                  <SelectValue placeholder={loadingTeachers ? "Loading..." : "Search name..."} />
                </SelectTrigger>
                <SelectContent className="uppercase font-bold">
                  <SelectItem value="none">Unassigned / To Follow</SelectItem>
                  {availableTeachers.map((t) => (
                    <SelectItem
                      key={t.id}
                      value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs font-medium text-foreground italic">
                - Showing only teachers with Class Adviser designation and
                without current advisory assignments.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-foreground">
                  Max Capacity *
                </Label>
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-r-none border-r-0"
                    onClick={() =>
                      setCapacity(
                        String(Math.max(1, (parseInt(capacity) || 0) - 1)),
                      )
                    }>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="h-10 w-full rounded-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-l-none border-l-0"
                    onClick={() =>
                      setCapacity(String((parseInt(capacity) || 0) + 1))
                    }>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleEdit}
            disabled={submitting || !name.trim()}
            className="font-black uppercase px-8">
            {submitting ? (
              "Saving..."
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
