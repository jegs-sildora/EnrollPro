import { ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { useCurriculumScpConfigs } from "./hooks/useCurriculumScpConfigs";
import { NoSchoolYearState } from "./components/NoSchoolYearState";
import { ScpProgramCard } from "./components/ScpProgramCard";

export default function CurriculumTabPage() {
  const {
    ayId,
    scpConfigs,
    loading,
    savingScp,
    handleUpdateScpField,
    handleUpdateStep,
    patchDocumentRequirement,
    handleAddDocumentRequirement,
    handleRemoveDocumentRequirement,
    handleSaveScp,
  } = useCurriculumScpConfigs();

  const currentYearInManila = parseInt(
    new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
    }),
    10,
  );

  const scpYearStart = new Date(currentYearInManila, 0, 1);
  const scpYearEnd = new Date(currentYearInManila, 11, 31);

  if (!ayId) {
    return <NoSchoolYearState />;
  }

  return (
    <div className="space-y-6">
      {!loading && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-5 w-5" />
                  Special Curricular Programs (SCP)
                </CardTitle>
                <CardDescription className="font-bold">
                  Configure BASIC EDUCATION EARLY REGISTRATION FORM criteria for
                  STE, SPA, SPS, etc.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleSaveScp}
                disabled={savingScp}>
                {savingScp ? "Saving..." : "Save Configuration"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {scpConfigs.map((scp, index) => (
                  <ScpProgramCard
                    key={scp.scpType}
                    scp={scp}
                    scpIndex={index}
                    scpYearStart={scpYearStart}
                    scpYearEnd={scpYearEnd}
                    onUpdateScpField={handleUpdateScpField}
                    onUpdateStep={handleUpdateStep}
                    onPatchDocumentRequirement={patchDocumentRequirement}
                    onAddDocumentRequirement={handleAddDocumentRequirement}
                    onRemoveDocumentRequirement={handleRemoveDocumentRequirement}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
