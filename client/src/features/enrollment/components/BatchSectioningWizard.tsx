import React, { useState, useEffect, useMemo, startTransition } from "react";
import {
  Loader2,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowLeft,
  X,
  Check,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { sileo } from "sileo";
import { useBlocker } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import api from "@/shared/api/axiosInstance";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { cn, formatScpType } from "@/shared/lib/utils";
import { useSectioningStore } from "@/store/sectioning.slice";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gradeLevelId: number;
  gradeLevelName: string;
  schoolYearId: number;
}

interface ProposedAssignment {
  applicationId: number;
  sectionId: number;
  sectionName: string;
  learnerName: string;
  lrn: string | null;
  gender: string | null;
  genAve: number | null;
  readingProfile: string | null;
  programType: string;
}

const resolveReadingProfileLabel = (level?: string | null): string => {
  if (!level) return "-";
  return level
    .toLowerCase()
    .split("_")
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(" ");
};

const TableSkeleton = () => (
  <div className="p-4 space-y-4">
    <div className="flex items-center space-x-4 p-4 border-b">
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[50px]" />
      <Skeleton className="h-4 w-[100px]" />
      <Skeleton className="h-4 w-[100px]" />
      <Skeleton className="h-4 w-[150px]" />
      <Skeleton className="h-4 flex-1" />
    </div>
    {[...Array(8)].map((_, i) => (
      <div key={i} className="flex items-center space-x-4 p-4 border-b opacity-50">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-8 w-[50px]" />
        <Skeleton className="h-8 w-[100px]" />
        <Skeleton className="h-8 w-[100px]" />
        <Skeleton className="h-8 w-[150px]" />
        <Skeleton className="h-8 flex-1" />
      </div>
    ))}
  </div>
);

const RosterRowComponent = React.forwardRef<
  HTMLTableRowElement,
  { 
    row: ProposedAssignment; 
    gradeSections: any[]; 
    updateAssignment: (appId: number, sectionId: string) => void;
    "data-index"?: number;
  }
>(({ row, gradeSections, updateAssignment, "data-index": dataIndex }, ref) => {
  // 3.4.1 Update local row state immediately for instant visual feedback.
  const [localSectionId, setLocalSectionId] = useState(String(row.sectionId));

  // Keep local state in sync with external changes (e.g. from filtering/sorting)
  useEffect(() => {
    setLocalSectionId(String(row.sectionId));
  }, [row.sectionId]);

  const handleValueChange = (val: string) => {
    setLocalSectionId(val);
    // 3.4.2 Wrap the Zustand updateLearnerSection call inside React.startTransition()
    startTransition(() => {
      updateAssignment(row.applicationId, val);
    });
  };

  return (
    <TableRow 
      ref={ref} 
      data-index={dataIndex}
      className="hover:bg-muted/30 transition-colors border-b last:border-0 group"
    >
      <TableCell className="py-3 px-4 text-left">
        <div className="flex flex-col">
          <span className="font-bold text-sm uppercase group-hover:text-primary transition-colors leading-tight">
            {row.learnerName}
          </span>
          <span className="text-[10px] font-black text-muted-foreground tracking-tighter uppercase">
            {row.lrn || "NO LRN"}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3 px-4 text-center">
        <span
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-[10px]",
            row.gender === "MALE"
              ? "bg-blue-100 text-blue-700"
              : "bg-pink-100 text-pink-700",
          )}>
          {row.gender === "MALE" ? "M" : "F"}
        </span>
      </TableCell>
      <TableCell className="py-3 px-4 text-center">
        <Badge
          variant="outline"
          className="text-[10px] font-black border-border bg-background uppercase tracking-tighter">
          {formatScpType(row.programType)}
        </Badge>
      </TableCell>
      <TableCell className="py-3 px-4 text-center  font-bold text-sm tabular-nums">
        {row.genAve?.toFixed(3) || "-"}
      </TableCell>
      <TableCell className="py-3 px-4 text-center">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-black uppercase tracking-tighter",
            row.readingProfile === "FRUSTRATION" ||
              row.readingProfile === "NON_READER"
              ? "border-destructive/30 text-destructive bg-destructive/5"
              : "border-emerald-300 text-emerald-700 bg-emerald-50",
          )}>
          {resolveReadingProfileLabel(row.readingProfile)}
        </Badge>
      </TableCell>
      <TableCell className="py-3 px-4 text-center">
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex justify-center">
          <Select
            value={localSectionId}
            onValueChange={handleValueChange}
            name={`section-assign-${row.applicationId}`}>
            <SelectTrigger
              id={`section-assign-${row.applicationId}`}
              aria-label={`Assign section for ${row.learnerName}`}
              className="h-8 w-44 text-xs font-bold border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gradeSections.map((s: any) => (
                <SelectItem
                  key={s.id}
                  value={String(s.id)}
                  className="font-bold text-xs uppercase">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TableCell>
    </TableRow>
  );
});
RosterRowComponent.displayName = "RosterRowComponent";

