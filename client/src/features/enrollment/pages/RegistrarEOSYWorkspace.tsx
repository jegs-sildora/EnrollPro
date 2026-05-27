import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Search,
  Lock,
  Unlock,
  Building2,
  CheckCircle2,
  Save,
  AlertCircle,
  TrendingUp,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { cn } from "@/shared/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams, useNavigate } from "react-router";
import type { EosyStatus } from "@enrollpro/shared";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";

interface SectionRecord {
  id: number;
  eosyStatus: EosyStatus | null;
  learnerId: number;
  enrollmentApplication: {
    learner: {
      lrn: string | null;
      firstName: string;
      lastName: string;
      sex: "MALE" | "FEMALE";
    };
  };
}

interface Section {
  id: number;
  name: string;
  isEosyFinalized: boolean;
  gradeLevel: { name: string };
  schoolYearId: number;
}

export default function RegistrarEOSYWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sectionId = searchParams.get("sectionId");
  const { activeSchoolYearId } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaveLoading] = useState(false);
  const [finalizing, setFinalizeLoading] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [records, setRecords] = useState<SectionRecord[]>([]);
  const [localStatuses, setLocalStatuses] = useState<Record<number, EosyStatus>>({});
  
  // UI State
  const [showSummary, setShowSummary] = useState(false);
  const {
    inputValue: searchQuery,
    setInputValue: setSearchQuery,
    activeFilter: activeSearchQuery,
    isSearching,
  } = useDebouncedSearch();

  const fetchData = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      // 1. Fetch Section Records
      const recordsRes = await api.get<{ records: SectionRecord[] }>(`/eosy/sections/${sectionId}/records`);
      setRecords(recordsRes.data.records);
      
      // Initialize local state with current DB values
      const initial: Record<number, EosyStatus> = {};
      recordsRes.data.records.forEach(r => {
        if (r.eosyStatus) initial[r.id] = r.eosyStatus;
      });
      setLocalStatuses(initial);

      // 2. Fetch Section Details (for lock state)
      // Note: We use the existing BOSY endpoint or a standard section fetch
      const sectionsRes = await api.get<{ sections: Section[] }>(`/eosy/sections`, { 
        params: { schoolYearId: activeSchoolYearId } 
      });
      const currentSection = sectionsRes.data.sections.find(s => s.id === Number(sectionId));
      if (currentSection) setSection(currentSection);

    } catch (error) {
      toastApiError(error as never);
    } finally {
      setLoading(false);
    }
  }, [sectionId, activeSchoolYearId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bulk Macro: Mark All as PROMOTED
  const handleMarkAllPromoted = () => {
    const updated = { ...localStatuses };
    records.forEach(r => {
      updated[r.id] = "PROMOTED";
    });
    setLocalStatuses(updated);
  };

  const handleStatusChange = (recordId: number, status: EosyStatus) => {
    setLocalStatuses(prev => ({ ...prev, [recordId]: status }));
  };

  const summary = useMemo(() => {
    const counts: Record<string, number> = {
      PROMOTED: 0,
      CONDITIONALLY_PROMOTED: 0,
      RETAINED: 0,
      DROPPED_OUT: 0,
      TRANSFERRED_OUT: 0,
    };
    Object.values(localStatuses).forEach(s => {
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [localStatuses]);

  const handleSave = async () => {
    if (!sectionId) return;
    setSaveLoading(true);
    try {
      const updates = Object.entries(localStatuses).map(([recordId, status]) => ({
        recordId: Number(recordId),
        status,
      }));

      await api.post("/eosy/batch-update", {
        sectionId: Number(sectionId),
        updates,
      });

      setShowSummary(false);
      await fetchData(); // Refresh data
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (!section) return;
    setFinalizeLoading(true);
    try {
      // Re-using the toggle-lock logic from the controller
      const isLocked = !section.isEosyFinalized;
      await api.post(`/eosy/sections/${section.id}/${isLocked ? "finalize" : "reopen"}`);
      await fetchData();
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setFinalizeLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const full = `${r.enrollmentApplication.learner.lastName} ${r.enrollmentApplication.learner.firstName}`.toLowerCase();
      const search = activeSearchQuery.toLowerCase();
      return full.includes(search) || r.enrollmentApplication.learner.lrn?.includes(activeSearchQuery);
    });
  }, [records, activeSearchQuery]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!section) return <div>Section not found.</div>;

  const isLocked = section.isEosyFinalized;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 h-8 text-slate-500">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sections
          </Button>
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Building2 className="h-6 w-6" />
             </div>
             <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">{section.gradeLevel.name} - {section.name}</h1>
                <p className="text-sm text-slate-500 font-bold">EOSY Status Batch Updating Workspace</p>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {!isLocked && (
             <>
                <Button variant="outline" size="sm" onClick={handleMarkAllPromoted} className="font-bold border-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                  <TrendingUp className="mr-2 h-4 w-4" /> 🚀 Mark All Promoted
                </Button>
                <Button size="sm" onClick={() => setShowSummary(true)} className="font-bold shadow-lg shadow-primary/20">
                  <Save className="mr-2 h-4 w-4" /> Save Batch Updates
                </Button>
             </>
           )}
           <Button 
            variant={isLocked ? "destructive" : "secondary"} 
            size="sm" 
            onClick={handleToggleLock}
            disabled={finalizing}
            className="font-bold"
           >
              {finalizing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isLocked ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              {isLocked ? "Re-open Section" : "🔒 Finalize & Lock"}
           </Button>
        </div>
      </div>

      {/* Lock Banner */}
      <AnimatePresence>
        {isLocked && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 border-2 border-red-200 p-4 rounded-xl flex items-center gap-4 text-red-700"
          >
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
               <Lock className="h-6 w-6" />
            </div>
            <div>
               <p className="font-black uppercase tracking-tight">🔒 SECTION IS FINALIZED AND LOCKED FOR THE SUMMER</p>
               <p className="text-sm opacity-90 font-bold text-red-600">This section has been officially promoted. No further changes can be made without administrator override.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspace Grid */}
      <Card className="border-2 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b space-y-4">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black uppercase text-slate-800">Section Roster (SF5 Flow)</CardTitle>
                <CardDescription className="font-bold">Direct promotion entry based on Teacher SF5 submissions</CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                 <input 
                  className="w-full bg-white border-2 border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Filter by name or LRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                 />
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b-2">
                    <TableHead className="w-16 text-center font-black">NO.</TableHead>
                    <TableHead className="font-black text-slate-700">LRN</TableHead>
                    <TableHead className="font-black text-slate-700">FULL NAME</TableHead>
                    <TableHead className="w-24 text-center font-black text-slate-700">SEX</TableHead>
                    <TableHead className="w-64 font-black text-slate-700">EOSY STATUS</TableHead>
                    <TableHead className="w-24 text-center font-black text-slate-700">INDICATOR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSearching ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="h-64 flex flex-col items-center justify-center gap-3 text-center bg-background/80">
                          <Search className="h-10 w-10 animate-pulse text-slate-400" />
                          <div className="space-y-1">
                            <p className="text-lg font-bold text-slate-500">
                              Searching...
                            </p>
                            <p className="text-sm font-bold text-slate-400">
                              Scanning EOSY records...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record, index) => {
                    const status = localStatuses[record.id];
                    return (
                      <TableRow key={record.id} className={cn(
                        "hover:bg-slate-50 transition-colors border-b",
                        isLocked && "opacity-60 grayscale"
                      )}>
                        <TableCell className="text-center font-bold text-slate-400">{index + 1}</TableCell>
                        <TableCell className="text-sm font-bold text-slate-600">
                          {record.enrollmentApplication.learner.lrn || "NO LRN"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                             <span className="font-black text-slate-800 uppercase tracking-tight">
                               {record.enrollmentApplication.learner.lastName}, {record.enrollmentApplication.learner.firstName}
                             </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge variant="outline" className={cn(
                             "font-black text-[10px]",
                             record.enrollmentApplication.learner.sex === "MALE" ? "border-blue-200 text-blue-700 bg-blue-50" : "border-pink-200 text-pink-700 bg-pink-50"
                           )}>
                             {record.enrollmentApplication.learner.sex === "MALE" ? "M" : "F"}
                           </Badge>
                        </TableCell>
                        <TableCell>
                           <Select
                            value={status || ""}
                            onValueChange={(val) => handleStatusChange(record.id, val as EosyStatus)}
                            disabled={isLocked}
                           >
                             <SelectTrigger className={cn(
                               "h-10 border-2 font-black uppercase text-xs",
                               status === "PROMOTED" && "border-emerald-200 text-emerald-700 bg-emerald-50/50",
                               status === "RETAINED" && "border-red-200 text-red-700 bg-red-50/50",
                               status === "DROPPED_OUT" && "border-slate-300 text-slate-600 bg-slate-50/50",
                               status === "TRANSFERRED_OUT" && "border-orange-200 text-orange-700 bg-orange-50/50",
                               status === "CONDITIONALLY_PROMOTED" && "border-amber-200 text-amber-700 bg-amber-50/50",
                             )}>
                               <SelectValue placeholder="SET STATUS..." />
                             </SelectTrigger>
                             <SelectContent>
                                <SelectItem value="PROMOTED" className="font-bold">PROMOTED</SelectItem>
                                <SelectItem value="CONDITIONALLY_PROMOTED" className="font-bold">CONDITIONALLY PROMOTED</SelectItem>
                                <SelectItem value="RETAINED" className="font-bold">RETAINED</SelectItem>
                                <SelectItem value="DROPPED_OUT" className="font-bold">DROPPED OUT</SelectItem>
                                <SelectItem value="TRANSFERRED_OUT" className="font-bold">TRANSFERRED OUT</SelectItem>
                             </SelectContent>
                           </Select>
                        </TableCell>
                        <TableCell className="text-center">
                           {status === "PROMOTED" && <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />}
                           {status === "RETAINED" && <AlertCircle className="h-5 w-5 text-red-500 mx-auto" />}
                        </TableCell>
                      </TableRow>
                    );
                    })
                  )}
                </TableBody>
              </Table>
           </div>
        </CardContent>
      </Card>

      {/* Summary Modal */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
         <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
               <DialogTitle className="text-xl font-black uppercase tracking-tight">Confirm Batch Submission</DialogTitle>
               <DialogDescription className="font-bold text-slate-600 pt-2">
                 You are about to finalize the EOSY statuses for <span className="text-primary font-bold">{records.length} learners</span> in section <span className="text-primary font-bold">{section.name}</span>.
               </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
               <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-100 space-y-2">
                  <div className="flex items-center justify-between font-bold text-sm">
                     <span className="text-slate-500 uppercase tracking-widest text-[10px]">Promoted</span>
                     <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-xs">{summary.PROMOTED}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-sm">
                     <span className="text-slate-500 uppercase tracking-widest text-[10px]">Conditionally Promoted</span>
                     <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-xs">{summary.CONDITIONALLY_PROMOTED}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-sm">
                     <span className="text-slate-500 uppercase tracking-widest text-[10px]">Retained</span>
                     <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs">{summary.RETAINED}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-sm">
                     <span className="text-slate-500 uppercase tracking-widest text-[10px]">Dropped Out</span>
                     <span className="text-slate-700 bg-slate-200 px-2 py-0.5 rounded text-xs">{summary.DROPPED_OUT}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-sm">
                     <span className="text-slate-500 uppercase tracking-widest text-[10px]">Transferred Out</span>
                     <span className="text-orange-700 bg-orange-100 px-2 py-0.5 rounded text-xs">{summary.TRANSFERRED_OUT}</span>
                  </div>
               </div>
               
               <p className="text-[10px] text-slate-400 font-bold uppercase text-center tracking-tighter italic">
                 ⚠️ This action will generate individual audit trail entries for each learner.
               </p>
            </div>

            <DialogFooter>
               <Button variant="outline" onClick={() => setShowSummary(false)} className="font-bold rounded-lg border-2">Cancel</Button>
               <Button 
                onClick={handleSave} 
                disabled={saving}
                className="font-black rounded-lg shadow-lg shadow-primary/20"
               >
                 {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                 COMMIT STATUSES
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
