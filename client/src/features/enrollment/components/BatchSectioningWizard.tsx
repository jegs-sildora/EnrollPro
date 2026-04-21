import React, { useState, useEffect, useMemo } from "react";
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
  ArrowUpDown
} from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/shared/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/shared/ui/select";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { cn, formatScpType } from "@/shared/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gradeLevelId: number;
  gradeLevelName: string;
  schoolYearId: number;
}

interface Step {
  title: string;
  description: string;
  stats?: Record<string, any>;
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

interface SectioningPreview {
  schoolYearLabel: string;
  gradeLevelName: string;
  steps: Step[];
  proposedAssignments: ProposedAssignment[];
}

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
  schoolYearId 
}: Props) {
  const [currentStep, setCurrentStep] = useState<number>(3); // Default to final review step
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewData, setPreviewData] = useState<SectioningPreview | null>(null);
  const [modifiedAssignments, setModifiedAssignments] = useState<ProposedAssignment[]>([]);
  const [gradeSections, setGradeSections] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "sectionName",
    direction: "asc"
  });

  useEffect(() => {
    if (isOpen) {
      void runPreview();
      void fetchGradeSections();
      setSectionFilter("all");
    } else {
      setCurrentStep(0);
      setPreviewData(null);
      setModifiedAssignments([]);
      setError(null);
      setSectionFilter("all");
      setSortConfig({ field: "sectionName", direction: "asc" });
    }
  }, [isOpen]);

  const toggleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-3.5 w-3.5" /> : <ArrowDown className="ml-2 h-3.5 w-3.5" />;
  };

  const runPreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post("/sections/batch-sectioning/run", {
        gradeLevelId,
        schoolYearId
      });
      setPreviewData(res.data);
      setModifiedAssignments(res.data.proposedAssignments);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to generate sectioning preview.");
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
        assignments: modifiedAssignments
      });

      sileo.success({
        title: "Batch Sectioning Success",
        description: `${modifiedAssignments.length} learners have been officially enrolled and assigned to sections.`
      });

      onSuccess();
      onClose();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsCommitting(false);
    }
  };

  const updateAssignment = (applicationId: number, newSectionId: string) => {
    const section = gradeSections.find(s => String(s.id) === newSectionId);
    if (!section) return;

    setModifiedAssignments(prev => prev.map(a => 
      a.applicationId === applicationId 
        ? { ...a, sectionId: section.id, sectionName: section.name } 
        : a
    ));
  };

  const filteredAssignments = useMemo(() => {
    let list = [...modifiedAssignments];
    
    // Sort logic
    list.sort((a, b) => {
      const field = sortConfig.field;
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      // Special case for Gender - MALE (M) should be first by default in SF1
      if (field === "gender") {
        if (a.gender === b.gender) return a.learnerName.localeCompare(b.learnerName);
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
      if (a.sectionName !== b.sectionName) return a.sectionName.localeCompare(b.sectionName);
      if (a.gender !== b.gender) return a.gender === "MALE" ? -1 : 1;
      return a.learnerName.localeCompare(b.learnerName);
    });

    if (sectionFilter === "all") return list;
    return list.filter(a => a.sectionName === sectionFilter);
  }, [modifiedAssignments, sectionFilter, sortConfig]);

  const uniqueSections = useMemo(() => {
    if (!previewData) return [];
    // Combine original sections and any manually assigned sections
    const sections = new Set([
      ...previewData.proposedAssignments.map(a => a.sectionName),
      ...modifiedAssignments.map(a => a.sectionName)
    ]);
    return Array.from(sections).sort();
  }, [previewData, modifiedAssignments]);

  const resolveReadingProfileLabel = (level?: string | null): string => {
    if (!level) return "-";
    return level.toLowerCase().split("_").map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col h-full bg-background animate-in fade-in duration-200 overflow-hidden text-foreground font-sans">
      {/* Top Header */}
      <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">HNHS Batch Sectioning Wizard</h2>
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
              LIS BOSY PRE-RUN • {previewData ? `${previewData.gradeLevelName.toUpperCase()}` : gradeLevelName.toUpperCase()} • {previewData ? `S.Y. ${previewData.schoolYearLabel}` : `SY ${schoolYearId}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 mr-4 border-r border-border pr-6">
            {[
              { id: 0, label: "SCP" },
              { id: 1, label: "Pilot" },
              { id: 2, label: "Draft" },
              { id: 3, label: "Review" }
            ].map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                <div 
                  className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold border transition-all",
                    currentStep > step.id ? "bg-green-600 border-green-600 text-white" : 
                    currentStep === step.id ? "bg-primary border-primary text-primary-foreground shadow-[0_0_8px_rgba(var(--primary),0.5)]" : 
                    "border-input text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? <Check className="w-3 h-3" /> : step.id + 1}
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-tighter",
                  currentStep === step.id ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
                {step.id < 3 && <ChevronRight className="w-3 h-3 text-border mx-1" />}
              </div>
            ))}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
          >
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
                <p className="text-lg font-bold">Executing HNHS Hybrid Algorithm...</p>
                <p className="text-sm text-muted-foreground uppercase tracking-widest font-black">Sorting, Slicing, and Snake Drafting</p>
              </div>
            </div>
          ) : error ? (
            <Card className="border-destructive/20 bg-destructive/5 max-w-2xl mx-auto">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-destructive">Pre-check Failed</h3>
                  <p className="text-destructive/80 mt-1 font-medium">{error}</p>
                </div>
                <Button onClick={onClose} variant="destructive">Close Wizard</Button>
              </CardContent>
            </Card>
          ) : previewData ? (
            <div className="space-y-8">
              {/* Algorithm Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {previewData.steps.map((step, idx) => (
                  <Card key={idx} className="border-2 transition-all border-border bg-card shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <Badge variant="secondary" className="font-black text-[10px]">PHASE {idx + 1}</Badge>
                      </div>
                      <CardTitle className="text-base font-black uppercase tracking-tight">{step.title}</CardTitle>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">{step.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                          <span className="text-muted-foreground">Status</span>
                          <span className="text-green-600 flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" /> COMPLETED
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                          <span className="text-muted-foreground">Assigned</span>
                          <span className="text-foreground">{step.stats?.assigned} Learners</span>
                        </div>
                        {step.stats?.spillover > 0 && (
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-orange-600">
                            <span>Reclassified</span>
                            <span>{step.stats?.spillover} Learners</span>
                          </div>
                        )}
                        {step.stats?.frustratedCount > 0 && (
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-destructive">
                            <span>Remedial Balance</span>
                            <span>{step.stats?.frustratedCount} Profiles</span>
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
                    <h3 className="text-lg font-bold uppercase tracking-tight text-foreground">Proposed Roster Preview</h3>
                    <Badge variant="outline" className="font-bold bg-card ml-2 text-xs">
                      {previewData.proposedAssignments.length} Learners Total
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <Filter className="w-3.5 h-3.5" /> Filter Preview
                    </div>
                    <Select value={sectionFilter} onValueChange={setSectionFilter}>
                      <SelectTrigger className="w-[240px] h-10 font-bold bg-card border-2">
                        <SelectValue placeholder="All Sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="font-bold uppercase text-xs">All Sections (Full Roster)</SelectItem>
                        {uniqueSections.map(section => (
                          <SelectItem key={section} value={section} className="font-medium">
                            {section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="border-2 shadow-xl overflow-hidden rounded-xl bg-card">
                  <div className="overflow-auto" style={{ maxHeight: "65vh" }}>
                    <Table>
                      <TableHeader className="bg-primary hover:bg-primary sticky top-0 z-20 shadow-sm">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="text-primary-foreground h-12 px-4 text-left">
                            <button 
                              onClick={() => toggleSort("learnerName")}
                              className="flex items-center font-black text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity"
                            >
                              Learner {getSortIcon("learnerName")}
                            </button>
                          </TableHead>
                          <TableHead className="text-primary-foreground h-12 px-4 text-center">
                            <button 
                              onClick={() => toggleSort("gender")}
                              className="flex items-center justify-center w-full font-black text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity"
                            >
                              Gender {getSortIcon("gender")}
                            </button>
                          </TableHead>
                          <TableHead className="text-primary-foreground font-black text-[10px] uppercase tracking-wider h-12 px-4 text-center">Program</TableHead>
                          <TableHead className="text-primary-foreground h-12 px-4 text-center">
                            <button 
                              onClick={() => toggleSort("genAve")}
                              className="flex items-center justify-center w-full font-black text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity"
                            >
                              Gen Ave {getSortIcon("genAve")}
                            </button>
                          </TableHead>
                          <TableHead className="text-primary-foreground font-black text-[10px] uppercase tracking-wider h-12 px-4 text-center">Reading</TableHead>
                          <TableHead className="text-primary-foreground h-12 px-4 text-center">
                            <button 
                              onClick={() => toggleSort("sectionName")}
                              className="flex items-center justify-center w-full font-black text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity"
                            >
                              Assigned Section {getSortIcon("sectionName")}
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          let lastSection = "";
                          let lastGender = "";
                          
                          return filteredAssignments.map((row) => {
                            const sectionChanged = row.sectionName !== lastSection;
                            const genderChanged = row.gender !== lastGender;
                            const showSeparator = sectionChanged || genderChanged;
                            
                            if (showSeparator) {
                              lastSection = row.sectionName;
                              lastGender = row.gender || "";
                            }
                            
                            return (
                              <React.Fragment key={row.applicationId}>
                                {showSeparator && (
                                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-y border-border/60">
                                    <TableCell colSpan={6} className="py-2.5 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className="h-[1px] flex-1 bg-border/80" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground whitespace-nowrap flex items-center gap-2">
                                          <div className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            row.gender === "MALE" ? "bg-blue-400" : "bg-pink-400"
                                          )} />
                                          {row.sectionName} ({row.gender === "MALE" ? "MALE" : "FEMALE"})
                                        </span>
                                        <div className="h-[1px] flex-1 bg-border/80" />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                                <TableRow className="hover:bg-muted/30 transition-colors border-b last:border-0 group">
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
                                    <span className={cn(
                                      "inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-[10px]",
                                      row.gender === "MALE" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                                    )}>
                                      {row.gender === "MALE" ? "M" : "F"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3 px-4 text-center">
                                    <Badge variant="outline" className="text-[10px] font-black border-border bg-background uppercase tracking-tighter">
                                      {formatScpType(row.programType)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-3 px-4 text-center font-mono font-bold text-sm tabular-nums">
                                    {row.genAve?.toFixed(3) || "-"}
                                  </TableCell>
                                  <TableCell className="py-3 px-4 text-center">
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-[10px] font-black uppercase tracking-tighter",
                                        row.readingProfile === "FRUSTRATION" || row.readingProfile === "NON_READER"
                                          ? "border-destructive/30 text-destructive bg-destructive/5" 
                                          : "border-emerald-300 text-emerald-700 bg-emerald-50"
                                      )}
                                    >
                                      {resolveReadingProfileLabel(row.readingProfile)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-3 px-4 text-center">
                                    <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
                                      <Select 
                                        value={String(row.sectionId)} 
                                        onValueChange={(val) => updateAssignment(row.applicationId, val)}
                                      >
                                        <SelectTrigger className="h-8 w-44 text-xs font-bold border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {gradeSections.map(s => (
                                            <SelectItem key={s.id} value={String(s.id)} className="font-bold text-xs uppercase">
                                              {s.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t-4 border-primary p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                  <div className="max-w-md">
                    <p className="font-black text-primary flex items-center gap-2 uppercase tracking-tight text-sm">
                      <AlertTriangle className="h-5 w-5 fill-primary text-primary-foreground" /> Final Commitment Required
                    </p>
                    <p className="text-[11px] text-muted-foreground font-semibold mt-1">
                      Clicking the button will write all assignments to the database, mark learners as 
                      <span className="font-black text-green-700 mx-1 uppercase">Officially Enrolled</span>, 
                      and issue unique portal PINs. This action is audited and final.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <Button variant="outline" onClick={onClose} className="h-12 px-8 font-black uppercase text-xs tracking-widest border-2">
                      Discard Preview
                    </Button>
                    <Button 
                      onClick={handleCommit} 
                      className="h-12 px-10 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                      disabled={isCommitting}
                    >
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
  );
}
