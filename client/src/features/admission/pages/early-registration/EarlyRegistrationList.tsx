import { useState, useEffect, useCallback } from "react";
import { Search, Eye } from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
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
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { Label } from "@/shared/ui/label";
import { format } from "date-fns";
import { ApplicationDetailPanel } from "@/features/enrollment/components/ApplicationDetailPanel";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import type { ApplicantDetail } from "@/features/enrollment/hooks/useApplicationDetail";

interface Application {
  id: number;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  trackingNumber: string;
  status: string;
  applicantType: string;
  gradeLevelId: number;
  gradeLevel: { name: string };
  strand?: { name: string } | null;
  createdAt: string;
}

const APPLICANT_TYPES = [
  { value: "ALL", label: "All Types" },
  { value: "REGULAR", label: "Regular" },
  { value: "STE", label: "STE" },
  { value: "SPA", label: "SPA" },
  { value: "SPS", label: "SPS" },
  { value: "SPJ", label: "SPJ" },
  { value: "SPFL", label: "SPFL" },
  { value: "SPTVE", label: "SPTVE" },
  { value: "STEM_GRADE11", label: "Grade 11 STEM" },
];

export default function EarlyRegistration() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);

  // Detail/Action state
  const [selectedApp, setSelectedApp] = useState<Application | ApplicantDetail | null>(null);
  const [actionType, setActionType] = useState<
    "APPROVE" | "REJECT" | "RESULT" | "ELIGIBLE" | null
  >(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [examScore, setExamScore] = useState("");
  const [examResult, setExamResult] = useState("PASSED");
  const [sections, setSections] = useState<
    {
      id: number;
      name: string;
      maxCapacity: number;
      _count: { enrollments: number };
    }[]
  >([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);

      if (status !== "ALL") {
        params.append("status", status);
      }

      if (type !== "ALL") params.append("applicantType", type);
      params.append("page", String(page));
      params.append("limit", "15");

      const res = await api.get(`/applications?${params.toString()}`);

      let filteredApps = res.data.applications;
      if (status === "ALL") {
        filteredApps = filteredApps.filter(
          (app: Application) =>
            !["ENROLLED", "PRE_REGISTERED"].includes(app.status),
        );
      }

      setApplications(filteredApps);
      setTotal(
        status === "ALL"
          ? res.data.total -
              (res.data.applications.length - filteredApps.length)
          : res.data.total,
      );
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, status, type, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchSections = async (glId: number) => {
    try {
      const res = await api.get(`/sections?gradeLevelId=${glId}`);
      setSections(res.data.sections);
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp || !selectedSectionId) return;
    try {
      await api.patch(`/applications/${selectedApp.id}/approve`, {
        sectionId: parseInt(selectedSectionId),
      });
      sileo.success({
        title: "Pre-registered",
        description: "Student moved to Enrollment phase.",
      });
      setActionType(null);
      setSelectedId(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleMarkEligible = async () => {
    if (!selectedApp) return;
    try {
      await api.patch(`/applications/${selectedApp.id}/mark-eligible`);
      sileo.success({
        title: "Eligible",
        description: "Marked as eligible for assessment.",
      });
      setActionType(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    try {
      await api.patch(`/applications/${selectedApp.id}/reject`, {
        rejectionReason,
      });
      sileo.success({
        title: "Rejected",
        description: "Application has been rejected.",
      });
      setActionType(null);
      setSelectedId(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleRecordResult = async () => {
    if (!selectedApp) return;
    try {
      await api.patch(`/applications/${selectedApp.id}/record-result`, {
        examScore: parseFloat(examScore),
        examResult,
        examNotes: "Recorded from Early Registration portal",
      });

      if (examResult === "PASSED") {
        await api.patch(`/applications/${selectedApp.id}/pass`);
      } else {
        await api.patch(`/applications/${selectedApp.id}/fail`);
      }

      sileo.success({
        title: "Result Recorded",
        description: "Applicant assessment result saved.",
      });
      setActionType(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden space-x-4">
      <div className="flex-1 flex flex-col space-y-6 overflow-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Early Registration Monitoring Dashboard
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Applicant screening and assessment workflow
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              Early Registration Queue: {total}
            </Badge>
          </div>
        </div>

        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <Label className="text-xs uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                  Search Applicant
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <Input
                    placeholder="LRN, First Name, Last Name..."
                    className="pl-9 h-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 w-full md:w-48">
                <Label className="text-xs uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                  Intake Status
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Active Intake</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="FOR_REVISION">For Revision</SelectItem>
                    <SelectItem value="ELIGIBLE">Eligible</SelectItem>
                    <SelectItem value="ASSESSMENT_SCHEDULED">
                      Exam Scheduled
                    </SelectItem>
                    <SelectItem value="ASSESSMENT_TAKEN">
                      Exam Taken
                    </SelectItem>

                    <SelectItem value="NOT_QUALIFIED">Not Qualified</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-full md:w-48">
                <Label className="text-xs uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                  Type
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICANT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="h-10 px-3"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                  setType("ALL");
                }}
              >
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-black overflow-hidden">
              <Table className="border-collapse border border-black">
                <TableHeader className="bg-[hsl(var(--primary))]">
                  <TableRow>
                    <TableHead className="border border-black text-center font-bold text-primary-foreground">
                      Applicant
                    </TableHead>
                    <TableHead className="border border-black text-center font-bold text-primary-foreground hidden md:table-cell">
                      LRN
                    </TableHead>
                    <TableHead className="border border-black text-center font-bold text-primary-foreground">
                      Grade
                    </TableHead>
                    <TableHead className="border border-black text-center font-bold text-primary-foreground hidden lg:table-cell">
                      Type
                    </TableHead>
                    <TableHead className="border border-black text-center font-bold text-primary-foreground">
                      Status
                    </TableHead>
                    <TableHead className="border border-black text-center font-bold text-primary-foreground hidden xl:table-cell">
                      Date
                    </TableHead>
                    <TableHead className="border border-black text-center font-bold text-primary-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow></TableRow>
                  ) : applications.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-sm text-[hsl(var(--muted-foreground))]"
                      >
                        No applicants found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    applications.map((app) => (
                      <TableRow
                        key={app.id}
                        className={`hover:bg-[hsl(var(--muted))] transition-colors text-center cursor-pointer ${selectedId === app.id ? "bg-[hsl(var(--muted))] shadow-inner" : ""}`}
                        onClick={() => setSelectedId(app.id)}
                      >
                        <TableCell className="border border-black">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-sm uppercase">
                              {app.lastName}, {app.firstName}
                            </span>
                            <span className="text-[hsl(var(--muted-foreground))]">
                              #{app.trackingNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="border border-black hidden md:table-cell">
                          {app.lrn}
                        </TableCell>
                        <TableCell className="border border-black">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {app.gradeLevel.name}
                            </span>
                            {app.strand && (
                              <span className="text-[hsl(var(--muted-foreground))]">
                                {app.strand.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="border border-black hidden lg:table-cell">
                          <Badge
                            variant="outline"
                            className="font-bold px-1.5 py-0 h-4 border-slate-300 text-slate-600"
                          >
                            {app.applicantType}
                          </Badge>
                        </TableCell>
                        <TableCell className="border border-black">
                          <StatusBadge status={app.status} />
                        </TableCell>
                        <TableCell className="border border-black text-[hsl(var(--muted-foreground))] hidden xl:table-cell">
                          {format(new Date(app.createdAt), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="border border-black text-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs font-medium bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(app.id);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Showing {applications.length} applicants
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Badge variant="secondary" className="px-3 h-8">
                  Page {page}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 15 >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TIER 1 - SLIDE-OVER PANEL */}
      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-[90%] md:w-[45%] min-w-[480px] max-w-[640px] p-0 flex flex-col border-l"
        >
          {selectedId && (
            <ApplicationDetailPanel
              id={selectedId}
              onClose={() => setSelectedId(null)}
              onApprove={() => {
                const app = applications.find((a) => a.id === selectedId);
                if (app) {
                  setSelectedApp(app);
                  setActionType("APPROVE");
                  fetchSections(app.gradeLevelId);
                }
              }}
              onReject={() => {
                const app = applications.find((a) => a.id === selectedId);
                if (app) {
                  setSelectedApp(app);
                  setActionType("REJECT");
                }
              }}
              onScheduleExam={async () => {
                const app = applications.find((a) => a.id === selectedId);
                if (app) {
                  setLoading(true);
                  try {
                    const fullRes = await api.get(
                      `/applications/${selectedId}`,
                    );
                    setSelectedApp(fullRes.data);
                    setIsScheduleDialogOpen(true);
                  } catch (err) {
                    toastApiError(err as never);
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              onRecordResult={() => {
                const app = applications.find((a) => a.id === selectedId);
                if (app) {
                  setSelectedApp(app);
                  setActionType("RESULT");
                }
              }}
              onPass={async () => {
                try {
                  await api.patch(`/applications/${selectedId}/pass`);
                  sileo.success({
                    title: "Passed",
                    description: "Applicant marked as PASSED.",
                  });
                  fetchData();
                  // Re-fetch detail panel content implicitly by state updates or let the user close/re-open.
                  // But usually useApplicationDetail will refetch or we can just trigger a list refetch which is fine.
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
              onFail={async () => {
                try {
                  await api.patch(`/applications/${selectedId}/fail`);
                  sileo.success({
                    title: "Failed",
                    description: "Applicant marked as FAILED.",
                  });
                  fetchData();
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
              onOfferRegular={() => {
                const app = applications.find((a) => a.id === selectedId);
                if (app) {
                  setSelectedApp(app);
                  setActionType("APPROVE"); // reuse APPROVE dialog for section selection
                  fetchSections(app.gradeLevelId);
                }
              }}
              onTemporarilyEnroll={async () => {
                if (
                  !confirm(
                    "Mark this applicant as temporarily enrolled? This means they can attend classes while documents are pending.",
                  )
                )
                  return;
                try {
                  await api.patch(
                    `/applications/${selectedId}/temporarily-enroll`,
                  );
                  sileo.success({
                    title: "Updated",
                    description: "Applicant is now temporarily enrolled.",
                  });
                  fetchData();
                } catch (e) {
                  toastApiError(e as never);
                }
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Action Dialogs */}
      <Dialog
        open={actionType !== null}
        onOpenChange={(open) => !open && setActionType(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === "APPROVE" && "Approve & Pre-register"}
              {actionType === "ELIGIBLE" && "Mark as Eligible"}
              {actionType === "REJECT" && "Reject Application"}
              {actionType === "RESULT" && "Record Assessment Result"}
            </DialogTitle>
            <DialogDescription>
              Candidate: {selectedApp?.lastName}, {selectedApp?.firstName}
            </DialogDescription>
          </DialogHeader>

          {actionType === "ELIGIBLE" && (
            <div className="py-4">
              <p className="text-sm">
                Marking this applicant as{" "}
                <span className="font-bold text-cyan-700">ELIGIBLE</span> means
                their documents are verified and they are cleared for assessment
                or direct pre-registration.
              </p>
            </div>
          )}

          {actionType === "APPROVE" && (
            <div className="space-y-4 py-4">
              <p className="text-xs text-emerald-700 font-medium">
                This candidate will be moved to the Enrollment phase and
                assigned to a section.
              </p>
              <div className="space-y-2">
                <Label>Select Section for {selectedApp?.gradeLevel.name}</Label>
                <Select
                  value={selectedSectionId}
                  onValueChange={setSelectedSectionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a section..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={String(s.id)}
                        disabled={s._count.enrollments >= s.maxCapacity}
                      >
                        {s.name} ({s._count.enrollments}/{s.maxCapacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {actionType === "REJECT" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason for Rejection</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Explain why this application is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          )}

          {actionType === "RESULT" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Score / Rating</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 85.5"
                  value={examScore}
                  onChange={(e) => setExamScore(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Final Verdict</Label>
                <Select value={examResult} onValueChange={setExamResult}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASSED">
                      PASSED - Qualifies for Program
                    </SelectItem>
                    <SelectItem value="FAILED">
                      FAILED - Did not meet criteria
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            {actionType === "ELIGIBLE" && (
              <Button
                className="bg-cyan-600 hover:bg-cyan-700"
                onClick={handleMarkEligible}
              >
                Confirm Eligibility
              </Button>
            )}
            {actionType === "APPROVE" && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleApprove}
                disabled={!selectedSectionId}
              >
                Confirm Pre-registration
              </Button>
            )}
            {actionType === "REJECT" && (
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason}
              >
                Reject Application
              </Button>
            )}
            {actionType === "RESULT" && (
              <Button onClick={handleRecordResult}>Save Result</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScheduleExamDialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
        applicant={selectedApp as ApplicantDetail | null}
        onSuccess={fetchData}
      />
    </div>
  );
}