// 3.3 Wrap RosterRowComponent in React.memo with a custom comparison
const MemoizedRosterRow = React.memo(RosterRowComponent, (prev, next) => {
  return (
    prev.row.applicationId === next.row.applicationId &&
    prev.row.sectionId === next.row.sectionId &&
    prev.gradeSections.length === next.gradeSections.length
  );
});

type SortField = "learnerName" | "genAve" | "sectionName" | "gender";

interface SortConfig {
  field: SortField;
  direction: "asc" | "desc";
}

export function BatchSectioningWizard({
  isOpen,
  onClose,
  onSuccess,
  gradeLevelId,
  gradeLevelName,
  schoolYearId,
}: Props) {
  const {
    previewData,
    modifiedAssignments,
    isBatchPending,
    setBatchData,
    updateLearnerSection,
    clearBatch,
    gradeLevelId: storedGradeLevelId,
    schoolYearId: storedSchoolYearId,
  } = useSectioningStore();

  const [currentStep, setCurrentStep] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [gradeSections, setGradeSections] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [viewingReclassified, setViewingReclassified] = useState<{
    title: string;
    learners: ProposedAssignment[];
  } | null>(null);
  const [reclassifiedLimit, setReclassifiedLimit] = useState(50);

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "sectionName",
    direction: "asc",
  });

  const [isTableDeferred, setIsTableDeferred] = useState(true);
  const parentRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewData) {
      setIsTableDeferred(true);
      const timer = setTimeout(() => setIsTableDeferred(false), 100);
      return () => clearTimeout(timer);
    }
  }, [previewData]);

  // Route Guard / Blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isBatchPending && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (isOpen) {
      // Check if we already have matching data in store
      const hasMatchingData =
        isBatchPending &&
        storedGradeLevelId === gradeLevelId &&
        storedSchoolYearId === schoolYearId;

      if (!hasMatchingData) {
        void runPreview();
      }

      void fetchGradeSections();
      setSectionFilter("all");
      setCurrentStep(3); // Fix Stepper Bug: Ensure we are on Step 4 (index 3)
    } else if (!isBatchPending) {
      // Only reset if no batch is pending (otherwise we want to keep state for re-entry)
      setError(null);
      setSectionFilter("all");
      setSortConfig({ field: "sectionName", direction: "asc" });
    }
  }, [
    isOpen,
    gradeLevelId,
    schoolYearId,
    isBatchPending,
    storedGradeLevelId,
    storedSchoolYearId,
  ]);

  const toggleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field)
      return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-2 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-2 h-3.5 w-3.5" />
    );
  };

  const runPreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post("/sections/batch-sectioning/run", {
        gradeLevelId,
        schoolYearId,
      });
      // Store in global state
      setBatchData(
        res.data,
        res.data.proposedAssignments,
        gradeLevelId,
        schoolYearId,
      );
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to generate sectioning preview.",
      );
      toastApiError(err as never);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGradeSections = async () => {
    try {
      const res = await api.get(`/sections?gradeLevelId=${gradeLevelId}`);
      setGradeSections(res.data.sections || []);
    } catch (err) {
      console.error("Failed to fetch sections", err);
    }
  };

  const handleCommit = async () => {
    if (!previewData) return;

    setIsCommitting(true);
    try {
      await api.post("/sections/batch-sectioning/commit", {
        gradeLevelId,
        schoolYearId,
        assignments: modifiedAssignments,
      });

      sileo.success({
        title: "Batch Sectioning Success",
        description: `${modifiedAssignments.length} learners have been officially enrolled and assigned to sections.`,
      });

      clearBatch();
      onSuccess();
      onClose();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsCommitting(false);
    }
  };

  const updateAssignment = (applicationId: number, newSectionId: string) => {
    const section = gradeSections.find((s) => String(s.id) === newSectionId);
    if (!section) return;

    // Use updateLearnerSection from store (Phase 1.3)
    updateLearnerSection(applicationId, section.id, section.name);
  };

  const filteredAssignments = useMemo(() => {
    let list = [...modifiedAssignments];

    // Sort logic
    list.sort((a, b) => {
      const field = sortConfig.field;
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      // Special case for Gender - MALE (M) should be first by default in SF1
      if (field === "gender") {
        if (a.gender === b.gender)
          return a.learnerName.localeCompare(b.learnerName);
        return (a.gender === "MALE" ? -1 : 1) * direction;
      }

      const valA = a[field] ?? "";
      const valB = b[field] ?? "";

      if (typeof valA === "number" && typeof valB === "number") {
        if (valA !== valB) return (valA - valB) * direction;
      } else {
        const strA = String(valA);
        const strB = String(valB);
        if (strA !== strB) return strA.localeCompare(strB) * direction;
      }

      // Tie-breakers for consistent SF1 order if main field is same
      if (a.sectionName !== b.sectionName)
        return a.sectionName.localeCompare(b.sectionName);
      if (a.gender !== b.gender) return a.gender === "MALE" ? -1 : 1;
      return a.learnerName.localeCompare(b.learnerName);
    });

    if (sectionFilter === "all") return list;
    return list.filter((a) => a.sectionName === sectionFilter);
  }, [modifiedAssignments, sectionFilter, sortConfig]);

  const uniqueSections = useMemo(() => {
    if (!previewData) return [];
    // Combine original sections and any manually assigned sections
    const sections = new Set([
      ...previewData.proposedAssignments.map((a) => a.sectionName),
      ...modifiedAssignments.map((a) => a.sectionName),
    ]);
    return Array.from(sections).sort();
  }, [previewData, modifiedAssignments]);

  const virtualItemsData = useMemo(() => {
    const items: Array<
      | { type: "separator"; id: string; sectionName: string; gender: string }
      | { type: "row"; id: string; row: ProposedAssignment }
    > = [];
    let lastSection = "";
    let lastGender = "";

    filteredAssignments.forEach((row) => {
      const sectionChanged = row.sectionName !== lastSection;
      const genderChanged = row.gender !== lastGender;
      const showSeparator = sectionChanged || genderChanged;

      if (showSeparator) {
        lastSection = row.sectionName;
        lastGender = row.gender || "";
        items.push({
          type: "separator",
          id: `sep-${lastSection}-${lastGender}`,
          sectionName: lastSection,
          gender: lastGender,
        });
      }
      items.push({ type: "row", id: `row-${row.applicationId}`, row });
    });
    return items;
  }, [filteredAssignments]);

  const rowVirtualizer = useVirtualizer({
    count: virtualItemsData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      virtualItemsData[index].type === "separator" ? 45 : 73,
    overscan: 10,
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="absolute inset-0 z-[35] flex flex-col h-full bg-background animate-in fade-in duration-0 overflow-hidden text-foreground font-sans">
        {/* Top Header */}
        <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                HNHS Batch Sectioning Wizard
              </h2>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                LIS BOSY PRE-RUN •{" "}
                {previewData
                  ? `${previewData.gradeLevelName.toUpperCase()}`
                  : gradeLevelName.toUpperCase()}{" "}
                •{" "}
                {previewData
                  ? `S.Y. ${previewData.schoolYearLabel}`
                  : `SY ${schoolYearId}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 mr-4 border-r border-border pr-6">
              {[
                { id: 0, label: "SCP" },
                { id: 1, label: "Pilot" },
                { id: 2, label: "Draft" },
                { id: 3, label: "Review" },
              ].map((step) => (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold border transition-all",
                      currentStep > step.id
                        ? "bg-green-600 border-green-600 text-white"
                        : currentStep === step.id
                          ? "bg-primary border-primary text-primary-foreground shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                          : "border-input text-muted-foreground",
                    )}>
                    {currentStep > step.id ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      step.id + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase tracking-tighter",
                      currentStep === step.id
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}>
                    {step.label}
                  </span>
                  {step.id < 3 && (
                    <ChevronRight className="w-3 h-3 text-border mx-1" />
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:bg-destructive hover:text-destructive-foreground">
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto bg-muted/10">
          <div className="max-w-6xl mx-auto py-10 px-6 pb-32">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <div className="text-center">
                  <p className="text-lg font-bold">
                    Executing HNHS Hybrid Algorithm...
                  </p>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest font-black">
                    Sorting, Slicing, and Snake Drafting
                  </p>
                </div>
              </div>
            ) : error ? (
              <Card className="border-destructive/20 bg-destructive/5 max-w-2xl mx-auto">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                    <AlertTriangle className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-destructive">
                      Pre-check Failed
                    </h3>
                    <p className="text-destructive/80 mt-1 font-medium">
                      {error}
                    </p>
                  </div>
                  <Button onClick={onClose} variant="destructive">
                    Close Wizard
                  </Button>
                </CardContent>
              </Card>
            ) : previewData ? (
              <div className="space-y-8">
                {/* Algorithm Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {previewData.steps.map((step, idx) => (
                    <Card
                      key={idx}
                      className="border-2 transition-all border-border bg-card shadow-sm">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="p-2 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <Badge
                            variant="secondary"
                            className="font-black text-[10px]">
                            PHASE {idx + 1}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-black uppercase tracking-tight">
                          {step.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                          {step.description}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                            <span className="text-muted-foreground">
                              Status
                            </span>
                            <span className="text-green-600 flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" /> COMPLETED
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                            <span className="text-muted-foreground">
                              Assigned
                            </span>
                            <span className="text-foreground">
                              {step.stats?.assigned} Learners
                            </span>
                          </div>

                          {/* Key Threshold Metrics */}
                          {idx === 0 &&
                            step.stats?.steCutoffScore !== undefined &&
                            step.stats?.steCutoffScore !== null && (
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                <span className="text-muted-foreground">
                                  STE Cut-off Score
                                </span>
                                <span className="text-primary font-bold">
                                  {step.stats.steCutoffScore}
                                </span>
                              </div>
                            )}
                          {idx === 1 &&
                            step.stats?.pilotCutoffAve !== undefined &&
                            step.stats?.pilotCutoffAve !== null && (
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                <span className="text-muted-foreground">
                                  Pilot Cut-off (Gen Ave)
                                </span>
                                <span className="text-primary font-bold">
                                  {step.stats.pilotCutoffAve.toFixed(3)}
                                </span>
                              </div>
                            )}

                          {step.stats?.spillover > 0 && (
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-orange-600">
                              <span>Reclassified</span>
                              <div className="flex items-center gap-2">
                                <span>{step.stats?.spillover} Learners</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-[9px] font-black uppercase tracking-tighter hover:bg-orange-100 flex items-center gap-1"
                                  onClick={() => {
                                    setReclassifiedLimit(50);
                                    setViewingReclassified({
                                      title: step.title,
                                      learners:
                                        step.stats?.reclassifiedLearners || [],
                                    });
                                  }}>
                                  <ChevronRight className="w-2.5 h-2.5" /> View
                                </Button>
                              </div>
                            </div>
                          )}
                          {step.stats?.frustratedCount > 0 && (
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-destructive">
                              <span>Remedial Balance</span>
                              <span>
                                {step.stats?.frustratedCount} Profiles
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Data Preview Table */}
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <h3 className="text-lg font-bold uppercase tracking-tight text-foreground">
                        Proposed Roster Preview
                      </h3>
                      <Badge
                        variant="outline"
                        className="font-bold bg-card ml-2 text-xs">
                        {modifiedAssignments.length} Learners Total
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <Filter className="w-3.5 h-3.5" /> Filter Preview
                      </div>
                      <Select
                        value={sectionFilter}
                        onValueChange={setSectionFilter}>
                        <SelectTrigger className="w-[240px] h-10 font-bold bg-card border-2">
                          <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="all"
                            className="font-bold uppercase text-xs">
                            All Sections (Full Roster)
                          </SelectItem>
                          {uniqueSections.map((section) => (
                            <SelectItem
                              key={section}
                              value={section}
                              className="font-medium">
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border-2 shadow-xl overflow-hidden rounded-xl bg-card min-h-[600px]">
                    {isTableDeferred ? (
                      <TableSkeleton />
                    ) : (
                      <div
                        ref={parentRef}
                        className="overflow-auto relative"
                        style={{ maxHeight: "65vh" }}>
                        <Table>
                          <TableHeader className="bg-primary hover:bg-primary sticky top-0 z-20 shadow-sm">
                            <TableRow className="hover:bg-transparent border-none">
                              <TableHead className="text-primary-foreground h-12 px-4 text-left">
                                <button
                                  onClick={() => toggleSort("learnerName")}
                                  className="flex items-center font-black text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity">
                                  Learner {getSortIcon("learnerName")}
                                </button>
                              </TableHead>
                              <TableHead className="text-primary-foreground h-12 px-4 text-center">
                                <button
                                  onClick={() => toggleSort("gender")}
                                  className="flex items-center justify-center w-full font-black text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity">
                                  Gender {getSortIcon("gender")}
                                </button>
                              </TableHead>
                              <TableHead className="text-primary-foreground font-black text-[10px] uppercase tracking-wider h-12 px-4 text-center">
                                Program
                              </TableHead>
                              <TableHead className="text-primary-foreground h-12 px-4 text-center">
                                <button
                                  onClick={() => toggleSort("genAve")}
                                  className="flex items-center justify-center w-full font-black text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity">
                                  Gen Ave {getSortIcon("genAve")}
                                </button>
                              </TableHead>
                              <TableHead className="text-primary-foreground font-black text-[10px] uppercase tracking-wider h-12 px-4 text-center">
                                Reading
                              </TableHead>
                              <TableHead className="text-primary-foreground h-12 px-4 text-center">
                                <button
                                  onClick={() => toggleSort("sectionName")}
                                  className="flex items-center justify-center w-full font-black text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity">
                                  Assigned Section {getSortIcon("sectionName")}
                                </button>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rowVirtualizer.getVirtualItems().length > 0 && (
                              <TableRow
                                style={{
                                  height: `${rowVirtualizer.getVirtualItems()[0]?.start || 0}px`,
                                }}
                                className="hover:bg-transparent border-none">
                                <TableCell colSpan={6} className="p-0" />
                              </TableRow>
                            )}

                            {rowVirtualizer
                              .getVirtualItems()
                              .map((virtualRow) => {
                                const item = virtualItemsData[virtualRow.index];
                                if (item.type === "separator") {
                                  return (
                                    <TableRow
                                      key={virtualRow.key}
                                      ref={rowVirtualizer.measureElement}
                                      data-index={virtualRow.index}
                                      className="bg-muted/50 hover:bg-muted/50 border-y border-border/60">
                                      <TableCell
                                        colSpan={6}
                                        className="py-2.5 px-4">
                                        <div className="flex items-center gap-3">
                                          <div className="h-[1px] flex-1 bg-border/80" />
                                          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground whitespace-nowrap flex items-center gap-2">
                                            <div
                                              className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                item.gender === "MALE"
                                                  ? "bg-blue-400"
                                                  : "bg-pink-400",
                                              )}
                                            />
                                            {item.sectionName} (
                                            {item.gender === "MALE"
                                              ? "MALE"
                                              : "FEMALE"}
                                            )
                                          </span>
                                          <div className="h-[1px] flex-1 bg-border/80" />
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                return (
                                  <MemoizedRosterRow
                                    key={virtualRow.key}
                                    ref={rowVirtualizer.measureElement}
                                    data-index={virtualRow.index}
                                    row={item.row}
                                    gradeSections={gradeSections}
                                    updateAssignment={updateAssignment}
                                  />
                                );
                              })}

                            {rowVirtualizer.getVirtualItems().length > 0 && (
                              <TableRow
                                style={{
                                  height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end || 0)}px`,
                                }}
                                className="hover:bg-transparent border-none">
                                <TableCell colSpan={6} className="p-0" />
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="absolute bottom-0 left-0 right-0 z-30 bg-card border-t-4 border-primary p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-0">
                  <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="max-w-md">
                      <p className="font-black text-primary flex items-center gap-2 uppercase tracking-tight text-sm">
                        <AlertTriangle className="h-5 w-5 fill-primary text-primary-foreground" />{" "}
                        Final Commitment Required
                      </p>
                      <p className="text-[11px] text-muted-foreground font-semibold mt-1">
                        Clicking the button will write all assignments to the
                        database, mark learners as
                        <span className="font-black text-green-700 mx-1 uppercase">
                          Officially Enrolled
                        </span>
                        , and issue unique portal PINs. This action is audited
                        and final.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          clearBatch();
                          onClose();
                        }}
                        className="h-12 px-8 font-black uppercase text-xs tracking-widest border-2">
                        Discard Preview
                      </Button>
                      <Button
                        onClick={handleCommit}
                        className="h-12 px-10 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                        disabled={isCommitting}>
                        {isCommitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Committing...
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-5 w-5" />
                            Lock & Finalize Batch
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Route Guard / Blocker Modal */}
      <Dialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}>
        <DialogContent className="sm:max-w-xl border-2">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold">
                Unsaved Batch Roster
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm font-medium leading-relaxed">
              You are about to leave the Sectioning Wizard. The generated
              rosters for S.Y. 2026-2027 have not been finalized.
              <br />
              <br />
              Don't worry, your progress is paused. You can safely return to
              this screen to resume auditing, or discard the batch run entirely
              to start over.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button 
              variant="ghost" 
              onClick={() => {
                clearBatch();
                onClose(); // Force overlay to close
                blocker.proceed?.();
              }}
              className="flex-1 font-bold text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              Discard Batch & Leave
            </Button>
            <Button 
              variant="default" 
              onClick={() => {
                onClose(); // Force overlay to close
                blocker.proceed?.();
              }}
              className="flex-1 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-md"
            >
              Keep Data & Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reclassified Learners Dialog */}
      <Dialog
        open={!!viewingReclassified}
        onOpenChange={(open) => {
          if (!open) setViewingReclassified(null);
        }}>
        <DialogContent className="sm:max-w-2xl border-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tight">
              Reclassified Learners — {viewingReclassified?.title}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium">
              These learners did not meet the threshold for this phase and have
              been moved to the next available pool for re-assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto border rounded-lg">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead className="font-black text-[10px] uppercase">
                    Learner Name
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-center">
                    Gender
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-center">
                    Gen Ave
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-center">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewingReclassified?.learners
                  .slice(0, reclassifiedLimit)
                  .map((learner) => (
                    <TableRow key={learner.applicationId}>
                      <TableCell className="font-bold text-sm uppercase">
                        {learner.learnerName}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold">
                          {learner.gender === "MALE" ? "M" : "F"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center  font-bold text-sm">
                        {learner.genAve?.toFixed(3) || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-black uppercase tracking-tighter border-orange-200 text-orange-700 bg-orange-50">
                          RECLASSIFIED
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {viewingReclassified &&
              viewingReclassified.learners.length > reclassifiedLimit && (
                <div className="p-4 border-t bg-muted/20 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReclassifiedLimit((prev) => prev + 50)}
                    className="font-black text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10">
                    Load Next 50 Learners (
                    {viewingReclassified.learners.length - reclassifiedLimit}{" "}
                    remaining)
                  </Button>
                </div>
              )}
          </div>
          <DialogFooter>
            <div className="flex w-full items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                Showing{" "}
                {Math.min(
                  reclassifiedLimit,
                  viewingReclassified?.learners.length || 0,
                )}{" "}
                of {viewingReclassified?.learners.length || 0} entries
              </p>
              <Button
                variant="outline"
                onClick={() => setViewingReclassified(null)}
                className="font-bold text-xs uppercase tracking-widest">
                Close Audit List
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
