import { ShieldCheck, CalendarDays } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { useCurriculumScpConfigs } from "./hooks/useCurriculumScpConfigs";
import { ScpProgramCard } from "./components/ScpProgramCard";

export default function CurriculumTabPage() {
  const {
    ayId,
    scpConfigs,
    loading,
    hasUnsavedChanges,
    savingScp,
    handleDiscardScpChanges,
    handleUpdateScpField,
    handleUpdateStep,
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
    return (
      <div className="flex h-[calc(100vh-20rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">No Active School Year</p>
              <p className="text-sm leading-relaxed px-4 font-semibold">
                Select an active school year from Settings or the header
                switcher to configure curriculum programs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {!loading && (
        <>
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-5 w-5" />
                  Special Curricular Programs (SCP)
                </CardTitle>
                <CardDescription className="font-bold">
                  Configure early registration criteria for STE, SPA, SPS, etc.
                </CardDescription>
              </div>
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
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-0 z-20">
            <div className="rounded-lg border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-muted-foreground">
                  {hasUnsavedChanges
                    ? "You have unsaved curriculum configuration changes."
                    : "All curriculum configurations are saved."}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    className="font-bold"
                    onClick={handleDiscardScpChanges}
                    disabled={savingScp || !hasUnsavedChanges}>
                    Discard Changes
                  </Button>
                  <Button
                    className="font-bold"
                    onClick={handleSaveScp}
                    disabled={savingScp || !hasUnsavedChanges}>
                    {savingScp
                      ? "Saving..."
                      : "Save All Curriculum Configurations"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
