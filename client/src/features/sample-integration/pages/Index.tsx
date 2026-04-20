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

interface IntegrationEnvelope<T, TMeta = Record<string, unknown>> {
  data: T;
  meta?: TMeta;
}

interface IntegrationTeacher {
  teacherId: number;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  fullName: string;
  email: string | null;
  contactNumber: string | null;
  specialization: string | null;
  isActive: boolean;
  sectionCount: number;
  schoolId: number | null;
  schoolName: string | null;
  schoolYearId: number;
  schoolYearLabel: string;
  isClassAdviser: boolean;
  advisorySectionId: number | null;
  advisorySectionName: string | null;
  advisorySectionGradeLevelId: number | null;
  advisorySectionGradeLevelName: string | null;
  advisoryEquivalentHoursPerWeek: number;
  isTic: boolean;
  isTeachingExempt: boolean;
  customTargetTeachingHoursPerWeek: number | null;
  designationNotes: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updateReason: string | null;
  updatedById: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

interface IntegrationStaff {
  id: number;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  fullName: string;
  role: "SYSTEM_ADMIN" | "REGISTRAR";
  email: string;
  designation: string | null;
  mobileNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface IntegrationLearner {
  enrollmentApplicationId: number;
  status: string;
  learnerType: string;
  applicantType: string;
  learner: {
    id: number;
    externalId: string;
    lrn: string | null;
    firstName: string;
    lastName: string;
    middleName: string | null;
    extensionName: string | null;
    fullName: string;
    birthdate: string | null;
    sex: string | null;
  };
  gradeLevel: {
    id: number;
    name: string;
    displayOrder: number;
  };
  schoolYear: {
    id: number;
    yearLabel: string;
  };
  section: {
    id: number;
    name: string;
    programType: string;
  } | null;
  enrolledAt: string | null;
}

interface IntegrationLearnersMeta {
  schoolYearId: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const INTEGRATION_FEED_ENDPOINTS = [
  {
    system: "Teachers",
    purpose: "Teacher directory and designation metadata",
    endpoint: "/api/integration/v1/faculty?schoolYearId=<activeSchoolYearId>",
  },
  {
    system: "Users",
    purpose: "System admin and registrar user feed",
    endpoint: "/api/integration/v1/staff?includeInactive=true",
  },
  {
    system: "Learners",
    purpose: "Enrolled learner roster with school-year scoping",
    endpoint:
      "/api/integration/v1/learners?schoolYearId=<activeSchoolYearId>&page=1&limit=200",
  },
];

const LEARNERS_PAGE_LIMIT = 200;

function formatDate(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString();
}

export default function SampleIntegrationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(
    null,
  );
  const [activeSchoolYearLabel, setActiveSchoolYearLabel] = useState<
    string | null
  >(null);
  const [teachers, setTeachers] = useState<IntegrationTeacher[]>([]);
  const [staffUsers, setStaffUsers] = useState<IntegrationStaff[]>([]);
  const [learners, setLearners] = useState<IntegrationLearner[]>([]);
  const [learnersMeta, setLearnersMeta] =
    useState<IntegrationLearnersMeta | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const settingsRes =
        await api.get<PublicSettingsResponse>("/settings/public");
      const schoolYearId = settingsRes.data.activeSchoolYearId;

      setActiveSchoolYearId(schoolYearId);
      setActiveSchoolYearLabel(settingsRes.data.activeSchoolYearLabel);

      if (!schoolYearId) {
        throw new Error(
          "No active school year is configured. Configure an active school year, then refresh integration feeds.",
        );
      }

      const fetchLearnersPage = (page: number) =>
        api.get<
          IntegrationEnvelope<IntegrationLearner[], IntegrationLearnersMeta>
        >("/integration/v1/learners", {
          params: {
            schoolYearId,
            page,
            limit: LEARNERS_PAGE_LIMIT,
          },
        });

      const [teachersRes, staffRes, firstLearnersRes] = await Promise.all([
        api.get<IntegrationEnvelope<IntegrationTeacher[]>>(
          "/integration/v1/faculty",
          {
            params: { schoolYearId },
          },
        ),
        api.get<IntegrationEnvelope<IntegrationStaff[]>>(
          "/integration/v1/staff",
          {
            params: { includeInactive: true },
          },
        ),
        fetchLearnersPage(1),
      ]);

      const firstPageLearners = firstLearnersRes.data.data ?? [];
      const baseMeta = firstLearnersRes.data.meta;
      const totalPages = Math.max(1, baseMeta?.totalPages ?? 1);

