import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { StudentDetailPanel } from "@/features/students/components/StudentDetailPanel";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { sileo } from "sileo";
import { useRetainedSheetValue } from "@/shared/hooks/useRetainedSheetValue";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { useHeaderStore } from "@/store/header.slice";

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
  const isHistoricalReadOnly = useHistoricalReadOnly();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [exportingSf1, setExportingSf1] = useState(false);
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
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SF1_${section?.gradeLevel}_${section?.name}_${ayLabel?.replace("/", "-") || "2026-2027"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      sileo.success({ title: "Success", description: "SF1 exported successfully." });
    } catch (err: unknown) {
      console.error("Failed to download SF1 template", err);
      sileo.error({ title: "Error", description: "Failed to download SF1." });
    } finally {
      setExportingSf1(false);
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
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex-1">
        <div className="overflow-x-auto">
          <Table className="relative w-full">
            <TableHeader className="bg-muted z-20 sticky top-0 shadow-sm border-b">
              <TableRow className="hover:bg-muted border-none">
                <TableHead className="text-center font-extrabold text-foreground h-11 w-[40px] tracking-wide">#</TableHead>
                <TableHead className="text-left font-extrabold text-foreground h-11 min-w-[200px] tracking-wide pl-4">LEARNER</TableHead>
                <TableHead className="text-right font-extrabold text-foreground h-11 w-[120px] pr-4">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {data.length === 0 ? (
                <TableRow>
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
                              <Loader2 className="h-4 w-4 animate-spin" />
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
    <div className="space-y-6">
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
              <span className="inline-flex items-center h-9 px-3 bg-muted/40 border border-border/60 rounded-xl text-base font-extrabold uppercase text-foreground">
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
      </Card>

      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
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

            <Button
              variant="outline"
              onClick={handleDownloadSf1}
              disabled={exportingSf1 || loading}
              className="h-9 font-extrabold text-sm border-border text-foreground bg-background hover:bg-muted shadow-sm"
            >
              {exportingSf1 ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Export SF1
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-base font-extrabold text-foreground">
                Loading Masterlist Data...
              </p>
            </div>
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
    </div>
  );
}
