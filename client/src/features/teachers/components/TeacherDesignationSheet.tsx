import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, CloudUpload, User } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type {
  AdvisorySectionOption,
  DesignationCollision,
  DesignationDrawerTab,
  DesignationFormState,
  Teacher,
} from "../types";
import { formatDateTime, formatTeacherName } from "../utils";

interface TeacherDesignationSheetProps {
  open: boolean;
  ayId: number | null;
  submitting: boolean;
  designationOpenFor: Teacher | null;
  designationDrawerTab: DesignationDrawerTab;
  setDesignationDrawerTab: (tab: DesignationDrawerTab) => void;
  designationForm: DesignationFormState;
  setDesignationForm: Dispatch<SetStateAction<DesignationFormState>>;
  advisorySections: AdvisorySectionOption[];
  advisorySectionsLoading: boolean;
  selectedAdvisorySection: AdvisorySectionOption | undefined;
  designationCollision: DesignationCollision | null;
  setDesignationCollision: (value: DesignationCollision | null) => void;
  allowCollisionOverride: boolean;
  setAllowCollisionOverride: (value: boolean) => void;
  forceSyncingTeacherId: number | null;
  onClose: () => void;
  onSave: () => void;
  onForceSyncTeacher: (teacher: Teacher) => void;
}

function renderAtlasSyncBadge(teacher: Teacher) {
  const status = teacher.atlasSync?.status;

  if (!status || status === "SKIPPED") {
    return <Badge variant="outline">Not Synced</Badge>;
  }

  if (status === "SYNCED") {
    return <Badge variant="success">Synced</Badge>;
  }

  if (status === "FAILED") {
    return <Badge variant="danger">Failed</Badge>;
  }

  return <Badge variant="warning">Pending</Badge>;
}

