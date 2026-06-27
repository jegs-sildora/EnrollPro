// @ts-nocheck
import { useState } from "react";
import { Download, Calendar, Filter, FileSpreadsheet, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/features/smart/components/ui/card";
import { Button } from "@/features/smart/components/ui/button";
import { Input } from "@/features/smart/components/ui/input";
import { Label } from "@/features/smart/components/ui/label";
import { Badge } from "@/features/smart/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/smart/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/smart/components/ui/select";
import { useTheme } from "@/features/smart/contexts/ThemeContext";
import { SERVER_URL } from "@/features/smart/lib/api";
import axios from "axios";

interface Section {
  id: string;
  name: string;
  gradeLevel: string;
}

interface AttendanceSummary {
  studentId: string;
  lrn: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

const gradeLevelLabels: Record<string, string> = {
  GRADE_7: "Grade 7",
  GRADE_8: "Grade 8",
  GRADE_9: "Grade 9",
  GRADE_10: "Grade 10",
};

export default function AttendanceReports() {
  const { colors } = useTheme();
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [summary, setSummary] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch sections on mount
  useState(() => {
    const fetchSections = async () => {
      try {
        const token = sessionStorage.getItem("token");
        const [classResponse, advisoryResponse] = await Promise.all([
          axios.get(`${SERVER_URL}/api/grades/my-classes`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${SERVER_URL}/api/advisory/my-advisory`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const sectionsMap = new Map<string, Section>();

        if (Array.isArray(classResponse.data)) {
          classResponse.data.forEach((assignment: any) => {
            if (assignment.section && !sectionsMap.has(assignment.section.id)) {
              sectionsMap.set(assignment.section.id, {
                id: assignment.section.id,
                name: assignment.section.name,
                gradeLevel: assignment.section.gradeLevel,
              });
            }
          });
        }

        if (advisoryResponse.data?.hasAdvisory && advisoryResponse.data?.section) {
          const advisorySection = advisoryResponse.data.section;
          if (!sectionsMap.has(advisorySection.id)) {
            sectionsMap.set(advisorySection.id, {
              id: advisorySection.id,
              name: advisorySection.name,
              gradeLevel: advisorySection.gradeLevel,
            });
          }
        }

        const sectionsList = Array.from(sectionsMap.values());
        setSections(sectionsList);

        if (advisoryResponse.data?.hasAdvisory && advisoryResponse.data?.section) {
          setSelectedSection(advisoryResponse.data.section.id);
        } else if (sectionsList.length > 0) {
          setSelectedSection(sectionsList[0].id);
        }

        // Set default start date to 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
      } catch (error) {
        console.error("Error fetching sections:", error);
      }
    };

    fetchSections();
  });

  const fetchReport = async () => {
    if (!selectedSection || !startDate || !endDate) return;

    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${SERVER_URL}/api/attendance/summary/${selectedSection}`,
        {
          params: { startDate, endDate },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSummary(response.data.data.summary);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (!selectedSection || !startDate || !endDate) return;

    setDownloading(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${SERVER_URL}/api/attendance/export/${selectedSection}`,
        {
          params: { startDate, endDate },
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      const section = sections.find(s => s.id === selectedSection);
      const sectionName = section ? `${gradeLevelLabels[section.gradeLevel]}-${section.name}` : "Attendance";
      link.setAttribute("download", `${sectionName}_${startDate}_to_${endDate}.xlsx`);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading Excel:", error);
    } finally {
      setDownloading(false);
    }
  };

  const getAttendanceRate = (present: number, total: number) => {
    if (total === 0) return 0;
    return ((present / total) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Attendance Reports</h1>
          <p className="text-gray-500 mt-1">View and download attendance summaries</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Report Filters
          </CardTitle>
          <CardDescription>Select section and date range to generate report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="section">Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger id="section" className="w-full truncate">
                  <SelectValue placeholder="Select section">
                    {selectedSection && sections.length > 0 ? (
                      (() => {
                        const selected = sections.find(s => s.id === selectedSection);
                        return selected ? `${gradeLevelLabels[selected.gradeLevel]} - ${selected.name}` : 'Select section';
                      })()
                    ) : 'Select section'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {gradeLevelLabels[section.gradeLevel]} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={fetchReport}
                disabled={!selectedSection || !startDate || !endDate || loading}
                className="flex-1"
                style={{ backgroundColor: colors.primary }}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    View Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Students</p>
                <p className="text-3xl font-extrabold" style={{ color: colors.primary }}>
                  {summary.length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-500">Avg. Attendance</p>
                <p className="text-3xl font-extrabold text-green-600">
                  {summary.length > 0
                    ? (
                      (summary.reduce((acc, s) => acc + s.present, 0) /
                        summary.reduce((acc, s) => acc + s.total, 0)) *
                      100
                    ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Days</p>
                <p className="text-3xl font-extrabold" style={{ color: colors.secondary }}>
                  {summary[0]?.total || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Button
                  onClick={downloadExcel}
                  disabled={downloading}
                  variant="outline"
                  className="w-full"
                  style={{ borderColor: colors.accent, color: colors.accent }}
                >
                  {downloading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Excel
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attendance Summary</CardTitle>
              <CardDescription>
                {summary.length > 0
                  ? `Showing ${summary.length} students from ${startDate} to ${endDate}`
                  : "Select filters and click 'View Report' to see data"}
              </CardDescription>
            </div>
            {summary.length > 0 && (
              <Badge variant="outline" className="text-sm">
                <FileSpreadsheet className="w-3 h-3 mr-1" />
                {summary.length} Records
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div
                  className="w-12 h-12 mx-auto mb-4 border-[3px] border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: colors.primary, borderTopColor: "transparent" }}
                />
                <p className="text-gray-500">Loading report...</p>
              </div>
            </div>
          ) : summary.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LRN</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Excused</TableHead>
                    <TableHead className="text-center">Total Days</TableHead>
                    <TableHead className="text-center">Attendance Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-mono text-sm">{student.lrn}</TableCell>
                      <TableCell className="">
                        {student.lastName}, {student.firstName} {student.middleName?.[0]}.
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          {student.present}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-100 text-red-700 border-red-200">
                          {student.absent}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          {student.late}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                          {student.excused}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{student.total}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-extrabold ${parseFloat(getAttendanceRate(student.present, student.total)) >= 90
                            ? "text-green-600"
                            : parseFloat(getAttendanceRate(student.present, student.total)) >= 75
                              ? "text-amber-600"
                              : "text-red-600"
                            }`}
                        >
                          {getAttendanceRate(student.present, student.total)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No attendance data available</p>
              <p className="text-sm mt-1">Select a section and date range to view the report</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
