import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, XCircle, Calendar, ClipboardCheck, UserCheck, Info } from 'lucide-react';
import { sileo } from 'sileo';
import api from '@/api/axiosInstance';
import { useSettingsStore } from '@/stores/settingsStore';
import { toastApiError } from '@/hooks/useApiToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface Application {
  id: number;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  trackingNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXAM_SCHEDULED' | 'EXAM_TAKEN' | 'PASSED' | 'FAILED';
  applicantType: string;
  gradeLevelId: number;
  gradeLevel: { name: string };
  strand?: { name: string } | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  EXAM_SCHEDULED: 'bg-blue-100 text-blue-700 border-blue-200',
  EXAM_TAKEN: 'bg-purple-100 text-purple-700 border-purple-200',
  PASSED: 'bg-green-100 text-green-700 border-green-200',
  FAILED: 'bg-orange-100 text-orange-700 border-orange-200',
};

const APPLICANT_TYPES = [
  { value: 'ALL', label: 'All Types' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'STE', label: 'STE' },
  { value: 'SPA', label: 'SPA' },
  { value: 'SPS', label: 'SPS' },
  { value: 'SPJ', label: 'SPJ' },
  { value: 'SPFL', label: 'SPFL' },
  { value: 'SPTVE', label: 'SPTVE' },
  { value: 'STEM_GRADE11', label: 'Grade 11 STEM' },
];

