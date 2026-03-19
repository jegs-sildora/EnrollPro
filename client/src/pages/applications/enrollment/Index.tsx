import { useState, useEffect, useCallback } from "react";
import { Search, Eye, UserCheck } from "lucide-react";
import { sileo } from "sileo";
import api from "@/api/axiosInstance";
import { useSettingsStore } from "@/stores/settingsStore";
import { toastApiError } from "@/hooks/useApiToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Application {
  id: number;
  lrn: string;
  lastName: string;
  firstName: string;
  trackingNumber: string;
  status: "PRE_REGISTERED" | "ENROLLED";
  applicantType: string;
  gradeLevel: { name: string };
  strand?: { name: string } | null;
  createdAt: string;
  section?: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PRE_REGISTERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ENROLLED: "bg-green-100 text-green-700 border-green-200",
};

export default function Enrollment() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  // Detail/Action state
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);

      // If status is ALL, we want both PRE_REGISTERED and ENROLLED
      if (status !== "ALL") {
        params.append("status", status);
      } else {
        // The backend might not have a way to filter for multiple statuses at once easily without a custom query
        // For now we'll fetch and filter client-side if status is ALL, or just use /applications and filter
      }

      params.append("page", String(page));
      params.append("limit", "15");

      const res = await api.get(`/applications?${params.toString()}`);

      let filteredApps = res.data.applications;
      if (status === "ALL") {
        filteredApps = filteredApps.filter((app: Application) =>
          ["PRE_REGISTERED", "ENROLLED"].includes(app.status),
        );
      }

      setApplications(filteredApps);
      setTotal(
        status === "ALL"
          ? res.data.total -
              (res.data.applications.length - filteredApps.length)
          : res.data.total,
      );
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, status, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEnroll = async () => {
    if (!selectedApp) return;
    try {
      await api.patch(`/applications/${selectedApp.id}/enroll`);
      sileo.success({
        title: "Enrolled",
        description: "Official enrollment confirmed.",
      });
      setIsEnrollModalOpen(false);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Enrollment Management
          </h1>
          <p className='text-sm text-[hsl(var(--muted-foreground))]'>
            Finalize registration and section assignments
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='outline' className='bg-emerald-50 text-emerald-700'>
            Enrolled/Pre-registered: {total}
          </Badge>
        </div>
      </div>

      <Card className='border-none shadow-sm bg-[hsl(var(--card))]'>
        <CardHeader className='pb-3'>
          <div className='flex flex-col md:flex-row gap-4 items-end'>
            <div className='flex-1 space-y-2 w-full'>
              <Label className='text-xs uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]'>
                Search Student
              </Label>
              <div className='relative'>
                <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]' />
                <Input
                  placeholder='LRN, Name...'
                  className='pl-9 h-10'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className='space-y-2 w-full md:w-48'>
              <Label className='text-xs uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]'>
                Enrollment Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className='h-10'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='ALL'>All Enrolling</SelectItem>
                  <SelectItem value='PRE_REGISTERED'>Pre-registered</SelectItem>
                  <SelectItem value='ENROLLED'>Officially Enrolled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant='outline'
              className='h-10 px-3'
              onClick={() => {
                setSearch("");
                setStatus("ALL");
              }}>
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-xl border border-[hsl(var(--border))] overflow-hidden'>
            <Table>
              <TableHeader className='bg-[hsl(var(--muted))]'>
                <TableRow>
                  <TableHead className='font-bold'>Student</TableHead>
                  <TableHead className='font-bold'>LRN</TableHead>
                  <TableHead className='font-bold'>Grade / Strand</TableHead>
                  <TableHead className='font-bold'>Section</TableHead>
                  <TableHead className='font-bold'>Status</TableHead>
                  <TableHead className='text-right font-bold'>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='h-24 text-center text-sm text-[hsl(var(--muted-foreground))]'>
                      Loading enrollment list...
                    </TableCell>
                  </TableRow>
                ) : applications.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='h-24 text-center text-sm text-[hsl(var(--muted-foreground))]'>
                      No students found.
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow
                      key={app.id}
                      className='hover:bg-[hsl(var(--muted))] transition-colors'>
                      <TableCell>
                        <div className='flex flex-col'>
                          <span className='font-bold text-sm'>
                            {app.lastName}, {app.firstName}
                          </span>
                          <span className='text-[10px] text-[hsl(var(--muted-foreground))]'>
                            #{app.trackingNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className=' text-xs'>{app.lrn}</TableCell>
                      <TableCell>
                        <div className='flex flex-col'>
                          <span className='text-xs font-medium'>
                            {app.gradeLevel.name}
                          </span>
                          {app.strand && (
                            <span className='text-[10px] text-[hsl(var(--muted-foreground))]'>
                              {app.strand.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className='bg-slate-50 text-slate-700 border-slate-200'>
                          {app.section?.name ?? "Not Assigned"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className={`text-[10px] font-bold ${STATUS_COLORS[app.status]}`}>
                          {app.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-1'>
                          {app.status === "PRE_REGISTERED" && (
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 text-green-600'
                              title='Official Enrollment'
                              onClick={() => {
                                setSelectedApp(app);
                                setIsEnrollModalOpen(true);
                              }}>
                              <UserCheck className='h-4 w-4' />
                            </Button>
                          )}
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={() => {
                              /* TODO: View full details */
                            }}>
                            <Eye className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className='flex items-center justify-between mt-4'>
            <span className='text-xs text-[hsl(var(--muted-foreground))]'>
              Showing {applications.length} students
            </span>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}>
                Previous
              </Button>
              <Badge variant='secondary' className='px-3 h-8'>
                Page {page}
              </Badge>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 15 >= total}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Dialogs */}
      <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Official Enrollment Confirmation</DialogTitle>
            <DialogDescription>
              Confirming enrollment for {selectedApp?.lastName},{" "}
              {selectedApp?.firstName}
            </DialogDescription>
          </DialogHeader>

          <div className='py-4'>
            <p className='text-sm'>
              This action confirms the{" "}
              <span className='font-bold text-green-700'>
                OFFICIAL ENROLLMENT
              </span>{" "}
              for Phase 2.
            </p>
            <div className='mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 space-y-2'>
              <div className='flex justify-between text-xs'>
                <span className='text-emerald-700'>Section:</span>
                <span className='font-bold'>{selectedApp?.section?.name}</span>
              </div>
              <div className='flex justify-between text-xs'>
                <span className='text-emerald-700'>Grade Level:</span>
                <span className='font-bold'>
                  {selectedApp?.gradeLevel.name}
                </span>
              </div>
            </div>
            <p className='text-xs text-[hsl(var(--muted-foreground))] mt-4 italic'>
              Ensure all physical documents (PSA, SF9) have been verified in
              person before proceeding.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsEnrollModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className='bg-green-600 hover:bg-green-700'
              onClick={handleEnroll}>
              Confirm Official Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
