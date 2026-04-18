import { useCallback, useEffect, useState } from "react";
import {
  Database,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

interface PublicSettingsResponse {
  activeSchoolYearId: number | null;
  activeSchoolYearLabel: string | null;
}

interface SampleTeacher {
  teacherId: number;
  employeeId: string | null;
  fullName: string;
  specialization: string | null;
  isActive: boolean;
  sectionCount: number;
}

interface SampleStaff {
  id: number;
  employeeId: string | null;
  fullName: string;
  role: "SYSTEM_ADMIN" | "REGISTRAR";
  email: string;
  isActive: boolean;
}

interface SampleStudent {
  enrollmentApplicationId: number;
  learner: {
    externalId: string;
    lrn: string | null;
    fullName: string;
  };
  gradeLevel: {
    name: string;
  };
  section: {
    name: string;
    programType: string;
  } | null;
}

const DEFAULT_FEED_ENDPOINTS = [
  {
    system: "ATLAS",
    purpose: "Teacher scheduling and designation ingestion",
    endpoint: "/api/integration/v1/default/atlas/faculty",
  },
  {
    system: "SMART",
    purpose: "Academic record learner masterlist",
    endpoint: "/api/integration/v1/default/smart/students",
  },
  {
    system: "AIMS",
    purpose: "Learner context for interventions and remediation",
    endpoint: "/api/integration/v1/default/aims/context",
  },
];

export default function SampleIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSchoolYearLabel, setActiveSchoolYearLabel] = useState<
    string | null
  >(null);
  const [teachers, setTeachers] = useState<SampleTeacher[]>([]);
  const [staff, setStaff] = useState<SampleStaff[]>([]);
  const [students, setStudents] = useState<SampleStudent[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [settingsRes, teachersRes, staffRes, studentsRes] =
        await Promise.all([
          api.get<PublicSettingsResponse>("/settings/public"),
          api.get<{ data: SampleTeacher[] }>("/integration/v1/sample/teachers"),
          api.get<{ data: SampleStaff[] }>("/integration/v1/sample/staff"),
          api.get<{ data: SampleStudent[] }>("/integration/v1/sample/students"),
        ]);

      setActiveSchoolYearLabel(settingsRes.data.activeSchoolYearLabel);
      setTeachers(teachersRes.data.data ?? []);
      setStaff(staffRes.data.data ?? []);
      setStudents(studentsRes.data.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load sample integration feeds.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Database className="h-7 w-7 text-primary" />
            Sample Integration Feeds
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Public demo view for dummy integration datasets. Use protected
            default endpoints for teammate ingestion in ATLAS, SMART, and AIMS.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Read-only</Badge>
            <Badge variant="secondary">Dummy Data Only</Badge>
            <Badge variant="outline">
              Active S.Y.: {activeSchoolYearLabel ?? "Not configured"}
            </Badge>
          </div>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh Feeds
        </Button>
      </header>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Feed Load Failed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Default Protected Feeds for Teammates
          </CardTitle>
          <CardDescription>
            These endpoints are integration-key protected and pre-scoped to the
            active school year by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEFAULT_FEED_ENDPOINTS.map((feed) => (
            <div
              key={feed.system}
              className="rounded-md border bg-card p-3 text-sm">
              <div className="font-semibold">{feed.system}</div>
              <div className="text-muted-foreground">{feed.purpose}</div>
              <div className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">
                {feed.endpoint}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              Teachers
            </CardTitle>
            <CardDescription>
              Sample faculty rows for ATLAS testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-2 text-sm">
                {teachers.length === 0 ? (
                  <p className="text-muted-foreground">
                    No sample teachers found. Run db:seed-sample-integration.
                  </p>
                ) : (
                  teachers.slice(0, 10).map((teacher) => (
                    <div key={teacher.teacherId} className="rounded border p-2">
                      <p className="font-semibold">{teacher.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {teacher.specialization ?? "N/A"} | Sections:{" "}
                        {teacher.sectionCount}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Staff
            </CardTitle>
            <CardDescription>
              Sample SYSTEM_ADMIN and REGISTRAR users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-2 text-sm">
                {staff.length === 0 ? (
                  <p className="text-muted-foreground">
                    No sample staff found. Run db:seed-sample-integration.
                  </p>
                ) : (
                  staff.slice(0, 10).map((member) => (
                    <div key={member.id} className="rounded border p-2">
                      <p className="font-semibold">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.role} | {member.email}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Enrolled Learners
            </CardTitle>
            <CardDescription>
              Sample enrolled roster with grade and section
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-2 text-sm">
                {students.length === 0 ? (
                  <p className="text-muted-foreground">
                    No sample students found. Run db:seed-sample-integration.
                  </p>
                ) : (
                  students.slice(0, 10).map((student) => (
                    <div
                      key={student.enrollmentApplicationId}
                      className="rounded border p-2">
                      <p className="font-semibold">
                        {student.learner.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        LRN: {student.learner.lrn ?? "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {student.gradeLevel.name} |{" "}
                        {student.section?.name ?? "Unsectioned"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
