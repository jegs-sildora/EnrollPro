import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ChangeEvent } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  Users,
  FileDown,
  AlertTriangle,
  UserPlus,
  Venus,
  Mars,
  Eye,
  Loader2,
  ChevronDown,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { StudentDetailPanel } from "@/features/students/components/StudentDetailPanel";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { sileo } from "sileo";
import { useRetainedSheetValue } from "@/shared/hooks/useRetainedSheetValue";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { useHeaderStore } from "@/store/header.slice";
import { DataTableSkeleton } from "@/shared/components/PageLoadingSkeleton";
import { useRealtimeRefresh } from "@/shared/hooks/useRealtimeRefresh";
import type {
  RealtimeInvalidationTopic,
  Sf1ImportCommitInput,
  Sf1ImportCommitResponse,
  Sf1ImportPreviewResponse,
  Sf1ImportPreviewRow,
} from "@enrollpro/shared";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

import InsertLateEnrolleeDrawer from "../components/InsertLateEnrolleeDrawer";
import { PageTransition } from "@/shared/components/PageTransition";

const MASTERLIST_REALTIME_TOPICS: RealtimeInvalidationTopic[] = [
  "homerooms:sections",
  "sectioning:sections",
  "students:list",
  "students:detail",
  "teachers:list",
];

interface LearnerRecord {
  id: number;
  enrollmentApplicationId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  status: string;
  applicantType: string;
  enrolledAt: string;
  sectioningMethod: string;
  dateSectioned: string | null;
  sf1Remarks: string | null;
  birthdate: string;
}

interface SectionDetails {
  id: number;
  name: string;
  maxCapacity: number;
  programType: string;
  gradeLevel: string;
  gradeLevelId: number;
  schoolYearId: number;
  advisingTeacher: { id: number; name: string } | null;
}

interface MasterlistResponse {
  section: SectionDetails;
  learners: LearnerRecord[];
}

interface SectionTeacherOption {
  id: number;
  name: string;
}

interface SectionTeachersResponse {
  teachers: SectionTeacherOption[];
}

function downloadBrowserFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  anchor.remove();
}

