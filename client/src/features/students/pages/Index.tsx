import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Eye,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatManilaDate } from "@/shared/lib/utils";
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
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";

interface Student {
  id: number;
  lrn: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  sex: string;
  birthDate: string;
  address: string;
  parentGuardianName: string;
  parentGuardianContact: string;
  emailAddress: string;
  trackingNumber: string;
  status: string;
  gradeLevel: string;
  gradeLevelId: number;
  section: string | null;
  sectionId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface StudentDetail extends Student {
  rejectionReason: string | null;
  schoolYear: string;
  schoolYearId: number;
  enrollment: {
    id: number;
    section: string;
    sectionId: number;
    advisingTeacher: string | null;
    enrolledAt: string;
    enrolledBy: string;
  } | null;
}

interface GradeLevel {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
  gradeLevelId: number;
}

interface ApiSection {
  id: number;
  name: string;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
  advisingTeacher: { id: number; name: string } | null;
}

interface ApiGradeLevelGroup {
  gradeLevelId: number;
  gradeLevelName: string;
  displayOrder: number;
  sections: ApiSection[];
}

export default function Students() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(
    null,
  );
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch grade levels and sections
  useEffect(() => {
    const fetchFilters = async () => {
      if (!ayId) return;
      try {
        const [glRes, secRes] = await Promise.all([
          api.get(`/curriculum/${ayId}/grade-levels`),
          api.get(`/sections/${ayId}`),
        ]);
        setGradeLevels(glRes.data.gradeLevels || []);

        // Flatten sections from grade levels in the response
        const allSections = (secRes.data.gradeLevels || []).flatMap(
          (gl: ApiGradeLevelGroup) =>
            (gl.sections || []).map((s: ApiSection) => ({
              ...s,
              gradeLevelId: gl.gradeLevelId,
            })),
        );
        setSections(allSections);
      } catch (err) {
        console.error("Failed to fetch filters:", err);
      }
    };
    fetchFilters();
  }, [ayId]);

