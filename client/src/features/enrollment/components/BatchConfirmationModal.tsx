import { useState, useEffect, useRef } from "react";
import {
  Search,
  CheckCircle2,
  UserCheck,
  Loader2,
  Upload,
  XCircle,
  FileSpreadsheet,
  Keyboard,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/utils";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";
import Papa from "papaparse";
import { motion } from "motion/react";

interface StagedLearner {
  id: number;
  lrn: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  currentGradeLevel: string;
  targetGradeLevelId: number;
  guardianName: string;
  contactNumber: string;
  isEnrolling: boolean;
  status: "OK" | "NOT_FOUND" | "MISMATCH";
}

interface BatchConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  activeSchoolYearId: number | null;
}

export function BatchConfirmationModal({
  open,
  onOpenChange,
  onSuccess,
  activeSchoolYearId,
}: BatchConfirmationModalProps) {
  const [activeTab, setActiveTab] = useState("scan");
  const [lrnInput, setLrnInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stagingList, setStagingList] = useState<StagedLearner[]>([]);

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLrnInput("");
      setStagingList([]);
      setActiveTab("scan");
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleLrnLookup = async (lrn: string) => {
    if (lrn.length !== 12) return;
    if (stagingList.some((s) => s.lrn === lrn)) {
      sileo.warning({
        title: "Duplicate LRN",
        description: "This student is already in the staging queue.",
      });
      setLrnInput("");
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/learner/lookup?lrn=${lrn}`);
      const data = res.data;

      // Logic for target grade (promotion)
      const prevNumMatch = data.previousGradeLevel.match(/\d+/);
      const prevNum = prevNumMatch ? parseInt(prevNumMatch[0]) : 7;
      const targetNum = prevNum + 1;

      const glRes = await api.get("/school-years/grade-levels", {
        params: { schoolYearId: activeSchoolYearId },
      });
      const gradeLevels = glRes.data.gradeLevels || [];
      const targetGradeLevel = gradeLevels.find(
        (gl: { name: string; id: number }) => {
          const numMatch = gl.name.match(/\d+/);
          return numMatch && parseInt(numMatch[0]) === targetNum;
        },
      );

      if (!targetGradeLevel) {
        throw new Error(`Target Grade ${targetNum} not found in active SY.`);
      }

      const newEntry: StagedLearner = {
        id: data.id,
        lrn: data.lrn,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        currentGradeLevel: data.previousGradeLevel,
        targetGradeLevelId: targetGradeLevel.id,
        guardianName: "", // Registrar will fill or edit
        contactNumber: "",
        isEnrolling: true,
        status: "OK",
      };

      setStagingList((prev) => [newEntry, ...prev]);
      setLrnInput("");
      scanInputRef.current?.focus();
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as any).response?.status === 404
      ) {
        sileo.error({
          title: "Not Found",
          description: `LRN ${lrn} was not found in the database.`,
        });
      } else {
        toastApiError(err as any);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateStagedLearner = (lrn: string, fields: Partial<StagedLearner>) => {
    setStagingList((prev) =>
      prev.map((s) => (s.lrn === lrn ? { ...s, ...fields } : s)),
    );
  };

  const removeStagedLearner = (lrn: string) => {
    setStagingList((prev) => prev.filter((s) => s.lrn !== lrn));
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];
        const validRows = [];
        const errors = [];

        for (const row of rows) {
          const lrn = row.LRN?.toString().trim();
          if (lrn && lrn.length === 12) {
            validRows.push({
              lrn,
              guardian: row.GUARDIAN || "",
              contact: row.CONTACT || "",
              consent:
                row.CONSENT?.toUpperCase() === "YES" || row.CONSENT === "1",
            });
          } else {
            errors.push(lrn || "Unknown Row");
          }
        }

        if (errors.length > 0) {
          sileo.warning({
            title: "CSV Errors",
            description: `Skipped ${errors.length} rows with invalid LRNs.`,
          });
        }

        // Process valid rows one by one for full metadata fetch
        sileo.info({
          title: "Processing CSV",
          description: `Fetching metadata for ${validRows.length} learners...`,
        });

        for (const v of validRows) {
          await handleLrnLookup(v.lrn);
          updateStagedLearner(v.lrn, {
            guardianName: v.guardian,
            contactNumber: v.contact,
            isEnrolling: v.consent,
          });
        }
        setLoading(false);
      },
    });
  };

  const handleProcessBatch = async () => {
    if (stagingList.length === 0) return;

    // Check for missing required data
    const missingData = stagingList.filter(
      (s) => s.isEnrolling && (!s.guardianName || !s.contactNumber),
    );
    if (missingData.length > 0) {
      sileo.error({
        title: "Incomplete Data",
        description: `Please provide Guardian and Contact details for all enrollees.`,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        batch: stagingList.map((s) => ({
          learnerId: s.id,
          schoolYearId: activeSchoolYearId,
          gradeLevelId: s.targetGradeLevelId,
          guardianName: s.guardianName,
          contactNumber: s.contactNumber,
          isEnrolling: s.isEnrolling,
          intakeMethod:
            activeTab === "scan" ? "BATCH_CONFIRMATION" : "CSV_UPLOAD",
        })),
      };

      await api.post("/enrollment/batch-confirm", payload);

      const enrolledCount = stagingList.filter((s) => s.isEnrolling).length;
      const transferCount = stagingList.length - enrolledCount;

      sileo.success({
        title: "Batch Processed",
        description: `Successfully processed ${stagingList.length} records. (${enrolledCount} Enrolled, ${transferCount} Transfers)`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      toastApiError(err as any);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-background rounded-2xl">
        {/* Professional Metadata Header */}
        <DialogHeader className="px-8 pt-8 pb-6 bg-muted/30 border-b border-border relative overflow-hidden">
          <div className="flex items-start gap-4 relative z-10">
            <div className="p-3 bg-primary/10 rounded-xl text-primary shadow-sm border border-primary/20">
              <UserCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-black uppercase  text-foreground leading-none">
                Batch Confirmation Pipeline
              </DialogTitle>
              <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  DO 017, s. 2025 Compliant
                </span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>Grade 8-10 Returning Learners</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full">
          {/* Animated System Tabs */}
          <div className="px-8 pt-6 bg-background">
            <TabsList className="bg-muted/50 h-auto p-1.5 gap-1.5 justify-start border border-border/60 relative rounded-xl w-full sm:w-auto">
              <TabsTrigger
                value="scan"
                className="flex-1 sm:flex-none py-2 px-6 gap-2 font-black uppercase text-[10px] tracking-widest relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all">
                {activeTab === "scan" && (
                  <motion.div
                    layoutId="batch-tab-pill"
                    className="absolute inset-0 bg-primary rounded-lg shadow-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-20 flex items-center gap-2 transition-colors duration-200",
                    activeTab === "scan"
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}>
                  <Keyboard className="h-3.5 w-3.5" /> Rapid Multi-Scan
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="csv"
                className="flex-1 sm:flex-none py-2 px-6 gap-2 font-black uppercase text-[10px] tracking-widest relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all">
                {activeTab === "csv" && (
                  <motion.div
                    layoutId="batch-tab-pill"
                    className="absolute inset-0 bg-primary rounded-lg shadow-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-20 flex items-center gap-2 transition-colors duration-200",
                    activeTab === "csv"
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Bulk CSV Upload
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-8 pt-6 space-y-6">
            <TabsContent
              value="scan"
              className="m-0 space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex justify-between items-center ml-1">
                  <span>1. Scan or Type LRN & Hit Enter</span>
                  {loading && (
                    <div className="flex items-center gap-2 text-primary animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-[9px]">Querying LIS...</span>
                    </div>
                  )}
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Search className="h-6 w-6" />
                  </div>
                  <Input
                    ref={scanInputRef}
                    value={lrnInput}
                    onChange={(e) =>
                      setLrnInput(
                        e.target.value.replace(/\D/g, "").slice(0, 12),
                      )
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleLrnLookup(lrnInput)
                    }
                    placeholder="12-DIGIT LRN"
                    className="h-20 pl-16 text-4xl font-black tracking-[0.4em] border-2 border-border focus-visible:ring-primary/20 focus-visible:border-primary bg-muted/10 shadow-inner rounded-2xl"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="csv"
              className="m-0">
              <div className="border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 bg-muted/5 hover:bg-muted/10 transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                />
                <div className="p-5 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <p className="font-black uppercase  text-xl text-foreground">
                    Drop CSV Enrollment List
                  </p>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Required: LRN, GUARDIAN, CONTACT, CONSENT
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="font-black uppercase text-[10px] tracking-widest px-8 shadow-sm">
                  Browse Files
                </Button>
              </div>
            </TabsContent>

            {/* Staging Queue Table (SF1 Style) */}
            <div className="space-y-4 mt-6">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-3">
                  Staging Queue
                  <div className="h-5 px-2 bg-primary/10 text-primary rounded border border-primary/20 flex items-center justify-center font-black">
                    {stagingList.length}
                  </div>
                </h3>
                {stagingList.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStagingList([])}
                    className="h-7 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive hover:bg-destructive/5">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Clear Queue
                  </Button>
                )}
              </div>

              <div className="border border-border rounded-xl shadow-sm bg-card overflow-hidden">
                <div className="max-h-[320px] overflow-y-auto scrollbar-thin">
                  {stagingList.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="p-4 bg-muted/30 rounded-full">
                        <Keyboard className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                          Pipeline is Clear
                        </p>
                        <p className="text-xs text-muted-foreground/50 font-bold uppercase ">
                          Ready for multi-scan or file ingestion
                        </p>
                      </div>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-md border-b border-border">
                        <tr>
                          <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                            Learner / Profile
                          </th>
                          <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                            Guardian Name
                          </th>
                          <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                            Contact
                          </th>
                          <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground w-[100px]">
                            Consent
                          </th>
                          <th className="px-5 py-4 w-[60px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {stagingList.map((s) => (
                          <tr
                            key={s.lrn}
                            className={cn(
                              "transition-all duration-200 group",
                              !s.isEnrolling
                                ? "bg-muted/10 grayscale"
                                : "hover:bg-muted/20",
                            )}>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-black text-sm uppercase text-foreground group-hover:text-primary transition-colors">
                                  {s.lastName}, {s.firstName}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-muted-foreground  tabular-nums bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
                                    {s.lrn}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-black uppercase h-4 px-1.5 border-primary/20 text-primary">
                                    {s.currentGradeLevel}
                                  </Badge>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <Input
                                value={s.guardianName}
                                onChange={(e) =>
                                  updateStagedLearner(s.lrn, {
                                    guardianName: e.target.value.toUpperCase(),
                                  })
                                }
                                placeholder="NAME OF GUARDIAN"
                                className="h-10 font-black text-xs uppercase bg-background border-border/60 focus:border-primary/40 focus:ring-primary/10 shadow-sm"
                              />
                            </td>
                            <td className="px-5 py-4">
                              <Input
                                value={s.contactNumber}
                                onChange={(e) =>
                                  updateStagedLearner(s.lrn, {
                                    contactNumber: e.target.value.replace(
                                      /\D/g,
                                      "",
                                    ),
                                  })
                                }
                                placeholder="09XXXXXXXXX"
                                className="h-10 font-black text-xs bg-background border-border/60 focus:border-primary/40 focus:ring-primary/10 shadow-sm"
                              />
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col items-center gap-1.5">
                                <Switch
                                  checked={s.isEnrolling}
                                  onCheckedChange={(val) =>
                                    updateStagedLearner(s.lrn, {
                                      isEnrolling: val,
                                    })
                                  }
                                  className="data-[state=checked]:bg-emerald-600 scale-90"
                                />
                                <span
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.1em]",
                                    s.isEnrolling
                                      ? "text-emerald-700"
                                      : "text-muted-foreground",
                                  )}>
                                  {s.isEnrolling ? "Enrolling" : "Transfer"}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeStagedLearner(s.lrn)}
                                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                <XCircle className="h-4.5 w-4.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Tabs>

        <DialogFooter className="px-8 py-6 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">
          <div className="flex flex-col sm:items-start items-center">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
              Deployment Dashboard
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase text-emerald-800 ">
                  Confirmed: {stagingList.filter((s) => s.isEnrolling).length}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/50">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="text-[10px] font-black uppercase text-muted-foreground ">
                  Transfers: {stagingList.filter((s) => !s.isEnrolling).length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none font-black uppercase text-[10px] tracking-widest h-12 px-8 hover:bg-muted/50">
              Cancel
            </Button>
            <Button
              disabled={stagingList.length === 0 || isProcessing}
              onClick={handleProcessBatch}
              className="flex-1 sm:flex-none h-12 px-10 font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground group">
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
              )}
              Commit Batch
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
