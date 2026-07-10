import { motion, AnimatePresence } from "motion/react";
import { useCallback, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/lib/utils";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Card, CardContent } from "@/shared/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { DataTableSkeleton } from "@/shared/components/PageLoadingSkeleton";
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  ClipboardList,
  BookOpen,
  FileCheck2,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import type { AxiosError } from "axios";
import FinalizeEnrollmentModal from "@/features/intake/components/FinalizeEnrollmentModal";
import { useHeaderStore } from "@/store/header.slice";
import {
  useGuardedTabChange,
  useUnsavedChanges,
} from "@/shared/hooks/useUnsavedChanges";

const READING_LEVELS = [
  { value: "INDEPENDENT", label: "Independent", color: "text-emerald-600" },
  { value: "INSTRUCTIONAL", label: "Instructional", color: "text-blue-600" },
  { value: "FRUSTRATION", label: "Frustration", color: "text-amber-600" },
  { value: "NON_READER", label: "Non-Reader", color: "text-red-600" },
] as const;

type ReadingLevel = (typeof READING_LEVELS)[number]["value"];

type LearnerType = "NEW_ENROLLEE" | "TRANSFEREE" | "RETURNING";

const WALK_IN_GRADE_LEVELS = ["GRADE 7", "GRADE 8", "GRADE 9", "GRADE 10"] as const;

const preListingSchema = z
  .object({
    learnerType: z.enum(["NEW_ENROLLEE", "TRANSFEREE", "RETURNING"]),
    gradeLevel: z.enum(["GRADE 7", "GRADE 8", "GRADE 9", "GRADE 10"]),
    lrn: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || /^\d{12}$/.test(value), {
        message: "LRN must be exactly 12 digits.",
      }),
    lastName: z.string().trim().min(1, "Last name is required."),
    firstName: z.string().trim().min(1, "First name is required."),
    middleName: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.learnerType === "TRANSFEREE" && !data.lrn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lrn"],
        message: "LRN is required for transferees.",
      });
    }
  });

type PreListingFormValues = z.infer<typeof preListingSchema>;

const LEARNER_TYPES: { value: LearnerType; label: string }[] = [
  { value: "NEW_ENROLLEE", label: "Incoming Grade 7" },
  { value: "TRANSFEREE", label: "Transferee" },
  { value: "RETURNING", label: "Balik-Aral" },
];

interface ListingEntry {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  lrn: string | null;
  gradeLevel: string;
  learnerType: LearnerType | null;
  readingLevel: ReadingLevel | null;
  status: "LISTED" | "PROCESSED" | "CONFIRMED";
  notes: string | null;
  createdAt: string;
}

