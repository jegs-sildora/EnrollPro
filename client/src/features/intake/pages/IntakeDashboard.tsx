import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Loader2, Plus, Trash2, CheckCircle2, ClipboardList, BookOpen } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import type { AxiosError } from "axios";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface EnrollmentListing {
  id: number;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  status: "LISTED" | "PROCESSED";
  dateCollected: string;
  notes?: string | null;
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}

interface EnrolledLearner {
  id: number;
  status: string;
  readingProfileLevel: string | null;
  readingProfileNotes: string | null;
  readingProfileAssessedAt: string | null;
  isConfirmationSlipReceived: boolean;
  learner: {
    id: number;
    lrn: string | null;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  gradeLevel: { id: number; name: string };
  enrollmentRecords: { section: { id: number; name: string } | null }[];
}

const READING_LEVELS = [
  { value: "INDEPENDENT", label: "Independent", color: "text-emerald-600" },
  { value: "INSTRUCTIONAL", label: "Instructional", color: "text-blue-600" },
  { value: "FRUSTRATION", label: "Frustration", color: "text-amber-600" },
  { value: "NON_READER", label: "Non-Reader", color: "text-red-600" },
] as const;

const GRADE_LEVELS = [
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

// ─── Pre-Listing Tab ────────────────────────────────────────────────────────────

function PreListingTab({ schoolYearId }: { schoolYearId: number }) {
  const [listings, setListings] = useState<EnrollmentListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gradeLevel: "",
    notes: "",
  });

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ listings: EnrollmentListing[] }>(
        `/enrollment-listings?schoolYearId=${schoolYearId}`,
      );
      setListings(res.data.listings);
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string }>);
    } finally {
      setLoading(false);
    }
  }, [schoolYearId]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  const handleAdd = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.gradeLevel) {
      sileo.error({ title: "Validation Error", description: "First name, last name, and grade level are required." });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/enrollment-listings", {
        firstName: form.firstName,
        lastName: form.lastName,
        gradeLevel: form.gradeLevel,
        schoolYearId,
        notes: form.notes || undefined,
      });
      setForm({ firstName: "", lastName: "", gradeLevel: "", notes: "" });
      sileo.success({ title: "Added", description: "Entry added to pre-listing." });
      void fetchListings();
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string }>);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkProcessed = async (id: number) => {
    try {
      await api.patch(`/enrollment-listings/${id}/status`, { status: "PROCESSED" });
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: "PROCESSED" } : l)),
      );
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string }>);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this entry?")) return;
    try {
      await api.delete(`/enrollment-listings/${id}`);
      setListings((prev) => prev.filter((l) => l.id !== id));
      sileo.success({ title: "Removed", description: "Entry deleted." });
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string }>);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-wide flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest">Last Name</Label>
              <Input
                placeholder="LAST NAME"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value.toUpperCase() }))}
                className="h-10 font-bold uppercase text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest">First Name</Label>
              <Input
                placeholder="FIRST NAME"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value.toUpperCase() }))}
                className="h-10 font-bold uppercase text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest">Grade Level</Label>
              <Select value={form.gradeLevel} onValueChange={(v) => setForm((f) => ({ ...f, gradeLevel: v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select grade..." />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map((g) => (
                    <SelectItem key={g} value={g.toUpperCase().replace(" ", "_")}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAdd}
                disabled={submitting}
                className="h-10 w-full font-black uppercase text-xs tracking-wide">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listing Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <ClipboardList className="h-8 w-8" />
              <p className="text-sm font-semibold">No entries yet for this school year.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date Collected</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        {l.lastName}, {l.firstName}
                      </td>
                      <td className="px-4 py-3 text-xs">{l.gradeLevel}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={l.status === "PROCESSED" ? "default" : "secondary"}
                          className={`text-[10px] font-black uppercase tracking-wide ${l.status === "PROCESSED" ? "bg-emerald-100 text-emerald-700" : ""}`}>
                          {l.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(l.dateCollected).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                        {l.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {l.status === "LISTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkProcessed(l.id)}
                              className="h-7 text-xs font-bold">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(l.id)}
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reading Assessment Tab ─────────────────────────────────────────────────────

function ReadingAssessmentTab({ schoolYearId }: { schoolYearId: number }) {
  const [learners, setLearners] = useState<EnrolledLearner[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const fetchLearners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ applications: EnrolledLearner[] }>(
        `/enrollment-listings/enrolled-learners?schoolYearId=${schoolYearId}`,
      );
      setLearners(res.data.applications);
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string }>);
    } finally {
      setLoading(false);
    }
  }, [schoolYearId]);

  useEffect(() => {
    void fetchLearners();
  }, [fetchLearners]);

  const handleReadingLevelChange = async (applicationId: number, level: string) => {
    setSavingIds((s) => new Set(s).add(applicationId));
    try {
      await api.patch(`/enrollment-listings/applications/${applicationId}/reading-profile`, {
        readingProfileLevel: level,
      });
      setLearners((prev) =>
        prev.map((l) =>
          l.id === applicationId ? { ...l, readingProfileLevel: level } : l,
        ),
      );
      sileo.success({ title: "Saved", description: "Reading profile updated." });
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string }>);
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(applicationId);
        return next;
      });
    }
  };

  const levelColor = (level: string | null) => {
    if (level === "NON_READER") return "text-red-600 font-black";
    if (level === "FRUSTRATION") return "text-amber-600 font-bold";
    if (level === "INSTRUCTIONAL") return "text-blue-600 font-bold";
    if (level === "INDEPENDENT") return "text-emerald-600 font-bold";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : learners.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <BookOpen className="h-8 w-8" />
            <p className="text-sm font-semibold">No enrolled learners found for this school year.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-left">Learner</th>
                  <th className="px-4 py-3 text-left">LRN</th>
                  <th className="px-4 py-3 text-left">Grade / Section</th>
                  <th className="px-4 py-3 text-left">Reading Level</th>
                  <th className="px-4 py-3 text-left">Assessed</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((l) => {
                  const section = l.enrollmentRecords[0]?.section;
                  const isSaving = savingIds.has(l.id);
                  return (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        {l.learner.lastName}, {l.learner.firstName}
                        {l.learner.middleName ? ` ${l.learner.middleName.charAt(0)}.` : ""}
                        {(l.readingProfileLevel === "NON_READER" || l.readingProfileLevel === "FRUSTRATION") && (
                          <Badge className="ml-2 text-[9px] font-black uppercase bg-red-100 text-red-700">
                            {l.readingProfileLevel === "NON_READER" ? "Non-Reader" : "Needs Support"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {l.learner.lrn ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-semibold">{l.gradeLevel.name}</span>
                        {section && (
                          <span className="text-muted-foreground"> · {section.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <Select
                            value={l.readingProfileLevel ?? ""}
                            onValueChange={(v) => handleReadingLevelChange(l.id, v)}
                            disabled={isSaving}>
                            <SelectTrigger className="h-8 text-xs w-[160px]">
                              <SelectValue placeholder="Not assessed" />
                            </SelectTrigger>
                            <SelectContent>
                              {READING_LEVELS.map((rl) => (
                                <SelectItem key={rl.value} value={rl.value}>
                                  <span className={rl.color}>{rl.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                        {l.readingProfileLevel && (
                          <p className={`text-[10px] mt-0.5 ${levelColor(l.readingProfileLevel)}`}>
                            {READING_LEVELS.find((r) => r.value === l.readingProfileLevel)?.label}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {l.readingProfileAssessedAt
                          ? new Date(l.readingProfileAssessedAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Confirmation Status Tab ────────────────────────────────────────────────────

function ConfirmationStatusTab({ schoolYearId }: { schoolYearId: number }) {
  const [learners, setLearners] = useState<EnrolledLearner[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const fetchLearners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ applications: EnrolledLearner[] }>(
        `/enrollment-listings/enrolled-learners?schoolYearId=${schoolYearId}`,
      );
      setLearners(res.data.applications);
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string }>);
    } finally {
      setLoading(false);
    }
  }, [schoolYearId]);

  useEffect(() => {
    void fetchLearners();
  }, [fetchLearners]);

  const handleToggleConfirmation = async (applicationId: number, current: boolean) => {
    setSavingIds((s) => new Set(s).add(applicationId));
    try {
      await api.patch(`/enrollment-listings/applications/${applicationId}/confirmation-slip`, {
        isConfirmationSlipReceived: !current,
      });
      setLearners((prev) =>
        prev.map((l) =>
          l.id === applicationId ? { ...l, isConfirmationSlipReceived: !current } : l,
        ),
      );
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string }>);
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(applicationId);
        return next;
      });
    }
  };

  const received = learners.filter((l) => l.isConfirmationSlipReceived).length;

  return (
    <div className="space-y-4">
      {!loading && learners.length > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold">
            {received} / {learners.length} confirmation slips received
          </span>
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : learners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <ClipboardList className="h-8 w-8" />
              <p className="text-sm font-semibold">No enrolled learners found for this school year.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-3 text-left">Learner</th>
                    <th className="px-4 py-3 text-left">Grade / Section</th>
                    <th className="px-4 py-3 text-left">Reading Profile</th>
                    <th className="px-4 py-3 text-center">Confirmation Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((l) => {
                    const section = l.enrollmentRecords[0]?.section;
                    const isSaving = savingIds.has(l.id);
                    const readingLabel = READING_LEVELS.find((r) => r.value === l.readingProfileLevel);
                    return (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold">
                          {l.learner.lastName}, {l.learner.firstName}
                          {l.learner.middleName ? ` ${l.learner.middleName.charAt(0)}.` : ""}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-semibold">{l.gradeLevel.name}</span>
                          {section && (
                            <span className="text-muted-foreground"> · {section.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {readingLabel ? (
                            <span className={`font-bold ${readingLabel.color}`}>
                              {readingLabel.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Not assessed</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <Button
                              size="sm"
                              variant={l.isConfirmationSlipReceived ? "default" : "outline"}
                              disabled={isSaving}
                              onClick={() =>
                                handleToggleConfirmation(l.id, l.isConfirmationSlipReceived)
                              }
                              className={`h-8 text-xs font-bold min-w-[110px] ${
                                l.isConfirmationSlipReceived
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "border-slate-300"
                              }`}>
                              {isSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : l.isConfirmationSlipReceived ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" /> Received</>
                              ) : (
                                "Mark Received"
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main IntakeDashboard ───────────────────────────────────────────────────────

export default function IntakeDashboard() {
  const { activeSchoolYearId, viewingSchoolYearId, activeSchoolYearLabel, viewingSchoolYearLabel } =
    useSettingsStore();

  const schoolYearId = viewingSchoolYearId ?? activeSchoolYearId;
  const yearLabel = viewingSchoolYearLabel ?? activeSchoolYearLabel;

  if (!schoolYearId) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm font-semibold">No active school year configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight">Intake Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          School Year {yearLabel} — Pre-Listing, Reading Assessment & Confirmation
        </p>
      </div>

      <Tabs defaultValue="pre-listing">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="pre-listing" className="text-xs font-bold uppercase tracking-wide">
            Pre-Listing
          </TabsTrigger>
          <TabsTrigger value="reading" className="text-xs font-bold uppercase tracking-wide">
            Reading Assessment
          </TabsTrigger>
          <TabsTrigger value="confirmation" className="text-xs font-bold uppercase tracking-wide">
            Confirmation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre-listing" className="mt-6">
          <PreListingTab schoolYearId={schoolYearId} />
        </TabsContent>

        <TabsContent value="reading" className="mt-6">
          <ReadingAssessmentTab schoolYearId={schoolYearId} />
        </TabsContent>

        <TabsContent value="confirmation" className="mt-6">
          <ConfirmationStatusTab schoolYearId={schoolYearId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
