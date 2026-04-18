import { useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { CardHeader } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { SCP_LABELS } from "@/shared/lib/utils";
import { useScpConfigs } from "@/features/admission/hooks/useScpConfigs";
import { REGISTRATION_STAGE_QUICK_FILTERS } from "@/features/admission/constants/registrationWorkflow";

const REGULAR_TRACK_HIDDEN_STAGE_VALUES = new Set([
  "EXAM_SCHEDULED",
  "ASSESSMENT_TAKEN",
  "INTERVIEW_SCHEDULED",
]);

const PHASE_TWO_HIDDEN_STAGE_VALUES = new Set([
  "TEMPORARILY_ENROLLED",
  "ENROLLED",
]);

interface FiltersProps {
  status: string;
  setStatus: (status: string) => void;
  search: string;
  setSearch: (search: string) => void;
  type: string;
  setType: (type: string) => void;
  setPage: (page: number) => void;
  stageCounts: Record<string, number>;
}

export function EarlyRegistrationFilters({
  status,
  setStatus,
  search,
  setSearch,
  type,
  setType,
  setPage,
  stageCounts,
}: FiltersProps) {
  const { configs } = useScpConfigs();

  const applicantTypes = useMemo(() => {
    const types = [
      { value: "ALL", label: "All Curriculum Programs" },
      { value: "REGULAR", label: "Regular" },
    ];

    // Add offered SCPs from the database
    configs.forEach((cfg) => {
      // Avoid duplicate REGULAR if it's somehow in configs
      if (cfg.scpType !== "REGULAR") {
        types.push({
          value: cfg.scpType,
          label: SCP_LABELS[cfg.scpType] || cfg.scpType,
        });
      }
    });

    return types;
  }, [configs]);

  const stageQuickFilters = useMemo(() => {
    const phaseOneFilters = REGISTRATION_STAGE_QUICK_FILTERS.filter(
      (stage) => !PHASE_TWO_HIDDEN_STAGE_VALUES.has(stage.value),
    );

    if (type !== "REGULAR") {
      return phaseOneFilters;
    }

    return phaseOneFilters.filter(
      (stage) => !REGULAR_TRACK_HIDDEN_STAGE_VALUES.has(stage.value),
    );
  }, [type]);

  const visibleStageQuickFilters = useMemo(
    () =>
      stageQuickFilters.filter(
        (stage) =>
          stage.value === "ALL" ||
          stage.value === status ||
          (stageCounts[stage.value] ?? 0) > 0,
      ),
    [stageQuickFilters, stageCounts, status],
  );

  useEffect(() => {
    const isCurrentStatusVisible = stageQuickFilters.some(
      (stage) => stage.value === status,
    );

    if (!isCurrentStatusVisible) {
      setStatus("ALL");
      setPage(1);
    }
  }, [status, stageQuickFilters, setStatus, setPage]);

  return (
    <CardHeader className="px-3 sm:px-6 pb-3">
      <div className="space-y-3">
        <div className="relative -mx-1 px-1">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 pr-8">
            {visibleStageQuickFilters.map((stage) => (
              <Button
                key={stage.value}
                type="button"
                size="sm"
                variant={status === stage.value ? "default" : "outline"}
                className="h-9 sm:h-8 text-xs font-bold whitespace-nowrap shrink-0"
                onClick={() => {
                  setStatus(stage.value);
                  setPage(1);
                }}>
                {stage.label}
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 px-1.5 text-[10px] shrink-0">
                  {stageCounts[stage.value] ?? 0}
                </Badge>
              </Button>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[hsl(var(--card))] to-transparent" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
        <div className="flex-1 space-y-2 w-full">
          <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
            Search Applicant
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
            <Input
              placeholder="LRN, First Name, Last Name..."
              className="pl-9 h-10 text-sm font-bold"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:flex gap-3 md:gap-4 w-full md:w-auto">
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold ">
              Curriculum Program
            </Label>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);

                if (
                  value === "REGULAR" &&
                  REGULAR_TRACK_HIDDEN_STAGE_VALUES.has(status)
                ) {
                  setStatus("ALL");
                }

                setPage(1);
              }}>
              <SelectTrigger className="h-10 w-full md:w-72 lg:w-80 text-sm font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {applicantTypes.map((t) => (
                  <SelectItem
                    key={t.value}
                    value={t.value}
                    className="text-sm font-bold">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <Button
            variant="outline"
            className="h-10 px-3 text-sm font-bold w-full md:w-auto"
            onClick={() => {
              setSearch("");
              setStatus("ALL");
              setType("ALL");
              setPage(1);
            }}>
            Reset
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}
