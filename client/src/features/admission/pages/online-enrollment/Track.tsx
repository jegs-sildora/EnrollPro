import { zodResolver } from "@/shared/lib/zodResolver";
import type { ApplicationTrackResponse } from "@enrollpro/shared";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  LogOut,
  Search,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AnimatedError } from "@/shared/components/AnimatedError";
import api from "@/shared/api/axiosInstance";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import TrackingNextSteps from "@/features/admission/components/TrackingNextSteps";
import { normalizeTrackingStatus } from "@/features/admission/components/trackingState";

const trackSchema = z.object({
  trackingNumber: z
    .string()
    .trim()
    .min(8, "Enter the tracking number provided after enrollment.")
    .max(24, "The tracking number is too long.")
    .regex(/^[A-Za-z0-9-]+$/, "Use only the letters, numbers, and dashes shown in the tracking number."),
});

type TrackFormData = z.infer<typeof trackSchema>;

interface ApplicationStatus extends ApplicationTrackResponse {
  firstName: string;
  middleName: string | null;
  lastName: string;
  createdAt: string;
  gradeLevel: { name: string };
  enrollment: {
    section: { name: string };
    enrolledAt: string;
  } | null;
}

interface StatusPresentation {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  IN_REVIEW: {
    label: "For Registrar Review",
    icon: Search,
    color: "border-slate-200 bg-slate-50 text-slate-700",
    description:
      "The Registrar's Office is checking the learner record and available school requirements.",
  },
  QUALIFIED_FOR_ENROLLMENT: {
    label: "Ready for Class Sectioning",
    icon: CheckCircle2,
    color: "border-emerald-200 bg-emerald-50 text-emerald-700",
    description:
      "The learner is enrolled and waiting for assignment to a class section.",
  },
  ENROLLED: {
    label: "Officially Enrolled",
    icon: CheckCircle2,
    color: "border-green-300 bg-green-100 text-green-800",
    description:
      "The learner has an official class section for the active school year.",
  },
  REJECTED: {
    label: "Not Accepted",
    icon: AlertCircle,
    color: "border-red-200 bg-red-50 text-red-700",
    description:
      "The application was not accepted. Contact the Registrar's Office for the recorded reason.",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    icon: AlertCircle,
    color: "border-slate-200 bg-slate-50 text-slate-700",
    description: "The enrollment application was withdrawn.",
  },
  TRANSFERRED: {
    label: "Transferred Out",
    icon: LogOut,
    color: "border-slate-200 bg-slate-50 text-slate-700",
    description: "The learner transferred to another school.",
  },
  DROPPED: {
    label: "Dropped",
    icon: LogOut,
    color: "border-slate-200 bg-slate-50 text-slate-700",
    description:
      "The learner is no longer in the active class list for this school year.",
  },
};

const LEARNING_PROGRAM_LABELS: Record<string, string> = {
  REGULAR: "Basic Education Curriculum",
  LATE_ENROLLEE: "Basic Education Curriculum",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING:
    "Science, Technology and Engineering",
  SPECIAL_PROGRAM_IN_THE_ARTS: "Special Program in the Arts",
  SPECIAL_PROGRAM_IN_SPORTS: "Special Program in Sports",
  SPECIAL_PROGRAM_IN_JOURNALISM: "Special Program in Journalism",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE:
    "Special Program in Foreign Language",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION:
    "Special Program in Technical-Vocational Education",
};

interface TrackApplicationProps {
  onResultsFetched?: (hasResults: boolean) => void;
}

