import { useState, useEffect } from "react";
import { Check, AlertCircle, Info, Loader2, ExternalLink, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router";
import api from "@/api/axiosInstance";
import { toastApiError } from "@/hooks/useApiToast";
import { sileo } from "sileo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LearnerType, ChecklistData } from "@/hooks/useApplicationDetail";

interface Props {
  applicantId: number;
  learnerType: LearnerType;
  checklist?: ChecklistData;
  onRefresh: () => void;
}

interface RequirementItem {
  key: keyof Omit<ChecklistData, "id" | "applicantId" | "lastUpdated">;
  label: string;
  description: string;
  isMandatory: boolean;
}

export function RequirementChecklist({ applicantId, learnerType, checklist, onRefresh }: Props) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localChecklist, setLocalChecklist] = useState<Partial<ChecklistData>>(checklist || {});

  useEffect(() => {
    if (checklist) {
      setLocalChecklist(checklist);
    }
  }, [checklist]);

  const requirements: RequirementItem[] = [
    {
      key: "psaBirthCertStatus",
      label: "PSA Birth Certificate",
      description: "Submitted once per school stay. Mandatory for new enrollees and transferees if not already on file.",
      isMandatory: learnerType !== "CONTINUING" && !localChecklist.psaBcOnFile,
    },
    {
      key: "psaBcOnFile",
      label: "PSA BC Already on File",
      description: "Mark if the PSA Birth Certificate was already submitted in previous years at this school. If checked, new PSA BC is not required.",
      isMandatory: false,
    },
    {
      key: "secondaryBirthProofStatus",
      label: "Secondary Proof of Birth",
      description: "Accepted if PSA Birth Certificate is unavailable (e.g., Brgy Cert, Baptismal). Required for temporary enrollment.",
      isMandatory: false,
    },
    {
      key: "originalPsaBcCollected",
      label: "Original PSA BC Collected",
      description: "Phase 2: The actual physical original document has been received and filed in the student's folder.",
      isMandatory: false,
    },
    {
      key: "sf9ReportCardStatus",
      label: "SF9 / Report Card",
      description: "Proof of last grade level completed. Mandatory for new enrollees and transferees.",
      isMandatory: learnerType !== "CONTINUING",
    },
    {
      key: "confirmationSlipStatus",
      label: "Confirmation Slip",
      description: "Mandatory for Grade 8-10 and Grade 12 continuing learners to confirm intent to enroll.",
      isMandatory: learnerType === "CONTINUING",
    },
    {
      key: "sf10PermanentStatus",
      label: "SF10 (Permanent Record)",
      description: "NOT an initial requirement. Transmitted school-to-school via LIS tracking after enrollment.",
      isMandatory: false,
    },
    {
      key: "goodMoralStatus",
      label: "Good Moral Certificate",
      description: "Not required for public schools per DO 017, s. 2025.",
      isMandatory: false,
    },
    {
      key: "medicalEvaluationStatus",
      label: "Medical Evaluation",
      description: "Not required unless for specific health-related program requirements or LWD.",
      isMandatory: false,
    },
    {
      key: "undertakingStatus",
      label: "Affidavit of Undertaking",
      description: "Required for transferees with unpaid private school fees or missing documents (Temporary Enrollment).",
      isMandatory: learnerType === "TRANSFEREE",
    },
  ];

  const handleToggle = async (key: keyof ChecklistData, value: boolean) => {
    setIsUpdating(true);
    const updatedData = { [key]: value };

    try {
      await api.patch(`/applications/${applicantId}/checklist`, updatedData);
      setLocalChecklist((prev) => ({ ...prev, ...updatedData }));
      sileo.success({
        title: "Checklist Updated",
        description: "Requirement status has been updated.",
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
      case "NEW_ENROLLEE": return "New Enrollee";
      case "TRANSFEREE": return "Transferee";
      case "RETURNING": return "Returning (Balik-Aral)";
      case "CONTINUING": return "Continuing";
      default: return type;
    }
  };

  const mandatoryMet = requirements
    .filter(r => r.isMandatory)
    .every(r => localChecklist[r.key]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            Documentary Checklist
            {isUpdating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </CardTitle>
          <Badge variant={mandatoryMet ? "success" : "secondary"}>
            {mandatoryMet ? "Mandatory Docs Met" : "Pending Mandatory Docs"}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Learner Type: <span className="font-bold text-primary">{getLearnerTypeLabel(learnerType)}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {requirements.map((req) => (
            <div key={req.key} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id={req.key}
                checked={!!localChecklist[req.key]}
                onCheckedChange={(checked) => handleToggle(req.key, !!checked)}
                disabled={isUpdating}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={req.key}
                    className="text-xs font-bold leading-none cursor-pointer"
                  >
                    {req.label}
                  </Label>
                  {req.isMandatory && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 text-red-600 border-red-200 bg-red-50">
                      Mandatory
                    </Badge>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">{req.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              {localChecklist[req.key] ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                req.isMandatory && <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
            </div>
          ))}
        </div>

        {checklist?.lastUpdated && (
          <p className="text-[9px] text-right text-muted-foreground pt-2 border-t">
            Last updated: {format(new Date(checklist.lastUpdated), "MMM dd, yyyy hh:mm a")}
          </p>
        )}

        <div className="pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-[10px] h-8 font-bold gap-2 uppercase tracking-tight"
            asChild
          >
            <Link to="/enrollment/requirements" target="_blank">
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