interface ConfirmationApp {
  id: number;
  learnerType: string | null;
  readingProfileLevel: ReadingLevel | null;
  learner: {
    lrn: string | null;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  gradeLevel: { name: string };
}

interface ReadingQueueApplication {
  id: number;
  learnerType: string | null;
  learner: {
    lrn: string | null;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  gradeLevel: { name: string };
  createdAt: string;
}

type ReadingQueueRow =
  | { source: "listing"; data: ListingEntry }
  | { source: "application"; data: ReadingQueueApplication };

type ConfirmationRow =
  | { source: "listing"; data: ListingEntry }
  | { source: "application"; data: ConfirmationApp };

function formatName(lastName: string, firstName: string, middleName?: string | null) {
  const mi = middleName ? ` ${middleName.charAt(0).toUpperCase()}.` : "";
  return `${lastName}, ${firstName}${mi}`;
}

function readingLabel(level: string | null) {
  return READING_LEVELS.find((r) => r.value === level)?.label ?? "Not assessed";
}

function readingColor(level: string | null) {
  if (level === "NON_READER") return "text-red-600 font-extrabold";
  if (level === "FRUSTRATION") return "text-amber-600 font-extrabold";
  if (level === "INSTRUCTIONAL") return "text-blue-600 font-extrabold";
  if (level === "INDEPENDENT") return "text-emerald-600 font-extrabold";
  return "text-foreground italic";
}

const intakeQueryKeys = {
  preListings: (schoolYearId: number) => ["intake", "pre-listings", schoolYearId] as const,
  readingQueue: (schoolYearId: number) => ["intake", "reading-queue", schoolYearId] as const,
  confirmationQueue: (schoolYearId: number) =>
    ["intake", "confirmation-queue", schoolYearId] as const,
};

async function fetchPreListings(schoolYearId: number): Promise<ListingEntry[]> {
  const res = await api.get<{ listings: ListingEntry[] }>(
    `/enrollment-listings?schoolYearId=${schoolYearId}`,
  );
  return res.data.listings;
}

async function fetchReadingQueue(schoolYearId: number): Promise<ReadingQueueRow[]> {
  const res = await api.get<{
    listings: ListingEntry[];
    applications: ReadingQueueApplication[];
  }>(`/enrollment-listings/reading-queue?schoolYearId=${schoolYearId}`);

  return [
    ...res.data.listings.map((listing) => ({ source: "listing" as const, data: listing })),
    ...res.data.applications.map((application) => ({
      source: "application" as const,
      data: application,
    })),
  ];
}

async function fetchConfirmationQueue(schoolYearId: number): Promise<ConfirmationRow[]> {
  const res = await api.get<{
    listings: ListingEntry[];
    applications: ConfirmationApp[];
  }>(`/enrollment-listings/confirmation-queue?schoolYearId=${schoolYearId}`);

  return [
    ...res.data.listings.map((listing) => ({ source: "listing" as const, data: listing })),
    ...res.data.applications.map((application) => ({
      source: "application" as const,
      data: application,
    })),
  ];
}

function PreListingTab({
  schoolYearId,
}: {
  schoolYearId: number;
}) {
  const queryClient = useQueryClient();

  const {
    control,
    register,
    reset,
    watch,
    handleSubmit,
    formState: { errors, isValid, isDirty },
  } = useForm<PreListingFormValues>({
    resolver: zodResolver(preListingSchema),
    mode: "onChange",
    defaultValues: {
      learnerType: "NEW_ENROLLEE",
      gradeLevel: "GRADE 7",
      lrn: "",
      lastName: "",
      firstName: "",
      middleName: "",
    },
  });

  const selectedLearnerType = watch("learnerType");

  const {
    data: listings = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: intakeQueryKeys.preListings(schoolYearId),
    queryFn: () => fetchPreListings(schoolYearId),
  });

  const createListingMutation = useMutation({
    mutationFn: async (values: PreListingFormValues) =>
      api.post("/enrollment-listings", {
        learnerType: values.learnerType,
        gradeLevel: values.gradeLevel,
        lrn: values.lrn || undefined,
        lastName: values.lastName.toUpperCase(),
        firstName: values.firstName.toUpperCase(),
        middleName: values.middleName?.toUpperCase() || undefined,
        schoolYearId,
        status: "PENDING_READING",
      }),
    onSuccess: async () => {
      reset({
        learnerType: "NEW_ENROLLEE",
        gradeLevel: "GRADE 7",
        lrn: "",
        lastName: "",
        firstName: "",
        middleName: "",
      });
      sileo.success({
        title: "Added",
        description: "Student added to Reading Assessment queue.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: intakeQueryKeys.preListings(schoolYearId) }),
        queryClient.invalidateQueries({ queryKey: intakeQueryKeys.readingQueue(schoolYearId) }),
      ]);
    },
    onError: (e) => {
      toastApiError(e as AxiosError<{ message?: string }>);
    },
  });

  const resetPreListingForm = useCallback(
    () =>
      reset({
        learnerType: "NEW_ENROLLEE",
        gradeLevel: "GRADE 7",
        lrn: "",
        lastName: "",
        firstName: "",
        middleName: "",
      }),
    [reset],
  );

  useUnsavedChanges({
    id: "intake-pre-listing-form",
    label: "Intake pre-listing form",
    isDirty,
    isSubmitting: createListingMutation.isPending,
    onDiscard: resetPreListingForm,
  });