export default function Applications() {
  const { activeAcademicYearId, viewingAcademicYearId } = useSettingsStore();
  const ayId = viewingAcademicYearId ?? activeAcademicYearId;

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [page, setPage] = useState(1);

  // Detail/Action state
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'SCHEDULE' | 'RESULT' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examScore, setExamScore] = useState('');
  const [examResult, setExamResult] = useState('PASSED');
  const [sections, setSections] = useState<{ id: number; name: string; maxCapacity: number; _count: { enrollments: number } }[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!ayId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status !== 'ALL') params.append('status', status);
      if (type !== 'ALL') params.append('applicantType', type);
      params.append('page', String(page));
      params.append('limit', '15');

      const res = await api.get(`/applications?${params.toString()}`);
      setApplications(res.data.applications);
      setTotal(res.data.total);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, status, type, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchSections = async (glId: number) => {
    try {
      const res = await api.get(`/sections?gradeLevelId=${glId}`);
      setSections(res.data.sections);
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp || !selectedSectionId) return;
    try {
      await api.post(`/applications/${selectedApp.id}/approve`, { sectionId: parseInt(selectedSectionId) });
      sileo.success({ title: 'Approved', description: 'Student enrolled successfully.' });
      setActionType(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    try {
      await api.post(`/applications/${selectedApp.id}/reject`, { rejectionReason });
      sileo.success({ title: 'Rejected', description: 'Application has been rejected.' });
      setActionType(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleSchedule = async () => {
    if (!selectedApp || !examDate) return;
    try {
      await api.post(`/applications/${selectedApp.id}/schedule-exam`, { 
        examDate, 
        assessmentType: selectedApp.applicantType === 'SPA' ? 'Audition' : selectedApp.applicantType === 'SPS' ? 'Tryout' : 'Entrance Exam' 
      });
      sileo.success({ title: 'Scheduled', description: 'Exam/Assessment scheduled.' });
      setActionType(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleRecordResult = async () => {
    if (!selectedApp) return;
    try {
      await api.post(`/applications/${selectedApp.id}/record-result`, { 
        examScore: parseFloat(examScore),
        examResult,
        examNotes: 'Recorded from portal'
      });
      sileo.success({ title: 'Result Recorded', description: 'Applicant assessment result saved.' });
      
      // Auto-pass/fail if needed
      if (examResult === 'PASSED') {
        await api.post(`/applications/${selectedApp.id}/pass`);
      } else {
        await api.post(`/applications/${selectedApp.id}/fail`);
      }
      
      setActionType(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Review and process student admissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700">Total: {total}</Badge>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-xs uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">Search Applicant</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <Input 
                  placeholder="LRN, First Name, Last Name..." 
                  className="pl-9 h-10" 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-2 w-full md:w-48">
              <Label className="text-xs uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="EXAM_SCHEDULED">Exam Scheduled</SelectItem>
                  <SelectItem value="EXAM_TAKEN">Exam Taken</SelectItem>
                  <SelectItem value="PASSED">Passed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="APPROVED">Enrolled</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full md:w-48">
              <Label className="text-xs uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICANT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="h-10 px-3" onClick={() => { setSearch(''); setStatus('ALL'); setType('ALL'); }}>
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <Table>
              <TableHeader className="bg-[hsl(var(--muted))]">
                <TableRow>
                  <TableHead className="font-bold">Applicant</TableHead>
                  <TableHead className="font-bold">LRN</TableHead>
                  <TableHead className="font-bold">Grade / Strand</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading applications...</TableCell>
                  </TableRow>
                ) : applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-[hsl(var(--muted-foreground))]">No applications found.</TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow key={app.id} className="hover:bg-[hsl(var(--muted))] transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{app.lastName}, {app.firstName}</span>
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">#{app.trackingNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{app.lrn}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{app.gradeLevel.name}</span>
                          {app.strand && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{app.strand.name}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 h-4 border-slate-300 text-slate-600">
                          {app.applicantType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-bold ${STATUS_COLORS[app.status]}`}>
                          {app.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                        {format(new Date(app.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Approve/Enroll Action */}
                          {(app.status === 'PENDING' || app.status === 'PASSED') && app.applicantType === 'REGULAR' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => { setSelectedApp(app); setActionType('APPROVE'); fetchSections(app.gradeLevelId); }}>
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {/* SCP Actions */}
                          {app.applicantType !== 'REGULAR' && app.status === 'PENDING' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => { setSelectedApp(app); setActionType('SCHEDULE'); }}>
                              <Calendar className="h-4 w-4" />
                            </Button>
                          )}

                          {app.status === 'EXAM_SCHEDULED' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600" onClick={() => { setSelectedApp(app); setActionType('RESULT'); }}>
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                          )}

                          {app.status === 'PASSED' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => { setSelectedApp(app); setActionType('APPROVE'); fetchSections(app.gradeLevelId); }}>
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}

                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { /* TODO: View full details */ }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {app.status !== 'APPROVED' && app.status !== 'REJECTED' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedApp(app); setActionType('REJECT'); }}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Showing {applications.length} of {total} applications</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <Badge variant="secondary" className="px-3 h-8">Page {page}</Badge>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 15 >= total}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Dialogs */}
      <Dialog open={actionType !== null} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'APPROVE' && 'Approve & Enroll Student'}
              {actionType === 'REJECT' && 'Reject Application'}
              {actionType === 'SCHEDULE' && 'Schedule Admission Assessment'}
              {actionType === 'RESULT' && 'Record Assessment Result'}
            </DialogTitle>
            <DialogDescription>
              Applicant: {selectedApp?.lastName}, {selectedApp?.firstName}
            </DialogDescription>
          </DialogHeader>

          {actionType === 'APPROVE' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Section for {selectedApp?.gradeLevel.name}</Label>
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a section..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map(s => (
                      <SelectItem key={s.id} value={String(s.id)} disabled={s._count.enrollments >= s.maxCapacity}>
                        {s.name} ({s._count.enrollments}/{s.maxCapacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Only sections for this grade level with available capacity are shown.</p>
              </div>
            </div>
          )}

          {actionType === 'REJECT' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason for Rejection</Label>
                <textarea 
                  className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Explain why this application is being rejected..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          )}

          {actionType === 'SCHEDULE' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Assessment Date</Label>
                <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 text-blue-800 text-xs">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>An email will be sent to the applicant with the schedule details.</p>
              </div>
            </div>
          )}

          {actionType === 'RESULT' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Score / Rating</Label>
                <Input type="number" step="0.01" placeholder="e.g. 85.5" value={examScore} onChange={e => setExamScore(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Final Verdict</Label>
                <Select value={examResult} onValueChange={setExamResult}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASSED">PASSED - Qualifies for Program</SelectItem>
                    <SelectItem value="FAILED">FAILED - Did not meet criteria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
            {actionType === 'APPROVE' && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={!selectedSectionId}>Confirm Enrollment</Button>}
            {actionType === 'REJECT' && <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason}>Reject Application</Button>}
            {actionType === 'SCHEDULE' && <Button onClick={handleSchedule} disabled={!examDate}>Confirm Schedule</Button>}
            {actionType === 'RESULT' && <Button onClick={handleRecordResult}>Save Result</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