  // Filter sections by grade level
  useEffect(() => {
    if (gradeLevelFilter === "all") {
      setFilteredSections(sections);
    } else {
      setFilteredSections(
        sections.filter(
          (s) => s.gradeLevelId === parseInt(gradeLevelFilter, 10),
        ),
      );
    }
    setSectionFilter("all");
  }, [gradeLevelFilter, sections]);

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  // Fetch students
  const fetchStudents = useCallback(async () => {
    if (!ayId) return;
    if (initialLoad) setLoading(true);
    try {
      const params: Record<string, string | number> = {
        schoolYearId: ayId,
        status: "ENROLLED",
        page,
        limit: 15,
        sortBy,
        sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (gradeLevelFilter !== "all") params.gradeLevelId = gradeLevelFilter;
      if (sectionFilter !== "all") params.sectionId = sectionFilter;

      const res = await api.get("/students", { params });
      setStudents(res.data.students || []);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      toastApiError(err as never);
      setStudents([]);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [
    ayId,
    page,
    debouncedSearch,
    gradeLevelFilter,
    sectionFilter,
    sortBy,
    sortOrder,
    initialLoad,
  ]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleViewDetails = async (studentId: number) => {
    setDetailLoading(true);
    setDetailDialogOpen(true);
    try {
      const res = await api.get(`/students/${studentId}`);
      setSelectedStudent(res.data.student);
    } catch (err) {
      toastApiError(err as never);
      setDetailDialogOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const getEnrolledBadge = () => (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
      Enrolled
    </Badge>
  );

  const formatDate = (dateString: string) => {
    return formatManilaDate(dateString, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const visibleSectionCount = useMemo(() => {
    const unique = new Set<string>();
    students.forEach((student) => {
      if (student.section) unique.add(student.section);
    });
    return unique.size;
  }, [students]);

  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        id: "student",
        header: () => (
          <button
            onClick={() => handleSort("lastName")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Student
            {getSortIcon("lastName")}
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col text-left min-w-[200px] pl-2">
            <span className="font-bold text-sm uppercase leading-tight">
              {row.original.fullName}
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {row.original.trackingNumber}
            </span>
          </div>
        ),
      },
      {
        id: "lrn",
        header: () => (
          <button
            onClick={() => handleSort("lrn")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            LRN
            {getSortIcon("lrn")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm">{row.original.lrn}</span>
        ),
      },
      {
        id: "gradeLevel",
        header: () => (
          <button
            onClick={() => handleSort("gradeLevel")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Grade Level
            {getSortIcon("gradeLevel")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm">{row.original.gradeLevel}</span>
        ),
      },
      {
        id: "section",
        header: () => (
          <button
            onClick={() => handleSort("section")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Section
            {getSortIcon("section")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm">
            {row.original.section || "—"}
          </span>
        ),
      },
      {
        id: "enrolled",
        header: () => (
          <button
            onClick={() => handleSort("createdAt")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Enrolled
            {getSortIcon("createdAt")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold block text-center">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex justify-center min-w-[100px]">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails(row.original.id);
              }}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View
            </Button>
          </div>
        ),
      },
    ],
    [handleSort, getSortIcon, handleViewDetails],
  );

  if (!ayId) {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">
                No School Year Selected
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
                Please set an active year or choose one from the header switcher
                to manage records for this period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          Learner Directory
        </h1>
        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          Manage officially enrolled learner records for the selected school
          year.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-bold">
              Total Enrolled
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-bold">
              Showing On Current Page
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-green-600">
              {students.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-bold">
              Sections On Current Page
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-blue-600">
              {visibleSectionCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                Search Learner
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  placeholder="LRN, first name, last name..."
                  className="pl-9 h-10 text-sm font-bold"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:flex gap-3 md:gap-4 w-full md:w-auto">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Grade Level
                </Label>
                <Select
                  value={gradeLevelFilter}
                  onValueChange={(value) => {
                    setGradeLevelFilter(value);
                    setPage(1);
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-52 text-sm font-bold">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm font-bold">
                      All Grades
                    </SelectItem>
                    {gradeLevels.map((gl) => (
                      <SelectItem
                        key={gl.id}
                        value={gl.id.toString()}
                        className="text-sm font-bold">
                        {gl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Section
                </Label>
                <Select
                  value={sectionFilter}
                  onValueChange={(value) => {
                    setSectionFilter(value);
                    setPage(1);
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-52 text-sm font-bold">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm font-bold">
                      All Sections
                    </SelectItem>
                    {filteredSections.map((sec) => (
                      <SelectItem
                        key={sec.id}
                        value={sec.id.toString()}
                        className="text-sm font-bold">
                        {sec.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex w-full md:w-auto items-center gap-2">
              <Button
                variant="outline"
                className="h-10 px-3 text-sm font-bold w-full md:w-auto"
                onClick={() => {
                  void fetchStudents();
                }}
                disabled={loading || !ayId}>
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                variant="outline"
                className="h-10 px-3 text-sm font-bold w-full md:w-auto"
                onClick={() => {
                  setSearch("");
                  setGradeLevelFilter("all");
                  setSectionFilter("all");
                  setSortBy("createdAt");
                  setSortOrder("desc");
                  setPage(1);
                }}>
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Student List */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-2">
          <CardTitle className="text-base sm:text-lg font-extrabold">
            Enrolled Learner Records
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm font-semibold">
            Showing {students.length} of {total} enrolled learners
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-4">
          <div className="md:hidden space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border p-3 space-y-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-9 bg-muted rounded w-full" />
                </div>
              ))
            ) : students.length === 0 ? (
              <div className="rounded-xl border p-6 text-center text-sm font-bold">
                No enrolled learners found for the selected filters.
              </div>
            ) : (
              students.map((student) => (
                <div
                  key={student.id}
                  className="rounded-xl border bg-[hsl(var(--card))] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm uppercase leading-tight break-words">
                        {student.fullName}
                      </p>
                      <p className="text-xs font-bold text-muted-foreground truncate">
                        {student.trackingNumber}
                      </p>
                    </div>
                    {getEnrolledBadge()}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        LRN
                      </p>
                      <p className="font-bold">{student.lrn}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        Grade Level
                      </p>
                      <p className="font-bold">{student.gradeLevel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        Section
                      </p>
                      <p className="font-bold">{student.section || "—"}</p>
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] font-bold text-muted-foreground">
                    Enrolled {formatDate(student.createdAt)}
                  </p>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 h-9 w-full text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                    onClick={() => handleViewDetails(student.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    View Learner
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={students}
              loading={loading}
              noResultsMessage="No enrolled learners found for the selected filters."
            />
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <p className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 font-bold"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 font-bold"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <div className="p-4 sm:p-6 space-y-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-lg sm:text-xl font-extrabold">
                Enrolled Learner Details
              </DialogTitle>
              <DialogDescription className="text-sm font-medium">
                Complete profile and enrollment details for{" "}
                {selectedStudent?.trackingNumber}
              </DialogDescription>
            </DialogHeader>

            {detailLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-24 bg-muted rounded w-full" />
                <div className="h-24 bg-muted rounded w-full" />
              </div>
            ) : selectedStudent ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {getEnrolledBadge()}
                  <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--muted-foreground))] break-all">
                    {selectedStudent.trackingNumber}
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Full Name
                      </Label>
                      <p className="text-sm font-semibold break-words">
                        {selectedStudent.fullName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        LRN
                      </Label>
                      <p className="text-sm font-semibold">
                        {selectedStudent.lrn}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Date of Birth
                      </Label>
                      <p className="text-sm font-medium">
                        {formatDate(selectedStudent.birthDate)} (
                        {calculateAge(selectedStudent.birthDate)} yrs)
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Sex
                      </Label>
                      <p className="text-sm font-medium">
                        {selectedStudent.sex}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Home Address
                      </Label>
                      <p className="text-sm font-medium break-words">
                        {selectedStudent.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Family and Contact
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Parent or Guardian
                      </Label>
                      <p className="text-sm font-medium">
                        {selectedStudent.parentGuardianName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Contact Number
                      </Label>
                      <p className="text-sm font-medium break-words">
                        {selectedStudent.parentGuardianContact}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Email Address
                      </Label>
                      <p className="text-sm font-medium break-words">
                        {selectedStudent.emailAddress}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Enrollment Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        School Year
                      </Label>
                      <p className="text-sm font-medium">
                        {selectedStudent.schoolYear}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Grade Level
                      </Label>
                      <p className="text-sm font-medium">
                        {selectedStudent.gradeLevel}
                      </p>
                    </div>
                    {selectedStudent.enrollment ? (
                      <>
                        <div>
                          <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                            Section
                          </Label>
                          <p className="text-sm font-medium">
                            {selectedStudent.enrollment.section}
                          </p>
                        </div>
                        {selectedStudent.enrollment.advisingTeacher && (
                          <div>
                            <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                              Advising Teacher
                            </Label>
                            <p className="text-sm font-medium">
                              {selectedStudent.enrollment.advisingTeacher}
                            </p>
                          </div>
                        )}
                        <div>
                          <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                            Enrolled On
                          </Label>
                          <p className="text-sm font-medium">
                            {formatDate(selectedStudent.enrollment.enrolledAt)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                            Enrolled By
                          </Label>
                          <p className="text-sm font-medium">
                            {selectedStudent.enrollment.enrolledBy}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-2 rounded-lg border border-dashed p-3">
                        <p className="text-sm font-semibold text-muted-foreground">
                          No enrollment assignment details are currently
                          available.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t text-xs sm:text-sm text-[hsl(var(--muted-foreground))] space-y-1">
                  <p className="font-semibold">
                    Applied: {formatDate(selectedStudent.createdAt)}
                  </p>
                  <p className="font-semibold">
                    Last Updated: {formatDate(selectedStudent.updatedAt)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
