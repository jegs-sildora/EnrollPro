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

interface TeachersScope {
  schoolId: number | null;
  schoolYearId: number | null;
  schoolYearLabel: string | null;
}

interface TeacherDesignationPayload {
  isClassAdviser: boolean;
  advisorySectionId: number | null;
  advisorySection: {
    id: number;
    name: string;
    gradeLevelId: number;
    gradeLevelName: string | null;
  } | null;
  advisoryEquivalentHoursPerWeek: number;
  isTic: boolean;
  isTeachingExempt: boolean;
}

interface TeacherRecord {
  id: number;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string | null;
  contactNumber: string | null;
  specialization: string | null;
  plantillaPosition: string | null;
  photoPath: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subjects: string[];
  sectionCount: number;
  designation: TeacherDesignationPayload | null;
}

interface TeachersResponse {
  scope: TeachersScope;
  teachers: TeacherRecord[];
}

interface AdminUserRecord {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  employeeId: string | null;
  designation: string | null;
  mobileNumber: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface AdminUsersResponse {
  users: AdminUserRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface StudentRecord {
  id: number;
  lrn: string | null;
  fullName: string;
  trackingNumber: string;
  status: string;
  gradeLevel: string;
  section: string | null;
  learningProgram: string;
  dateEnrolled: string | null;
}

interface StudentsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface StudentsResponse {
  students: StudentRecord[];
  pagination: StudentsPagination;
}

interface StudentsMeta {
  schoolYearId: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const CORE_API_FEED_ENDPOINTS = [
  {
    system: "Teachers",
    purpose: "Teacher directory and school-year designation metadata",
    endpoint: "/api/teachers?schoolYearId=<activeSchoolYearId>",
  },
  {
    system: "Users",
    purpose: "System users feed (admin, registrar, teacher)",
    endpoint: "/api/admin/users?page=1&limit=100",
  },
  {
    system: "Learners",
    purpose: "Student roster with school-year scoping",
    endpoint:
      "/api/students?schoolYearId=<activeSchoolYearId>&page=1&limit=100",
  },
];

const USERS_PAGE_LIMIT = 100;
const STUDENTS_PAGE_LIMIT = 100;

function formatDate(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString();
}

function formatTeacherName(teacher: TeacherRecord): string {
  return `${teacher.lastName}, ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName.charAt(0)}.` : ""}`;
}

function formatUserName(user: AdminUserRecord): string {
  return `${user.lastName}, ${user.firstName}${user.middleName ? ` ${user.middleName.charAt(0)}.` : ""}`;
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
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [staffUsers, setStaffUsers] = useState<AdminUserRecord[]>([]);
  const [learners, setLearners] = useState<StudentRecord[]>([]);
  const [learnersMeta, setLearnersMeta] = useState<StudentsMeta | null>(null);

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
          "No active school year is configured. Configure an active school year, then refresh API feeds.",
        );
      }

      const fetchStudentsPage = (page: number) =>
        api.get<StudentsResponse>("/students", {
          params: {
            schoolYearId,
            page,
            limit: STUDENTS_PAGE_LIMIT,
          },
        });

      const fetchUsersPage = (page: number) =>
        api.get<AdminUsersResponse>("/admin/users", {
          params: {
            page,
            limit: USERS_PAGE_LIMIT,
          },
        });

      const [teachersRes, firstUsersRes, firstStudentsRes] = await Promise.all([
        api.get<TeachersResponse>("/teachers", {
          params: { schoolYearId },
        }),
        fetchUsersPage(1),
        fetchStudentsPage(1),
      ]);

      const firstUsers = firstUsersRes.data.users ?? [];
      const usersTotalPages = Math.max(1, firstUsersRes.data.totalPages ?? 1);
      let mergedUsers = [...firstUsers];
      if (usersTotalPages > 1) {
        const remainingPages = Array.from(
          { length: usersTotalPages - 1 },
          (_, idx) => idx + 2,
        );
        const remainingResponses = await Promise.all(
          remainingPages.map((page) => fetchUsersPage(page)),
        );
        mergedUsers = mergedUsers.concat(
          ...remainingResponses.map((response) => response.data.users ?? []),
        );
      }

      const firstPageStudents = firstStudentsRes.data.students ?? [];
      const studentsMeta = firstStudentsRes.data.pagination;
      const studentsTotalPages = Math.max(1, studentsMeta?.totalPages ?? 1);
      let mergedStudents = [...firstPageStudents];
      if (studentsTotalPages > 1) {
        const remainingPages = Array.from(
          { length: studentsTotalPages - 1 },
          (_, idx) => idx + 2,
        );
        const remainingResponses = await Promise.all(
          remainingPages.map((page) => fetchStudentsPage(page)),
        );
        mergedStudents = mergedStudents.concat(
          ...remainingResponses.map((response) => response.data.students ?? []),
        );
      }

      setTeachers(teachersRes.data.teachers ?? []);
      setStaffUsers(mergedUsers);
      setLearners(mergedStudents);
      setLearnersMeta(
        studentsMeta
          ? {
              schoolYearId,
              total: studentsMeta.total,
              page: studentsMeta.page,
              limit: studentsMeta.limit,
              totalPages: studentsTotalPages,
            }
          : {
              schoolYearId,
              total: mergedStudents.length,
              page: 1,
              limit: STUDENTS_PAGE_LIMIT,
              totalPages: studentsTotalPages,
            },
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load API feeds.",
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
            Core API Feed Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live, API-backed view for teacher, user, and learner data from
            mounted codebase endpoints.
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
            This page fetches only from core app APIs and renders full payload
            fields per record.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CORE_API_FEED_ENDPOINTS.map((feed) => (
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
              Source: /teachers?schoolYearId=&lt;activeSchoolYearId&gt;
            </CardDescription>
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
                    No teacher records returned by /teachers.
                  </p>
                ) : (
                  teachers.map((teacher) => (
                    <div key={teacher.id} className="rounded border p-2">
                      <p className="font-semibold">
                        {formatTeacherName(teacher)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Teacher ID: {teacher.id} | Employee ID:{" "}
                        {teacher.employeeId ?? "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {teacher.specialization ?? "No specialization"} |
                        Subjects: {teacher.subjects.length} | Sections:{" "}
                        {teacher.sectionCount} | Active:{" "}
                        {teacher.isActive ? "Yes" : "No"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Adviser:{" "}
                        {teacher.designation?.isClassAdviser ? "Yes" : "No"} |
                        TIC: {teacher.designation?.isTic ? "Yes" : "No"} |
                        Teaching Exempt:{" "}
                        {teacher.designation?.isTeachingExempt ? "Yes" : "No"}
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
              Source: /admin/users (auto-paginated)
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
                    No user records returned by /admin/users.
                  </p>
                ) : (
                  staffUsers.map((member) => (
                    <div key={member.id} className="rounded border p-2">
                      <p className="font-semibold">{formatUserName(member)}</p>
                      <p className="text-xs text-muted-foreground">
                        User ID: {member.id} | Role: {member.role}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email} | Active:{" "}
                        {member.isActive ? "Yes" : "No"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last Login: {formatDate(member.lastLoginAt)}
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
              Source: /students (auto-paginated)
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
                    No learner records returned by /students.
                  </p>
                ) : (
                  learners.map((learnerRow) => (
                    <div key={learnerRow.id} className="rounded border p-2">
                      <p className="font-semibold">{learnerRow.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Application ID: {learnerRow.id} | Tracking:{" "}
                        {learnerRow.trackingNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        LRN: {learnerRow.lrn ?? "N/A"} | {learnerRow.gradeLevel}{" "}
                        | {learnerRow.section ?? "Unsectioned"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Program: {learnerRow.learningProgram} | Enrolled At:{" "}
                        {formatDate(learnerRow.dateEnrolled)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {learnerRow.status}
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