export default function TrackApplication({
  onResultsFetched,
}: TrackApplicationProps) {
  const [application, setApplication] = useState<ApplicationStatus | null>(null);
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
    setApplication(null);
    setError("");
    onResultsFetched?.(false);
    reset({ trackingNumber: "" });
  };

  const onTrack = async (data: TrackFormData) => {
    setIsLoading(true);
    setError("");
    setApplication(null);
    onResultsFetched?.(false);

    try {
      const response = await api.get<ApplicationStatus>(
        `/applications/track/${data.trackingNumber.trim().toUpperCase()}`,
      );
      setApplication(response.data);
      onResultsFetched?.(true);
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError
          ? (
              requestError as {
                response?: { data?: { message?: string } };
              }
            ).response?.data?.message
          : undefined;
      setError(
        message ??
          "No enrollment application matches that tracking number.",
      );
      onResultsFetched?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizedStatus = application
    ? normalizeTrackingStatus(application.status)
    : "IN_REVIEW";
  const presentation =
    STATUS_PRESENTATION[normalizedStatus] ?? STATUS_PRESENTATION.IN_REVIEW;
  const StatusIcon = presentation.icon;
  const programLabel = application
    ? LEARNING_PROGRAM_LABELS[application.applicantType] ??
      application.applicantType.replaceAll("_", " ")
    : "";

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <Card className="w-full overflow-hidden rounded-lg border-2 border-primary/5 shadow-xl">
        <CardHeader className="bg-primary p-8 text-center text-primary-foreground">
          <CardTitle className="text-2xl font-extrabold uppercase">
            Enrollment Application Status
          </CardTitle>
          <CardDescription className="font-extrabold text-primary-foreground/90">
            Enter the tracking number issued after submitting the enrollment
            form
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit(onTrack)} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="trackingNumber"
                className="text-base font-extrabold uppercase"
              >
                Tracking Number
              </Label>
              <div className="relative">
                <Input
                  id="trackingNumber"
                  {...register("trackingNumber")}
                  placeholder="EN-26-ABC123"
                  className="h-14 border-2 pl-12 text-lg font-extrabold uppercase"
                  autoComplete="off"
                />
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              </div>
              <AnimatedError error={errors.trackingNumber?.message} />
            </div>
            <Button
              type="submit"
              className="h-14 w-full text-lg font-extrabold uppercase"
              disabled={isLoading}
            >
              {isLoading ? "Checking..." : "Check Status"}
            </Button>
          </form>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="tracking-error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-8 flex items-start gap-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-6"
              >
                <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <div>
                  <h4 className="font-extrabold uppercase text-primary">
                    Application Not Found
                  </h4>
                  <p className="mt-1 text-base font-extrabold text-primary/80">
                    {error}
                  </p>
                </div>
              </motion.div>
            ) : null}

            {application ? (
              <motion.div
                key={application.trackingNumber}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-10 space-y-8"
              >
                <div
                  className={cn(
                    "flex flex-col items-center gap-4 rounded-lg border-2 p-8 text-center",
                    presentation.color,
                  )}
                >
                  <StatusIcon className="h-10 w-10" />
                  <div>
                    <p className="text-sm font-extrabold uppercase">
                      Current Status
                    </p>
                    <h3 className="mt-1 text-2xl font-extrabold uppercase">
                      {presentation.label}
                    </h3>
                  </div>
                  <p className="max-w-lg text-base font-semibold">
                    {presentation.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3">
                  <InfoBlock
                    icon={User}
                    label="Learner Name"
                    value={`${application.lastName}, ${application.firstName} ${application.middleName ?? ""}`}
                  />
                  <InfoBlock
                    icon={FileText}
                    label="Incoming Grade"
                    value={application.gradeLevel.name}
                  />
                  <InfoBlock
                    icon={BookOpen}
                    label="Curriculum Program"
                    value={programLabel}
                  />
                  {application.enrollment?.section ? (
                    <InfoBlock
                      icon={CheckCircle2}
                      label="Class Section"
                      value={application.enrollment.section.name}
                      className="md:col-span-3"
                    />
                  ) : null}
                  <InfoBlock
                    icon={Clock}
                    label="Date Submitted"
                    value={format(
                      new Date(application.createdAt),
                      "MMMM dd, yyyy",
                    )}
                    className="md:col-span-3"
                  />
                </div>

                <div className="space-y-4 rounded-lg border bg-muted p-6">
                  <h4 className="text-base font-extrabold uppercase">
                    Enrollment Progress
                  </h4>
                  <TrackingNextSteps
                    applicantType={application.applicantType}
                    programType={application.programType}
                    status={application.status}
                    currentStep={application.currentStep}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full font-extrabold sm:w-auto"
                    onClick={handleBackToSearch}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Check Another Tracking Number
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-1 rounded-lg border border-primary/10 bg-primary/5 p-5",
        className,
      )}
    >
      <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold uppercase">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="font-extrabold uppercase text-primary">{value.trim()}</p>
    </div>
  );
}
