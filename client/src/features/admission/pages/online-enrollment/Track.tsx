import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import {
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  User,
  BookOpen,
  Download,
  MapPin,
  ClipboardList,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import {
  cn,
  formatDisplayTime12Hour,
  formatManilaDate,
  getManilaNow,
} from "@/shared/lib/utils";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { useSettingsStore } from "@/store/settings.slice";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import TrackingNextSteps from "@/features/admission/components/TrackingNextSteps";
import { normalizeTrackingStatus } from "@/features/admission/components/trackingState";
import type { ApplicationTrackResponse } from "@enrollpro/shared";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";
const trackSchema = z.object({
  trackingNumber: z
    .string()
    .min(1, "Tracking number is required")
    .regex(
      /^[A-Z]{3,5}-\d{4}-\d{5}$/,
      "Invalid tracking number format (e.g. REG-2026-00001)",
    ),
});

type TrackFormData = z.infer<typeof trackSchema>;

interface ApplicationStatus extends ApplicationTrackResponse {
  firstName: string;
  middleName?: string;
  lastName: string;
  applicantName?: string;
  program?: string;
  rank?: number;
  isPassed?: boolean;
  compositeScore?: number;
  trackingStatus?: string;
  learningProgram?: string;
  createdAt: string;
  gradeLevel: { name: string };
  enrollment?: { section: { name: string }; enrolledAt: string };
  assessments?: {
    type: string;
    scheduledDate?: string;
    scheduledTime?: string;
    venue?: string;
    notes?: string;
  }[];
  rejectionReason?: string;
  scpDetail?: { scpType: string };
  earlyRegistrationId?: number | null;
}

const statusConfig: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    desc: string;
  }