  const deleteListingMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/enrollment-listings/${id}`),
    onSuccess: async () => {
      sileo.success({ title: "Removed", description: "Entry deleted." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: intakeQueryKeys.preListings(schoolYearId) }),
        queryClient.invalidateQueries({ queryKey: intakeQueryKeys.readingQueue(schoolYearId) }),
      ]);
    },
    onError: (e) => {
      toastApiError(e as AxiosError<{ message?: string }>);
    },
  });

  const onSubmit = (values: PreListingFormValues) => {
    createListingMutation.mutate(values);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Remove this pre-listing entry?")) return;
    deleteListingMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted border border-slate-200 rounded-lg p-6">
        <div className="space-y-1 mb-5">
          <h3 className="text-base font-extrabold text-slate-900">Register Walk-In Applicant</h3>
          <p className="text-base leading-tight text-slate-600">
            Manually add incoming Grade 7 or Transferee students to the intake pipeline.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-widest">Learner Type</Label>
              <Controller
                control={control}
                name="learnerType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select learner type..." /></SelectTrigger>
                    <SelectContent>
                      {LEARNER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.learnerType ? (
                <p className="text-base text-destructive font-extrabold">{errors.learnerType.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-widest">Grade Level</Label>
              <Controller
                control={control}
                name="gradeLevel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select grade level..." /></SelectTrigger>
                    <SelectContent>
                      {WALK_IN_GRADE_LEVELS.map((g) => (
                        <SelectItem key={g} value={g}>{g.replace("GRADE ", "Grade ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.gradeLevel ? (
                <p className="text-base text-destructive font-extrabold">{errors.gradeLevel.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-widest">
                LRN {selectedLearnerType === "TRANSFEREE" ? "(Required)" : "(Optional)"}
              </Label>
              <Input
                inputMode="numeric"
                maxLength={12}
                placeholder={selectedLearnerType === "TRANSFEREE" ? "12-digit LRN (Required)" : "12-digit LRN (Optional)"}
                {...register("lrn", {
                  onChange: (e) => {
                    e.target.value = String(e.target.value).replace(/\D/g, "").slice(0, 12);
                  },
                })}
              />
              {errors.lrn ? (
                <p className="text-base text-destructive font-extrabold">{errors.lrn.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-widest">Last Name</Label>
              <Input placeholder="LAST NAME" {...register("lastName")} />
              {errors.lastName ? (
                <p className="text-base text-destructive font-extrabold">{errors.lastName.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-widest">First Name</Label>
              <Input placeholder="FIRST NAME" {...register("firstName")} />
              {errors.firstName ? (
                <p className="text-base text-destructive font-extrabold">{errors.firstName.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-extrabold uppercase tracking-widest">Middle Name (Optional)</Label>
              <Input placeholder="MIDDLE NAME" {...register("middleName")} />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              type="submit"
              disabled={!isValid || createListingMutation.isPending}
              className="font-extrabold uppercase text-base tracking-normal"
            >
              {createListingMutation.isPending ? (
                <Loader2 className="h-4 w-4 " />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" /> Add to Reading Queue
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <DataTableSkeleton rows={50} columns={5} className="rounded-none border-0" />
          ) : isError ? (
            <div className="flex items-center justify-center py-12 text-base leading-tight font-extrabold text-destructive">
              Unable to load pre-listing entries.
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-foreground gap-2">
              <ClipboardList className="h-8 w-8" />
              <p className="text-base leading-tight font-extrabold">No entries yet for this school year.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base leading-tight">
                <thead>
                  <tr className="border-b bg-slate-50 text-[10px] font-extrabold uppercase tracking-widest text-foreground">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-extrabold">{formatName(l.lastName, l.firstName, l.middleName)}</td>
                      <td className="px-4 py-3 text-base">{l.gradeLevel}</td>
                      <td className="px-4 py-3 text-base">{LEARNER_TYPES.find((t) => t.value === l.learnerType)?.label ?? "-"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] font-extrabold uppercase tracking-wide">{l.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {l.status === "LISTED" && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(l.id)}
                            className="h-7 text-base text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
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

function ReadingAssessmentTab({
  schoolYearId,
  queue,
  isLoading,
  isError,
}: {
  schoolYearId: number;
  queue: ReadingQueueRow[];
  isLoading: boolean;
  isError: boolean;
}) {
  const [target, setTarget] = useState<ReadingQueueRow | null>(null);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel | "">("");
  const queryClient = useQueryClient();

  const assessMutation = useMutation({
    mutationFn: async (nextReadingLevel: ReadingLevel) => {
      if (!target) {
        throw new Error("No intake row selected.");
      }

      if (target.source === "listing") {
        return api.patch(`/enrollment-listings/${target.data.id}/assess`, {
          readingLevel: nextReadingLevel,
        });
      }

      return api.patch(`/enrollment-listings/applications/${target.data.id}/intake-assess`, {
        readingLevel: nextReadingLevel,
      });
    },
    onSuccess: async () => {
      sileo.success({ title: "Saved", description: "Reading assessment forwarded to confirmation." });
      setTarget(null);
      setReadingLevel("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: intakeQueryKeys.readingQueue(schoolYearId) }),
        queryClient.invalidateQueries({ queryKey: intakeQueryKeys.confirmationQueue(schoolYearId) }),
      ]);
    },
    onError: (e) => {
      toastApiError(e as AxiosError<{ message?: string }>);
    },
  });

  const saveAssessment = () => {
    if (!readingLevel) return;
    assessMutation.mutate(readingLevel);
  };

  const rowName = (row: ReadingQueueRow) =>
    row.source === "listing"
      ? formatName(row.data.lastName, row.data.firstName, row.data.middleName)
      : formatName(row.data.learner.lastName, row.data.learner.firstName, row.data.learner.middleName);

  const rowGrade = (row: ReadingQueueRow) =>
    row.source === "listing" ? row.data.gradeLevel : row.data.gradeLevel.name;

  const rowLearnerType = (row: ReadingQueueRow) =>
    row.source === "listing" ? row.data.learnerType : row.data.learnerType;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <DataTableSkeleton rows={50} columns={5} className="rounded-none border-0" />
          ) : isError ? (
            <div className="flex items-center justify-center py-12 text-base leading-tight font-extrabold text-destructive">
              Unable to load the reading queue.
            </div>
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-foreground gap-2">
              <BookOpen className="h-8 w-8" />
              <p className="text-base leading-tight font-extrabold">No learners pending reading assessment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base leading-tight">
                <thead>
                  <tr className="border-b bg-slate-50 text-[10px] font-extrabold uppercase tracking-widest text-foreground">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={`${row.source}-${row.data.id}`} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-extrabold">{rowName(row)}</td>
                      <td className="px-4 py-3 text-base">{rowGrade(row)}</td>
                      <td className="px-4 py-3 text-base">{LEARNER_TYPES.find((t) => t.value === rowLearnerType(row))?.label ?? "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <Button size="sm" onClick={() => { setTarget(row); setReadingLevel(""); }}
                          className="h-8 text-base font-extrabold uppercase tracking-normal">
                          <BookOpen className="h-3 w-3 mr-1" /> Assess
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) { setTarget(null); setReadingLevel(""); } }}>
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base leading-tight font-extrabold uppercase tracking-wide">Phil-IRI Reading Assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-[10px] font-extrabold uppercase tracking-widest">Reading Level</Label>
            <div className="grid grid-cols-2 gap-2">
              {READING_LEVELS.map((r) => (
                <button key={r.value} type="button" onClick={() => setReadingLevel(r.value)}
                  className={`rounded-md border px-3 py-2 text-base font-extrabold text-left ${readingLevel === r.value ? "border-primary bg-primary/10" : "border-border"} ${r.color}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTarget(null)}>Cancel</Button>
            <Button size="sm" disabled={!readingLevel || assessMutation.isPending} onClick={saveAssessment}
              className="font-extrabold uppercase text-base">
              {assessMutation.isPending ? <Loader2 className="h-4 w-4 " /> : <><CheckCircle2 className="h-3 w-3 mr-1" /> Save and Forward</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConfirmationTab({
  schoolYearId,
  rows,
  isLoading,
  isError,
}: {
  schoolYearId: number;
  rows: ConfirmationRow[];
  isLoading: boolean;
  isError: boolean;
}) {
  const [target, setTarget] = useState<ConfirmationRow | null>(null);
  const queryClient = useQueryClient();

  const officializeMutation = useMutation({
    mutationFn: async (payload: {
      confirmationSlipReceived: boolean;
      heightCm: number;
      weightKg: number;
    }) => {
      if (!target) {
        throw new Error("No intake row selected.");
      }

      if (target.source === "listing") {
        return api.patch(`/enrollment-listings/${target.data.id}/intake-confirm`, payload);
      }

      return api.patch(`/enrollment-listings/applications/${target.data.id}/officialize`, payload);
    },
    onSuccess: async () => {
      sileo.success({ title: "Officialized", description: "Learner moved to next stage." });
      setTarget(null);
      await queryClient.invalidateQueries({
        queryKey: intakeQueryKeys.confirmationQueue(schoolYearId),
      });
    },
    onError: (e) => {
      toastApiError(e as AxiosError<{ message?: string }>);
    },
  });

  const submitOfficialize = (payload: {
    confirmationSlipReceived: boolean;
    heightCm: number;
    weightKg: number;
  }) => {
    officializeMutation.mutate(payload);
  };

  const rowName = (row: ConfirmationRow) =>
    row.source === "listing"
      ? formatName(row.data.lastName, row.data.firstName, row.data.middleName)
      : formatName(row.data.learner.lastName, row.data.learner.firstName, row.data.learner.middleName);

  const rowGrade = (row: ConfirmationRow) =>
    row.source === "listing" ? row.data.gradeLevel : row.data.gradeLevel.name;

  const rowReading = (row: ConfirmationRow) =>
    row.source === "listing" ? row.data.readingLevel : row.data.readingProfileLevel;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <DataTableSkeleton rows={50} columns={5} className="rounded-none border-0" />
          ) : isError ? (
            <div className="flex items-center justify-center py-12 text-base leading-tight font-extrabold text-destructive">
              Unable to load the confirmation queue.
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-foreground gap-2">
              <FileCheck2 className="h-8 w-8" />
              <p className="text-base leading-tight font-extrabold">No learners pending confirmation.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base leading-tight">
                <thead>
                  <tr className="border-b bg-slate-50 text-[10px] font-extrabold uppercase tracking-widest text-foreground">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Reading Profile</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.source}-${row.data.id}`} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-extrabold">{rowName(row)}</td>
                      <td className="px-4 py-3 text-base">{rowGrade(row)}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] font-extrabold uppercase ${row.source === "application" && row.data.learnerType === "RETURNING" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                          {row.source === "application" && row.data.learnerType === "RETURNING"
                            ? "Continuing"
                            : "Incoming"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-base">
                        <span className={readingColor(rowReading(row))}>{readingLabel(rowReading(row))}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button size="sm" onClick={() => setTarget(row)}
                          className="h-8 text-base font-extrabold uppercase tracking-normal bg-emerald-600 hover:bg-emerald-700 text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm Enrollment
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <FinalizeEnrollmentModal
        open={!!target}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
          }
        }}
        learnerName={target ? rowName(target) : undefined}
        title="Finalize Enrollment"
        loading={officializeMutation.isPending}
        onSubmit={submitOfficialize}
      />
    </>
  );
}

export default function IntakeDashboard() {
  const [activeTab, setActiveTab] = useState("pre-listing");
  const guardedSetActiveTab = useGuardedTabChange(setActiveTab);
  const { activeSchoolYearId, viewingSchoolYearId, activeSchoolYearLabel, viewingSchoolYearLabel } =
    useSettingsStore();

  const schoolYearId = viewingSchoolYearId ?? activeSchoolYearId;
  const yearLabel = viewingSchoolYearLabel ?? activeSchoolYearLabel;

  const {
    data: readingQueue = [],
    isLoading: isReadingLoading,
    isError: isReadingError,
  } = useQuery({
    queryKey: schoolYearId
      ? intakeQueryKeys.readingQueue(schoolYearId)
      : (["intake", "reading-queue", null] as const),
    queryFn: () => fetchReadingQueue(schoolYearId as number),
    enabled: Boolean(schoolYearId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  const {
    data: confirmationQueue = [],
    isLoading: isConfirmationLoading,
    isError: isConfirmationError,
  } = useQuery({
    queryKey: schoolYearId
      ? intakeQueryKeys.confirmationQueue(schoolYearId)
      : (["intake", "confirmation-queue", null] as const),
    queryFn: () => fetchConfirmationQueue(schoolYearId as number),
    enabled: Boolean(schoolYearId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  const readingCount = readingQueue.length;
  const confirmationCount = confirmationQueue.length;

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Intake Dashboard");
    return () => setTitle(null);
  }, [setTitle]);

  if (!schoolYearId) {
    return (
      <div className="flex items-center justify-center py-20 text-foreground">
        <p className="text-base leading-tight font-extrabold">No active school year configured.</p>
      </div>
    );
  }

  return (
<div className="space-y-6 p-6">

      <Tabs value={activeTab} onValueChange={guardedSetActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3 h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
          <TabsTrigger value="pre-listing" className="text-base font-extrabold uppercase tracking-normal relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "pre-listing" && (
              <motion.div
                layoutId="intake-tab-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-10 flex items-center justify-center w-full h-full", activeTab === "pre-listing" ? "text-primary-foreground" : "text-foreground")}>
              <ClipboardList className="h-3 w-3 mr-1" /> Pre-Listing
            </span>
          </TabsTrigger>
          <TabsTrigger value="reading" className="text-base font-extrabold uppercase tracking-normal relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "reading" && (
              <motion.div
                layoutId="intake-tab-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-10 flex items-center justify-center w-full h-full", activeTab === "reading" ? "text-primary-foreground" : "text-foreground")}>
              <BookOpen className="h-3 w-3 mr-1" /> Reading Assessment
              {readingCount > 0 && (
                <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-amber-500 text-white border-0">{readingCount}</Badge>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="confirmation" className="text-base font-extrabold uppercase tracking-normal relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "confirmation" && (
              <motion.div
                layoutId="intake-tab-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-10 flex items-center justify-center w-full h-full", activeTab === "confirmation" ? "text-primary-foreground" : "text-foreground")}>
              <FileCheck2 className="h-3 w-3 mr-1" /> Confirmation
              {confirmationCount > 0 && (
                <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-emerald-600 text-white border-0">{confirmationCount}</Badge>
              )}
            </span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === "pre-listing" && (
            <motion.div
              key="pre-listing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-6 w-full"
            >
              <TabsContent value="pre-listing" forceMount className="mt-0 focus-visible:outline-none ring-0">
                <PreListingTab schoolYearId={schoolYearId} />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "reading" && (
            <motion.div
              key="reading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-6 w-full"
            >
              <TabsContent value="reading" forceMount className="mt-0 focus-visible:outline-none ring-0">
                <ReadingAssessmentTab
                  schoolYearId={schoolYearId}
                  queue={readingQueue}
                  isLoading={isReadingLoading}
                  isError={isReadingError}
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "confirmation" && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-6 w-full"
            >
              <TabsContent value="confirmation" forceMount className="mt-0 focus-visible:outline-none ring-0">
                <ConfirmationTab
                  schoolYearId={schoolYearId}
                  rows={confirmationQueue}
                  isLoading={isConfirmationLoading}
                  isError={isConfirmationError}
                />
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