      let mergedLearners = [...firstPageLearners];
      if (totalPages > 1) {
        const remainingPages = Array.from(
          { length: totalPages - 1 },
          (_, idx) => idx + 2,
        );
        const remainingResponses = await Promise.all(
          remainingPages.map((page) => fetchLearnersPage(page)),
        );
        mergedLearners = mergedLearners.concat(
          ...remainingResponses.map((response) => response.data.data ?? []),
        );
      }

      setTeachers(teachersRes.data.data ?? []);
      setStaffUsers(staffRes.data.data ?? []);
      setLearners(mergedLearners);
      setLearnersMeta(
        baseMeta
          ? {
              ...baseMeta,
              totalPages,
            }
          : {
              schoolYearId,
              total: mergedLearners.length,
              page: 1,
              limit: LEARNERS_PAGE_LIMIT,
              totalPages,
            },
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load integration feeds.",
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
            Integration API Feed Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live, API-backed view for teacher, user, and learner integration
            data.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Read-only</Badge>
            <Badge variant="secondary">Strict API Source</Badge>
            <Badge variant="outline">
              Active S.Y. ID: {activeSchoolYearId ?? "Not configured"}
            </Badge>
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
            Active Feed Contracts
          </CardTitle>
          <CardDescription>
            This page fetches only from integration APIs and renders full
            payload fields per record.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {INTEGRATION_FEED_ENDPOINTS.map((feed) => (
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
            <CardDescription>Source: /integration/v1/faculty</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  {teachers.length} teacher records loaded.
                </p>
                {teachers.length === 0 ? (
                  <p className="text-muted-foreground">
                    No teacher records returned by /integration/v1/faculty.
                  </p>
                ) : (
                  teachers.map((teacher) => (
                    <div key={teacher.teacherId} className="rounded border p-2">
                      <p className="font-semibold">{teacher.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Teacher ID: {teacher.teacherId} | Employee ID:{" "}
                        {teacher.employeeId ?? "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {teacher.specialization ?? "No specialization"} |
                        Sections: {teacher.sectionCount} | Active:{" "}
                        {teacher.isActive ? "Yes" : "No"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Adviser: {teacher.isClassAdviser ? "Yes" : "No"} | TIC:{" "}
                        {teacher.isTic ? "Yes" : "No"} | Teaching Exempt:{" "}
                        {teacher.isTeachingExempt ? "Yes" : "No"}
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-primary">
                          View full API payload
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 text-[11px]">
                          {JSON.stringify(teacher, null, 2)}
                        </pre>
                      </details>
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
              Users
            </CardTitle>
            <CardDescription>
              Source: /integration/v1/staff?includeInactive=true
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  {staffUsers.length} user records loaded.
                </p>
                {staffUsers.length === 0 ? (
                  <p className="text-muted-foreground">
                    No user records returned by /integration/v1/staff.
                  </p>
                ) : (
                  staffUsers.map((member) => (
                    <div key={member.id} className="rounded border p-2">
                      <p className="font-semibold">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        User ID: {member.id} | Role: {member.role}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email} | Active:{" "}
                        {member.isActive ? "Yes" : "No"}
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-primary">
                          View full API payload
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 text-[11px]">
                          {JSON.stringify(member, null, 2)}
                        </pre>
                      </details>
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
              Source: /integration/v1/learners (auto-paginated)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  {learners.length} learner records loaded
                  {learnersMeta ? ` (API total: ${learnersMeta.total})` : ""}.
                </p>
                {learners.length === 0 ? (
                  <p className="text-muted-foreground">
                    No learner records returned by /integration/v1/learners.
                  </p>
                ) : (
                  learners.map((learnerRow) => (
                    <div
                      key={learnerRow.enrollmentApplicationId}
                      className="rounded border p-2">
                      <p className="font-semibold">
                        {learnerRow.learner.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Application ID: {learnerRow.enrollmentApplicationId} |
                        External ID: {learnerRow.learner.externalId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        LRN: {learnerRow.learner.lrn ?? "N/A"} |{" "}
                        {learnerRow.gradeLevel.name} |{" "}
                        {learnerRow.section?.name ?? "Unsectioned"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Program: {learnerRow.section?.programType ?? "N/A"} |
                        Enrolled At: {formatDate(learnerRow.enrolledAt)}
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-primary">
                          View full API payload
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-muted px-2 py-1 text-[11px]">
                          {JSON.stringify(learnerRow, null, 2)}
                        </pre>
                      </details>
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