export function TeacherDesignationSheet({
  open,
  ayId,
  submitting,
  designationOpenFor,
  designationDrawerTab,
  setDesignationDrawerTab,
  designationForm,
  setDesignationForm,
  advisorySections,
  advisorySectionsLoading,
  selectedAdvisorySection,
  designationCollision,
  setDesignationCollision,
  allowCollisionOverride,
  setAllowCollisionOverride,
  forceSyncingTeacherId,
  onClose,
  onSave,
  onForceSyncTeacher,
}: TeacherDesignationSheetProps) {
  const teacherDisplayName = designationOpenFor
    ? formatTeacherName(designationOpenFor)
    : "Teacher";
  const designationLastUpdated =
    designationOpenFor?.designation?.updatedAt ?? null;

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}>
      <SheetContent
        side="right"
        className="w-full p-0 sm:max-w-3xl flex flex-col overflow-hidden bg-background">
        <SheetHeader className="space-y-1 border-b p-3 sm:p-4 pr-14 shrink-0 bg-primary font-black">
          <SheetTitle className="text-base sm:text-lg text-primary-foreground font-black tracking-tight uppercase">
            ATLAS Teacher Designation
          </SheetTitle>
          <SheetDescription className="text-[11px] sm:text-xs text-primary-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{teacherDisplayName}</span>
            <span className="hidden sm:inline">|</span>
            <span>
              {ayId ? `School Year #${ayId}` : "No Active School Year"}
            </span>
            {designationLastUpdated ? (
              <>
                <span className="hidden sm:inline">|</span>
                <span>Updated {formatDateTime(designationLastUpdated)}</span>
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 font-bold">
          <div className="bg-[hsl(var(--muted))] p-3 sm:p-4 rounded-md border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl border-2 border-primary border-dashed shadow-sm bg-background flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Teacher
                  </p>
                  <h3 className="font-black text-base sm:text-lg uppercase tracking-tight break-words">
                    {teacherDisplayName}
                  </h3>
                </div>
              </div>
              {designationOpenFor ? (
                renderAtlasSyncBadge(designationOpenFor)
              ) : (
                <Badge variant="outline">No Teacher Selected</Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 border-t pt-3 mt-3 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Last Updated By
                </p>
                <p className="text-sm">
                  {designationOpenFor?.designation?.updatedByName ?? "-"}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Last Updated At
                </p>
                <p className="text-sm">
                  {formatDateTime(designationLastUpdated)}
                </p>
              </div>
            </div>
          </div>

          <Tabs
            value={designationDrawerTab}
            onValueChange={(value) =>
              setDesignationDrawerTab(value as DesignationDrawerTab)
            }
            className="space-y-3">
            <TabsList className="grid w-full grid-cols-3 bg-muted/40 h-auto p-1">
              <TabsTrigger value="role-load" className="py-2 text-xs">
                Role & Load
              </TabsTrigger>
              <TabsTrigger value="schedule-notes" className="py-2 text-xs">
                Schedule & Notes
              </TabsTrigger>
              <TabsTrigger value="review" className="py-2 text-xs">
                Review & Sync
              </TabsTrigger>
            </TabsList>

            <TabsContent value="role-load" className="mt-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-card p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="isClassAdviser"
                      className="text-xs uppercase tracking-wider">
                      Class Adviser
                    </Label>
                    <Switch
                      id="isClassAdviser"
                      checked={designationForm.isClassAdviser}
                      onCheckedChange={(checked) =>
                        setDesignationForm((prev) => ({
                          ...prev,
                          isClassAdviser: checked,
                          advisorySectionId: checked
                            ? prev.advisorySectionId
                            : "",
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Advisory Section
                    </Label>
                    <Select
                      value={designationForm.advisorySectionId || "__none__"}
                      onValueChange={(value) => {
                        setDesignationForm((prev) => ({
                          ...prev,
                          advisorySectionId: value === "__none__" ? "" : value,
                        }));
                        setDesignationCollision(null);
                        setAllowCollisionOverride(false);
                      }}
                      disabled={
                        !designationForm.isClassAdviser ||
                        advisorySectionsLoading
                      }>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            advisorySectionsLoading
                              ? "Loading sections..."
                              : "Select advisory section"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          No section selected
                        </SelectItem>
                        {advisorySections.map((section) => (
                          <SelectItem
                            key={section.id}
                            value={section.id.toString()}>
                            {section.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAdvisorySection?.currentAdviserName &&
                    selectedAdvisorySection.currentAdviserId !==
                      designationOpenFor?.id ? (
                      <p className="text-[0.6875rem] text-amber-700">
                        Currently assigned to{" "}
                        {selectedAdvisorySection.currentAdviserName}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Advisory Equivalent Hours / Week
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      step="0.5"
                      value={designationForm.advisoryEquivalentHoursPerWeek}
                      onChange={(event) =>
                        setDesignationForm((prev) => ({
                          ...prev,
                          advisoryEquivalentHoursPerWeek: event.target.value,
                        }))
                      }
                      disabled={!designationForm.isClassAdviser}
                    />
                  </div>
                </div>

                <div className="rounded-md border bg-card p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="isTic"
                      className="text-xs uppercase tracking-wider">
                      Teacher In Charge (TIC)
                    </Label>
                    <Switch
                      id="isTic"
                      checked={designationForm.isTic}
                      onCheckedChange={(checked) =>
                        setDesignationForm((prev) => ({
                          ...prev,
                          isTic: checked,
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="isTeachingExempt"
                      className="text-xs uppercase tracking-wider">
                      Teaching Exempt
                    </Label>
                    <Switch
                      id="isTeachingExempt"
                      checked={designationForm.isTeachingExempt}
                      onCheckedChange={(checked) =>
                        setDesignationForm((prev) => ({
                          ...prev,
                          isTeachingExempt: checked,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Custom Target Teaching Hours / Week
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      step="0.5"
                      value={designationForm.customTargetTeachingHoursPerWeek}
                      onChange={(event) =>
                        setDesignationForm((prev) => ({
                          ...prev,
                          customTargetTeachingHoursPerWeek: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="schedule-notes" className="mt-0 space-y-4">
              <div className="rounded-md border bg-card p-3 sm:p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider">
                      Effective From
                    </Label>
                    <Input
                      type="date"
                      value={designationForm.effectiveFrom}
                      onChange={(event) =>
                        setDesignationForm((prev) => ({
                          ...prev,
                          effectiveFrom: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider">
                      Effective To
                    </Label>
                    <Input
                      type="date"
                      value={designationForm.effectiveTo}
                      onChange={(event) =>
                        setDesignationForm((prev) => ({
                          ...prev,
                          effectiveTo: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider">
                    Designation Notes
                  </Label>
                  <Textarea
                    value={designationForm.designationNotes}
                    onChange={(event) =>
                      setDesignationForm((prev) => ({
                        ...prev,
                        designationNotes: event.target.value,
                      }))
                    }
                    placeholder="Optional notes for load planning and designation context"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider">
                    Reason for Change
                  </Label>
                  <Textarea
                    value={designationForm.reason}
                    onChange={(event) =>
                      setDesignationForm((prev) => ({
                        ...prev,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Optional audit reason for this update"
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="review" className="mt-0 space-y-4">
              {designationCollision ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 sm:px-4 sm:py-4 text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Adviser conflict detected</p>
                      <p className="text-xs">
                        {designationCollision.gradeLevelName ?? "Grade"} -{" "}
                        {designationCollision.sectionName} is currently assigned
                        to {designationCollision.currentAdviserName}.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="allowCollisionOverride" className="text-xs">
                      Override existing adviser assignment
                    </Label>
                    <Switch
                      id="allowCollisionOverride"
                      checked={allowCollisionOverride}
                      onCheckedChange={setAllowCollisionOverride}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-md border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                  No adviser collision detected for the selected section.
                </div>
              )}

              <div className="rounded-md border bg-card p-3 sm:p-4 space-y-2 text-sm">
                <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Sync Diagnostics
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span>Current State</span>
                  {designationOpenFor
                    ? renderAtlasSyncBadge(designationOpenFor)
                    : null}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Attempts</span>
                  <span className="text-foreground text-right">
                    {designationOpenFor?.atlasSync
                      ? `${designationOpenFor.atlasSync.attemptCount}/${designationOpenFor.atlasSync.maxAttempts}`
                      : "-"}
                  </span>
                  <span>Next Retry</span>
                  <span className="text-foreground text-right">
                    {formatDateTime(
                      designationOpenFor?.atlasSync?.nextRetryAt ?? null,
                    )}
                  </span>
                  <span>Last Ack</span>
                  <span className="text-foreground text-right">
                    {formatDateTime(
                      designationOpenFor?.atlasSync?.acknowledgedAt ?? null,
                    )}
                  </span>
                </div>
                {designationOpenFor?.atlasSync?.errorMessage ? (
                  <p className="text-xs text-destructive">
                    {designationOpenFor.atlasSync.errorMessage}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    designationOpenFor && onForceSyncTeacher(designationOpenFor)
                  }
                  disabled={
                    !ayId ||
                    !designationOpenFor ||
                    forceSyncingTeacherId === designationOpenFor.id
                  }>
                  <CloudUpload className="mr-2 h-4 w-4" />
                  {designationOpenFor &&
                  forceSyncingTeacherId === designationOpenFor.id
                    ? "Syncing..."
                    : "Force Sync Teacher"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t px-3 sm:px-4 py-3 sm:py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0 bg-background">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !ayId}
            className="w-full sm:w-auto">
            {submitting ? "Saving..." : "Save Designation"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
