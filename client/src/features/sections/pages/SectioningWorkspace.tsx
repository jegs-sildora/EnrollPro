import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Users, 
  Search, 
  ArrowRightLeft, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  UserCheck,
  LayoutGrid,
  Info,
  FileDown,
  Archive,
  RefreshCw as RefreshCwIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import api from "@/shared/api/axiosInstance";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Progress } from "@/shared/ui/progress";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/shared/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { sileo } from "sileo";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { cn } from "@/shared/lib/utils";

// --- Types ---
interface SectionSummary {
  id: number;
  name: string;
  gradeLevel: string;
  gradeLevelOrder: number;
  tleProgram: string | null;
  tleProgramId: number | null;
  maxCapacity: number;
  currentCount: number;
  boys: number;
  girls: number;
  adviser: string;
  programType: string;
}

interface PoolLearner {
  applicationId: number;
  lrn: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: "MALE" | "FEMALE";
  genAve: number | null;
  gradeLevel: string;
  tleProgram: string | null;
  tleProgramId: number | null;
}

export default function SectioningWorkspace() {
  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [pool, setPool] = useState<PoolLearner[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Selection & Filters
  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([]);
  const [filterSex, setFilterSex] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (isHistoricalReadOnly) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [secRes, poolRes] = await Promise.all([
        api.get<SectionSummary[]>("/sectioning/sections-summary"),
        api.get<PoolLearner[]>("/sectioning/pool")
      ]);
      setSections(secRes.data);
      setPool(poolRes.data);
    } catch {
      sileo.error({ title: "Sync Failed", description: "Could not refresh sectioning workspace." });
    } finally {
      setLoading(false);
    }
  }, [isHistoricalReadOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Logic ---
  const filteredPool = useMemo(() => {
    return pool.filter(l => {
      const matchesSearch = l.firstName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           l.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           l.lrn.includes(searchQuery);
      const matchesSex = filterSex === "all" || l.sex === filterSex;
      return matchesSearch && matchesSex;
    });
  }, [pool, searchQuery, filterSex]);

  const toggleSelect = useCallback((appId: number) => {
    setSelectedAppIds(prev => 
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  }, []);

  // --- Actions ---
  const handleDownloadSF1 = async (sectionId: number, sectionName: string) => {
    setDownloadingId(sectionId);
    try {
      const response = await api.get(`/export/sf1/${sectionId}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `SF1_${sectionName.replace(/\s+/g, "_")}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      sileo.success({ 
        title: "Report Generated", 
        description: `School Form 1 for ${sectionName} is ready.` 
      });
    } catch {
      sileo.error({ 
        title: "Export Failed", 
        description: "Could not generate SF1 report. Please try again." 
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBulkAssign = async () => {
    if (!targetSectionId || selectedAppIds.length === 0) return;
    
    setProcessing(true);
    try {
      await api.post("/sectioning/assign-bulk", {
        sectionId: targetSectionId,
        applicationIds: selectedAppIds
      });
      
      sileo.success({ 
        title: "Sectioning Complete", 
        description: `Successfully moved ${selectedAppIds.length} students.` 
      });
      
      setSelectedAppIds([]);
      setTargetSectionId(null);
      await fetchData();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const msg = axiosError.response?.data?.message || "Internal Policy Violation";
      sileo.error({ title: "Assignment Blocked", description: msg });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Synchronizing ATLAS Workspace...</p>
      </div>
    );
  }

  if (isHistoricalReadOnly) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center gap-4 p-6">
        <Archive className="h-12 w-12 text-slate-300" />
        <div className="text-center space-y-1">
          <p className="text-sm font-black uppercase text-slate-500">Sectioning Workspace Unavailable</p>
          <p className="text-xs text-slate-400 font-bold max-w-sm">
            This workspace is only accessible for the active school year. Switch to the active year to manage learner sectioning.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-6 p-6 overflow-hidden">
      {/* --- Top Header --- */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-3">
            <ArrowRightLeft className="h-8 w-8 text-primary" />
            Sectioning Workspace
          </h1>
          <p className="text-slate-500 font-bold text-sm">ATLAS Integration: grouping READY_FOR_SECTIONING candidates.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex flex-col items-end px-4">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Pool</span>
              <span className="text-xl font-black text-slate-900 leading-none">{pool.length}</span>
           </div>
           <div className="w-px h-8 bg-slate-100" />
           <Button onClick={fetchData} variant="ghost" size="icon" className="h-10 w-10">
              <RefreshCwIcon className="h-4 w-4" />
           </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* --- LEFT PANE: UNSECTIONED POOL --- */}
        <Card className="flex-[1.2] flex flex-col shadow-xl border-none overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg font-black uppercase tracking-wide flex items-center gap-2 text-slate-800">
                  <Users className="h-5 w-5 text-primary" />
                  Candidate Pool
                </CardTitle>
                <CardDescription className="text-xs font-bold">Unassigned learners awaiting placement.</CardDescription>
              </div>
              <Badge variant="outline" className="font-black bg-white">{selectedAppIds.length} Selected</Badge>
            </div>

            <div className="flex gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search LRN or Name..." 
                  className="pl-9 h-10 border-slate-200 focus:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterSex} onValueChange={setFilterSex}>
                <SelectTrigger className="w-32 h-10 border-slate-200">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="MALE">Boys</SelectItem>
                  <SelectItem value="FEMALE">Girls</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <div className="flex-1 overflow-auto p-0 relative">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="p-4 w-10">
                    <Checkbox 
                      checked={selectedAppIds.length === filteredPool.length && filteredPool.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedAppIds(filteredPool.map(l => l.applicationId));
                        else setSelectedAppIds([]);
                      }}
                    />
                  </th>
                  <th className="p-4">Learner Detail</th>
                  <th className="p-4">TLE Specialization</th>
                  <th className="p-4">Gen Ave</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredPool.map((l) => (
                    <motion.tr 
                      key={l.applicationId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "group border-b border-slate-50 hover:bg-slate-50/50 transition-colors",
                        selectedAppIds.includes(l.applicationId) && "bg-primary/[0.02]"
                      )}
                    >
                      <td className="p-4">
                        <Checkbox 
                          checked={selectedAppIds.includes(l.applicationId)}
                          onCheckedChange={() => toggleSelect(l.applicationId)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase">{l.lastName}, {l.firstName}</span>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase">{l.lrn}</span>
                             <span className={cn(
                               "text-[9px] font-black px-1.5 rounded-sm",
                               l.sex === "MALE" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                             )}>
                               {l.sex.charAt(0)}
                             </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {l.tleProgram ? (
                          <Badge variant="secondary" className="text-[9px] font-black bg-slate-100 text-slate-600 uppercase border-none">
                            {l.tleProgram}
                          </Badge>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300">EXPLORATORY</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-black text-slate-600">{l.genAve || '--'}</span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>

        {/* --- RIGHT PANE: SECTION GRID --- */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Target Sections
            </h2>
          </div>

          <div className="flex-1 overflow-auto pr-2 space-y-4">
            {sections.map((s) => {
              const occupancy = (s.currentCount / s.maxCapacity) * 100;
              const isFull = s.currentCount >= s.maxCapacity;
              const isSelected = targetSectionId === s.id;
              
              return (
                <Card 
                  key={s.id}
                  onClick={() => !isFull && setTargetSectionId(s.id)}
                  className={cn(
                    "cursor-pointer transition-all border-2 relative overflow-hidden",
                    isSelected ? "border-primary bg-primary/[0.01] ring-4 ring-primary/5 shadow-lg" : "border-transparent hover:border-slate-200 bg-white",
                    isFull && "opacity-60 cursor-not-allowed bg-slate-50 grayscale"
                  )}
                >
                  <CardHeader className="p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{s.gradeLevel}</span>
                        <CardTitle className="text-lg font-black text-slate-900 uppercase">{s.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={downloadingId === s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSF1(s.id, s.name);
                          }}
                          className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-50 shadow-sm"
                        >
                          {downloadingId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5 text-slate-600" />
                          )}
                        </Button>
                        {isFull ? (
                          <Badge variant="destructive" className="font-black text-[9px] tracking-widest px-2 py-0.5 uppercase">FULL</Badge>
                        ) : (
                          <div className="text-right">
                             <span className="text-xl font-black text-slate-900 leading-none">{s.currentCount}</span>
                             <span className="text-[10px] font-bold text-slate-400 ml-1">/ {s.maxCapacity}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-2 space-y-4">
                    <div className="space-y-1.5">
                       <Progress value={occupancy} className="h-1.5" />
                       <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tight text-slate-400">
                          <div className="flex gap-3">
                             <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Boys: {s.boys}</span>
                             <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-pink-500" /> Girls: {s.girls}</span>
                          </div>
                          <span>{Math.round(occupancy)}% Cap.</span>
                       </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                       <div className="flex items-center gap-2">
                          <UserCheck className="h-3 w-3 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{s.adviser}</span>
                       </div>
                       {s.tleProgram && (
                         <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest py-0 border-primary/20 text-primary">
                           {s.tleProgram}
                         </Badge>
                       )}
                    </div>
                  </CardContent>
                  
                  {isSelected && (
                    <motion.div 
                      layoutId="check-indicator"
                      className="absolute top-4 right-4 h-6 w-6 bg-primary rounded-full flex items-center justify-center text-white shadow-lg"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </motion.div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- FLOATING ACTION BAR --- */}
      <AnimatePresence>
        {selectedAppIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 z-50"
          >
             <div className="bg-slate-900 shadow-2xl rounded-3xl p-6 border border-slate-800 flex items-center justify-between text-white backdrop-blur-md bg-opacity-95">
                <div className="flex items-center gap-6">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selected Candidates</span>
                      <span className="text-2xl font-black leading-none">{selectedAppIds.length} <span className="text-xs text-slate-500">Learners</span></span>
                   </div>
                   <div className="h-10 w-px bg-slate-800" />
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Destination</span>
                      <span className={cn(
                        "text-sm font-black uppercase tracking-tight",
                        targetSectionId ? "text-primary" : "text-slate-600"
                      )}>
                        {targetSectionId 
                          ? sections.find(s => s.id === targetSectionId)?.name 
                          : "Select a Section from the Right →"}
                      </span>
                   </div>
                </div>

                <div className="flex items-center gap-3">
                   <Button 
                    variant="ghost" 
                    onClick={() => { setSelectedAppIds([]); setTargetSectionId(null); }}
                    className="text-slate-400 hover:text-white font-black uppercase text-xs tracking-widest"
                   >
                     Cancel
                   </Button>
                   <Button 
                    disabled={!targetSectionId || processing}
                    onClick={handleBulkAssign}
                    className="h-14 px-8 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-3"
                   >
                     {processing ? (
                       <Loader2 className="h-5 w-5 animate-spin" />
                     ) : (
                       <>
                         Commit Bulk Assignment
                         <ChevronRight className="h-5 w-5" />
                       </>
                     )}
                   </Button>
                </div>
             </div>
             
             {/* Policy Helper Hint */}
             {!targetSectionId && (
               <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute -top-10 left-1/2 -translate-x-1/2 w-full text-center"
               >
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                    <Info className="h-3 w-3" /> Select a target section from the grid to enable transfer
                 </p>
               </motion.div>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

