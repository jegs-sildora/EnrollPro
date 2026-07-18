import { AnimatedError } from "@/shared/components/AnimatedError";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
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

import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  LogOut,
  ArrowLeft,
  Calendar,
  User,
  BookOpen,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import {
  cn,
} from "@/shared/lib/utils";
import { format } from "date-fns";


import TrackingNextSteps from "@/features/admission/components/TrackingNextSteps";
import { normalizeTrackingStatus } from "@/features/admission/components/trackingState";
import type { ApplicationTrackResponse } from "@enrollpro/shared";


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
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");


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


  const nextStepsStatus =
    status?.rawStatus ||
    status?.status ||
    status?.trackingStatus ||
    normalizedStatus ||
    undefined;


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
          <CardTitle className="text-2xl font-extrabold uppercase ">
            Application Monitor
          </CardTitle>
          <CardDescription className="text-primary-foreground/90 font-extrabold">
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
                className="text-base font-extrabold uppercase  text-foreground">
                Tracking Number
              </Label>
              <div className="relative">
                <Input
                  id="trackingNumber"
                  {...register("trackingNumber")}
                  placeholder="REG-2026-00001"
                  className={cn(
                    "h-14 pl-12 text-lg font-extrabold border-2 transition-all",
                    errors.trackingNumber
                      ? "border-primary focus-visible:ring-primary"
                      : "border-primary/10 focus-visible:border-primary focus-visible:ring-primary/5",
                  )}
                  autoComplete="off"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground" />
              </div>
              <AnimatedError error={errors.trackingNumber?.message as string || errors.trackingNumber as unknown as string} />
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-lg font-extrabold uppercase  bg-primary hover:bg-primary/90 transition-all text-primary-foreground"
              disabled={isLoading}>
              {isLoading ? "Searching..." : "Check Status"}
            </Button>
          </form>



          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 bg-primary/5 border-2 border-primary/20 rounded-2xl flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-primary uppercase ">
                    Application Not Found
                  </h4>
                  <p className="text-base leading-tight font-extrabold text-primary/80 mt-1">
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
                <div
                  className={cn(
                    "p-8 rounded-lg border-2 flex flex-col items-center text-center gap-4",
                    config.color,
                  )}>
                  <div className="p-4 rounded-full bg-muted shadow-sm border border-current/20">
                    {Icon && <Icon className="w-10 h-10" />}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold uppercase  opacity-70">
                      Current Status
                    </h3>
                    <p className="text-3xl font-extrabold uppercase  mt-1">
                      {config.label}
                    </p>
                  </div>
                  <p className="text-base font-extrabold leading-relaxed max-w-sm opacity-90">
                    {config.desc}
                  </p>
                </div>

                <div className="grid gap-4 text-center grid-cols-1 md:grid-cols-3">
                  <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1">
                    <p className="text-[0.625rem] font-extrabold uppercase text-foreground  flex items-center justify-center gap-1.5">
                      <User className="w-3 h-3" /> Learner's Name
                    </p>
                    <p className="font-extrabold text-primary uppercase">
                      {status.lastName}, {status.firstName}{" "}
                      {status.middleName || ""}
                    </p>
                  </div>
                  <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1">
                    <p className="text-[0.625rem] font-extrabold uppercase text-foreground  flex items-center justify-center gap-1.5">
                      <FileText className="w-3 h-3" /> Grade Level
                    </p>
                    <p className="font-extrabold text-primary uppercase">
                      {status.gradeLevel.name}
                    </p>
                  </div>

                  <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1">
                    <p className="text-[0.625rem] font-extrabold uppercase text-primary/60  flex items-center justify-center gap-1.5">
                      <BookOpen className="w-3 h-3" /> Learning Program
                    </p>
                    <p className="font-extrabold text-primary uppercase">
                      {learningProgramLabel}
                    </p>
                  </div>





                  <div className="p-5 bg-muted border border-border rounded-2xl space-y-1 text-center md:col-span-3">
                    <p className="text-[0.625rem] font-extrabold uppercase text-foreground ">
                      Date Submitted
                    </p>
                    <p className="text-base font-extrabold text-foreground">
                      {format(new Date(status.createdAt), "MMMM dd, yyyy")}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-muted border border-border rounded-2xl space-y-4">
                  <h4 className="text-base leading-tight font-extrabold uppercase  text-foreground">
                    Dynamic Next Steps
                  </h4>
                  <TrackingNextSteps
                    applicantType={status.applicantType}
                    programType={status.programType}
                    status={nextStepsStatus}
                    currentStep={status.currentStep}
                  />

                  <div className="flex items-center justify-center mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-5 font-extrabold w-full sm:w-auto"
                      onClick={handleBackToSearch}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Search
                    </Button>
                  </div>
                </div>

                <div className="pt-4 text-center">
                  <p className="text-[0.6875rem] font-extrabold text-foreground/60 uppercase ">
                    Last updated: {format(new Date(), "hh:mm a")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>


        </CardContent>
      </Card>
    </div>
  );
}
