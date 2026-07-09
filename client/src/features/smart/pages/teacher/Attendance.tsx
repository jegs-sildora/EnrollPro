// @ts-nocheck
import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, Users, Check, X, Clock, FileText, Save, CheckCircle2, AlertCircle, ClipboardCheck, RefreshCw } from "lucide-react";
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

interface Student {
  studentId: string;
  lrn: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  remarks?: string;
  attendanceId?: string | null;
}

interface Section {
  id: string;
  name: string;
  gradeLevel: string;
}

interface AttendanceData {
  section: Section;
  date: string;
  attendance: Student[];
}

const gradeLevelLabels: Record<string, string> = {
  GRADE_7: "Grade 7",
  GRADE_8: "Grade 8",
  GRADE_9: "Grade 9",
  GRADE_10: "Grade 10",
};

export default function Attendance() {
  const { colors } = useTheme();
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch teacher's sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const token = sessionStorage.getItem("token");

        // Get class assignments
        const classResponse = await axios.get(`${SERVER_URL}/api/grades/my-classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Get advisory section
        const advisoryResponse = await axios.get(`${SERVER_URL}/api/advisory/my-advisory`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const sectionsMap = new Map<string, Section>();

        // Add sections from class assignments (API returns array directly)
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

        // Add advisory section if exists (API returns object with section property)
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

        // Auto-select advisory section if available
        if (advisoryResponse.data?.hasAdvisory && advisoryResponse.data?.section) {
          setSelectedSection(advisoryResponse.data.section.id);
        } else if (sectionsList.length > 0) {
          setSelectedSection(sectionsList[0].id);
        }
      } catch (error) {
        console.error("Error fetching sections:", error);
      }
    };

    fetchSections();
  }, []);

  // Fetch attendance when section or date changes
  useEffect(() => {
    if (selectedSection && selectedDate) {
      fetchAttendance();
    }
  }, [selectedSection, selectedDate]);

  const fetchAttendance = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = sessionStorage.getItem("token");
      const response = await axios.get(
        `${SERVER_URL}/api/attendance/section/${selectedSection}?date=${selectedDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAttendanceData(response.data.data);
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.message || "Failed to load attendance" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") => {
    if (!attendanceData) return;
    setAttendanceData({
      ...attendanceData,
      attendance: attendanceData.attendance.map((student) =>
        student.studentId === studentId ? { ...student, status } : student
      ),
    });
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    if (!attendanceData) return;
    setAttendanceData({
      ...attendanceData,
      attendance: attendanceData.attendance.map((student) =>
        student.studentId === studentId ? { ...student, remarks } : student
      ),
    });
  };

  const markAllPresent = () => {
    if (!attendanceData) return;
    setAttendanceData({
      ...attendanceData,
      attendance: attendanceData.attendance.map((student) => ({
        ...student,
        status: "PRESENT",
        remarks: "",
      })),
    });
  };

  const saveAttendance = async () => {
    if (!attendanceData) return;

    setSaving(true);
    setMessage(null);
    try {
      const token = sessionStorage.getItem("token");
      await axios.post(
        `${SERVER_URL}/api/attendance/bulk`,
        {
          sectionId: selectedSection,
          date: selectedDate,
          attendance: attendanceData.attendance.map((s) => ({
            studentId: s.studentId,
            status: s.status,
            remarks: s.remarks || null,
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: "success", text: "Attendance saved successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.message || "Failed to save attendance" });
    } finally {
      setSaving(false);
    }
  };

  const getStatusStats = () => {
    if (!attendanceData) return { present: 0, absent: 0, late: 0, excused: 0 };
    return {
      present: attendanceData.attendance.filter((s) => s.status === "PRESENT").length,
      absent: attendanceData.attendance.filter((s) => s.status === "ABSENT").length,
      late: attendanceData.attendance.filter((s) => s.status === "LATE").length,
      excused: attendanceData.attendance.filter((s) => s.status === "EXCUSED").length,
    };
  };

  const stats = getStatusStats();

  return (
<div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Daily Attendance</h1>
          </div>
          <p className="text-slate-500 ">Manage and track student attendance records</p>
        </div>
      </div>

      {/* Control Panel - Refined Glass Style */}
      <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-muted/90 backdrop-blur-md">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <Label htmlFor="section" className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Target Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger id="section" className="h-12 bg-slate-50 border-slate-100 rounded-xl text-xs font-extrabold shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all">
                  <SelectValue placeholder="Select section">
                    {selectedSection && sections.length > 0 ? (
                      (() => {
                        const selected = sections.find(s => s.id === selectedSection);
                        return selected ? `${gradeLevelLabels[selected.gradeLevel]} - ${selected.name}` : 'Select section';
                      })()
                    ) : 'Select section'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id} className="text-xs font-extrabold uppercase">
                      {gradeLevelLabels[section.gradeLevel]} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Attendance Date</Label>
              <div className="relative">
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="h-12 bg-slate-50 border-slate-100 rounded-xl text-xs font-extrabold shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all pl-10"
                />
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={markAllPresent}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-extrabold transition-all"
                disabled={!attendanceData || loading}
              >
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                MARK ALL PRESENT
              </Button>
              <Button
                onClick={saveAttendance}
                disabled={saving || !attendanceData}
                className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200 font-extrabold text-[10px] tracking-widest uppercase transition-all"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    SYNCING...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    COMMIT CHANGES
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messaging */}
      {message && (
        <div
          className={`p-5 rounded-2xl border-0 shadow-lg animate-slide-up ${message.type === "success"
            ? "bg-emerald-50 text-emerald-700 shadow-emerald-100"
            : "bg-rose-50 text-rose-700 shadow-rose-100"
            }`}
        >
          <div className="flex items-center gap-3">
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-extrabold text-sm tracking-tight">{message.text}</span>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      {attendanceData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "PRESENT", value: stats.present, icon: CheckCircle2, color: "emerald" },
            { label: "ABSENT", value: stats.absent, icon: X, color: "rose" },
            { label: "LATE", value: stats.late, icon: Clock, color: "amber" },
            { label: "EXCUSED", value: stats.excused, icon: FileText, color: "indigo" },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-lg shadow-slate-200/50 rounded-3xl bg-muted overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className={`text-3xl font-extrabold text-${stat.color}-600`}>{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-500`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Table - Modern Corporate List */}
      <Card className="border-0 shadow-2xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden bg-muted">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-extrabold text-slate-900">
                {attendanceData?.section
                  ? `${gradeLevelLabels[attendanceData.section.gradeLevel]} - ${attendanceData.section.name}`
                  : "Attendance Masterlist"
                }
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs font-extrabold uppercase tracking-widest mt-1">
                {attendanceData ? `${attendanceData.attendance.length} Learners Enrolled` : "Select filters to view list"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 text-center">
              <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-400 font-extrabold uppercase tracking-widest text-xs">Pulling Records...</p>
            </div>
          ) : attendanceData ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-transparent border-0">
                    <TableHead className="px-8 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">LRN</TableHead>
                    <TableHead className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Learner Name</TableHead>
                    <TableHead className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">Attendance Status</TableHead>
                    <TableHead className="px-8 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Notes / Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.attendance.map((student) => (
                    <TableRow key={student.studentId} className="hover:bg-slate-50/50 transition-all border-slate-50 group">
                      <TableCell className="px-8 font-mono text-xs text-slate-400 font-extrabold group-hover:text-slate-900 transition-colors">
                        {student.lrn}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-extrabold text-xs">
                            {student.lastName.charAt(0)}
                          </div>
                          <span className="font-extrabold text-slate-900 tracking-tight">
                            {student.lastName}, {student.firstName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          {[
                            { id: "PRESENT", icon: Check, color: "emerald", label: "P" },
                            { id: "ABSENT", icon: X, color: "rose", label: "A" },
                            { id: "LATE", icon: Clock, color: "amber", label: "L" },
                            { id: "EXCUSED", icon: FileText, color: "indigo", label: "E" }
                          ].map((option) => (
                            <button
                              key={option.id}
                              onClick={() => handleStatusChange(student.studentId, option.id as any)}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${student.status === option.id
                                ? `bg-${option.color}-500 text-white shadow-lg shadow-${option.color}-200 scale-110`
                                : `bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600`
                                }`}
                              title={option.id}
                            >
                              <option.icon className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-8">
                        <Input
                          placeholder="Add remark..."
                          value={student.remarks || ""}
                          onChange={(e) => handleRemarksChange(student.studentId, e.target.value)}
                          className="h-10 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:ring-0 rounded-none text-xs  transition-all"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-32 text-center bg-slate-50/50">
              <div className="w-20 h-20 bg-muted rounded-[2rem] shadow-sm flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-slate-200" />
              </div>
              <h3 className="text-slate-900 font-extrabold text-sm uppercase tracking-widest mb-2">No Records Selected</h3>
              <p className="text-slate-400 text-xs ">Configure section and date to begin tracking attendance</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

