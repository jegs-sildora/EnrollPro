import type { Dispatch, SetStateAction } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Info,
  ArrowRight,
  ArrowLeft,
  Save,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { UserPhoto } from "@/shared/components/UserPhoto";
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
import { cn } from "@/shared/lib/utils";

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
  onClose: () => void;
  onSave: () => void;
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
  onClose,
  onSave,
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
          <SheetTitle className="text-base sm:text-lg text-primary-foreground font-black  uppercase">
            Teacher Designation
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
                <UserPhoto
                  photo={designationOpenFor?.photoPath}
                  containerClassName="h-12 w-12 rounded-xl border-2 border-primary shadow-sm bg-background"
                  alt={teacherDisplayName}
                />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Teacher
                  </p>
                  <h3 className="font-black text-base sm:text-lg uppercase  break-words">
                    {teacherDisplayName}
                  </h3>
                </div>
              </div>
              <Badge variant="outline">
                {designationOpenFor ? "Selected" : "No Teacher Selected"}
              </Badge>
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
            className="space-y-4">
            <TabsList className="w-full flex h-auto gap-1 p-1 bg-white border border-border relative rounded-lg">
              <TabsTrigger
                value="role-load"
                className="flex-1 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs">
                {designationDrawerTab === "role-load" && (
                  <motion.div
                    layoutId="designation-active-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <ShieldCheck className="h-3.5 w-3.5 relative z-20" />
                <span className="relative z-20">Role & Load</span>
              </TabsTrigger>
              <TabsTrigger
                value="schedule-notes"
                className="flex-1 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs">
                {designationDrawerTab === "schedule-notes" && (
                  <motion.div
                    layoutId="designation-active-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Calendar className="h-3.5 w-3.5 relative z-20" />
                <span className="relative z-20">Schedule & Notes</span>
              </TabsTrigger>
              <TabsTrigger
                value="review"
                className="flex-1 py-2 gap-2 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs">
                {designationDrawerTab === "review" && (
                  <motion.div
                    layoutId="designation-active-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Info className="h-3.5 w-3.5 relative z-20" />
                <span className="relative z-20">Review</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="role-load"
              className="mt-0 focus-visible:outline-none ring-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4">
                
                <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black uppercase text-primary">Calculated Weekly Load</h4>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Synchronized to ATLAS Scheduling Engine</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-primary">
                      {designationForm.isTeachingExempt ? 0 : Math.max(0, (Number(designationForm.customTargetTeachingHoursPerWeek) || 30) - (Number(designationForm.advisoryEquivalentHoursPerWeek) || 0))}
                    </span>
                    <span className="text-xs font-bold text-primary ml-1 uppercase">hrs</span>
                  </div>
                </div>

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
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{section.sectionName}</span>
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {section.enrolledCount}/{section.maxCapacity}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAdvisorySection?.currentAdviserName &&
                    selectedAdvisorySection.currentAdviserId !==
                      designationOpenFor?.id ? (
                      <p className="text-[0.6875rem] text-amber-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Currently assigned to{" "}
                        {selectedAdvisorySection.currentAdviserName}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      Advisory Equivalent Hours / Week
                    </Label>
                    <div className="relative group">
                      <Input
                        type="text"
                        value={
                          designationForm.isClassAdviser ? "🔒 5.0 HRS" : "0.0"
                        }
                        className="bg-muted/50 font-black text-primary border-primary/20 cursor-not-allowed h-9"
                        readOnly
                        disabled
                      />
                      {designationForm.isClassAdviser && (
                        <p className="text-[10px] text-primary/70 mt-1 font-bold italic">
                          (Standardized DepEd Advisory Load)
                        </p>
                      )}
                    </div>
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
            </motion.div>
          </TabsContent>

            <TabsContent
              value="schedule-notes"
              className="mt-0 focus-visible:outline-none ring-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4">
                <div className="rounded-md border bg-card p-3 sm:p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 border-b pb-3 mb-1">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="isCustomPeriod"
                        className="text-xs uppercase tracking-wider font-black">
                        Custom Designation Period
                      </Label>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                        Enable for mid-year replacements or leave of absence
                      </p>
                    </div>
                    <Switch
                      id="isCustomPeriod"
                      checked={designationForm.isCustomPeriod}
                      onCheckedChange={(checked) =>
                        setDesignationForm((prev) => ({
                          ...prev,
                          isCustomPeriod: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider flex items-center gap-1.5">
                        Effective From
                        {!designationForm.isCustomPeriod && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black italic">
                            AUTO (BOSY)
                          </span>
                        )}
                      </Label>
                      <div className="relative group">
                        <Input
                          type="date"
                          value={designationForm.effectiveFrom}
                          onChange={(event) =>
                            setDesignationForm((prev) => ({
                              ...prev,
                              effectiveFrom: event.target.value,
                            }))
                          }
                          disabled={!designationForm.isCustomPeriod}
                          className={
                            !designationForm.isCustomPeriod
                              ? "bg-muted/50 border-dashed"
                              : ""
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider flex items-center gap-1.5">
                        Effective To
                        {!designationForm.isCustomPeriod && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black italic">
                            AUTO (EOSY)
                          </span>
                        )}
                      </Label>
                      <div className="relative group">
                        <Input
                          type="date"
                          value={designationForm.effectiveTo}
                          onChange={(event) =>
                            setDesignationForm((prev) => ({
                              ...prev,
                              effectiveTo: event.target.value,
                            }))
                          }
                          disabled={!designationForm.isCustomPeriod}
                          className={
                            !designationForm.isCustomPeriod
                              ? "bg-muted/50 border-dashed"
                              : ""
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-card p-3 sm:p-4 space-y-4">
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
              </motion.div>
            </TabsContent>

            <TabsContent
              value="review"
              className="mt-0 focus-visible:outline-none ring-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4">
                <div className="rounded-md border bg-card overflow-hidden">
                  <div className="bg-primary/5 px-4 py-3 border-b space-y-1">
                    <h4 className="text-xs font-black uppercase text-primary tracking-wider">
                      Designation Summary: {designationOpenFor?.lastName},{" "}
                      {designationOpenFor?.firstName}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tight flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      Effective:{" "}
                      {designationForm.isCustomPeriod ? (
                        <>
                          {designationForm.effectiveFrom || "N/A"} to{" "}
                          {designationForm.effectiveTo || "N/A"}
                        </>
                      ) : (
                        "BOSY to EOSY (Standard Academic Year)"
                      )}
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Base Academic Load (from Atlas Engine)
                      </span>
                      <span className="font-black">
                        {Math.max(
                          0,
                          (Number(
                            designationForm.customTargetTeachingHoursPerWeek,
                          ) || 30) -
                            (designationForm.isClassAdviser ? 5 : 0),
                        )}{" "}
                        Hrs / Week
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Class Adviser ({selectedAdvisorySection?.label ?? "N/A"})
                      </span>
                      <span className="font-black">
                        {designationForm.isClassAdviser ? 5 : 0} Hrs / Week
                      </span>
                    </div>
                    <div className="border-t pt-3 flex justify-between text-base">
                      <span className="font-black uppercase tracking-tight">
                        Total Designated Load
                      </span>
                      <span className="font-black text-primary">
                        {designationForm.isTeachingExempt
                          ? 0
                          : Number(
                              designationForm.customTargetTeachingHoursPerWeek,
                            ) || 30}{" "}
                        Hrs / Week
                      </span>
                    </div>
                  </div>

                  {!designationForm.isTeachingExempt && (() => {
                    const total = Number(designationForm.customTargetTeachingHoursPerWeek) || 30;
                    if (total > 30) {
                      return (
                        <div className="bg-amber-50 px-4 py-3 border-t flex items-start gap-2 text-[11px] text-amber-800 font-bold uppercase tracking-tight">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <p>
                            LEGAL OVERLOAD ({total} Hrs): Exceeding the 30-hour limit under R.A. 4670 
                            requires signed conformity for overload pay.
                          </p>
                        </div>
                      );
                    }
                    if (total === 30) {
                      return (
                        <div className="bg-blue-50 px-4 py-3 border-t flex items-start gap-2 text-[11px] text-blue-800 font-bold uppercase tracking-tight">
                          <Info className="h-4 w-4 shrink-0 text-blue-600" />
                          <p>
                            ℹ️ STANDARD FULL LOAD: This designation exactly meets the 30-hour standard 
                            teaching threshold under R.A. 4670. No overload pay required.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-muted/30 px-4 py-3 border-t flex items-start gap-2 text-[11px] text-muted-foreground font-bold uppercase tracking-tight">
                        <Info className="h-4 w-4 shrink-0" />
                        <p>
                          UNDERLOAD STATUS ({total} Hrs): Teacher load is below the 30-hour 
                          standard teaching threshold.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {designationCollision ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 sm:px-4 sm:py-4 text-amber-900 space-y-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                      <div className="text-sm">
                        <p className="font-black uppercase tracking-tight">
                          Adviser conflict detected
                        </p>
                        <p className="text-xs font-medium">
                          {designationCollision.gradeLevelName ?? "Grade"} -{" "}
                          {designationCollision.sectionName} is currently
                          assigned to {designationCollision.currentAdviserName}.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <Label
                        htmlFor="allowCollisionOverride"
                        className="text-[11px] font-black uppercase tracking-tight text-amber-800">
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
                  <div className="rounded-md border bg-emerald-50 border-emerald-100 px-3 py-3 text-xs text-emerald-800 flex items-center gap-2 font-bold uppercase tracking-tight">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    SYSTEM CHECK: No scheduling or advisory collisions
                    detected.
                  </div>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t px-3 sm:px-4 py-3 sm:py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between items-center shrink-0 bg-background">
          <div>
            {designationDrawerTab !== "role-load" && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (designationDrawerTab === "review") setDesignationDrawerTab("schedule-notes");
                  else if (designationDrawerTab === "schedule-notes") setDesignationDrawerTab("role-load");
                }}
                disabled={submitting}
                className="w-full sm:w-auto font-black uppercase text-xs tracking-widest gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto font-black uppercase text-xs tracking-widest">
              Cancel
            </Button>

            {designationDrawerTab === "review" ? (
              <Button
                onClick={onSave}
                disabled={submitting || !ayId}
                className="w-full sm:w-auto font-black uppercase text-xs tracking-widest gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save Designation
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (designationDrawerTab === "role-load") setDesignationDrawerTab("schedule-notes");
                  else if (designationDrawerTab === "schedule-notes") setDesignationDrawerTab("review");
                }}
                disabled={submitting}
                className="w-full sm:w-auto font-black uppercase text-xs tracking-widest gap-2">
                Next Step <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
