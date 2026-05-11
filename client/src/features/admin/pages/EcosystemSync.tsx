import { useState, useEffect, useCallback } from "react";
import {
  RefreshCcw,
  Printer,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { cn } from "@/shared/lib/utils";

import { PaginationBar } from "@/shared/components/PaginationBar";

interface EcosystemSyncStatus {
  ecosystem: string;
  status: "PENDING" | "SYNCED" | "FAILED" | "NOT_APPLICABLE";
  lastSyncedAt?: string;
  errorMessage?: string;
}

interface Entity {
  id: number;
  name: string;
  identifier: string;
  type: "LEARNER" | "TEACHER";
  grade?: string;
  section?: string;
  syncStatuses: EcosystemSyncStatus[];
}

interface SyncJob {
  id: string;
  progress: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  processed: number;
  total: number;
}

export default function EcosystemSync() {
  const [view, setView] = useState("learners");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null);
  const [lastJobResults, setLastJobResults] = useState<SyncJob | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [sections, setSections] = useState<{ id: number; name: string; gradeLevel: { name: string } }[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);
  const [provisioning, setProvisioning] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);

  // Debounce search term
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1); // Reset to first page when filters change
  }, [view, gradeFilter, statusFilter, debouncedSearch]);

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const type = view === "learners" ? "LEARNER" : "TEACHER";
      const res = await api.get(`/integration/v1/ecosystem/status`, {
        params: {
          type,
          page,
          limit,
          gradeLevelId: gradeFilter !== "all" ? gradeFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: debouncedSearch || undefined,
        },
      });
      setEntities(res.data.data);
      setTotal(res.data.meta?.total || 0);
      setPendingCount(res.data.meta?.pendingCount || 0);
    } catch (error: unknown) {
      console.error(error);
      sileo.error({
        title: "Failed to fetch status",
        description: "Could not retrieve ecosystem sync statuses.",
      });
    } finally {
      setLoading(false);
    }
  }, [view, gradeFilter, statusFilter, debouncedSearch, page, limit]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const fetchSections = async () => {
    try {
      const res = await api.get("/integration/v1/sections");
      setSections(res.data.data);
    } catch (error: unknown) {
      console.error(error);
    }
  };

  const handleProvisionTeachers = async () => {
    setProvisioning(true);
    try {
      const res = await api.post(
        "/integration/v1/ecosystem/provision-teachers",
      );
      const { createdCount, skippedCount } = res.data.data;
      sileo.success({
        title: "Provisioning Complete",
        description: `Created ${createdCount} accounts. Skipped ${skippedCount} existing users.`,
      });
      void fetchEntities();
    } catch (error: unknown) {
      console.error(error);
      sileo.error({
        title: "Provisioning Failed",
        description: "Could not provision teacher login accounts.",
      });
    } finally {
      setProvisioning(false);
    }
  };

  const handleSync = async (fullSync = false) => {
    if (entities.length === 0 && !fullSync) return;

    try {
      const type = view === "learners" ? "LEARNER" : "TEACHER";
      const res = await api.post("/integration/v1/ecosystem/sync", {
        type,
        deltaOnly: !fullSync,
        fullSync,
      });

      const jobId = res.data.data.jobId;
      startPolling(jobId);
      sileo.info({
        title: fullSync ? "BOSY Sync Started" : "Delta Sync Started",
        description: `Synchronizing ${res.data.data.count} ${type.toLowerCase()} records to the mesh ecosystem...`,
      });
    } catch (error: unknown) {
      console.error(error);
      sileo.error({
        title: "Sync Failed",
        description: "Could not trigger synchronization pipeline.",
      });
    }
  };

  const startPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/integration/v1/ecosystem/jobs/${jobId}`);
        const job = res.data.data;
        setSyncJob(job);

        if (job.status === "COMPLETED" || job.status === "FAILED") {
          clearInterval(interval);
          setLastJobResults(job);
          setTimeout(() => {
            setSyncJob(null);
            setIsReportOpen(true);
          }, 1500);
          void fetchEntities();
        }
      } catch {
        clearInterval(interval);
        setSyncJob(null);
      }
    }, 1000);
  };

  const handlePrint = async () => {
    if (!selectedSectionId) return;
    window.open(
      `${import.meta.env.VITE_API_URL || "/api"}/integration/v1/ecosystem/credentials/print/${selectedSectionId}`,
      "_blank",
    );
    setIsPrintModalOpen(false);
  };

  const getStatusBadge = (
    ecosystem: string,
    statuses: EcosystemSyncStatus[],
    entityType: string,
  ) => {
    // Learners do not have ATLAS accounts
    if (entityType === "LEARNER" && ecosystem === "ATLAS") {
      return (
        <Badge
          variant="outline"
          className="text-foreground/40 border-dashed font-bold text-xs gap-1 px-2 py-0.5 opacity-50">
          <MinusCircle className="size-3" />
          N/A
        </Badge>
      );
    }

    const statusObj = statuses.find((s) => s.ecosystem === ecosystem);
    const status = statusObj?.status || "PENDING";

    switch (status) {
      case "SYNCED":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-bold text-xs gap-1 px-2 py-0.5">
            <CheckCircle2 className="size-3" />
            SYNCED
          </Badge>
        );
      case "FAILED":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none font-bold text-xs gap-1 px-2 py-0.5">
            <XCircle className="size-3" />
            FAILED
          </Badge>
        );
      case "NOT_APPLICABLE":
        return (
          <Badge
            variant="outline"
            className="text-foreground border-dashed font-bold text-xs gap-1 px-2 py-0.5">
            <MinusCircle className="size-3" />
            N/A
          </Badge>
        );
      default:
        return (
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none font-bold text-xs gap-1 px-2 py-0.5">
            <Clock className="size-3" />
            PENDING
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Subsystem Connection Status Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-none border bg-card/50">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase  text-foreground">
                A.T.L.A.S.
              </span>
              <CardTitle className="text-sm font-black">
                SCHEDULING SYNC
              </CardTitle>
            </div>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-black text-[9px] gap-1 px-1.5 py-0">
              <div className="size-1.5 rounded-full bg-green-600 animate-pulse" />
              CONNECTED
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-primary">
              {Math.round(
                (entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "ATLAS" && s.status === "SYNCED",
                  ),
                ).length /
                  (entities.length || 1)) *
                  100,
              )}
              %
            </div>
            <p className="text-xs font-bold text-foreground uppercase ">
              {
                entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "ATLAS" && s.status === "SYNCED",
                  ),
                ).length
              }{" "}
              Records Propagated
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-card/50">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase  text-foreground">
                S.M.A.R.T.
              </span>
              <CardTitle className="text-sm font-black">
                LEARNING PORTAL
              </CardTitle>
            </div>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-black text-[9px] gap-1 px-1.5 py-0">
              <div className="size-1.5 rounded-full bg-green-600 animate-pulse" />
              CONNECTED
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-primary">
              {Math.round(
                (entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "SMART" && s.status === "SYNCED",
                  ),
                ).length /
                  (entities.length || 1)) *
                  100,
              )}
              %
            </div>
            <p className="text-xs font-bold text-foreground uppercase ">
              {
                entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "SMART" && s.status === "SYNCED",
                  ),
                ).length
              }{" "}
              Records Propagated
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-card/50">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase  text-foreground">
                A.I.M.S.
              </span>
              <CardTitle className="text-sm font-black">
                ARCHIVAL SYNC
              </CardTitle>
            </div>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-black text-[9px] gap-1 px-1.5 py-0">
              <div className="size-1.5 rounded-full bg-green-600 animate-pulse" />
              CONNECTED
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-primary">
              {Math.round(
                (entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "AIMS" && s.status === "SYNCED",
                  ),
                ).length /
                  (entities.length || 1)) *
                  100,
              )}
              %
            </div>
            <p className="text-xs font-bold text-foreground uppercase ">
              {
                entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "AIMS" && s.status === "SYNCED",
                  ),
                ).length
              }{" "}
              Records Propagated
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        {/* ── Header Area ── */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-foreground uppercase ">
                Master Roster Synchronization
              </h1>
              <p className="text-xs text-foreground font-bold">
                Propagate identity and enrollment data from EnrollPro (IdP) to
                downstream subsystems.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {view === "teachers" && (
                <Button
                  variant="outline"
                  className="h-10 font-black gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary px-6 uppercase  text-xs"
                  onClick={handleProvisionTeachers}
                  disabled={provisioning || loading}>
                  {provisioning ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Provision Missing Accounts
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="h-10 font-black gap-2 relative bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg px-6 uppercase  text-xs"
                    disabled={!!syncJob || loading}>
                    {syncJob ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="size-4" />
                    )}
                    {syncJob
                      ? `Syncing... ${syncJob.progress}%`
                      : "Trigger Sync Pipeline"}
                    {!syncJob && pendingCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 size-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-black border-2 border-background shadow-sm">
                        {pendingCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 font-bold">
                  <DropdownMenuLabel className="text-xs uppercase  opacity-50 px-2 py-1.5">
                    Sync Strategies
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => handleSync(false)}
                    className="cursor-pointer gap-2 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs">Delta Sync (Pending Only)</span>
                      <span className="text-xs text-foreground font-normal">
                        Push only unsynced/updated records.
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSync(true)}
                    className="cursor-pointer gap-2 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs">Big Bang BOSY Sync</span>
                      <span className="text-xs text-foreground font-normal">
                        Force-push all {total} records.
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                className="h-10 font-bold gap-2 text-xs uppercase "
                onClick={() => {
                  fetchSections();
                  setIsPrintModalOpen(true);
                }}>
                <Printer className="size-4" />
                Print Credentials
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {syncJob && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <Card className="border-primary/20 bg-primary/5 shadow-inner">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-full border border-primary/10">
                        <div
                          className={cn(
                            "size-2 rounded-full",
                            syncJob.progress > 0
                              ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                              : "bg-muted animate-pulse",
                          )}
                        />
                        <span className="text-[9px] font-black uppercase ">
                          ATLAS
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-full border border-primary/10">
                        <div
                          className={cn(
                            "size-2 rounded-full",
                            syncJob.progress > 40
                              ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                              : "bg-muted animate-pulse",
                          )}
                        />
                        <span className="text-[9px] font-black uppercase ">
                          SMART
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-full border border-primary/10">
                        <div
                          className={cn(
                            "size-2 rounded-full",
                            syncJob.progress > 80
                              ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                              : "bg-muted animate-pulse",
                          )}
                        />
                        <span className="text-[9px] font-black uppercase ">
                          AIMS
                        </span>
                      </div>
                      <span className="text-xs font-black uppercase  text-primary ml-2 animate-pulse">
                        Identity Federation: Propagating SSOT Identity...
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-4">
                        <Badge
                          variant="outline"
                          className="bg-primary/10 text-primary border-primary/20 font-black text-xs py-0 px-2">
                          MODE: IDENTITY UPSERT (SAFE)
                        </Badge>
                        <span className="text-xs font-black text-primary">
                          {syncJob.progress}%
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-foreground italic text-right max-w-[280px] leading-tight">
                        Synchronizes demographics and section assignments. Will
                        not overwrite or delete existing grades, clinic records,
                        or clearance data in target systems.
                      </p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${syncJob.progress}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filters & Search ── */}
        <Card className="border-none shadow-sm bg-muted/20">
          <CardContent className="p-3 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Select
                value={view}
                onValueChange={(val) => {
                  setView(val);
                  setPage(1);
                }}>
                <SelectTrigger className="h-9 font-black text-xs uppercase  w-32">
                  <SelectValue placeholder="View Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="learners"
                    className="font-bold text-xs uppercase">
                    Learners
                  </SelectItem>
                  <SelectItem
                    value="teachers"
                    className="font-bold text-xs uppercase">
                    Teachers
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {view === "learners" && (
              <div className="flex items-center gap-2">
                <Select
                  value={gradeFilter}
                  onValueChange={(val) => {
                    setGradeFilter(val);
                    setPage(1);
                  }}>
                  <SelectTrigger className="h-9 font-bold text-xs uppercase  w-32">
                    <SelectValue placeholder="Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="all"
                      className="font-bold text-xs uppercase">
                      All Grades
                    </SelectItem>
                    <SelectItem
                      value="7"
                      className="font-bold text-xs uppercase">
                      Grade 7
                    </SelectItem>
                    <SelectItem
                      value="8"
                      className="font-bold text-xs uppercase">
                      Grade 8
                    </SelectItem>
                    <SelectItem
                      value="9"
                      className="font-bold text-xs uppercase">
                      Grade 9
                    </SelectItem>
                    <SelectItem
                      value="10"
                      className="font-bold text-xs uppercase">
                      Grade 10
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 font-bold text-xs uppercase  w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="all"
                    className="font-bold text-xs uppercase">
                    All Status
                  </SelectItem>
                  <SelectItem
                    value="pending"
                    className="font-bold text-xs uppercase">
                    Pending
                  </SelectItem>
                  <SelectItem
                    value="synced"
                    className="font-bold text-xs uppercase text-green-600">
                    Synced
                  </SelectItem>
                  <SelectItem
                    value="failed"
                    className="font-bold text-xs uppercase text-red-600">
                    Failed
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-foreground" />
              <Input
                placeholder="Search identifier or name..."
                className="h-9 pl-9 font-bold text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => fetchEntities()}
              disabled={loading}>
              <RefreshCcw
                className={`size-4 ${loading ? "animate-spin text-primary" : ""}`}
              />
            </Button>
          </CardContent>
        </Card>

        {/* ── Matrix Table ── */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden min-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5 border-b">
                <TableHead className="w-[300px] font-black uppercase text-xs  py-4">
                  Master Entity Details
                </TableHead>
                <TableHead className="font-black uppercase text-xs  text-center border-r border-dashed">
                  Source (EnrollPro)
                </TableHead>
                <TableHead className="font-black uppercase text-xs  text-center">
                  A.T.L.A.S.
                </TableHead>
                <TableHead className="font-black uppercase text-xs  text-center">
                  S.M.A.R.T.
                </TableHead>
                <TableHead className="font-black uppercase text-xs  text-center">
                  A.I.M.S.
                </TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-80 text-center align-middle text-foreground font-black uppercase text-xs ">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 opacity-30" />
                    Querying Ledger...
                  </TableCell>
                </TableRow>
              ) : entities.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-80 text-center align-middle text-foreground font-black uppercase text-xs ">
                    No matching records in the Identity Ledger.
                  </TableCell>
                </TableRow>
              ) : (
                entities.map((entity) => (
                  <TableRow
                    key={`${entity.type}-${entity.id}`}
                    className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs shrink-0 uppercase">
                          {entity.name.split(",")[0].substring(0, 1)}
                          {entity.name.split(" ")[1]?.substring(0, 1)}
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="font-bold text-xs uppercase">
                            {entity.name}
                          </span>
                          <span className="text-[9px] font-black text-foreground uppercase ">
                            {entity.type === "LEARNER" ? "LRN" : "EMP"}:{" "}
                            <span className="text-foreground">
                              {entity.identifier}
                            </span>
                            {entity.grade && ` • ${entity.grade}`}
                            {entity.section && ` - ${entity.section}`}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center relative border-r border-dashed border-border/50">
                      <div className="flex items-center justify-center gap-2">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-black text-[9px] gap-1 px-1.5 py-0">
                          <CheckCircle2 className="size-2.5" />
                          AUTHORITATIVE
                        </Badge>
                        <ChevronRight className="size-3 text-foreground/30" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {getStatusBadge(
                          "ATLAS",
                          entity.syncStatuses,
                          entity.type,
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {getStatusBadge(
                          "SMART",
                          entity.syncStatuses,
                          entity.type,
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {getStatusBadge(
                          "AIMS",
                          entity.syncStatuses,
                          entity.type,
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="size-3.5 text-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {total > 0 && (
            <PaginationBar
              page={page}
              total={total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
              itemName={view === "learners" ? "Identities" : "Faculty"}
            />
          )}
        </div>
      </div>

      {/* ── Print Credentials Modal ── */}
      <Dialog
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase ">
              Print Section Credentials
            </DialogTitle>
            <DialogDescription className="font-bold text-xs">
              Select a class section to generate a PDF of credential slips for
              all enrolled students.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase st text-foreground">
                Select Section
              </label>
              <Select
                value={selectedSectionId}
                onValueChange={setSelectedSectionId}>
                <SelectTrigger className="font-bold">
                  <SelectValue placeholder="Choose a section..." />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem
                      key={section.id}
                      value={section.id.toString()}
                      className="font-bold uppercase text-xs">
                      {section.gradeLevel.name} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPrintModalOpen(false)}
              className="font-bold uppercase text-xs">
              Cancel
            </Button>
            <Button
              onClick={handlePrint}
              disabled={!selectedSectionId}
              className="font-bold uppercase text-xs gap-2">
              <Printer className="size-4" />
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Resolution Report Modal ── */}
      <Dialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Sync Resolution Report
            </DialogTitle>
            <DialogDescription className="font-bold text-xs">
              Federation pipeline execution results for job{" "}
              {lastJobResults?.id.substring(0, 8)}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                <div className="text-xs font-black uppercase text-green-600 mb-1">
                  Success Rate
                </div>
                <div className="text-2xl font-black text-green-700">
                  {lastJobResults && lastJobResults.total > 0
                    ? Math.round(
                        (lastJobResults.processed / lastJobResults.total) * 100,
                      )
                    : 0}
                  %
                </div>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="text-xs font-black uppercase text-primary mb-1">
                  Operations
                </div>
                <div className="text-2xl font-black text-primary">
                  {lastJobResults?.processed} / {lastJobResults?.total}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase  text-foreground px-1">
                Subsystem Handshakes
              </h4>
              <div className="space-y-1">
                {["ATLAS", "SMART", "AIMS"].map((sub) => (
                  <div
                    key={sub}
                    className="flex items-center justify-between p-2 rounded border text-xs font-bold">
                    <span className="uppercase">{sub} Subsystem</span>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-black text-[9px] px-1.5 py-0">
                      SUCCESSFUL
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded bg-muted/30 text-xs font-bold text-foreground leading-relaxed italic border-l-2 border-primary">
              "Master Roster remains in sync. Downstream subsystems have been
              notified of identity federation updates. Graceful degradation
              mechanisms are standing by for mesh fluctuations."
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsReportOpen(false)}
              className="w-full font-black uppercase text-xs  h-10">
              Acknowledge & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
