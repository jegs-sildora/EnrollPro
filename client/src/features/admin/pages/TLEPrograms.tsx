import { useState, useEffect, useCallback } from "react";
import { sileo } from "sileo";
import { Plus, Edit2, PowerOff, RefreshCw, BookOpen } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import type { AxiosError } from "axios";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";

interface TLEProgram {
  id: number;
  name: string;
  category: string;
  trackType: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const TLE_CATEGORIES = [
  { value: "HOME_ECONOMICS", label: "Home Economics (HE)" },
  { value: "INDUSTRIAL_ARTS", label: "Industrial Arts (IA)" },
  { value: "AGRI_FISHERY_ARTS", label: "Agri-Fishery Arts (AFA)" },
  { value: "ICT", label: "Information & Communications Technology (ICT)" },
];

const TLE_TRACK_TYPES = [
  { value: "EXPLORATORY", label: "Exploratory (G7/G8)" },
  { value: "SPECIALIZATION", label: "Specialization (NC II)" },
];

function categoryLabel(cat: string): string {
  return TLE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

const EMPTY_FORM = {
  name: "",
  category: "",
  trackType: "SPECIALIZATION",
  displayOrder: 0,
  isActive: true,
};

export default function TLEPrograms() {
  const [programs, setPrograms] = useState<TLEProgram[]>([]);
  const [loading, setLoading] = useState(false);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TLEProgram | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Deactivate modal state
  const [deactivateTarget, setDeactivateTarget] = useState<TLEProgram | null>(
    null,
  );
  const [deactivating, setDeactivating] = useState(false);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ programs: TLEProgram[] }>(
        "/admin/tle-programs",
      );
      setPrograms(res.data.programs);
    } catch (e) {
      toastApiError(
        e as AxiosError<{
          message?: string;
          errors?: Record<string, string[]>;
        }>,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrograms();
  }, [fetchPrograms]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, displayOrder: programs.length + 1 });
    setSheetOpen(true);
  };

  const openEdit = (p: TLEProgram) => {
    setEditTarget(p);
    setForm({
      name: p.name,
      category: p.category,
      trackType: p.trackType,
      displayOrder: p.displayOrder,
      isActive: p.isActive,
    });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.category || !form.trackType) return;
    setSubmitting(true);
    try {
      if (editTarget) {
        await api.put(`/admin/tle-programs/${editTarget.id}`, form);
        sileo.success({ title: "TLE Program updated" });
      } else {
        await api.post("/admin/tle-programs", form);
        sileo.success({ title: "TLE Program created" });
      }
      setSheetOpen(false);
      void fetchPrograms();
    } catch (e) {
      toastApiError(
        e as AxiosError<{
          message?: string;
          errors?: Record<string, string[]>;
        }>,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await api.patch(`/admin/tle-programs/${deactivateTarget.id}/deactivate`);
      sileo.success({ title: "TLE Program deactivated" });
      setDeactivateTarget(null);
      void fetchPrograms();
    } catch (e) {
      toastApiError(
        e as AxiosError<{
          message?: string;
          errors?: Record<string, string[]>;
        }>,
      );
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">TLE Programs</h1>
          <p className="text-sm font-bold text-muted-foreground">
            Manage Technology and Livelihood Education specializations for Grade
            9 and Grade 10
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => void fetchPrograms()}
            disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={openCreate}
            className="gap-2 font-bold">
            <Plus className="h-4 w-4" />
            Add TLE Program
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            TLE Specializations ({programs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-black uppercase text-xs text-muted-foreground py-2 pr-4">
                    #
                  </th>
                  <th className="text-left font-black uppercase text-xs text-muted-foreground py-2 pr-4">
                    Program Name
                  </th>
                  <th className="text-left font-black uppercase text-xs text-muted-foreground py-2 pr-4">
                    Category
                  </th>
                  <th className="text-left font-black uppercase text-xs text-muted-foreground py-2 pr-4">
                    Track Type
                  </th>
                  <th className="text-left font-black uppercase text-xs text-muted-foreground py-2 pr-4">
                    Status
                  </th>
                  <th className="text-right font-black uppercase text-xs text-muted-foreground py-2">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {programs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground text-sm font-bold">
                      {loading ? "Loading..." : "No TLE programs found."}
                    </td>
                  </tr>
                )}
                {programs.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4 font-bold text-muted-foreground">
                      {p.displayOrder}
                    </td>
                    <td className="py-3 pr-4 font-bold">{p.name}</td>
                    <td className="py-3 pr-4">
                      <span className="text-xs font-bold text-muted-foreground">
                        {categoryLabel(p.category)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant="outline"
                        className="font-bold text-[10px] uppercase">
                        {p.trackType.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={p.isActive ? "default" : "secondary"}
                        className="font-bold text-xs">
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit"
                          onClick={() => openEdit(p)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        {p.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Deactivate"
                            onClick={() => setDeactivateTarget(p)}>
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col">
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="font-black uppercase text-base">
              {editTarget ? "Edit TLE Program" : "Add TLE Program"}
            </SheetTitle>
            <SheetDescription className="font-bold text-sm">
              {editTarget
                ? `Updating "${editTarget.name}"`
                : "Create a new TLE specialization for assignment to Grade 9 and Grade 10 sections and learners."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">
                Program Name *
              </Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g., HE - Cookery"
                className="font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">Category *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="font-bold">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TLE_CATEGORIES.map((c) => (
                    <SelectItem
                      key={c.value}
                      value={c.value}
                      className="font-bold text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">
                Track Type *
              </Label>
              <Select
                value={form.trackType}
                onValueChange={(v) => setForm((f) => ({ ...f, trackType: v }))}>
                <SelectTrigger className="font-bold">
                  <SelectValue placeholder="Select track type" />
                </SelectTrigger>
                <SelectContent>
                  {TLE_TRACK_TYPES.map((t) => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                      className="font-bold text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">
                Display Order
              </Label>
              <Input
                type="number"
                value={form.displayOrder}
                min={1}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    displayOrder: parseInt(e.target.value) || 0,
                  }))
                }
                className="font-bold"
              />
              <p className="text-[10px] text-muted-foreground font-bold italic">
                Lower numbers appear first in program lists.
              </p>
            </div>

            {editTarget && (
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase">Status</Label>
                <Select
                  value={form.isActive ? "active" : "inactive"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, isActive: v === "active" }))
                  }>
                  <SelectTrigger className="font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="active"
                      className="font-bold text-xs">
                      Active
                    </SelectItem>
                    <SelectItem
                      value="inactive"
                      className="font-bold text-xs">
                      Inactive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <SheetFooter className="border-t pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={submitting}
              className="font-bold uppercase">
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={
                submitting ||
                !form.name.trim() ||
                !form.category ||
                !form.trackType
              }
              className="font-black uppercase">
              {submitting
                ? "Saving..."
                : editTarget
                  ? "Save Changes"
                  : "Create Program"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmationModal
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate TLE Program"
        description={`Are you sure you want to deactivate "${deactivateTarget?.name}"? It will no longer appear in selection lists. This will fail if active learners are currently assigned to this program.`}
        confirmText="Deactivate"
        loading={deactivating}
        onConfirm={() => void handleDeactivate()}
        variant="danger"
      />
    </div>
  );
}
