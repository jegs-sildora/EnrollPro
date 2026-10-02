import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router";
import {
  Users,
  Eye,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";

import { StudentDetailPanel } from "@/features/students/components/StudentDetailPanel";
import { StudentDetailModal } from "@/features/students/components/StudentDetailModal";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { useRetainedSheetValue } from "@/shared/hooks/useRetainedSheetValue";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { PageTransition } from "@/shared/components/PageTransition";
import { useSettingsStore } from "@/store/settings.slice";
import { useHeaderStore } from "@/store/header.slice";
import { DataTableSkeleton } from "@/shared/components/PageLoadingSkeleton";
import { cn, getGradeLevelBadgeStyles, formatGradeLevel } from "@/shared/lib/utils";

interface RosterLearner {
  id: number;
  learnerId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  status: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  studentPhoto?: string | null;
}

export default function ViewProgramRoster() {
  const { programType } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const retainedStudentId = useRetainedSheetValue(selectedStudentId);
  const [learners, setLearners] = useState<RosterLearner[]>([]);

  const { steEnabled, spaEnabled, spsEnabled } = useSettingsStore();

  const ALL_PROGRAMS = useMemo(() => [
    { programType: "REGULAR", acronym: "BEC", label: "Basic Education Curriculum" },
    ...(steEnabled ? [{ programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", acronym: "STE", label: "Science, Technology, and Engineering" }] : []),
    ...(spaEnabled ? [{ programType: "SPECIAL_PROGRAM_IN_THE_ARTS", acronym: "SPA", label: "Special Program in the Arts" }] : []),
    ...(spsEnabled ? [{ programType: "SPECIAL_PROGRAM_IN_SPORTS", acronym: "SPS", label: "Special Program in Sports" }] : []),
  ], [steEnabled, spaEnabled, spsEnabled]);

  const programInfo = useMemo(() => {
    return ALL_PROGRAMS.find((p: { programType: string, label: string, acronym: string }) => p.programType.toLowerCase() === programType?.toLowerCase()) || 
           { programType: programType || "REGULAR", label: programType || "Basic Education Curriculum", acronym: programType || "BEC" };
  }, [programType, ALL_PROGRAMS]);

  const fetchRoster = useCallback(async () => {
    if (!programType) return;
    setLoading(true);
    try {
      const res = await api.get<{ students: { id: number, status: string, lrn?: string, firstName: string, lastName: string, middleName?: string, sex: string, gradeLevel: string, section: string | null, studentPhoto?: string | null }[] }>(`/students`, {
        params: {
          programType: programInfo.programType,
          status: 'ENROLLED',
          limit: 2000
        }
      });
      
      const mapped = res.data.students.map((app): RosterLearner => {
        return {
          id: app.id,
          learnerId: app.id,
          lrn: app.lrn || null,
          firstName: app.firstName || "",
          lastName: app.lastName || "",
          middleName: app.middleName || null,
          sex: app.sex || "",
          status: app.status || "UNKNOWN",
          gradeLevelName: app.gradeLevel || null,
          sectionName: app.section || null,
          studentPhoto: app.studentPhoto || null
        };
      });
      setLearners(mapped);
    } catch (err: unknown) {
      console.error("Failed to fetch program roster", err);
      sileo.error({
        title: "Load Failed",
        description: "Could not load the program roster.",
      });
    } finally {
      setLoading(false);
    }
  }, [programType, programInfo]);

  useState(() => {
    void fetchRoster();
  });

  const setTitle = useHeaderStore(s => s.setTitle);
  
  // Update header title dynamically
  useEffect(() => {
    if (programInfo) {
      setTitle(`${programInfo.label} Total Enrollees`);
    }
    return () => {
      setTitle(null);
    };
  }, [programInfo, setTitle]);

  const maleLearners = useMemo(
    () => [...learners].filter((l) => l.sex === "MALE").sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [learners]
  );
  const femaleLearners = useMemo(
    () => [...learners].filter((l) => l.sex === "FEMALE").sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [learners]
  );

  const exportCsv = () => {
    if (learners.length === 0) return;
    const header = "LRN,Last Name,First Name,Middle Name,Sex,Grade Level,Section\n";
    const rows = learners.map(l => {
      const grade = l.gradeLevelName ? l.gradeLevelName.replace('Grade ', 'G') : '';
      return `${l.lrn || ''},"${l.lastName}","${l.firstName}","${l.middleName || ''}",${l.sex},"${grade}","${l.sectionName || ''}"`;
    }).join("\n");
    
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${programInfo.acronym}_Roster.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    anchor.remove();
  };

  const renderTable = (data: RosterLearner[], title: string, sex: "MALE" | "FEMALE") => (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className={`font-bold text-base uppercase tracking-widest ${sex === "MALE" ? "text-blue-700" : "text-pink-700"}`}>
          {title}
        </h3>
        <span className="font-bold text-base text-foreground uppercase">
          Total: {data.length}
        </span>
      </div>
      <div className="flex-1">
        <div className="overflow-x-auto">
          <Table className="relative w-full">
            <TableHeader className="border-b border-border bg-transparent">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-center font-bold text-foreground h-11 w-[40px] tracking-wide">#</TableHead>
                <TableHead className="text-left font-bold text-foreground h-11 min-w-[200px] tracking-wide pl-4">LEARNER</TableHead>
                <TableHead className="text-left font-bold text-foreground h-11 min-w-[120px] tracking-wide">GRADE & SECTION</TableHead>
                <TableHead className="text-right font-bold text-foreground h-11 w-[120px] pr-4">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {data.length === 0 ? (
                <TableRow className="border-b-0">
                  <TableCell colSpan={4} className="h-24 text-center text-foreground font-bold">
                    No {title.toLowerCase()} assigned.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((learner, idx) => (
                  <TableRow key={learner.id} className="hover:bg-muted/50 transition-colors group">
                    <TableCell className="text-center font-bold text-sm text-foreground py-3">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="py-3 pl-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserPhoto
                          photo={learner.studentPhoto || null}
                          containerClassName="w-10 h-10 rounded-full shadow-sm border shrink-0 border-2 border-primary border-solid"
                          className="w-full h-full object-cover"
                        />
                        <div className="flex flex-col">
                          <span className="font-extrabold text-sm uppercase text-foreground leading-tight">
                            {learner.lastName}, {learner.firstName} {learner.middleName ? learner.middleName[0] + "." : ""}
                          </span>
                          <span className="text-sm uppercase text-foreground mt-0.5">
                            LRN: {learner.lrn || "NO LRN"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col">
                        <span className={cn("inline-flex items-center justify-center w-fit whitespace-nowrap rounded-md border px-2 py-1 mb-1 text-xs font-bold", getGradeLevelBadgeStyles(learner.gradeLevelName || "Unknown"))}>
                          {formatGradeLevel(learner.gradeLevelName || "Unknown")}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground uppercase">
                          {learner.sectionName || "UNASSIGNED"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3 pr-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-bold uppercase text-primary border-primary hover:bg-primary hover:text-primary-foreground transition-all"
                        onClick={() => setSelectedStudentId(learner.learnerId)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  return (
    <PageTransition className="flex flex-col h-full min-h-0 space-y-6">
      <div className="mb-4 flex flex-col gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-foreground transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col flex-1 min-h-0">
        <CardHeader className="px-6 py-4 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-base font-bold text-foreground whitespace-nowrap">
                Program Roster:
              </span>
              <span className="inline-flex items-center h-9 px-3 bg-muted/40 border border-border/60 rounded-md text-base font-bold uppercase text-foreground">
                {programInfo.label}
              </span>
            </div>

            <div className="flex items-center gap-6 text-base font-bold text-foreground tracking-wide">
              <span className="text-foreground">
                Total Enrolled: <span className="text-foreground">{learners.length}</span>
              </span>
              <div className="w-px h-4 bg-border" />
              <Badge className="bg-blue-600/10 text-blue-600 border-blue-600 border-2 flex items-center gap-1.5 uppercase font-bold shadow-sm">
                M: {maleLearners.length}
              </Badge>
              <div className="w-px h-4 bg-border" />
              <Badge className="bg-pink-600/10 text-pink-600 border-pink-600 border-2 flex items-center gap-1.5 uppercase font-bold shadow-sm">
                F: {femaleLearners.length}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <hr className="border-border shrink-0" />

        <CardHeader className="px-3 sm:px-6 pb-2 pt-6 flex flex-col md:flex-row md:items-start justify-between border-b border-border gap-4 shrink-0">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold">
              Enrolled Learner Records
            </CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={loading || learners.length === 0}
              className="h-9 font-bold text-sm border-border text-foreground bg-background hover:bg-primary hover:text-primary-foreground shadow-sm rounded-md"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Roster (CSV)
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          {loading ? (
            <DataTableSkeleton rows={50} columns={5} className="rounded-md border-0" />
          ) : learners.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center h-full border-none w-full">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-extrabold text-foreground">No Enrolled Learners</h3>
              <p className="text-muted-foreground mx-auto">
                This program has no enrolled learners yet.
              </p>
            </div>
          ) : (
            <div className="p-4 flex-1 overflow-auto">
              <div className="flex flex-col xl:flex-row gap-6">
                {renderTable(maleLearners, "Male Learners", "MALE")}
                {renderTable(femaleLearners, "Female Learners", "FEMALE")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={selectedStudentId !== null}
        onOpenChange={(open) => !open && setSelectedStudentId(null)}
      >
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-0">
          <div className="p-6">
            {retainedStudentId ? (
              <StudentDetailPanel 
                id={retainedStudentId} 
                onClose={() => setSelectedStudentId(null)} 
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className="hidden">
        <StudentDetailModal
          id={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
        />
      </div>
    </PageTransition>
  );
}
