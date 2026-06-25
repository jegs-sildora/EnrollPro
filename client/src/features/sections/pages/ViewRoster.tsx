import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router";
import { Link } from "react-router";
import {
  Users,
  FileDown,
  Printer,
  Loader2,
  AlertTriangle,
  UserPlus,
  Venus,
  Mars
} from "lucide-react";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { StudentDetailPanel } from "@/features/students/components/StudentDetailPanel";
import { Button } from "@/shared/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { sileo } from "sileo";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
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

export default function ViewRoster() {
  const { sectionId } = useParams();

  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const { ayLabel } = useSchoolYearContext();

  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [exportingSf1, setExportingSf1] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const [section, setSection] = useState<SectionDetails | null>(null);
  const [roster, setRoster] = useState<LearnerRecord[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  const fetchRosterData = useCallback(async () => {
    if (!sectionId || !ayId) return;
    setLoading(true);
    try {
      const [rosterRes, teachersRes] = await Promise.all([
        api.get(`/sections/${sectionId}/roster`),
        api.get(`/sections/teachers?schoolYearId=${ayId}`)
      ]);
      setSection(rosterRes.data.section);
      setRoster(rosterRes.data.learners);
      setTeachers(teachersRes.data.teachers);
    } catch (err: any) {
      console.error(err);
      sileo.error({ title: "Error", description: "Failed to load roster data." });
    } finally {
      setLoading(false);
    }
  }, [sectionId, ayId]);

  useEffect(() => {
    void fetchRosterData();
  }, [fetchRosterData]);

  const handleInlineAdviserChange = async (newAdviserId: string) => {
    if (!sectionId) return;
    try {
      await api.post(`/sections/${sectionId}/handover-adviser`, {
        newAdviserId: newAdviserId === "none" ? null : parseInt(newAdviserId),
      });
      sileo.success({ title: "Success", description: "Class adviser updated successfully." });
    } catch (err: any) {
      console.error(err);
      sileo.error({ title: "Error", description: "Failed to update class adviser." });
    }
  };

  const handleDownloadSf1 = async () => {
    if (!sectionId) return;
    setExportingSf1(true);
    try {
      const res = await api.get(`/sections/${sectionId}/roster/sf1`, {
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
    } catch (err: any) {
      console.error("Failed to download SF1 template", err);
      sileo.error({ title: "Error", description: "Failed to download SF1." });
    } finally {
      setExportingSf1(false);
    }
  };
  const maleLearners = useMemo(
    () => [...roster].filter((l) => l.sex === "MALE").sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [roster]
  );
  const femaleLearners = useMemo(
    () => [...roster].filter((l) => l.sex === "FEMALE").sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [roster]
  );

  const getProgramTypeLabel = (pt: string) => {
    switch (pt) {
      case "REGULAR": return "Basic Education Curriculum — Regular / Heterogeneous";
      case "SCIENCE_TECHNOLOGY_AND_ENGINEERING":
      case "STE": return "Special Curricular Program — Science, Technology, and Engineering (STE)";
      case "SPA": return "Special Program in the Arts (SPA)";
      case "SPS": return "Special Program in Sports (SPS)";
      case "BEC_HOMO": return "Basic Education Curriculum — Homogeneous";
      default: return pt;
    }
  };

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

  const renderLearnerRow = (learner: LearnerRecord, index: number) => {
    const age = calculateAgeAsOfJuneFirst(learner.birthdate);
    let remark = "";
    if (learner.sf1Remarks) {
      remark = learner.sf1Remarks;
    }

    return (
      <TableRow key={learner.id} className="hover:bg-muted/50 transition-colors">
        <TableCell className="text-center font-bold text-base text-muted-foreground py-3">
          {index}
        </TableCell>
        <TableCell className="text-center font-bold text-base py-3">
          {learner.lrn || "—"}
        </TableCell>
        <TableCell className="py-3 pl-2 min-w-[200px]">
          <span className="font-bold text-base uppercase block leading-tight">
            {learner.lastName}, {learner.firstName} {learner.middleName ? learner.middleName[0] + "." : ""}
          </span>
        </TableCell>
        <TableCell className="text-center py-3 whitespace-nowrap">
          {learner.birthdate ? (
            <span className="text-base font-bold">{formatDate(learner.birthdate)}</span>
          ) : (
            <span className="text-sm italic text-muted-foreground">Requires DOB Update</span>
          )}
        </TableCell>
        <TableCell className="text-center font-bold text-base py-3">
          {age !== null ? age : "—"}
        </TableCell>
        <TableCell className="text-center py-3">
          {remark && (
            <span className="text-sm font-bold uppercase text-foreground">
              {remark}
            </span>
          )}
        </TableCell>
        <TableCell className="text-right py-3 pr-2">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedStudentId(learner.id)} 
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-bold px-3 py-1 h-auto"
          >
            Open Record
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="mb-4">
          <Link
            to="/sections"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-foreground transition-colors"
          >
            ← Back to Class Sections Lobby
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold uppercase">
              {section?.gradeLevel} — {section?.name}
            </h1>
            <p className="text-base leading-tight font-bold text-foreground">
              {section ? getProgramTypeLabel(section.programType) : "—"}
            </p>
          </div>
          <div className="bg-muted/50 px-4 py-2 rounded-lg border border-border flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-foreground whitespace-nowrap">
              S.Y. {ayLabel?.replace(/-/g, "–") || "2026–2027"}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar Card */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-muted-foreground">
                Class Adviser:
              </span>
              <Select
                disabled={loading}
                value={section?.advisingTeacher ? String(section.advisingTeacher.id) : "none"}
                onValueChange={async (val) => {
                  await handleInlineAdviserChange(val);
                  const newName = val === "none" ? null : teachers.find(t => t.id === parseInt(val))?.name;
                  setSection((prev: any) => prev ? {
                    ...prev,
                    advisingTeacher: val === "none" ? null : { id: parseInt(val), name: newName || "" }
                  } : null);
                }}
              >
                <SelectTrigger className="h-9 px-3 border-border hover:bg-muted bg-background shadow-sm focus:ring-0 text-base font-bold truncate max-w-[250px]">
                  <SelectValue placeholder="UNASSIGNED" />
                </SelectTrigger>
                <SelectContent className="font-bold max-h-[300px]">
                  <SelectItem value="none" className="text-sm text-amber-600 italic font-bold">
                    UNASSIGNED
                  </SelectItem>
                  {section?.advisingTeacher && !teachers.some(t => t.id === section.advisingTeacher!.id) && (
                    <SelectItem value={String(section.advisingTeacher.id)} className="text-sm">
                      {section.advisingTeacher.name}
                    </SelectItem>
                  )}
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-sm">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-6 text-sm font-bold text-foreground tracking-wide">
              <span className="text-muted-foreground">
                Total Seated: <span className="text-foreground">{roster.length} / {section?.maxCapacity || 0}</span>
              </span>
              <div className="w-px h-4 bg-border" />
              <span className="flex items-center gap-1.5 text-blue-600">
                <Mars className="h-4 w-4" /> Male: {maleLearners.length}
              </span>
              <div className="w-px h-4 bg-border" />
              <span className="flex items-center gap-1.5 text-pink-600">
                <Venus className="h-4 w-4" /> Female: {femaleLearners.length}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Roster Table Card */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-2 pt-6 flex flex-col md:flex-row md:items-start justify-between border-b border-border gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg font-extrabold">
              Enrolled Learner Records
            </CardTitle>
            <div className="text-base sm:text-base leading-tight font-bold text-muted-foreground mt-1">
              Showing official Masterlist roll ({roster.length} of {section?.maxCapacity || 0} assigned seats)
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="default"
                      disabled={loading || (roster.length >= (section?.maxCapacity || 0))}
                      onClick={() => setShowDrawer(true)}
                      className="h-9 font-bold text-xs bg-green-600 hover:bg-green-700 text-white border-none"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Learner to Roster
                    </Button>
                  </span>
                </TooltipTrigger>
                {(roster.length >= (section?.maxCapacity || 0)) && (
                  <TooltipContent className="bg-slate-900 text-white border-none text-sm font-bold p-3 shadow-xl">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Maximum capacity reached.
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              onClick={handleDownloadSf1}
              disabled={exportingSf1 || loading}
              className="h-9 font-bold text-xs border-border text-foreground bg-background hover:bg-muted shadow-sm"
            >
              {exportingSf1 ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Export SF1
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="h-9 font-bold text-xs border-border text-foreground bg-background hover:bg-muted shadow-sm"
            >
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-base font-bold text-muted-foreground">
                Loading Roster Data...
              </p>
            </div>
          ) : roster.length === 0 ? (
            <div className="flex py-16 w-full items-center justify-center">
              <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
                <CardContent className="pt-10 pb-10 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-2">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground text-lg">
                      No Enrolled Learners
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed px-4">
                      This class section has no enrolled learners yet. Click "+ Add Learner to Roster" above to encode students individually.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-muted/5 relative min-h-[500px] flex flex-col p-4">
              <div className="flex flex-col rounded-lg overflow-hidden border border-border shadow-sm max-h-full">
                <div className="bg-background overflow-auto flex-1 relative">
                  <Table className="relative min-w-[900px]">
                    <TableHeader className="bg-muted z-20 sticky top-0 shadow-sm border-b">
                      <TableRow className="hover:bg-muted border-none">
                        <TableHead className="text-center font-bold text-foreground h-11 w-[60px] tracking-wide">#</TableHead>
                        <TableHead className="text-center font-bold text-foreground h-11 w-[120px] tracking-wide">LRN</TableHead>
                        <TableHead className="text-left font-bold text-foreground h-11 min-w-[200px] tracking-wide pl-4">LEARNER NAME</TableHead>
                        <TableHead className="text-center font-bold text-foreground h-11 w-[160px] tracking-wide">BIRTHDATE</TableHead>
                        <TableHead className="text-center font-bold text-foreground h-11 w-[80px] tracking-wide">AGE</TableHead>
                        <TableHead className="text-center font-bold text-foreground h-11 w-[140px] tracking-wide">REMARKS</TableHead>
                        <TableHead className="text-right font-bold text-foreground h-11 w-[160px] pr-4">ACTION</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Male Learners */}
                      {maleLearners.length > 0 && (
                        <>
                          <TableRow className="bg-slate-50 border-y border-border hover:bg-slate-50">
                            <TableCell colSpan={7} className="py-3">
                              <div className="flex justify-between font-bold text-sm tracking-widest text-primary uppercase px-2">
                                <span>MALE LEARNERS</span>
                                <span>Total: {maleLearners.length}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {maleLearners.map((learner, idx) => renderLearnerRow(learner, idx + 1))}
                        </>
                      )}
                      
                      {/* Female Learners */}
                      {femaleLearners.length > 0 && (
                        <>
                          <TableRow className="bg-slate-50 border-y border-border hover:bg-slate-50">
                            <TableCell colSpan={7} className="py-3">
                              <div className="flex justify-between font-bold text-sm tracking-widest text-primary uppercase px-2">
                                <span>FEMALE LEARNERS</span>
                                <span>Total: {femaleLearners.length}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {femaleLearners.map((learner, idx) => renderLearnerRow(learner, idx + 1))}
                        </>
                      )}
                      
                      {maleLearners.length === 0 && femaleLearners.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground font-bold">
                            No Learners Enrolled
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showDrawer && sectionId && section && (
        <InsertLateEnrolleeDrawer
          open={showDrawer}
          onOpenChange={setShowDrawer}
          sectionId={parseInt(sectionId)}
          sectionName={section.name}
          gradeLevelId={section.gradeLevelId}
          gradeLevelName={section.gradeLevel}
          maxCapacity={section.maxCapacity}
          enrolledCount={roster.length}
          programType={section.programType}
          schoolYearId={section.schoolYearId}
          onSuccess={() => {
            void fetchRosterData();
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
          {selectedStudentId && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <StudentDetailPanel
                id={selectedStudentId}
                onClose={() => setSelectedStudentId(null)}
                onRefreshData={fetchRosterData}
                onTransferOut={() => {}}
                onDropout={() => {}}
                canEditProfile={false}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sovereign Page Footer */}
      <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wider print:hidden">
        <span>Complies with DepEd Order No. 4, s. 2014 (Modified School Form 1)</span>
        <span>Sovereign Offline Registry • Local Registry Node</span>
      </div>
    </div>
  );
}
