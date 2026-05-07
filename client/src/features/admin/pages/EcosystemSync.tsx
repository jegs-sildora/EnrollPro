import { useState, useEffect } from "react";
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
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);

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

  useEffect(() => {
    fetchEntities();
  }, [view, gradeFilter, statusFilter, debouncedSearch, page, limit]);

  const fetchEntities = async () => {
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
    } catch (error) {
      sileo.error({
        title: "Failed to fetch status",
        description: "Could not retrieve ecosystem sync statuses.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const res = await api.get("/integration/v1/sections");
      setSections(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSync = async () => {
    if (entities.length === 0) return;

    try {
      const type = view === "learners" ? "LEARNER" : "TEACHER";
      const res = await api.post("/integration/v1/ecosystem/sync", {
        type,
        deltaOnly: true,
      });

      const jobId = res.data.data.jobId;
      startPolling(jobId);
      sileo.info({
        title: "Sync Started",
        description: `Synchronizing ${res.data.data.count} ${type.toLowerCase()} accounts...`,
      });
    } catch (error) {
      sileo.error({
        title: "Sync Failed",
        description: "Could not trigger synchronization.",
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
          setTimeout(() => setSyncJob(null), 3000);
          fetchEntities();
          if (job.status === "COMPLETED") {
            sileo.success({
              title: "Sync Completed",
              description: `Successfully processed ${job.total} operations.`,
            });
          }
        }
      } catch (error) {
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
      {/* ── Header Area ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black  text-primary uppercase">
              Ecosystem Synchronization
            </h1>
            <p className="text-sm text-foreground font-bold">
              Manage Single Sign-On (SSO) credentials and subsystem health
              across ATLAS, SMART, and AIMS.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="h-9 font-bold gap-2 relative"
              onClick={handleSync}
              disabled={!!syncJob || loading || pendingCount === 0}>
              {syncJob ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCcw className="size-4" />
              )}
              {syncJob
                ? `Syncing... ${syncJob.progress}%`
                : "Sync Pending & Failed"}
              {!syncJob && pendingCount > 0 && (
                <span className="absolute -top-2 -right-2 size-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-black border-2 border-background animate-in zoom-in duration-300">
                  {pendingCount}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              className="h-9 font-bold gap-2"
              onClick={() => {
                fetchSections();
                setIsPrintModalOpen(true);
              }}>
              <Printer className="size-4" />
              Print Section Credentials
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
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase r text-primary">
                    BATCH SYNC: Pushing updates to ATLAS, SMART, and AIMS...
                  </span>
                  <span className="text-xs font-black">
                    {syncJob.progress}%
                  </span>
                </div>
                <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
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
      <Card className="border-none shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 min-w-[200px]">
            <Select
              value={view}
              onValueChange={(val) => {
                setView(val);
                setPage(1);
              }}>
              <SelectTrigger className="h-9 font-bold">
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
            <div className="flex items-center gap-2 min-w-[150px]">
              <Select
                value={gradeFilter}
                onValueChange={(val) => {
                  setGradeFilter(val);
                  setPage(1);
                }}>
                <SelectTrigger className="h-9 font-bold">
                  <SelectValue placeholder="Grade Level" />
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

          <div className="flex items-center gap-2 min-w-[150px]">
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 font-bold">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="all"
                  className="font-bold text-xs uppercase">
                  All Statuses
                </SelectItem>
                <SelectItem
                  value="pending"
                  className="font-bold text-xs uppercase">
                  Pending Sync
                </SelectItem>
                <SelectItem
                  value="synced"
                  className="font-bold text-xs uppercase">
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

          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground" />
            <Input
              placeholder="Search by name, LRN, or Employee ID..."
              className="h-9 pl-9 font-bold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchEntities()}
            disabled={loading}>
            <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardContent>
      </Card>

      {/* ── Matrix Table ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden min-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary border-none">
              <TableHead className="w-[300px] font-black uppercase st text-center text-primary-foreground py-4">
                User Details
              </TableHead>
              <TableHead className="font-black uppercase st text-center text-primary-foreground border-r border-dashed border-primary-foreground/10">
                EnrollPro (IdP)
              </TableHead>
              <TableHead className="font-black uppercase st text-center text-primary-foreground">
                A.T.L.A.S.
              </TableHead>
              <TableHead className="font-black uppercase st text-center text-primary-foreground">
                S.M.A.R.T.
              </TableHead>
              <TableHead className="font-black uppercase st text-center text-primary-foreground">
                A.I.M.S.
              </TableHead>
              <TableHead className="w-[100px] text-primary-foreground"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-80 text-center align-middle text-foreground font-bold uppercase text-xs">
                  <Loader2 className="size-6 animate-spin mx-auto mb-2 opacity-50" />
                  Loading records...
                </TableCell>
              </TableRow>
            ) : entities.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-80 text-center align-middle text-foreground font-bold uppercase text-xs">
                  No records found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              entities.map((entity) => (
                <TableRow
                  key={`${entity.type}-${entity.id}`}
                  className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0 uppercase">
                        {entity.name.split(",")[0].substring(0, 1)}
                        {entity.name.split(" ")[1]?.substring(0, 1)}
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold text-sm uppercase">
                          {entity.name}
                        </span>
                        <span className="text-xs font-bold text-foreground er uppercase">
                          {entity.type === "LEARNER" ? "LRN" : "EMP"}:{" "}
                          {entity.identifier}
                          {entity.grade && ` • ${entity.grade}`}
                          {entity.section && ` - ${entity.section}`}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center relative border-r border-dashed border-border/50">
                    <div className="flex items-center justify-center gap-2">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-bold text-xs gap-1 px-2 py-0.5">
                        <CheckCircle2 className="size-3" />
                        ACTIVE
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
                      {getStatusBadge("AIMS", entity.syncStatuses, entity.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="size-4" />
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
            itemName={view === "learners" ? "Learners" : "Teachers"}
          />
        )}
      </div>

      {/* ── Subsystem Health Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <Card className="shadow-none border ">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase st text-foreground">
                A.T.L.A.S.
              </span>
              <CardTitle className="text-sm font-black">
                SCHEDULING SYNC
              </CardTitle>
            </div>
            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black er">
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
            <p className="text-xs font-bold text-foreground uppercase">
              {
                entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "ATLAS" && s.status === "SYNCED",
                  ),
                ).length
              }{" "}
              Records Synced
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none border ">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase st text-foreground">
                S.M.A.R.T.
              </span>
              <CardTitle className="text-sm font-black">
                LEARNING PORTAL
              </CardTitle>
            </div>
            <div className="size-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black er">
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
            <p className="text-xs font-bold text-foreground uppercase">
              {
                entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "SMART" && s.status === "SYNCED",
                  ),
                ).length
              }{" "}
              Records Synced
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none border ">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase st text-foreground">
                A.I.M.S.
              </span>
              <CardTitle className="text-sm font-black">
                ARCHIVAL SYNC
              </CardTitle>
            </div>
            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black er">
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
            <p className="text-xs font-bold text-foreground uppercase">
              {
                entities.filter((e) =>
                  e.syncStatuses.some(
                    (s) => s.ecosystem === "AIMS" && s.status === "SYNCED",
                  ),
                ).length
              }{" "}
              Records Synced
            </p>
          </CardContent>
        </Card>
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
    </div>
  );
}