> = {
  SUBMITTED_BEERF: {
    label: "Submitted BEERF",
    icon: Clock,
    color: "text-slate-600 bg-slate-50 border-slate-200",
    desc: "Your Basic Education Early Registration Form has been received and is queued for registrar review.",
  },
  SUBMITTED_BEEF: {
    label: "Submitted BEEF",
    icon: Clock,
    color: "text-slate-600 bg-slate-50 border-slate-200",
    desc: "Your Basic Education Enrollment Form has been received and is queued for registrar review.",
  },
  SUBMITTED: {
    label: "Submitted",
    icon: Clock,
    color: "text-slate-600 bg-slate-50 border-slate-200",
    desc: "We’ve received your application! It's currently in the queue for its initial review.",
  },
  IN_REVIEW: {
    label: "In Review",
    icon: Search,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    desc: "The Registrar is currently looking over your documents. We'll keep you posted!",
  },
  VERIFIED: {
    label: "Verified",
    icon: CheckCircle2,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    desc: "Your submitted records have been verified by the Registrar.",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    icon: Search,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    desc: "The Registrar is currently looking over your documents. We'll keep you posted!",
  },
  FOR_REVISION: {
    label: "For Revision",
    icon: AlertCircle,
    color: "text-orange-600 bg-orange-50 border-orange-200",
    desc: "We found a small detail that needs a quick fix. Please check your email for instructions on how to update your application.",
  },
  ELIGIBLE: {
    label: "Eligible",
    icon: CheckCircle2,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    desc: "Great news! You’ve passed the basic screening and are all set for the next step.",
  },
  ASSESSMENT_IN_PROGRESS: {
    label: "Assessment In Progress",
    icon: Calendar,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    desc: "Assessment activities are ongoing. Please monitor your schedule details below.",
  },
  EXAM_SCHEDULED: {
    label: "Assessment Scheduled",
    icon: Calendar,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    desc: "It’s game time! Your assessment has been scheduled—you can find all the details right below.",
  },
  ASSESSMENT_TAKEN: {
    label: "Assessment Taken",
    icon: CheckCircle2,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    desc: "Nice work on completing your assessment! We’re now busy processing your results.",
  },
  PASSED: {
    label: "Passed",
    icon: CheckCircle2,
    color: "text-green-600 bg-green-50 border-green-200",
    desc: "Congratulations! You’ve passed the assessment. Your interview and enrollment are just around the corner!",
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview Scheduled",
    icon: Calendar,
    color: "text-violet-600 bg-violet-50 border-violet-200",
    desc: "We’d love to chat! Your interview is now scheduled—check the details below to prepare.",
  },
  QUALIFIED_FOR_ENROLLMENT: {
    label: "Qualified for Enrollment",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    desc: "Your application is qualified. Proceed with registrar enrollment completion requirements.",
  },
  READY_FOR_ENROLLMENT: {
    label: "Ready for Enrollment",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    desc: "You are now ready for enrollment. Coordinate with the registrar to complete your official enrollment.",
  },
  TEMPORARILY_ENROLLED: {
    label: "Temporarily Enrolled",
    icon: Clock,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    desc: "You’re all set to start attending classes while we help you finalize your remaining documents!",
  },
  ENROLLED: {
    label: "Enrolled",
    icon: CheckCircle2,
    color: "text-green-700 bg-green-100 border-green-300",
    desc: "Welcome to the family! You are now officially enrolled for this school year.",
  },
  FAILED_ASSESSMENT: {
    label: "Not Qualified",
    icon: AlertCircle,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    desc: "While you didn't meet the criteria for this specific program, the Registrar may be able to offer you a spot in a regular section.",
  },
  NOT_QUALIFIED: {
    label: "Not Qualified",
    icon: AlertCircle,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    desc: "While you didn't meet the criteria for this specific program, the Registrar may be able to offer you a spot in a regular section.",
  },
  REJECTED: {
    label: "Rejected",
    icon: AlertCircle,
    color: "text-red-600 bg-red-50 border-red-200",
    desc: "Thank you for your interest. Unfortunately, we aren't able to move forward with your application at this time.",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    icon: AlertCircle,
    color: "text-zinc-400 bg-zinc-50 border-zinc-200",
    desc: "This application has been withdrawn. We're here if you decide to join us in the future!",
  },
  TRANSFERRED: {
    label: "Transferred Out",
    icon: LogOut,
    color: "text-slate-600 bg-slate-100 border-slate-300",
    desc: "The learner has been officially transferred to another school.",
  },
  DROPPED: {
    label: "Dropped",
    icon: LogOut,
    color: "text-slate-600 bg-slate-100 border-slate-300",
    desc: "The learner has been dropped from the system.",
  },
};

const LEARNING_PROGRAM_LABELS: Record<string, string> = {
  REGULAR: "Regular Program",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "Science, Technology & Engineering",
  SPECIAL_PROGRAM_IN_THE_ARTS: "Special Program in the Arts",
  SPECIAL_PROGRAM_IN_SPORTS: "Special Program in Sports",
  SPECIAL_PROGRAM_IN_JOURNALISM: "Special Program in Journalism",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "Special Program in Foreign Language",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION:
    "Special Program in Tech-Voc Education",
};

interface TrackApplicationProps {
  onResultsFetched?: (hasResults: boolean) => void;
}