function sanitizeFilenamePart(value: string | null | undefined): string {
  return (value || "section").replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function getSf1RowName(row: Sf1ImportPreviewRow): string {
  const givenNames = [row.firstName, row.middleName, row.extensionName]
    .filter(Boolean)
    .join(" ");
  if (row.lastName && givenNames) return `${row.lastName}, ${givenNames}`;
  return row.lastName ?? givenNames;
}

function getSf1StatusLabel(row: Sf1ImportPreviewRow): string {
  if (row.matchStatus === "VALID_NEW_LEARNER") return "Valid New Learner";
  if (row.matchStatus === "VALID_EXISTING_LEARNER") return "Valid Existing Learner";
  return "Blocked";
}

export interface ViewMasterlistProps {
  sectionId?: number;
  onBack?: () => void;
  mode?: "homeroom" | "sectioning";
}

export default function ViewMasterlist({ sectionId: propSectionId, onBack, mode = "homeroom" }: ViewMasterlistProps = {}) {
  const params = useParams();
  const resolvedSectionId = propSectionId || Number(params.sectionId);

  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const { ayLabel } = useSchoolYearContext();
  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sf1FileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [exportingSf1, setExportingSf1] = useState(false);
  const [downloadingSf1Template, setDownloadingSf1Template] = useState(false);
  const [previewingSf1, setPreviewingSf1] = useState(false);
  const [committingSf1, setCommittingSf1] = useState(false);
  const [sf1PreviewOpen, setSf1PreviewOpen] = useState(false);
  const [sf1PreviewFileName, setSf1PreviewFileName] = useState("");
  const [sf1Preview, setSf1Preview] = useState<Sf1ImportPreviewResponse | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [unassignProcessingId, setUnassignProcessingId] = useState<number | null>(null);

  const [section, setSection] = useState<SectionDetails | null>(null);
  const [masterlist, setMasterlist] = useState<LearnerRecord[]>([]);
  const [teachers, setTeachers] = useState<SectionTeacherOption[]>([]);
  const retainedStudentId = useRetainedSheetValue(selectedStudentId);

  const fetchMasterlistData = useCallback(async () => {
    if (!resolvedSectionId || !ayId) return;
    setLoading(true);
    try {
      const [masterlistRes, teachersRes] = await Promise.all([
        api.get<MasterlistResponse>(`/sections/${resolvedSectionId}/masterlist`),
        api.get<SectionTeachersResponse>(`/sections/teachers?schoolYearId=${ayId}`)
      ]);

      if (masterlistRes.data.section.schoolYearId !== ayId && !propSectionId) {
        navigate("/sections", { replace: true });
        return;
      }

      setSection(masterlistRes.data.section);
      setMasterlist(masterlistRes.data.learners);
      setTeachers(teachersRes.data.teachers);
    } catch (err: unknown) {
      console.error(err);
      sileo.error({ title: "Error", description: "Failed to load masterlist data." });
    } finally {
      setLoading(false);
    }
  }, [resolvedSectionId, ayId, propSectionId, navigate]);

  useEffect(() => {
    void fetchMasterlistData();
  }, [fetchMasterlistData]);

  useRealtimeRefresh({
    topics: MASTERLIST_REALTIME_TOPICS,
    schoolYearId: ayId,
    onRefresh: fetchMasterlistData,
  });

  const handleUnassign = async (enrollmentApplicationId: number) => {
    setUnassignProcessingId(enrollmentApplicationId);
    try {
      await api.post(`/sectioning/masterlist/unassign`, {
        enrollmentApplicationId,
        reason: "Manual unassignment to pool",
      });
      sileo.success({
        title: "Unassigned",
        description: "Learner returned to unassigned pool.",
      });
      void queryClient.invalidateQueries({ queryKey: ["sectioning", "pool"] });
      void queryClient.invalidateQueries({ queryKey: ["sectioning", "sections-summary"] });
      void fetchMasterlistData();
    } catch (err: any) {
      sileo.error({
        title: "Failed",
        description: err.response?.data?.message || "Could not unassign learner.",
      });
    } finally {
      setUnassignProcessingId(null);
    }
  };

  const handleDownloadSf1 = async () => {
    if (!resolvedSectionId) return;
    setExportingSf1(true);
    try {
      const res = await api.get(`/sections/${resolvedSectionId}/masterlist/sf1`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBrowserFile(
        blob,
        `SF1_${sanitizeFilenamePart(section?.gradeLevel)}_${sanitizeFilenamePart(section?.name)}_${sanitizeFilenamePart(ayLabel?.replace("/", "-") || "2026-2027")}.xlsx`,
      );
      sileo.success({ title: "Success", description: "SF1 exported successfully." });
    } catch (err: unknown) {
      console.error("Failed to download SF1 template", err);
      sileo.error({ title: "Error", description: "Failed to download SF1." });
    } finally {
      setExportingSf1(false);
    }
  };

  const handleDownloadSf1Template = async () => {
    if (!resolvedSectionId) return;
    setDownloadingSf1Template(true);
    try {
      const res = await api.get(`/sections/${resolvedSectionId}/masterlist/sf1/template`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBrowserFile(
        blob,
        `SF1_Blank_Template_${sanitizeFilenamePart(section?.gradeLevel)}_${sanitizeFilenamePart(section?.name)}.xlsx`,
      );
      sileo.success({
        title: "Template downloaded",
        description: "Blank SF1 roster template is ready for encoding.",
      });
    } catch (err: unknown) {
      console.error("Failed to download SF1 blank template", err);
      sileo.error({
        title: "Download failed",
        description: "Could not download the blank SF1 roster template.",
      });
    } finally {
      setDownloadingSf1Template(false);
    }
  };

  const handleSf1FileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!file || !resolvedSectionId) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      sileo.error({
        title: "Invalid file",
        description: "Upload an Excel .xlsx SF1 roster file.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setPreviewingSf1(true);
    try {
      const res = await api.post<Sf1ImportPreviewResponse>(
        `/sections/${resolvedSectionId}/masterlist/sf1/import/preview`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setSf1Preview(res.data);
      setSf1PreviewFileName(file.name);
      setSf1PreviewOpen(true);
    } catch (err: unknown) {
      console.error("Failed to preview SF1 roster", err);
      sileo.error({
        title: "Preview failed",
        description: "Could not read the SF1 roster. Check that the file follows the official LIS SF1 layout.",
      });
    } finally {
      setPreviewingSf1(false);
    }
  };

  const handleCommitSf1Preview = async () => {
    if (!resolvedSectionId || !sf1Preview) return;
    const payload: Sf1ImportCommitInput = { rows: sf1Preview.rows };

    setCommittingSf1(true);
    try {
      const res = await api.post<Sf1ImportCommitResponse>(
        `/sections/${resolvedSectionId}/masterlist/sf1/import/commit`,
        payload,
      );
      sileo.success({
        title: "SF1 roster imported",
        description: `${res.data.committedCount} learner record(s) added to this section masterlist.`,
      });
      setSf1PreviewOpen(false);
      setSf1Preview(null);
      setSf1PreviewFileName("");
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["sectioning"] });
      void fetchMasterlistData();
    } catch (err: unknown) {
      console.error("Failed to commit SF1 roster", err);
      sileo.error({
        title: "Import failed",
        description: "Could not commit the valid SF1 rows. No invalid or conflicted rows were written.",
      });
    } finally {
      setCommittingSf1(false);
    }
  };

  const maleLearners = useMemo(
    () => [...masterlist].filter((l) => l.sex === "MALE").sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [masterlist]
  );
  const femaleLearners = useMemo(
    () => [...masterlist].filter((l) => l.sex === "FEMALE").sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [masterlist]
  );

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      timeZone: 'Asia/Manila',
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const calculateAgeAsOfJuneFirst = (birthdateStr?: string | null) => {
    if (!birthdateStr) return null;
    const bDate = new Date(birthdateStr);
    if (isNaN(bDate.getTime())) return null;
    let startYear = 2026;
    if (ayLabel) {
      const match = ayLabel.match(/^(\d{4})/);
      if (match) startYear = parseInt(match[1]);
    }
    const juneFirst = new Date(startYear, 5, 1);
    let age = juneFirst.getFullYear() - bDate.getFullYear();
    const m = juneFirst.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && juneFirst.getDate() < bDate.getDate())) {
      age--;
    }
    return age;
  };

  const renderTable = (data: LearnerRecord[], title: string, sex: "MALE" | "FEMALE") => (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className={`font-extrabold text-lg uppercase tracking-widest ${sex === "MALE" ? "text-blue-700" : "text-pink-700"}`}>
          {title}
        </h3>
        <span className="font-extrabold text-sm text-foreground uppercase">
          Total: {data.length}
        </span>
      </div>
      <div className="flex-1">
        <div className="overflow-x-auto">
          <Table className="relative w-full">
            <TableHeader className="border-b border-border bg-transparent">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-center font-extrabold text-foreground h-11 w-[40px] tracking-wide">#</TableHead>
                <TableHead className="text-left font-extrabold text-foreground h-11 min-w-[200px] tracking-wide pl-4">LEARNER</TableHead>
                <TableHead className="text-right font-extrabold text-foreground h-11 w-[120px] pr-4">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {data.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={3} className="h-24 text-center text-foreground font-extrabold">
                    No {title.toLowerCase()} assigned.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((learner, idx) => {
                  const age = calculateAgeAsOfJuneFirst(learner.birthdate);
                  return (
                    <TableRow key={learner.id} className="hover:bg-muted/50 transition-colors group">
                      <TableCell className="text-center font-extrabold text-sm text-foreground py-3">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="py-3 pl-4">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-sm uppercase text-foreground leading-tight">
                            {learner.lastName}, {learner.firstName} {learner.middleName ? learner.middleName[0] + "." : ""}
                          </span>
                          <span className="text-sm font-bold uppercase text-foreground mt-0.5">
                            {learner.lrn || "NO LRN"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3 pr-4">
                        {mode === "sectioning" ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="font-extrabold uppercase"
                            disabled={unassignProcessingId === learner.enrollmentApplicationId}
                            onClick={() => handleUnassign(learner.enrollmentApplicationId)}
                          >
                            {unassignProcessingId === learner.enrollmentApplicationId ? (
                              <Loader2 className="h-4 w-4 " />
                            ) : (
                              "Unenroll"
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="font-extrabold uppercase text-primary border-primary hover:bg-primary hover:text-primary-foreground transition-all"
                            onClick={() => setSelectedStudentId(learner.id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Profile
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    if (section) {
      setTitle(`${section.gradeLevel} — ${section.name}`);
    } else {
      setTitle("Masterlist");
    }
    return () => {
      if (mode === "sectioning") {
        setTitle("Class Sectioning and SF1");
      } else {
        setTitle(null);
      }
    };
  }, [section, setTitle, mode]);

  return (
    <PageTransition className="space-y-6">
      <input
        ref={sf1FileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleSf1FileSelected}
      />

      <div className="mb-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:text-foreground transition-colors"
          >
            ← Back to Section Workspace
          </button>
        ) : (
          <Link
            to="/sections"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:text-foreground transition-colors"
          >
            ← Back to Class Sections Lobby
          </Link>
        )}
      </div>

      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-base font-extrabold text-foreground whitespace-nowrap">
                Class Adviser:
              </span>
              <span className="inline-flex items-center h-9 px-3 bg-muted/40 border border-border/60 rounded-md text-base font-extrabold uppercase text-foreground">
                {section?.advisingTeacher ? section.advisingTeacher.name : "UNASSIGNED"}
              </span>
            </div>

            <div className="flex items-center gap-6 text-base font-extrabold text-foreground tracking-wide">
              <span className="text-foreground">
                Total Seated: <span className="text-foreground">{masterlist.length} / {section?.maxCapacity || 0}</span>
              </span>
              <div className="w-px h-4 bg-border" />
              <Badge className="bg-blue-600/10 text-blue-600 border-blue-600 border-2 flex items-center gap-1.5 uppercase font-extrabold shadow-sm">
                <Mars className="h-4 w-4" /> Male: {maleLearners.length}
              </Badge>
              <div className="w-px h-4 bg-border" />
              <Badge className="bg-pink-600/10 text-pink-600 border-pink-600 border-2 flex items-center gap-1.5 uppercase font-extrabold shadow-sm">
                <Venus className="h-4 w-4" /> Female: {femaleLearners.length}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <hr className="border-border" />

        <CardHeader className="px-3 sm:px-6 pb-2 pt-6 flex flex-col md:flex-row md:items-start justify-between border-b border-border gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg font-extrabold">
              Enrolled Learner Records
            </CardTitle>
          </div>
          <div className="flex items-center gap-3">
            {!isHistoricalReadOnly && mode === "homeroom" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        variant="default"
                        disabled={loading || (masterlist.length >= (section?.maxCapacity || 0))}
                        onClick={() => setShowDrawer(true)}
                        className="h-9 font-extrabold text-sm bg-primary text-primary-foreground border-none"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Learner to Masterlist
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {(masterlist.length >= (section?.maxCapacity || 0)) && (
                    <TooltipContent className="bg-slate-900 text-white border-none text-sm font-extrabold p-3 shadow-xl">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        Maximum capacity reached.
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={exportingSf1 || previewingSf1 || downloadingSf1Template || loading}
                  className="h-9 font-extrabold text-sm border-border text-foreground bg-background hover:bg-muted shadow-sm"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  SF1 Roster
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 font-extrabold">
                <DropdownMenuItem
                  disabled={isHistoricalReadOnly || previewingSf1 || loading}
                  onClick={() => sf1FileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload SF1 Roster
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={downloadingSf1Template || loading}
                  onClick={() => {
                    void handleDownloadSf1Template();
                  }}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Download Blank Template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={exportingSf1 || loading}
                  onClick={() => {
                    void handleDownloadSf1();
                  }}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Export Official SF1
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <DataTableSkeleton rows={50} columns={5} className="rounded-md border-0" />
          ) : masterlist.length === 0 ? (
            <div className="flex py-16 w-full items-center justify-center">
              <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
                <CardContent className="pt-10 pb-10 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-2">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-foreground text-lg">
                      No Enrolled Learners
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed px-4">
                      This class section has no enrolled learners yet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex flex-col xl:flex-row gap-6">
                {renderTable(maleLearners, "Male Learners", "MALE")}
                {renderTable(femaleLearners, "Female Learners", "FEMALE")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={sf1PreviewOpen}
        onOpenChange={(open) => {
          if (!committingSf1) setSf1PreviewOpen(open);
        }}
      >
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle className="uppercase">SF1 Roster Preflight Review</DialogTitle>
            <DialogDescription>
              Review the uploaded SF1 roster before adding valid learners to this section masterlist.
              Invalid rows and learners already seated in another section will not be imported.
            </DialogDescription>
          </DialogHeader>

          {sf1Preview && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-extrabold uppercase text-muted-foreground">
                    Uploaded File
                  </span>
                  <span className="text-sm font-extrabold text-foreground break-all">
                    {sf1PreviewFileName || "SF1 roster file"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Rows Found", value: sf1Preview.summary.totalRows },
                  { label: "Valid Rows", value: sf1Preview.summary.validRows },
                  { label: "Existing Learners", value: sf1Preview.summary.existingLearners },
                  { label: "New Learners", value: sf1Preview.summary.newLearners },
                  { label: "Duplicate LRNs", value: sf1Preview.summary.duplicateLrnRows },
                  { label: "Other Section Conflicts", value: sf1Preview.summary.crossSectionConflicts },
                  { label: "Blocked Rows", value: sf1Preview.summary.blockedRows },
                  {
                    label: "Target Section",
                    value: `${sf1Preview.section.gradeLevelName} ${sf1Preview.section.name}`,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-md border border-border bg-card p-3">
                    <div className="text-xs font-extrabold uppercase text-muted-foreground">
                      {item.label}
                    </div>
                    <div className="mt-1 text-lg font-extrabold text-foreground">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="max-h-[45vh] overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                      <TableHead className="w-16 font-extrabold">Row</TableHead>
                      <TableHead className="font-extrabold">Learner</TableHead>
                      <TableHead className="w-32 font-extrabold">LRN</TableHead>
                      <TableHead className="w-24 font-extrabold">Sex</TableHead>
                      <TableHead className="w-44 font-extrabold">Status</TableHead>
                      <TableHead className="font-extrabold">Action Needed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["MALE", "FEMALE"] as const).map((group) => {
                      const groupRows = sf1Preview.rows.filter((row) => row.genderGroup === group);
                      if (groupRows.length === 0) return null;

                      return (
                        <Fragment key={group}>
                          <TableRow key={`${group}-header`} className="bg-background hover:bg-background">
                            <TableCell
                              colSpan={6}
                              className={`font-extrabold uppercase tracking-widest ${
                                group === "MALE" ? "text-blue-700" : "text-pink-700"
                              }`}
                            >
                              {group === "MALE" ? "Male Learners" : "Female Learners"}
                            </TableCell>
                          </TableRow>
                          {groupRows.map((row) => (
                            <TableRow key={`${group}-${row.rowNumber}-${row.lrn}`}>
                              <TableCell className="font-bold text-muted-foreground">
                                {row.rowNumber}
                              </TableCell>
                              <TableCell>
                                <div className="font-extrabold uppercase text-foreground">
                                  {getSf1RowName(row) || "Name not readable"}
                                </div>
                                {row.existingSectionName && (
                                  <div className="text-xs font-bold text-destructive">
                                    Already seated in {row.existingSectionName}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-bold">{row.lrn || "No valid LRN"}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`font-extrabold ${
                                    row.sex === "MALE"
                                      ? "border-blue-600 text-blue-700"
                                      : row.sex === "FEMALE"
                                        ? "border-pink-600 text-pink-700"
                                        : "border-muted-foreground text-muted-foreground"
                                  }`}
                                >
                                  {row.sex || "Check"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={row.matchStatus === "BLOCKED" ? "destructive" : "outline"}
                                  className="font-extrabold"
                                >
                                  {getSf1StatusLabel(row)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm font-bold text-muted-foreground">
                                {row.issueMessages.length > 0
                                  ? row.issueMessages.join("; ")
                                  : "Ready to commit"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                Import uses the current section as the official source for grade level, school year,
                program type, and section name. Spreadsheet labels that do not match this class will not override EnrollPro.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={committingSf1}
              onClick={() => setSf1PreviewOpen(false)}
              className="font-extrabold"
            >
              Review Later
            </Button>
            <Button
              type="button"
              disabled={!sf1Preview || sf1Preview.summary.validRows === 0 || committingSf1}
              onClick={() => {
                void handleCommitSf1Preview();
              }}
              className="font-extrabold"
            >
              {committingSf1 ? "Committing..." : "Commit Valid Records"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resolvedSectionId && section && (
        <InsertLateEnrolleeDrawer
          open={showDrawer}
          onOpenChange={setShowDrawer}
          sectionId={Number(resolvedSectionId)}
          sectionName={section.name}
          gradeLevelId={section.gradeLevelId}
          gradeLevelName={section.gradeLevel}
          maxCapacity={section.maxCapacity}
          enrolledCount={masterlist.length}
          programType={section.programType}
          schoolYearId={section.schoolYearId}
          onSuccess={() => {
            void fetchMasterlistData();
          }}
        />
      )}

      {/* Student Detail Panel */}
      <Sheet
        open={selectedStudentId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedStudentId(null);
        }}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className="p-0 flex flex-col border-l overflow-visible w-full sm:w-[600px] lg:w-[800px] max-w-none">
          {retainedStudentId && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <StudentDetailPanel
                id={retainedStudentId}
                schoolYearId={section?.schoolYearId}
                onClose={() => setSelectedStudentId(null)}
                onRefreshData={fetchMasterlistData}
                onTransferOut={() => { }}
                onDropout={() => { }}
                canEditProfile={false}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}
