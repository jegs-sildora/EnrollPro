import { useState, useEffect } from "react";
import {
  Check,
  AlertCircle,
  Info,
  Loader2,
  ExternalLink,
  BookOpen,
  Save,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import type {
  LearnerType,
  ChecklistData,
} from "@/features/enrollment/hooks/useApplicationDetail";

interface Props {
  applicantId: number;
  learnerType: LearnerType;
  checklist?: ChecklistData;
  endpointBase?: string;
  onRefresh: () => void;
  onMandatoryStatusChange?: (isMet: boolean) => void;
  readOnly?: boolean;
}

type ChecklistFieldKey = keyof Omit<
  ChecklistData,
  "id" | "applicantId" | "updatedAt" | "updatedBy" | "academicStatus"
>;

interface RequirementItem {
  key: ChecklistFieldKey;
  label: string;
  description: string;
  isMandatory: boolean;
}

interface ApiRequirement {
  type: string;
  label: string;
  isRequired: boolean;
  description?: string;
}

const CHECKLIST_FIELD_LABELS: Record<ChecklistFieldKey, string> = {
  isPsaBirthCertPresented: "PSA Birth Certificate",
  isOriginalPsaBcCollected: "Original PSA Copy Collected",
  isSf9Submitted: "SF9 / Report Card",
  isSf10Requested: "SF10 (Permanent Record)",
  isGoodMoralPresented: "Good Moral Certificate",
  isMedicalEvalSubmitted: "Medical Evaluation",
  isCertOfRecognitionPresented: "Certificate of Recognition",
  isUndertakingSigned: "Affidavit of Undertaking",
  isConfirmationSlipReceived: "Confirmation Slip",
};

const CHECKLIST_FIELD_DESCRIPTIONS: Record<ChecklistFieldKey, string> = {
  isPsaBirthCertPresented:
    "Submitted once per school stay. Mandatory for new enrollees and transferees.",
  isOriginalPsaBcCollected:
    "Track if the original PSA copy has been collected for records filing.",
  isSf9Submitted:
    "Proof of last grade level completed. Mandatory for new enrollees and transferees.",
  isSf10Requested:
    "NOT an initial requirement. Transmitted school-to-school via LIS tracking after enrollment.",
  isGoodMoralPresented: "Not required for public schools per DO 017, s. 2025.",
  isMedicalEvalSubmitted:
    "Not required unless for specific health-related program requirements or LWD.",
  isCertOfRecognitionPresented:
    "Used for programs requiring achievement certificates as supporting evidence.",
  isUndertakingSigned:
    "Required for transferees with unpaid private school fees or missing documents (Temporary Enrollment).",
  isConfirmationSlipReceived:
    "Mandatory for Grade 8-10 continuing learners to confirm intent to enroll.",
};

const REQUIREMENT_TYPE_TO_CHECKLIST_KEY: Record<string, ChecklistFieldKey> = {
  PSA_BIRTH_CERTIFICATE: "isPsaBirthCertPresented",
  SF9_REPORT_CARD: "isSf9Submitted",
  ACADEMIC_RECORD: "isSf9Submitted",
  CONFIRMATION_SLIP: "isConfirmationSlipReceived",
  AFFIDAVIT_OF_UNDERTAKING: "isUndertakingSigned",
  GOOD_MORAL_CERTIFICATE: "isGoodMoralPresented",
  MEDICAL_CERTIFICATE: "isMedicalEvalSubmitted",
  MEDICAL_EVALUATION: "isMedicalEvalSubmitted",
  CERTIFICATE_OF_RECOGNITION: "isCertOfRecognitionPresented",
};

function buildFallbackRequirements(
  learnerType: LearnerType,
): RequirementItem[] {
  return [
    {
      key: "isPsaBirthCertPresented",
      label: CHECKLIST_FIELD_LABELS.isPsaBirthCertPresented,
      description: CHECKLIST_FIELD_DESCRIPTIONS.isPsaBirthCertPresented,
      isMandatory: learnerType !== "CONTINUING",
    },
    {
      key: "isSf9Submitted",
      label: CHECKLIST_FIELD_LABELS.isSf9Submitted,
      description: CHECKLIST_FIELD_DESCRIPTIONS.isSf9Submitted,
      isMandatory: learnerType !== "CONTINUING",
    },
    {
      key: "isConfirmationSlipReceived",
      label: CHECKLIST_FIELD_LABELS.isConfirmationSlipReceived,
      description: CHECKLIST_FIELD_DESCRIPTIONS.isConfirmationSlipReceived,
      isMandatory: learnerType === "CONTINUING",
    },
    {
      key: "isSf10Requested",
      label: CHECKLIST_FIELD_LABELS.isSf10Requested,
      description: CHECKLIST_FIELD_DESCRIPTIONS.isSf10Requested,
      isMandatory: false,
    },
    {
      key: "isGoodMoralPresented",
      label: CHECKLIST_FIELD_LABELS.isGoodMoralPresented,
      description: CHECKLIST_FIELD_DESCRIPTIONS.isGoodMoralPresented,
      isMandatory: false,
    },
    {
      key: "isMedicalEvalSubmitted",
      label: CHECKLIST_FIELD_LABELS.isMedicalEvalSubmitted,
      description: CHECKLIST_FIELD_DESCRIPTIONS.isMedicalEvalSubmitted,
      isMandatory: false,
    },
    {
      key: "isUndertakingSigned",
      label: CHECKLIST_FIELD_LABELS.isUndertakingSigned,
      description: CHECKLIST_FIELD_DESCRIPTIONS.isUndertakingSigned,
      isMandatory: learnerType === "TRANSFEREE",
    },
    {
      key: "isCertOfRecognitionPresented",
      label: CHECKLIST_FIELD_LABELS.isCertOfRecognitionPresented,
      description: CHECKLIST_FIELD_DESCRIPTIONS.isCertOfRecognitionPresented,
      isMandatory: false,
    },
  ];
}

function mapApiRequirementsToChecklist(
  requirements: ApiRequirement[],
): RequirementItem[] {
  const mapped = new Map<ChecklistFieldKey, RequirementItem>();

  for (const requirement of requirements) {
    const key = REQUIREMENT_TYPE_TO_CHECKLIST_KEY[requirement.type];
    if (!key) continue;

    const existing = mapped.get(key);
    mapped.set(key, {
      key,
      label: requirement.label || CHECKLIST_FIELD_LABELS[key],
      description: requirement.description || CHECKLIST_FIELD_DESCRIPTIONS[key],
      isMandatory: Boolean(existing?.isMandatory || requirement.isRequired),
    });
  }

  return Array.from(mapped.values());
}

export function RequirementChecklist({
  applicantId,
  learnerType,
  checklist,
  endpointBase = "/applications",
  onRefresh,
  onMandatoryStatusChange,
  readOnly = false,
}: Props) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(true);
  const [localChecklist, setLocalChecklist] = useState<Partial<ChecklistData>>(
    checklist || {},
  );
  const [requirements, setRequirements] = useState<RequirementItem[]>([]);

  const showAcademicStatusControl = endpointBase.includes("/applications");

  useEffect(() => {
    if (checklist) {
      setLocalChecklist(checklist);
    }
  }, [checklist]);

  useEffect(() => {
    let isCancelled = false;

    const loadRequirements = async () => {
      setIsLoadingRequirements(true);

      try {
        const response = await api.get(
          `${endpointBase}/${applicantId}/requirements`,
        );
        const apiRequirements: ApiRequirement[] = Array.isArray(
          response.data?.requirements,
        )
          ? response.data.requirements
          : [];

        const mapped = mapApiRequirementsToChecklist(apiRequirements);

        if (!isCancelled) {
          setRequirements(
            mapped.length > 0 ? mapped : buildFallbackRequirements(learnerType),
          );
        }
      } catch {
        if (!isCancelled) {
          setRequirements(buildFallbackRequirements(learnerType));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingRequirements(false);
        }
      }
    };

    void loadRequirements();

    return () => {
      isCancelled = true;
    };
  }, [applicantId, endpointBase, learnerType]);

  const handleToggle = (key: ChecklistFieldKey, value: boolean) => {
    setLocalChecklist((prev) => ({ ...prev, [key]: value }));
  };

  const hasChanges = requirements.some(
    (req) => !!localChecklist[req.key] !== !!checklist?.[req.key],
  );

  const currentAcademicStatus = (localChecklist.academicStatus ??
    checklist?.academicStatus ??
    "PROMOTED") as "PROMOTED" | "RETAINED";
  const hasAcademicStatusChange =
    currentAcademicStatus !== (checklist?.academicStatus ?? "PROMOTED");
  const hasPendingChanges = hasChanges || hasAcademicStatusChange;

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      const payload = requirements.reduce<Record<string, boolean | string>>(
        (acc, requirement) => {
          acc[requirement.key] = Boolean(localChecklist[requirement.key]);
          return acc;
        },
        {},
      );

      if (showAcademicStatusControl) {
        payload.academicStatus = currentAcademicStatus;
      }

      await api.patch(`${endpointBase}/${applicantId}/checklist`, payload);
      sileo.success({
        title: "Checklist Updated",
        description: "Documentary Checklist has been updated.",
      });
      onRefresh();
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setIsUpdating(false);
    }
  };

  const getLearnerTypeLabel = (type: LearnerType) => {
    switch (type) {
      case "NEW_ENROLLEE":
        return "New Enrollee";
      case "TRANSFEREE":
        return "Transferee";
      case "RETURNING":
        return "Returning (Balik-Aral)";
      case "CONTINUING":
        return "Continuing";
      case "OSCYA":
        return "OSCYA";
      case "ALS":
        return "ALS";
      default:
        return type;
    }
  };

  const mandatoryRequirements = requirements.filter((r) => r.isMandatory);
  const mandatoryMet =
    currentAcademicStatus !== "RETAINED" &&
    mandatoryRequirements.every((r) => localChecklist[r.key]);

  useEffect(() => {
    onMandatoryStatusChange?.(mandatoryMet);
  }, [mandatoryMet, onMandatoryStatusChange]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            Documentary Checklist
            {(isUpdating || isLoadingRequirements) && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={mandatoryMet ? "success" : "secondary"}>
              {mandatoryMet
                ? "Mandatory Documents Met"
                : "Pending Mandatory Documents"}
            </Badge>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                readOnly ||
                isUpdating ||
                isLoadingRequirements ||
                !hasPendingChanges
              }
              className="h-7 text-[0.625rem] font-bold uppercase tracking-tight gap-1.5">
              {isUpdating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {readOnly ? "Read-Only" : "Save Changes"}
            </Button>
          </div>
        </div>
        <p className="text-[0.625rem] text-muted-foreground mt-1">
          Learner Type:{" "}
          <span className="font-bold text-primary">
            {getLearnerTypeLabel(learnerType)}
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAcademicStatusControl && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
              Academic Status
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Select
                value={currentAcademicStatus}
                onValueChange={(value: "PROMOTED" | "RETAINED") => {
                  setLocalChecklist((prev) => ({
                    ...prev,
                    academicStatus: value,
                  }));
                }}
                disabled={readOnly || isUpdating}>
                <SelectTrigger className="h-8 w-[220px] text-xs font-bold">
                  <SelectValue placeholder="Select academic status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROMOTED">Promoted</SelectItem>
                  <SelectItem value="RETAINED">Retained</SelectItem>
                </SelectContent>
              </Select>
              {currentAcademicStatus === "RETAINED" && (
                <Badge variant="destructive" className="text-[10px] font-bold">
                  Retained blocks verification/enrollment
                </Badge>
              )}
            </div>
          </div>
        )}

        {isLoadingRequirements ? (
          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            Loading requirement rules...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {requirements.map((req) => (
              <div
                key={req.key}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                <Checkbox
                  id={req.key}
                  checked={!!localChecklist[req.key]}
                  onCheckedChange={(checked) =>
                    handleToggle(req.key, !!checked)
                  }
                  disabled={readOnly || isUpdating}
                  className="shrink-0"
                />
                <div className="flex-1 space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={req.key}
                      className="text-xs font-bold leading-tight cursor-pointer truncate"
                      title={req.label}>
                      {req.label}
                    </Label>
                    {req.isMandatory && (
                      <Badge
                        variant="outline"
                        className="text-[0.5rem] h-3.5 px-1 text-red-600 border-red-200 bg-red-50 shrink-0">
                        M
                      </Badge>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">{req.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="shrink-0">
                  {localChecklist[req.key] ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    req.isMandatory && (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {checklist?.updatedAt && (
          <p className="text-xs text-right pt-2 border-t">
            Last updated:{" "}
            {format(new Date(checklist.updatedAt), "MMMM dd, yyyy hh:mm a")}
          </p>
        )}

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[0.625rem] h-8 font-bold gap-2 uppercase tracking-wider"
            asChild>
            <Link to="/settings?tab=requirements" target="_blank">
              <BookOpen className="h-3 w-3" />
              View Requirements Guide
              <ExternalLink className="h-2 w-2 ml-auto" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