export default function TrackApplication({
  onResultsFetched,
}: TrackApplicationProps) {
  const { schoolName, logoUrl } = useSettingsStore();
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const pdfRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrackFormData>({
    resolver: zodResolver(trackSchema),
  });

  const handleBackToSearch = () => {
    setStatus(null);
    setError("");
    onResultsFetched?.(false);
    reset({ trackingNumber: "" });
  };

  const downloadPDF = async () => {
    if (!pdfRef.current || !status) return;
    setIsGenerating(true);

    try {
      const element = pdfRef.current;

      await new Promise((resolve) => setTimeout(resolve, 800));

      const dataUrl = await toJpeg(element, {
        quality: 0.98,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      const imgWidth = 595.28;
      const imgHeight = (element.offsetHeight * imgWidth) / element.offsetWidth;
      const pageHeight = 841.89; // A4 height in pt

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageCount = Math.ceil(imgHeight / pageHeight);
      for (let i = 0; i < pageCount; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, "JPEG", 0, -(i * pageHeight), imgWidth, imgHeight);
      }
      pdf.save(`Confirmation_Slip_${status.trackingNumber}.pdf`);
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const onTrack = async (data: TrackFormData) => {
    setIsLoading(true);
    setError("");
    setStatus(null);
    onResultsFetched?.(false);

    try {
      // Small delay for professional feel
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await api.get<ApplicationStatus>(
        `/applications/track/${data.trackingNumber}`,
      );
      setStatus(response.data);
      onResultsFetched?.(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        "Could not find an application with that tracking number.";
      setError(message);
      onResultsFetched?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizedStatus = status
    ? normalizeTrackingStatus(
        status.status || status.trackingStatus || status.rawStatus,
      )
    : null;
  const rawStatusKey = String(
    status?.rawStatus || status?.status || status?.trackingStatus || "",
  )
    .trim()
    .toUpperCase();
  const displayStatusKey =
    (rawStatusKey && statusConfig[rawStatusKey] ? rawStatusKey : null) ||
    normalizedStatus ||
    "SUBMITTED";
  const config = displayStatusKey
    ? statusConfig[displayStatusKey] || statusConfig.SUBMITTED
    : null;
  const Icon = config?.icon;

  const learningProgramType =
    status?.learningProgram ??
    status?.scpDetail?.scpType ??
    status?.applicantType ??
    "REGULAR";
  const learningProgramLabel =
    LEARNING_PROGRAM_LABELS[learningProgramType] ||
    learningProgramType.replace(/_/g, " ");

  const examDate = null;
  const examTime = null;
  const examVenue = null;
  const examNotes = null;
  const isAssessmentInProgress = false;
  const nextStepsStatus =
    status?.rawStatus ||
    status?.status ||
    status?.trackingStatus ||
    normalizedStatus ||
    undefined;

  const applicantName =
    status?.applicantName?.trim() ||
    [status?.firstName, status?.middleName, status?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

  const monitorProgram =
    status?.program || status?.scpDetail?.scpType || status?.learningProgram || status?.programType;
  const monitorStatus = String(
    status?.status || status?.trackingStatus || status?.rawStatus || "",
  )
    .trim()
    .toUpperCase();
  const isSteProgram = ["STE", "SCIENCE_TECHNOLOGY_AND_ENGINEERING"].includes(
    String(monitorProgram || "").trim().toUpperCase(),
  );
  const isEvaluatedMonitorState = monitorStatus === "EVALUATED";
  const hasCompassionateMonitorState =
    Boolean(status) &&
    isSteProgram &&
    isEvaluatedMonitorState &&
    typeof status?.isPassed === "boolean" &&
    typeof status?.rank === "number";

  const compassionateView = !hasCompassionateMonitorState
    ? null
    : status?.isPassed && (status.rank ?? 0) <= 70
      ? "priority-success"
      : status?.isPassed && (status.rank ?? 0) > 70
        ? "capacity-redirect"
        : "standard-redirect";

  return (
    <div
      className={cn(
        "max-w-4xl mx-auto p-4 md:p-8 transition-all duration-500",
      )}>
      <Card
        className={cn(
          "shadow-xl border-2 border-primary/5 rounded-lg overflow-hidden transition-all duration-500 w-full",
        )}>
        <CardHeader className="bg-primary text-primary-foreground p-8 text-center">
          <CardTitle className="text-2xl font-black uppercase ">
            Application Monitor
          </CardTitle>
          <CardDescription className="text-primary-foreground/90 font-bold">
            Enter your tracking number to check your status
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form
            onSubmit={handleSubmit(onTrack)}
            className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="trackingNumber"
                className="text-xs font-black uppercase  text-foreground">
                Tracking Number
              </Label>
              <div className="relative">
                <Input
                  id="trackingNumber"
                  {...register("trackingNumber")}
                  placeholder="REG-2026-00001"
                  className={cn(
                    "h-14 pl-12 text-lg font-black border-2 transition-all",
                    errors.trackingNumber
                      ? "border-primary focus-visible:ring-primary"
                      : "border-primary/10 focus-visible:border-primary focus-visible:ring-primary/5",
                  )}
                  autoComplete="off"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground" />
              </div>
              {errors.trackingNumber && (
                <p className="text-xs text-primary font-bold">
                  {errors.trackingNumber.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-lg font-black uppercase  bg-primary hover:bg-primary/90 transition-all text-primary-foreground"
              disabled={isLoading}>
              {isLoading ? "Searching..." : "Check Status"}
            </Button>
          </form>

          {!status && !error && (
            <div className="mt-8 pt-6 border-t border-dashed text-center">
              <p className="text-md font-bold text-foreground uppercase ">
                Lost or missing confirmation slip?
              </p>
              <p className="text-xs text-foreground/60 mt-1 uppercase font-bold">
                Enter your tracking number above to retrieve and download your
                official slip.
              </p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 bg-primary/5 border-2 border-primary/20 rounded-2xl flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-primary uppercase ">
                    Application Not Found
                  </h4>
                  <p className="text-sm font-bold text-primary/80 mt-1">
                    {error}
                  </p>
                </div>
              </motion.div>
            )}

            {status && config && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-10 space-y-8">
                {compassionateView ? (
                  <Card className="border-2 border-primary/10 shadow-sm">
                    <CardContent className="p-4 sm:p-6 space-y-4">
                      <div
                        className={cn(
                          "rounded-2xl border-2 p-4 sm:p-5 space-y-3",
                          compassionateView === "priority-success"
                            ? "border-emerald-300 bg-emerald-50"
                            : compassionateView === "capacity-redirect"
                              ? "border-blue-300 bg-blue-50"
                              : "border-amber-300 bg-amber-50",
                        )}>
                        <h3
                          className={cn(
                            "text-base sm:text-lg font-black uppercase leading-tight",
                            compassionateView === "priority-success"
                              ? "text-emerald-800"
                              : compassionateView === "capacity-redirect"
                                ? "text-blue-800"
                                : "text-amber-800",
                          )}>
                          {compassionateView === "priority-success"
                            ? "🎉 QUALIFIED: Ready for STE Enrollment"
                            : compassionateView === "capacity-redirect"
                              ? "ℹ️ REDIRECTED: Regular BEC Track"
                              : "🔄 REDIRECTED: Regular BEC Track"}
                        </h3>

                        <p className="text-sm sm:text-base font-bold leading-relaxed text-foreground">
                          {compassionateView === "priority-success"
                            ? `Congratulations, ${applicantName || "Applicant"}! You have officially qualified for the Top 70 slots of the ${String(monitorProgram || "STE")} program.`
                            : compassionateView === "capacity-redirect"
                              ? `Hello, ${applicantName || "Applicant"}. You successfully passed the academic assessments for the ${String(monitorProgram || "STE")} program. However, due to strict DepEd capacity limits, only the Top 70 applicants can be accommodated this school year. Based on the composite ranking, you are currently waitlisted.`
                              : `Hello, ${applicantName || "Applicant"}. Your screening results have been processed. While you did not meet the cutoff score for the ${String(monitorProgram || "STE")} program, you are fully cleared to proceed with standard high school enrollment.`}
                        </p>

                        <Alert
                          className={cn(
                            "border text-sm sm:text-base",
                            compassionateView === "priority-success"
                              ? "border-emerald-300 bg-white text-emerald-900"
                              : compassionateView === "capacity-redirect"
                                ? "border-blue-300 bg-white text-blue-900"
                                : "border-amber-300 bg-white text-amber-900",
                          )}>
                          <AlertTitle className="font-black uppercase text-xs sm:text-sm">
                            Next Step
                          </AlertTitle>
                          <AlertDescription className="font-bold leading-relaxed">
                            {compassionateView === "priority-success"
                              ? "Please proceed to the school gymnasium on your scheduled date and present this tracking number at the SCP Priority Lane for your BOSY Confirmation."
                              : compassionateView === "capacity-redirect"
                                ? "You are officially cleared to enroll in the Regular Basic Education Curriculum (BEC). Please proceed to the standard enrollment lane during BOSY Confirmation."
                                : "Please proceed to the standard BEC enrollment lane during BOSY Confirmation."}
                          </AlertDescription>
                        </Alert>
                      </div>

                      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
                        <p className="text-[0.625rem] font-black uppercase tracking-wider text-primary/70">
                          Tracking Number
                        </p>
                        <p className="mt-1 text-lg sm:text-2xl font-black text-primary break-all">
                          {status.trackingNumber}
                        </p>
                        {typeof status.rank === "number" ? (
                          <p className="mt-2 text-xs sm:text-sm font-bold text-primary/80">
                            Rank #{status.rank}
                            {typeof status.compositeScore === "number"
                              ? ` • Composite Score: ${status.compositeScore.toFixed(2)}`
                              : ""}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto h-11 px-5 font-black"
                          onClick={handleBackToSearch}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back to Search
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div
                    className={cn(
                      "p-8 rounded-lg border-2 flex flex-col items-center text-center gap-4",
                      config.color,
                    )}>
                    <div className="p-4 rounded-full bg-white shadow-sm border border-current/20">
                      {Icon && <Icon className="w-10 h-10" />}
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase  opacity-70">
                        Current Status
                      </h3>
                      <p className="text-3xl font-black uppercase  mt-1">
                        {config.label}
                      </p>
                    </div>
                    <p className="text-sm font-bold leading-relaxed max-w-sm opacity-90">
                      {config.desc}
                    </p>
                  </div>
                )}

                <div className="grid gap-4 text-center grid-cols-1 md:grid-cols-3">
                  <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1">
                    <p className="text-[0.625rem] font-black uppercase text-foreground  flex items-center justify-center gap-1.5">
                      <User className="w-3 h-3" /> Learner's Name
                    </p>
                    <p className="font-black text-primary uppercase">
                      {status.lastName}, {status.firstName}{" "}
                      {status.middleName || ""}
                    </p>
                  </div>
                  <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1">
                    <p className="text-[0.625rem] font-black uppercase text-foreground  flex items-center justify-center gap-1.5">
                      <FileText className="w-3 h-3" /> Grade Level
                    </p>
                    <p className="font-black text-primary uppercase">
                      {status.gradeLevel.name}
                    </p>
                  </div>

                  <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1">
                    <p className="text-[0.625rem] font-black uppercase text-primary/60  flex items-center justify-center gap-1.5">
                      <BookOpen className="w-3 h-3" /> Learning Program
                    </p>
                    <p className="font-black text-primary uppercase">
                      {learningProgramLabel}
                    </p>
                  </div>

                  {isAssessmentInProgress && examDate && (
                    <>
                      <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1">
                        <p className="text-[0.625rem] font-black uppercase text-purple-600  flex items-center justify-center gap-1.5">
                          <Calendar className="w-3 h-3" /> Scheduled Date
                        </p>
                        <p className="font-black text-purple-900 uppercase">
                          {format(new Date(examDate), "MMMM dd, yyyy")}
                        </p>
                        <p className="text-[0.625rem] font-bold text-purple-700/70 uppercase">
                          {formatDisplayTime12Hour(examTime) || "TBA"}
                        </p>
                      </div>
                      <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1">
                        <p className="text-[0.625rem] font-black uppercase text-purple-600  flex items-center justify-center gap-1.5">
                          <MapPin className="w-3 h-3" /> Exam Location
                        </p>
                        <p className="font-black text-purple-900 uppercase">
                          {examVenue || "TO BE ANNOUNCED"}
                        </p>
                      </div>
                      <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1">
                        <p className="text-[0.625rem] font-black uppercase text-purple-600  flex items-center justify-center gap-1.5">
                          <ClipboardList className="w-3 h-3" /> Additional Notes
                        </p>
                        <p className="font-bold text-purple-900/80 text-[0.625rem] uppercase italic leading-tight line-clamp-2">
                          {examNotes || "No special instructions"}
                        </p>
                      </div>
                    </>
                  )}

                  {status.rawStatus === "FOR_REVISION" &&
                    status.rejectionReason && (
                      <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl space-y-1 md:col-span-3">
                        <p className="text-[0.625rem] font-black uppercase text-primary  flex items-center justify-center gap-1.5">
                          <AlertCircle className="w-3 h-3" /> Revision Details
                        </p>
                        <p className="font-bold text-primary/90 italic">
                          "{status.rejectionReason}"
                        </p>
                      </div>
                    )}

                  <div className="p-5 bg-white border border-border rounded-2xl space-y-1 text-center md:col-span-3">
                    <p className="text-[0.625rem] font-black uppercase text-foreground ">
                      Date Submitted
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      {format(new Date(status.createdAt), "MMMM dd, yyyy")}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-white border border-border rounded-2xl space-y-4">
                  <h4 className="text-sm font-black uppercase  text-foreground">
                    Dynamic Next Steps
                  </h4>
                  <TrackingNextSteps
                    applicantType={status.applicantType}
                    programType={status.programType}
                    status={nextStepsStatus}
                    currentStep={status.currentStep}
                    hasBeerf={Boolean(status.earlyRegistrationId)}
                  />
                  <div className="mt-8 pt-6 border-t border-dashed text-center">
                    <p className="text-md font-bold text-foreground uppercase ">
                      Lost or missing confirmation slip?
                    </p>
                    <p className="text-xs text-foreground/60 mt-1 uppercase font-bold">
                      Enter your tracking number above to retrieve and download
                      your official slip.
                    </p>
                  </div>
                  <div className="flex items-center justify-center mt-6">
                    <Button
                      className="h-12 px-8 font-bold w-full sm:w-auto gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={downloadPDF}
                      disabled={isGenerating}>
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isGenerating
                        ? "Generating PDF..."
                        : "Retrieve Confirmation Slip (PDF)"}
                    </Button>
                  </div>
                  {!compassionateView ? (
                    <div className="flex items-center justify-center mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 px-5 font-black w-full sm:w-auto"
                        onClick={handleBackToSearch}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Search
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="pt-4 text-center">
                  <p className="text-[0.6875rem] font-bold text-foreground/60 uppercase ">
                    Last updated: {format(new Date(), "hh:mm a")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PDF Container (Hidden) ── */}
          {status && (
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                top: "0",
                left: "-9999px",
                overflow: "visible",
                pointerEvents: "none",
              }}>
              <div
                ref={pdfRef}
                style={{
                  width: "800px",
                  padding: "60px",
                  backgroundColor: "#ffffff",
                  color: "#061E29",
                }}
                className="font-sans">
              <div
                style={{ borderColor: "#061E29" }}
                className="flex flex-col items-center justify-center gap-6 mb-4 border-b-2 pb-10">
                <div className="flex items-center justify-center gap-10 w-full">
                  {logoUrl ? (
                    <img
                      src={`${API_BASE}${logoUrl}`}
                      crossOrigin="anonymous"
                      alt="School Logo"
                      className="h-28 w-28 object-contain"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: "#f3f4f6" }}
                      className="h-28 w-28 rounded-full flex items-center justify-center font-bold text-4xl text-[#061E29]">
                      {schoolName?.charAt(0)}
                    </div>
                  )}
                  <div className="text-center flex-1">
                    <h1
                      style={{ color: "#061E29" }}
                      className="text-3xl font-black uppercase  mb-1">
                      {schoolName}
                    </h1>
                    <p
                      style={{ color: "#4b5563" }}
                      className="text-base font-bold uppercase  mb-2">
                      Basic Education Early Registration Form Portal
                    </p>
                    <div
                      style={{ backgroundColor: "#061E29", color: "#ffffff" }}
                      className="flex items-center justify-center px-6 py-3 rounded-xl text-xs font-black  uppercase text-center">
                      <p className="-mt-3">
                        Official Basic Education Early Registration Form
                        Confirmation Slip
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <h2
                    style={{ color: "#061E29" }}
                    className="text-4xl font-black ">
                    Application Received!
                  </h2>
                  <p
                    style={{ color: "#4b5563" }}
                    className="text-xl font-bold">
                    Your application has been successfully submitted to{" "}
                    <span
                      style={{ color: "#061E29" }}
                      className="font-bold">
                      {schoolName}
                    </span>
                    .
                  </p>
                </div>

                <div
                  style={{ backgroundColor: "#f9fafb", borderColor: "#061E29" }}
                  className="p-12 rounded-lg border-4 text-center space-y-6 relative overflow-hidden border-dashed">
                  <p
                    style={{ color: "#6b7280" }}
                    className="text-xs uppercase  font-black">
                    Application Tracking Number
                  </p>
                  <p
                    style={{ color: "#061E29" }}
                    className="text-7xl  font-black ">
                    {status.trackingNumber}
                  </p>

                  <div className="pt-6 flex justify-center gap-12 text-center">
                    <div className="space-y-1">
                      <p
                        style={{ color: "#9ca3af" }}
                        className="text-[0.625rem] font-black uppercase">
                        Date Generated
                      </p>
                      <p
                        style={{ color: "#061E29" }}
                        className="text-sm font-bold">
                        {formatManilaDate(getManilaNow(), {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p
                        style={{ color: "#9ca3af" }}
                        className="text-[0.625rem] font-black uppercase">
                        Time Generated
                      </p>
                      <p
                        style={{ color: "#061E29" }}
                        className="text-sm font-bold">
                        {formatManilaDate(getManilaNow(), {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  style={{ borderColor: "#f3f4f6" }}
                  className="space-y-8 bg-white p-8 border-2 rounded-lg">
                  <h3
                    style={{ color: "#061E29" }}
                    className="text-2xl font-black flex items-center gap-3 uppercase  -mt-3">
                    Important Next Steps
                  </h3>
                  <TrackingNextSteps
                    applicantType={status.applicantType}
                    programType={status.programType}
                    status={nextStepsStatus}
                    currentStep={status.currentStep}
                    hasBeerf={Boolean(status.earlyRegistrationId)}
                  />
                </div>

                <div
                  style={{ borderColor: "#061E29" }}
                  className="border-t-4 pt-12 mt-12 flex justify-between items-end">
                  <div className="space-y-2">
                    <p
                      style={{ color: "#9ca3af" }}
                      className="text-[0.625rem] font-black uppercase ">
                      Security Validation
                    </p>
                    <div
                      style={{ backgroundColor: "#061E29", color: "#ffffff" }}
                      className="px-4 py-2  text-xs font-bold">
                      VALID_AUTHENTIC_SUBMISSION_
                      {status.trackingNumber?.replace(/-/g, "_") || "PENDING"}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p
                      style={{ color: "#061E29" }}
                      className="font-black uppercase  text-lg leading-none">
                      EnrollPro Management System
                    </p>
                    <p
                      style={{ color: "#9ca3af" }}
                      className="text-[0.625rem] font-bold">
                      This document is electronically generated. No physical
                      signature required.
                    </p>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
