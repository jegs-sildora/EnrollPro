import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import { 
  Users, 
  Search, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  UserCheck,
  LayoutGrid,
  Info,
  FileDown,
  Archive,
  RefreshCw as RefreshCwIcon,
  Lock,
  AlertTriangle,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import api from "@/shared/api/axiosInstance";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Progress } from "@/shared/ui/progress";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
} from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { AdminPinInput } from "@/shared/components/AdminPinInput";
import { sileo } from "sileo";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { useSettingsStore } from "@/store/settings.slice";
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
  const { activeSchoolYearLabel, systemStatus, setSettings } = useSettingsStore();
  const isLocked = systemStatus === "BOSY_LOCKED";

  // BOSY Lockdown State
  const [preLockStats, setPreLockStats] = useState<{ pendingCount: number; unsectionedCount: number; sectionedCount: number } | null>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockConfirmLabel, setLockConfirmLabel] = useState("");
  const [lockConfirmTouched, setLockConfirmTouched] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinTouched, setPinTouched] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const isLockConfirmValid = lockConfirmLabel === activeSchoolYearLabel;
  const isPinValid = /^\d{6}$/.test(adminPin);
  const totalIncomplete = (preLockStats?.pendingCount ?? 0) + (preLockStats?.unsectionedCount ?? 0);
  const isLockBlocked = !isLocked && totalIncomplete > 0;
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [pool, setPool] = useState<PoolLearner[]>([]);
  const [processing, setProcessing] = useState(false);

  const queryClient = useQueryClient();

  // ── React Query: sections & pool with 5 s background polling ─────────────
  const {
    data: sectionsData,
    isFetching: sectionsFetching,
    isLoading: sectionsInitialLoading,
  } = useQuery({
    queryKey: queryKeys.sectioningSections(),
    queryFn: () =>
      api.get<SectionSummary[]>("/sectioning/sections-summary").then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  const {
    data: poolData,
    isFetching: poolFetching,
    isLoading: poolInitialLoading,
  } = useQuery({
    queryKey: queryKeys.sectioningPool(),
    queryFn: () =>
      api.get<PoolLearner[]>("/sectioning/pool").then((r) => r.data),
    enabled: !isHistoricalReadOnly,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  // Sync query results into legacy state (keeps downstream JSX + handlers unchanged)
  useEffect(() => { if (sectionsData) setSections(sectionsData); }, [sectionsData]);
  useEffect(() => { if (poolData) setPool(poolData); }, [poolData]);

  const loading = (sectionsInitialLoading || poolInitialLoading) && !isHistoricalReadOnly;
  const isSyncing = (sectionsFetching || poolFetching) && !loading;

  // ── New-row highlight tracking ────────────────────────────────────────────
  // First load: populate knownIds without marking anything as new.
  // Subsequent polls: IDs absent from knownIds are "new" and get a flash animation.
  const knownPoolIdsRef = useRef<Set<number>>(new Set());
  const isFirstPoolLoad = useRef(true);
  const [newPoolIds, setNewPoolIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!poolData || poolData.length === 0) return;
    if (isFirstPoolLoad.current) {
      knownPoolIdsRef.current = new Set(poolData.map((p) => p.applicationId));
      isFirstPoolLoad.current = false;
      return;
    }
    const freshIds = poolData
      .filter((p) => !knownPoolIdsRef.current.has(p.applicationId))
      .map((p) => p.applicationId);
    if (freshIds.length > 0) {
      knownPoolIdsRef.current = new Set(poolData.map((p) => p.applicationId));
      setNewPoolIds(new Set(freshIds));
      // Clear highlight after 2 s
      const t = setTimeout(() => setNewPoolIds(new Set()), 2_000);
      return () => clearTimeout(t);
    } else {
      knownPoolIdsRef.current = new Set(poolData.map((p) => p.applicationId));
    }
  }, [poolData]);
  
  // Selection & Filters
  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([]);
  const [filterSex, setFilterSex] = useState<string>("all");
  const {
    inputValue: searchQuery,
    setInputValue: setSearchQuery,
    activeFilter: activeSearchQuery,
    isSearching,
  } = useDebouncedSearch();
  const {
    inputValue: rosterSearchQuery,
    setInputValue: setRosterSearchQuery,
    activeFilter: activeRosterFilter,
    isSearching: isRosterSearching,
  } = useDebouncedSearch();
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"workspace" | "pool" | "rosters" | "bosy">("workspace");

  const fetchStatus = async () => {
    try {
      const res = await api.get("/admin/system/status");
      if (res.data.preLockStats) {
        setPreLockStats(res.data.preLockStats);
      }
    } catch (err) {
      console.error("Failed to fetch pre-lock stats", err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [systemStatus]);

  const handleLockBosy = async () => {
    if (lockConfirmLabel !== activeSchoolYearLabel) {
      setLockConfirmTouched(true);
      sileo.error({ title: "Validation Failed", description: "School year label does not match." });
      return;
    }
    if (!/^\d{6}$/.test(adminPin)) {
      setPinTouched(true);
      sileo.error({ title: "Invalid PIN", description: "Please enter a valid 6-digit Admin PIN." });
      return;
    }
    setIsLocking(true);
    try {
      const res = await api.post("/admin/system/lock-bosy", { pin: adminPin, yearLabel: lockConfirmLabel });
      sileo.success({ title: "BOSY Locked", description: res.data.message });
      const pubRes = await api.get("/settings/public");
      setSettings(pubRes.data);
      setIsLockModalOpen(false);
      setLockConfirmLabel("");
      setLockConfirmTouched(false);
      setAdminPin("");
      setPinTouched(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response.data?.message
          : err instanceof Error ? err.message : "Failed to lock BOSY.";
      sileo.error({ title: "Lock Failed", description: message || "An unexpected error occurred." });
    } finally {
      setIsLocking(false);
    }
  };

  // --- Logic ---
  const filteredPool = useMemo(() => {
    return pool.filter((l) => {
      const normalizedQuery = activeSearchQuery.toLowerCase();
      const matchesSearch =
        l.firstName.toLowerCase().includes(normalizedQuery) ||
        l.lastName.toLowerCase().includes(normalizedQuery) ||
        l.lrn.includes(activeSearchQuery);
      const matchesSex = filterSex === "all" || l.sex === filterSex;
      return matchesSearch && matchesSex;
    });
  }, [pool, activeSearchQuery, filterSex]);

  const filteredSections = useMemo(() => {
    if (!activeRosterFilter.trim()) return sections;
    const q = activeRosterFilter.toLowerCase();
    return sections.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.adviser.toLowerCase().includes(q) ||
      s.gradeLevel.toLowerCase().includes(q),
    );
  }, [sections, activeRosterFilter]);

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
      // Invalidate both queries so both pool and section counts refresh
      await queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.sectioningSections() });
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

  const TABS = [
    { key: "workspace" as const, label: "Batch Sectioning Workspace" },
    { key: "pool" as const, label: "Unsectioned Learner Pool" },
    { key: "rosters" as const, label: "Official Class Rosters" },
    { key: "bosy" as const, label: "BOSY Finalization" },
  ];

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col overflow-hidden">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
        <div className="space-y-1">
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
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
          <Button
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
              void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningSections() });
            }}
            variant="ghost"
            size="icon"
            className="h-10 w-10"
          >
            <RefreshCwIcon className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ── Tab Strip ── */}
      <div className="px-6 flex-shrink-0 border-b border-slate-200">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 py-1" role="tablist" aria-label="Sectioning Workspace Views">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={cn(
                "px-3 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all text-center leading-tight",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>


      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-hidden">

        {/* ── BATCH SECTIONING WORKSPACE ── */}
        {activeTab === "workspace" && (
          <div className="h-full flex gap-6 p-6 overflow-hidden">
            {/* LEFT PANE: UNSECTIONED POOL */}
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
                            if (checked) setSelectedAppIds(filteredPool.map((l) => l.applicationId));
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
                    {isSearching && (
                      <TableSearchIndicator colSpan={4} />
                    )}
                    <AnimatePresence>
                      {filteredPool.length === 0 && !isSearching ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-sm font-bold text-slate-400">
                            No learners match the current filters.
                          </td>
                        </tr>
                      ) : null}
                      {filteredPool.map((l) => (
                        <motion.tr
                          key={l.applicationId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn(
                            "group border-b border-slate-50 hover:bg-slate-50/50 transition-colors",
                            selectedAppIds.includes(l.applicationId) && "bg-primary/[0.02]",
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
                                  l.sex === "MALE" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600",
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
                            <span className="text-xs font-black text-slate-600">{l.genAve || "--"}</span>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* RIGHT PANE: SECTION GRID */}
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
                        isFull && "opacity-60 cursor-not-allowed bg-slate-50 grayscale",
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
                              onClick={(e) => { e.stopPropagation(); handleDownloadSF1(s.id, s.name); }}
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
        )}

        {/* ── UNSECTIONED LEARNER POOL ── */}
        {activeTab === "pool" && (
          <div className="h-full p-6">
            <Card className="h-full flex flex-col shadow-xl border-none overflow-hidden bg-white">
              <CardHeader className="border-b border-slate-50 bg-slate-50/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-black uppercase tracking-wide flex items-center gap-2 text-slate-800">
                      <Users className="h-5 w-5 text-primary" />
                      Unsectioned Learner Pool
                    </CardTitle>
                    <CardDescription className="text-xs font-bold">
                      All learners currently unassigned to any section.{" "}
                      <span className="text-primary font-black">{pool.length} remaining.</span>
                    </CardDescription>
                  </div>
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
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      <th className="p-4">#</th>
                      <th className="p-4">Learner Detail</th>
                      <th className="p-4">TLE Specialization</th>
                      <th className="p-4">Gen Ave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPool.map((l, idx) => (
                      <motion.tr
                        key={l.applicationId}
                        initial={
                          newPoolIds.has(l.applicationId)
                            ? { backgroundColor: "hsl(var(--primary) / 0.10)" }
                            : false
                        }
                        animate={{ backgroundColor: "transparent" }}
                        transition={{ duration: 1.8, ease: "easeOut" }}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="p-4">
                          <span className="text-xs font-black text-slate-300">{idx + 1}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900 uppercase">{l.lastName}, {l.firstName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase">{l.lrn}</span>
                              <span className={cn(
                                "text-[9px] font-black px-1.5 rounded-sm",
                                l.sex === "MALE" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600",
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
                          <span className="text-xs font-black text-slate-600">{l.genAve || "--"}</span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── OFFICIAL CLASS ROSTERS ── */}
        {activeTab === "rosters" && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Roster search bar */}
            <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by section, adviser, or grade..."
                  className="pl-9 h-10 border-slate-200 focus:ring-primary/20"
                  value={rosterSearchQuery}
                  onChange={(e) => setRosterSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {/* Roster table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                  <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="p-4 w-10">#</th>
                    <th className="p-4">Section</th>
                    <th className="p-4">Grade Level</th>
                    <th className="p-4">Track / Program</th>
                    <th className="p-4 text-center">Boys</th>
                    <th className="p-4 text-center">Girls</th>
                    <th className="p-4 text-center">Enrolled</th>
                    <th className="p-4 text-center">Capacity</th>
                    <th className="p-4">Fill Rate</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isRosterSearching && (
                    <TableSearchIndicator colSpan={10} />
                  )}
                  {filteredSections.length === 0 && !isRosterSearching ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-sm font-bold text-slate-400">
                        No sections match the current filter.
                      </td>
                    </tr>
                  ) : null}
                  {!isRosterSearching && filteredSections.map((s, idx) => {
                    const occupancy = (s.currentCount / s.maxCapacity) * 100;
                    const isFull = s.currentCount >= s.maxCapacity;
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-sm text-slate-400">{idx + 1}</td>
                        <td className="p-4">
                          <span className="text-sm font-black text-slate-900 uppercase">{s.name}</span>
                        </td>
                        <td className="p-4 text-sm font-bold text-slate-600">{s.gradeLevel}</td>
                        <td className="p-4">
                          {s.tleProgram ? (
                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest py-0 border-primary/20 text-primary">
                              {s.tleProgram}
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-center text-sm font-bold text-blue-600">{s.boys}</td>
                        <td className="p-4 text-center text-sm font-bold text-pink-600">{s.girls}</td>
                        <td className="p-4 text-center text-sm font-black text-slate-900">{s.currentCount}</td>
                        <td className="p-4 text-center text-sm font-bold text-slate-600">{s.maxCapacity}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Progress value={occupancy} className="h-1.5 w-16" />
                            <span className={cn("text-xs font-black", isFull ? "text-red-500" : "text-slate-500")}>
                              {Math.round(occupancy)}%
                            </span>
                            {isFull && (
                              <Badge variant="destructive" className="font-black text-[9px] tracking-widest px-1.5 py-0 uppercase">FULL</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === s.id}
                            onClick={() => handleDownloadSF1(s.id, s.name)}
                            className="h-8 gap-1.5 border-slate-200 hover:bg-primary/5"
                          >
                            {downloadingId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <FileDown className="h-3.5 w-3.5 text-slate-600" />
                            )}
                            SF1
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BOSY FINALIZATION ── */}
        {activeTab === "bosy" && (
          <div className="h-full overflow-auto p-6 flex justify-center">
            <div className="w-full max-w-2xl space-y-6">

              {/* Locked state banner */}
              {isLocked && (
                <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-black text-emerald-800 uppercase text-sm">BOSY Locked — Official Enrollment Finalized</p>
                    <p className="text-xs text-emerald-600 font-bold mt-0.5">SF1 rosters are sealed. The academic grading period is now active.</p>
                  </div>
                </div>
              )}

              {/* Readiness Metrics */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Pre-Lock Readiness Checks
                  </CardTitle>
                  <CardDescription>All blockers must be cleared before BOSY can be locked.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {[
                    { label: "Learners Sectioned", value: preLockStats?.sectionedCount, ok: true },
                    { label: "Unsectioned Learners", value: preLockStats?.unsectionedCount, ok: (preLockStats?.unsectionedCount ?? 1) === 0 },
                    { label: "Pending Verifications", value: preLockStats?.pendingCount, ok: (preLockStats?.pendingCount ?? 1) === 0 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <span className="text-sm font-bold text-slate-600">{item.label}</span>
                      <div className="flex items-center gap-2.5">
                        <span className={cn("text-sm font-black tabular-nums", item.ok ? "text-slate-900" : "text-primary")}>
                          {item.value?.toLocaleString() ?? "..."}
                        </span>
                        {item.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Lockdown Action Panel */}
              {!isLocked && (
                <Card className="shadow-sm border-primary/10">
                  <CardContent className="pt-6 space-y-6">
                    {/* System Restrictions */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                      <h4 className="text-xs font-black uppercase flex items-center gap-2 text-slate-600">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        System Restrictions After Lock
                      </h4>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          Batch Sectioning: Will be permanently disabled for this term
                        </li>
                        <li className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          Late Enrollment Flow: Will become the only admission path
                        </li>
                        <li className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          SF1 Generation: Will be enabled for all finalized sections
                        </li>
                      </ul>
                    </div>

                    {/* Blocked warning */}
                    {isLockBlocked && (
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-black text-primary uppercase">Lockdown Blocked</p>
                          <p className="text-xs font-bold text-primary mt-1 leading-relaxed">
                            {totalIncomplete} learner(s) remain unsectioned or pending. Resolve all blockers before locking.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* The lockdown button + dialog */}
                    <div className="flex flex-col items-center gap-4 pt-2">
                      <Dialog
                        open={isLockModalOpen}
                        onOpenChange={(open) => {
                          setIsLockModalOpen(open);
                          if (!open) {
                            setLockConfirmLabel("");
                            setLockConfirmTouched(false);
                            setAdminPin("");
                            setPinTouched(false);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            disabled={isLockBlocked}
                            className={cn(
                              "h-16 px-12 text-base font-black uppercase tracking-widest shadow-xl transition-all",
                              isLockBlocked
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 border-b-4 border-primary/30 active:border-b-0 active:translate-y-1",
                            )}
                          >
                            <Lock className="mr-3 h-6 w-6" />
                            🔒 Initiate BOSY Lockdown
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase text-primary flex items-center gap-2">
                              <ShieldAlert className="h-6 w-6" />
                              Authorize BOSY Lockdown
                            </DialogTitle>
                            <DialogDescription className="font-bold text-foreground pt-2">
                              You are about to end the official enrollment period for S.Y. {activeSchoolYearLabel}.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6 py-4">
                            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
                              <p className="text-sm font-bold text-primary underline uppercase">Critical Impacts:</p>
                              <ul className="text-xs font-medium space-y-1 list-disc pl-4 text-primary/80">
                                <li>Mass batch sectioning will be disabled immediately.</li>
                                <li>Registrars will transition to Late Enrollment workflow.</li>
                                <li>This action is recorded in the permanent System Audit Log.</li>
                              </ul>
                            </div>
                            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                              <p className="text-xs font-bold text-emerald-800 uppercase">PRE-FLIGHT CHECK PASSED: All learners accounted for.</p>
                            </div>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="confirm-sy-bosy" className="text-xs font-black uppercase">
                                  Type &quot;{activeSchoolYearLabel}&quot; below to confirm:
                                </Label>
                                <div className="relative">
                                  <Input
                                    id="confirm-sy-bosy"
                                    placeholder=""
                                    value={lockConfirmLabel}
                                    onChange={(e) => setLockConfirmLabel(e.target.value)}
                                    onBlur={() => setLockConfirmTouched(true)}
                                    className={cn("font-bold uppercase pr-10", lockConfirmTouched && !isLockConfirmValid && "border-primary focus-visible:ring-primary")}
                                  />
                                  {isLockConfirmValid && lockConfirmLabel !== "" && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                                      <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                  )}
                                </div>
                                {lockConfirmTouched && !isLockConfirmValid && (
                                  <p className="text-xs text-primary font-bold uppercase">School Year label does not match</p>
                                )}
                              </div>
                              <div className="space-y-3">
                                <Label className="text-xs font-black uppercase">Enter 6-Digit Admin PIN:</Label>
                                <AdminPinInput
                                  value={adminPin}
                                  onChange={setAdminPin}
                                  invalid={pinTouched && !isPinValid}
                                  onBlur={() => setPinTouched(true)}
                                  autoFocus={isLockModalOpen}
                                  disabled={isLocking}
                                  ariaLabel="BOSY lock admin PIN"
                                />
                                {pinTouched && !isPinValid && (
                                  <p className="text-xs text-primary font-bold uppercase">Valid 6-digit administrative PIN required</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsLockModalOpen(false)} disabled={isLocking}>Cancel</Button>
                            <Button
                              className={cn("font-black uppercase transition-all px-6", isLocking || !isLockConfirmValid || !isPinValid ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg border-b-4 border-primary/20 active:border-b-0 active:translate-y-1")}
                              onClick={handleLockBosy}
                              disabled={isLocking || !isLockConfirmValid || !isPinValid}
                            >
                              {isLocking ? "Locking System..." : "Confirm & Execute Lockdown"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Warning Microcopy */}
                      <p className="text-xs text-center text-slate-400 max-w-md leading-relaxed italic">
                        Locking BOSY finalizes the official class rosters, enables the generation of DepEd School Form 1 (SF1), and officially opens the academic grading period. This action requires System Admin privileges to reverse.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── FLOATING ACTION BAR (workspace tab only) ── */}
      <AnimatePresence>
        {activeTab === "workspace" && selectedAppIds.length > 0 && (
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
                    targetSectionId ? "text-primary" : "text-slate-600",
                  )}>
                    {targetSectionId
                      ? sections.find((s) => s.id === targetSectionId)?.name
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
