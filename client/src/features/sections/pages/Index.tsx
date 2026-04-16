import { useState, useEffect, useCallback } from "react";
import { sileo } from "sileo";
import {
  Plus,
  Trash2,
  Grid3X3,
  X,
  Check,
  Edit2,
  CalendarDays,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
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
import { Skeleton } from "@/shared/ui/skeleton";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

interface Teacher {
  id: number;
  name: string;
  employeeId: string | null;
}

interface SectionItem {
  id: number;
  name: string;
  programType: string;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
  advisingTeacher: { id: number; name: string } | null;
}

interface GradeLevelGroup {
  gradeLevelId: number;
  gradeLevelName: string;
  displayOrder: number;
  sections: SectionItem[];
}

const PROGRAM_TYPE_OPTIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE" },
  { value: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA" },
  { value: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS" },
  { value: "SPECIAL_PROGRAM_IN_JOURNALISM", label: "SPJ" },
  { value: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE", label: "SPFL" },
  {
    value: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    label: "SPTVE",
  },
];

function formatProgramType(programType: string): string {
  return (
    PROGRAM_TYPE_OPTIONS.find((option) => option.value === programType)
      ?.label ?? programType
  );
}

function fillColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-orange-400";
  if (pct >= 50) return "bg-yellow-400";
  return "bg-green-500";
}

function fillEmoji(pct: number): string {
  if (pct >= 90) return "🔴";
  if (pct >= 75) return "🟠";
  if (pct >= 50) return "🟡";
  return "🟢";
}

export default function Sections() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [groups, setGroups] = useState<GradeLevelGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  // Inline add section state
  const [addGlId, setAddGlId] = useState<number | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [sectionCap, setSectionCap] = useState("40");
  const [sectionProgramType, setSectionProgramType] =
    useState<string>("REGULAR");
  const [advisingTeacherId, setAdvisingTeacherId] = useState<string>("none");
  const [adding, setAdding] = useState(false);

  // Edit section state
  const [editSection, setEditSection] = useState<SectionItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCap, setEditCap] = useState("40");
  const [editProgramType, setEditProgramType] = useState<string>("REGULAR");
  const [editAdvisingTeacherId, setEditAdvisingTeacherId] =
    useState<string>("none");
  const [editing, setEditing] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [res, teachersRes] = await Promise.all([
        api.get(`/sections/${ayId}`),
        api.get("/sections/teachers"),
      ]);
      setGroups(res.data.gradeLevels);
      setTeachers(teachersRes.data.teachers);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleAddMode = (glId: number) => {
    if (addGlId === glId) {
      setAddGlId(null);
    } else {
      setAddGlId(glId);
      setSectionName("");
      setSectionCap("40");
      setSectionProgramType("REGULAR");
      setAdvisingTeacherId("none");
    }
  };

  const handleAdd = async () => {
    if (!addGlId || !sectionName.trim()) return;
    setAdding(true);
    try {
      await api.post("/sections", {
        name: sectionName.trim(),
        maxCapacity: parseInt(sectionCap) || 40,
        gradeLevelId: addGlId,
        programType: sectionProgramType,
        advisingTeacherId:
          advisingTeacherId === "none" ? null : parseInt(advisingTeacherId),
      });
      sileo.success({
        title: "Section Added",
        description: sectionName.trim(),
      });
      setAddGlId(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (section: SectionItem) => {
    setEditSection(section);
    setEditName(section.name);
    setEditCap(section.maxCapacity.toString());
    setEditProgramType(section.programType ?? "REGULAR");
    setEditAdvisingTeacherId(
      section.advisingTeacher ? section.advisingTeacher.id.toString() : "none",
    );
  };

  const handleEdit = async () => {
    if (!editSection || !editName.trim()) return;
    setEditing(true);
    try {
      await api.put(`/sections/${editSection.id}`, {
        name: editName.trim(),
        maxCapacity: parseInt(editCap) || 40,
        programType: editProgramType,
        advisingTeacherId:
          editAdvisingTeacherId === "none"
            ? null
            : parseInt(editAdvisingTeacherId),
      });
      sileo.success({ title: "Section Updated", description: editName.trim() });
      setEditSection(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/sections/${deleteId}`);
      sileo.success({ title: "Deleted", description: deleteName });
      setDeleteId(null);
      fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setDeleting(false);
    }
  };

  if (!ayId) {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">
                No School Year Selected
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
                Please set an active year or choose one from the header switcher
                to manage records for this period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sections</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Manage grade level sections and advising teachers
          </p>
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-80" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-12 w-full rounded-lg" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Capacity Heatmap overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Grid3X3 className="h-5 w-5" />
                Capacity Heatmap
              </CardTitle>
              <CardDescription>
                Visual overview of section fill rates. 🟢 &lt;50% · 🟡 50-74% ·
                🟠 75-89% · 🔴 90%+
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                  No grade levels found for this School Year.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.flatMap((g) =>
                    g.sections.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3">
                        <span className="text-lg">
                          {fillEmoji(s.fillPercent)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {g.gradeLevelName} — {s.name} (
                            {formatProgramType(s.programType)})
                          </p>
                          <div className="mt-1 h-2 w-full rounded-full bg-[hsl(var(--muted))]">
                            <div
                              className={`h-2 rounded-full transition-all ${fillColor(s.fillPercent)}`}
                              style={{
                                width: `${Math.min(s.fillPercent, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs  text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                          {s.enrolledCount}/{s.maxCapacity}
                        </span>
                      </div>
                    )),
                  )}
                  {groups.every((g) => g.sections.length === 0) && (
                    <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                      No sections created yet. Add sections to grade levels
                      below.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sections grouped by grade level */}
          <div className="grid gap-6 md:grid-cols-2">
            {groups.map((g) => (
              <Card key={g.gradeLevelId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {g.gradeLevelName}
                    </CardTitle>
                    <Button
                      size="sm"
                      variant={addGlId === g.gradeLevelId ? "ghost" : "outline"}
                      onClick={() => toggleAddMode(g.gradeLevelId)}>
                      {addGlId === g.gradeLevelId ? (
                        <>
                          <X className="mr-1 h-3 w-3" /> Cancel
                        </>
                      ) : (
                        <>
                          <Plus className="mr-1 h-3 w-3" /> Add Section
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {addGlId === g.gradeLevelId && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Section Name</Label>
                          <Input
                            placeholder="e.g. Section A"
                            value={sectionName}
                            onChange={(e) => setSectionName(e.target.value)}
                            className="h-9 text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Max Capacity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={sectionCap}
                            onChange={(e) => setSectionCap(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-xs">Program Type</Label>
                          <Select
                            value={sectionProgramType}
                            onValueChange={setSectionProgramType}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select program" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROGRAM_TYPE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-xs">
                            Advising Teacher (Optional)
                          </Label>
                          <Select
                            value={advisingTeacherId}
                            onValueChange={setAdvisingTeacherId}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select teacher" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                No Advising Teacher
                              </SelectItem>
                              {teachers.map((t) => (
                                <SelectItem key={t.id} value={t.id.toString()}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={handleAdd}
                        disabled={adding || !sectionName.trim()}>
                        {adding ? (
                          "Adding..."
                        ) : (
                          <>
                            <Check className="mr-1 h-3 w-3" /> Save Section
                          </>
                        )}
                      </Button>
                      <Separator />
                    </div>
                  )}

                  {g.sections.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-2">
                      No sections
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {g.sections.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                          <span className="text-sm">
                            {fillEmoji(s.fillPercent)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {s.name}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                              {formatProgramType(s.programType)}
                            </p>
                          </div>
                          {s.advisingTeacher && (
                            <span
                              className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-25"
                              title={s.advisingTeacher.name}>
                              {s.advisingTeacher.name}
                            </span>
                          )}
                          <span className="text-xs  text-[hsl(var(--muted-foreground))]">
                            {s.enrolledCount}/{s.maxCapacity} ({s.fillPercent}%)
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(s)}
                            title="Edit section">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-[hsl(var(--destructive))]"
                            onClick={() => {
                              setDeleteId(s.id);
                              setDeleteName(s.name);
                            }}
                            disabled={s.enrolledCount > 0}
                            title={
                              s.enrolledCount > 0
                                ? "Cannot delete — has enrolled students"
                                : "Delete section"
                            }>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Edit Section Dialog */}
      <Dialog
        open={!!editSection}
        onOpenChange={(open) => !open && setEditSection(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Name</Label>
              <Input
                placeholder="e.g. Section A"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Capacity</Label>
              <Input
                type="number"
                min="1"
                value={editCap}
                onChange={(e) => setEditCap(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Program Type</Label>
              <Select
                value={editProgramType}
                onValueChange={setEditProgramType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Advising Teacher</Label>
              <Select
                value={editAdvisingTeacherId}
                onValueChange={setEditAdvisingTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Advising Teacher</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSection(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editing || !editName.trim()}>
              {editing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Section"
        description={`Are you sure you want to delete the section "${deleteName}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        variant="danger"
      />
    </div>
  );
}
