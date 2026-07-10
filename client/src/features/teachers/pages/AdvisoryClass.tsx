import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { 
  Users,
  FileDown,
  Loader2,
  Venus,
  Mars,
  Eye
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { PageLoadingSkeleton } from "@/shared/components/PageLoadingSkeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Sheet,
  SheetContent,
} from "@/shared/ui/sheet";
import { StudentDetailPanel } from "@/features/students/components/StudentDetailPanel";
import { useRetainedSheetValue } from "@/shared/hooks/useRetainedSheetValue";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { useHeaderStore } from "@/store/header.slice";

interface AdvisoryLearner {
  id: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  birthdate?: string | null;
}

interface AdvisoryRecord {
  id: number;
  sf1Remarks?: string | null;
  enrollmentApplication: {
    learner: AdvisoryLearner;
  };
}

interface AdvisorySection {
  id: number;
  name: string;
  maxCapacity: number;
  programType: string;
  schoolYearId: number;
  gradeLevel: {
    displayOrder: number;
    name: string;
  };
  advisingTeacher?: {
    name: string;
  } | null;
}

interface AdvisoryResponse {
  section?: AdvisorySection | null;
  records?: AdvisoryRecord[];
}

export default function AdvisoryClass() {
  const { ayLabel } = useSchoolYearContext();
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const retainedStudentId = useRetainedSheetValue(selectedStudentId);
  const [exportingSf1, setExportingSf1] = useState(false);

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ["teacher", "advisory"],
    queryFn: () => api.get<AdvisoryResponse>("/teacher-eosy/advisory").then(res => res.data),
  });

  const section = data?.section;
  const records = data?.records || [];

  const handleDownloadSf1 = async () => {
    if (!section) return;
    try {
      setExportingSf1(true);
      const res = await api.get(`/reports/sf1/${section.id}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SF1_${section.gradeLevel.name}_${section.name}_${ayLabel?.replace("/", "-") || "2026-2027"}.xlsx`;
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
    () => [...records].filter((r) => r.enrollmentApplication.learner.sex === "MALE").sort((a, b) => a.enrollmentApplication.learner.lastName.localeCompare(b.enrollmentApplication.learner.lastName)),
    [records]
  );
  
  const femaleLearners = useMemo(
    () => [...records].filter((r) => r.enrollmentApplication.learner.sex === "FEMALE").sort((a, b) => a.enrollmentApplication.learner.lastName.localeCompare(b.enrollmentApplication.learner.lastName)),
    [records]
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

  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { timeZone: 'Asia/Manila', 
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

  const renderTable = (data: AdvisoryRecord[], title: string, sex: "MALE" | "FEMALE") => (
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
                <TableHead className="text-center font-extrabold text-foreground h-11 w-[120px] tracking-wide">BIRTHDATE</TableHead>
                <TableHead className="text-center font-extrabold text-foreground h-11 w-[60px] tracking-wide">AGE</TableHead>
                <TableHead className="text-right font-extrabold text-foreground h-11 w-[120px] pr-4">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {data.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={5} className="h-24 text-center text-foreground font-extrabold">
                    No {title.toLowerCase()} assigned.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((record, idx) => {
                  const learner = record.enrollmentApplication.learner;
                  const age = calculateAgeAsOfJuneFirst(learner.birthdate);
                  const remark = record.sf1Remarks || "";
                  return (
                    <TableRow key={record.id} className="hover:bg-muted/50 transition-colors group">
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
                          {remark && (
                            <span className="text-xs font-bold uppercase text-amber-600 mt-0.5">
                              {remark}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {learner.birthdate ? (
                          <span className="text-sm font-extrabold">{formatDate(learner.birthdate)}</span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Needs Update</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-extrabold text-sm py-3">
                        {age !== null ? age : "—"}
                      </TableCell>
                      <TableCell className="text-right py-3 pr-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-extrabold uppercase text-primary border-primary hover:bg-primary hover:text-primary-foreground transition-all"
                          onClick={() => setSelectedStudentId(learner.id)}
                        >
                          <Eye className="w-4 h-4 lg:mr-2" />
                          <span className="hidden lg:inline">Profile</span>
                        </Button>
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
      setTitle(`${section.gradeLevel.name} — ${section.name}`);
    } else {
      setTitle("My Advisory Class");
    }
    return () => setTitle(null);
  }, [section, setTitle]);

  if (loading) {
    return <PageLoadingSkeleton variant="registry" />;
  }

  if (!section) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground">
            View your currently assigned advisory class and enrolled learners.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
          <p className="text-lg text-foreground">No Active Advisory Section</p>
          <p className="mt-1">You are not currently assigned as an adviser to any section for this school year.</p>
        </div>
      </div>
    );
  }

  return (
<div className="space-y-6">
      {/* Unified Card */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-6 py-4">
          <div className="flex justify-end items-center gap-6 text-base font-extrabold text-foreground tracking-wide">
            <span className="text-foreground">
              Total Seated: <span className="text-foreground">{records.length} / {section.maxCapacity || 0}</span>
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
        </CardHeader>

        <hr className="border-border" />

        <CardHeader className="px-3 sm:px-6 pb-2 pt-6 flex flex-col md:flex-row md:items-start justify-between border-b border-border gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-base sm:text-lg font-extrabold">
              Enrolled Learner Records
            </CardTitle>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-base font-extrabold text-foreground whitespace-nowrap">
                Class Adviser:
              </span>
              <span className="inline-flex items-center h-9 px-3 bg-muted/40 border border-border/60 rounded-md text-base font-extrabold uppercase text-foreground">
                {section.advisingTeacher ? section.advisingTeacher.name : "ASSIGNED (YOU)"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleDownloadSf1}
              disabled={exportingSf1 || loading}
              className="h-9 font-extrabold text-sm border-border text-foreground bg-background hover:bg-muted shadow-sm"
            >
              {exportingSf1 ? (
                <Loader2 className="h-4 w-4 mr-2 " />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Export SF1
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {records.length === 0 ? (
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
                onClose={() => setSelectedStudentId(null)}
                onRefreshData={() => refetch()}
                canEditProfile={false}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
