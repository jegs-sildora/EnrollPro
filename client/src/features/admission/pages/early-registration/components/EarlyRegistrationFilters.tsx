import { useMemo } from "react";
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

const STAGE_QUICK_FILTERS = [
  { value: "ALL", label: "All Active" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "VERIFIED", label: "Verified" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "ELIGIBLE", label: "Eligible" },
  { value: "ASSESSMENT_SCHEDULED", label: "Exam Scheduled" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
];

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

  return (
    <CardHeader className="px-3 sm:px-6 pb-3">
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {STAGE_QUICK_FILTERS.map((stage) => (
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

