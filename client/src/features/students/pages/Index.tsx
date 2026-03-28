import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Eye,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
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
  strand: string | null;
  strandId: number | null;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
      return <ArrowUpDown className='h-4 w-4 ml-1 opacity-40' />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className='h-4 w-4 ml-1' />
    ) : (
      <ArrowDown className='h-4 w-4 ml-1' />
    );
  };

  // Fetch students
  const fetchStudents = useCallback(async () => {
    if (!ayId) return;
    if (initialLoad) setLoading(true);
    try {
      const params: Record<string, string | number> = {
        schoolYearId: ayId,
        page,
        limit: 15,
        sortBy,
        sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (gradeLevelFilter !== "all") params.gradeLevelId = gradeLevelFilter;
      if (sectionFilter !== "all") params.sectionId = sectionFilter;
      if (statusFilter !== "all") params.status = statusFilter;

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
    statusFilter,
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ENROLLED":
        return (
          <Badge className='bg-green-100 text-green-700 hover:bg-green-100 border-green-200'>
            Enrolled
          </Badge>
        );
      case "PRE_REGISTERED":
        return (
          <Badge className='bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200'>
            Pre-registered
          </Badge>
        );
      case "SUBMITTED":
      case "UNDER_REVIEW":
        return (
          <Badge className='bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200'>
            Processing
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className='bg-red-100 text-red-700 hover:bg-red-100 border-red-200'>
            Rejected
          </Badge>
        );
      default:
        return <Badge variant='outline'>{status.replace("_", " ")}</Badge>;
    }
  };

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

  if (!ayId) {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">No School Year Selected</p>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
                Please set an active year or choose one from the header switcher to manage records for this period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold flex items-center gap-2'>
          <Users className='h-8 w-8' />
          Students
        </h1>
        <p className='text-sm text-[hsl(var(--muted-foreground))]'>
          Search and manage enrolled student records
        </p>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Total Records</CardDescription>
            <CardTitle className='text-2xl'>{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Official Enrollment</CardDescription>
            <CardTitle className='text-2xl text-green-600'>
              {students.filter((s) => s.status === "ENROLLED").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Pre-registered</CardDescription>
            <CardTitle className='text-2xl text-emerald-600'>
              {students.filter((s) => s.status === "PRE_REGISTERED").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
            {/* Search */}
            <div className='lg:col-span-2'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]' />
                <Input
                  placeholder='Search by LRN or name...'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='pl-9'
                />
              </div>
            </div>

            {/* Grade Level Filter */}
            <div>
              <Select
                value={gradeLevelFilter}
                onValueChange={setGradeLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder='Grade Level' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Grades</SelectItem>
                  {gradeLevels.map((gl) => (
                    <SelectItem key={gl.id} value={gl.id.toString()}>
                      {gl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Filter */}
            <div>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder='Section' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Sections</SelectItem>
                  {filteredSections.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id.toString()}>
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='ENROLLED'>Enrolled</SelectItem>
                  <SelectItem value='PRE_REGISTERED'>Pre-registered</SelectItem>
                  <SelectItem value='UNDER_REVIEW'>Processing</SelectItem>
                  <SelectItem value='REJECTED'>Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Records</CardTitle>
          <CardDescription>
            Showing {students.length} of {total} students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='w-full overflow-x-auto rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='p-0'>
                    <button
                      onClick={() => handleSort("lrn")}
                      className='flex h-12 w-full items-center px-4 font-semibold hover:bg-[hsl(var(--muted))]/50 transition-colors cursor-pointer relative z-10'>
                      LRN
                      {getSortIcon("lrn")}
                    </button>
                  </TableHead>
                  <TableHead className='p-0'>
                    <button
                      onClick={() => handleSort("lastName")}
                      className='flex h-12 w-full items-center px-4 font-semibold hover:bg-[hsl(var(--muted))]/50 transition-colors cursor-pointer relative z-10'>
                      Full Name
                      {getSortIcon("lastName")}
                    </button>
                  </TableHead>
                  <TableHead className='p-0 hidden md:table-cell'>
                    <button
                      onClick={() => handleSort("gradeLevel")}
                      className='flex h-12 w-full items-center px-4 font-semibold hover:bg-[hsl(var(--muted))]/50 transition-colors cursor-pointer relative z-10'>
                      Grade Level
                      {getSortIcon("gradeLevel")}
                    </button>
                  </TableHead>
                  <TableHead className='p-0 hidden lg:table-cell'>
                    <button
                      onClick={() => handleSort("section")}
                      className='flex h-12 w-full items-center px-4 font-semibold hover:bg-[hsl(var(--muted))]/50 transition-colors cursor-pointer relative z-10'>
                      Section
                      {getSortIcon("section")}
                    </button>
                  </TableHead>
                  <TableHead className='p-0 hidden lg:table-cell'>
                    <button
                      onClick={() => handleSort("strand")}
                      className='flex h-12 w-full items-center px-4 font-semibold hover:bg-[hsl(var(--muted))]/50 transition-colors cursor-pointer relative z-10'>
                      Strand
                      {getSortIcon("strand")}
                    </button>
                  </TableHead>
                  <TableHead className='p-0'>
                    <button
                      onClick={() => handleSort("status")}
                      className='flex h-12 w-full items-center px-4 font-semibold hover:bg-[hsl(var(--muted))]/50 transition-colors cursor-pointer relative z-10'>
                      Status
                      {getSortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead className='p-0 hidden md:table-cell'>
                    <button
                      onClick={() => handleSort("createdAt")}
                      className='flex h-12 w-full items-center px-4 font-semibold hover:bg-[hsl(var(--muted))]/50 transition-colors cursor-pointer relative z-10'>
                      Applied
                      {getSortIcon("createdAt")}
                    </button>
                  </TableHead>
                  <TableHead className='font-semibold text-right px-4'>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? null : students.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className='text-center py-8 text-[hsl(var(--muted-foreground))]'>
                      No students found. Try adjusting your search or filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className=' text-xs'>{student.lrn}</TableCell>
                      <TableCell className='font-medium'>
                        {student.fullName}
                      </TableCell>
                      <TableCell className='hidden md:table-cell'>
                        {student.gradeLevel}
                      </TableCell>
                      <TableCell className='hidden lg:table-cell'>
                        {student.section || "—"}
                      </TableCell>
                      <TableCell className='hidden lg:table-cell'>
                        {student.strand || "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(student.status)}</TableCell>
                      <TableCell className='hidden md:table-cell text-sm text-[hsl(var(--muted-foreground))]'>
                        {formatDate(student.createdAt)}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleViewDetails(student.id)}>
                          <Eye className='h-4 w-4' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex items-center justify-between mt-4'>
              <p className='text-sm text-[hsl(var(--muted-foreground))]'>
                Page {page} of {totalPages}
              </p>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}>
                  Previous
                </Button>
                <Button
                  variant='outline'
                  size='sm'
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
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedStudent?.trackingNumber}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? null : selectedStudent ? (
            <div className='space-y-6'>
              {/* Status Badge */}
              <div className='flex items-center justify-between'>
                {getStatusBadge(selectedStudent.status)}
                <span className='text-sm text-[hsl(var(--muted-foreground))]'>
                  {selectedStudent.trackingNumber}
                </span>
              </div>

              {/* Personal Information */}
              <div className='space-y-3'>
                <h3 className='font-semibold text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]'>
                  Personal Information
                </h3>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      Full Name
                    </Label>
                    <p className='font-medium'>{selectedStudent.fullName}</p>
                  </div>
                  <div>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      LRN
                    </Label>
                    <p className=' text-sm'>{selectedStudent.lrn}</p>
                  </div>
                  <div>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      Date of Birth
                    </Label>
                    <p className='text-sm'>
                      {formatDate(selectedStudent.birthDate)} (
                      {calculateAge(selectedStudent.birthDate)} yrs)
                    </p>
                  </div>
                  <div>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      Sex
                    </Label>
                    <p className='text-sm'>{selectedStudent.sex}</p>
                  </div>
                  <div className='col-span-2'>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      Home Address
                    </Label>
                    <p className='text-sm'>{selectedStudent.address}</p>
                  </div>
                </div>
              </div>

              {/* Family & Contact */}
              <div className='space-y-3'>
                <h3 className='font-semibold text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]'>
                  Family & Contact
                </h3>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      Parent/Guardian
                    </Label>
                    <p className='text-sm'>
                      {selectedStudent.parentGuardianName}
                    </p>
                  </div>
                  <div>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      Contact Number
                    </Label>
                    <p className='text-sm '>
                      {selectedStudent.parentGuardianContact}
                    </p>
                  </div>
                  <div className='col-span-2'>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      Email Address
                    </Label>
                    <p className='text-sm'>{selectedStudent.emailAddress}</p>
                  </div>
                </div>
              </div>

              {/* Enrollment Information */}
              <div className='space-y-3'>
                <h3 className='font-semibold text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]'>
                  Enrollment Information
                </h3>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      School Year
                    </Label>
                    <p className='text-sm'>{selectedStudent.schoolYear}</p>
                  </div>
                  <div>
                    <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                      Grade Level
                    </Label>
                    <p className='text-sm'>{selectedStudent.gradeLevel}</p>
                  </div>
                  {selectedStudent.strand && (
                    <div>
                      <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                        Strand
                      </Label>
                      <p className='text-sm'>{selectedStudent.strand}</p>
                    </div>
                  )}
                  {selectedStudent.enrollment && (
                    <>
                      <div>
                        <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                          Section
                        </Label>
                        <p className='text-sm'>
                          {selectedStudent.enrollment.section}
                        </p>
                      </div>
                      {selectedStudent.enrollment.advisingTeacher && (
                        <div>
                          <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                            Advising Teacher
                          </Label>
                          <p className='text-sm'>
                            {selectedStudent.enrollment.advisingTeacher}
                          </p>
                        </div>
                      )}
                      <div>
                        <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                          Enrolled On
                        </Label>
                        <p className='text-sm'>
                          {formatDate(selectedStudent.enrollment.enrolledAt)}
                        </p>
                      </div>
                      <div>
                        <Label className='text-xs text-[hsl(var(--muted-foreground))]'>
                          Enrolled By
                        </Label>
                        <p className='text-sm'>
                          {selectedStudent.enrollment.enrolledBy}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Rejection Reason (if applicable) */}
              {selectedStudent.status === "REJECTED" &&
                selectedStudent.rejectionReason && (
                  <div className='space-y-2 p-4 bg-red-50 rounded-lg border border-red-200'>
                    <Label className='text-xs font-semibold text-red-700'>
                      Rejection Reason
                    </Label>
                    <p className='text-sm text-red-900'>
                      {selectedStudent.rejectionReason}
                    </p>
                  </div>
                )}

              {/* Submission Info */}
              <div className='pt-4 border-t text-xs text-[hsl(var(--muted-foreground))]'>
                <p>Applied: {formatDate(selectedStudent.createdAt)}</p>
                <p>Last Updated: {formatDate(selectedStudent.updatedAt)}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
