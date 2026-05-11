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
import { 
  DEFAULT_MAX_CAPACITY_REGULAR, 
  DEFAULT_MAX_CAPACITY_SCP 
} from "@enrollpro/shared/constants";

interface Teacher {
  id: number;
  name: string;
  employeeId: string | null;
}

interface CreateSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gradeLevelId: number;
  gradeLevelName: string;
  schoolYearId: number;
  teachers: Teacher[];
  onSuccess: () => void;
}

const SCP_LABELS: Record<string, string> = {
  REGULAR: "Regular (BEC)",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
};

interface ScpConfig {
  scpType: string;
  isOffered: boolean;
}

export function CreateSectionModal({
  open,
  onOpenChange,
  gradeLevelId,
  gradeLevelName,
  schoolYearId,
  teachers,
  onSuccess,
}: CreateSectionModalProps) {
  const [name, setName] = useState("");
  const [programType, setProgramType] = useState("REGULAR");
  const [adviserId, setAdviserId] = useState<string>("none");
  const [capacity, setCapacity] = useState(DEFAULT_MAX_CAPACITY_REGULAR);
  const [adding, setAdding] = useState(false);
  const [programOptions, setProgramOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "REGULAR", label: "Regular (BEC)" }]);

  // Reset form and fetch offered SCPs when modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setProgramType("REGULAR");
      setAdviserId("none");
      setCapacity(DEFAULT_MAX_CAPACITY_REGULAR);

      const fetchOfferedScps = async () => {
        try {
          const res = await api.get<{ scpProgramConfigs: ScpConfig[] }>(
            `/curriculum/${schoolYearId}/scp-config`,
          );
          const configs = res.data.scpProgramConfigs || [];
          const offeredScps = configs
            .filter((cfg) => cfg.isOffered)
            .map((cfg) => ({
              value: cfg.scpType,
              label: SCP_LABELS[cfg.scpType] || cfg.scpType,
            }));

          setProgramOptions([
            { value: "REGULAR", label: "Regular (BEC)" },
            ...offeredScps,
          ]);
        } catch (err) {
          console.error("[fetchOfferedScps Error]", err);
        }
      };

      if (schoolYearId) {
        fetchOfferedScps();
      }
    }
  }, [open, schoolYearId]);

  const handleProgramChange = (value: string) => {
    setProgramType(value);
    setCapacity(
      value === "REGULAR" 
        ? DEFAULT_MAX_CAPACITY_REGULAR 
        : DEFAULT_MAX_CAPACITY_SCP
    );
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await api.post("/sections", {
        name: name.trim(),
        gradeLevelId,
        schoolYearId,
        programType,
        advisingTeacherId: adviserId === "none" ? null : parseInt(adviserId),
        maxCapacity: capacity,
      });
      sileo.success({
        title: "Section created",
        description: `${name.trim()} has been added to ${gradeLevelName}.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const apiError = err as { response?: { data?: { message?: string } } };
      sileo.error({
        title: "Creation failed",
        description:
          apiError.response?.data?.message || "Failed to create section",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-2">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold uppercase">
            Add New Section
          </DialogTitle>
          <p className="text-sm text-foreground font-bold">
            Create a new class roster for {gradeLevelName} in the active school
            year.
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
                  Grade Level
                </Label>
                <Input
                  value={gradeLevelName}
                  readOnly={true}
                  className="h-10 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-foreground">
                  Program *
                </Label>
                <Select
                  value={programType}
                  onValueChange={handleProgramChange}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-bold">
                    {programOptions.map((opt) => (
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

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase  text-foreground">
                Section Name *
              </Label>
              <Input
                placeholder="e.g. Rizal, Mabini, Aristotle"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 font-black uppercase text-base border-primary/20 focus:border-primary/50 placeholder:text-foreground/50"
              />
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Advisory & Capacity Group */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase  text-primary flex items-center gap-2">
              Advisory & Capacity
            </h3>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase  text-foreground">
                Class Adviser *
              </Label>
              <Select
                value={adviserId}
                onValueChange={setAdviserId}>
                <SelectTrigger className="h-10 font-bold">
                  <SelectValue 
                    placeholder="Search name..." 
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
              <p className="text-xs font-medium text-foreground italic">
                - Showing only teachers with Class Adviser designation and
                without current advisory assignments.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase  text-foreground">
                  Max Capacity *
                </Label>
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-r-none border-r-0"
                    onClick={() => setCapacity(Math.max(1, capacity - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                    className="h-10 w-full rounded-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-l-none border-l-0"
                    onClick={() => setCapacity(capacity + 1)}>
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
            disabled={adding}
            className="font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={adding || !name.trim()}
            className="font-black uppercase  px-8">
            {adding ? (
              "Saving..."
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> Save Section
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
