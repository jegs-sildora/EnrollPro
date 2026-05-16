import { useState, useEffect, useCallback, useMemo } from "react";
import { sileo } from "sileo";
import { Plus, Edit2, PowerOff, RefreshCw, BookOpen } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import type { AxiosError } from "axios";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  AddTleProgramModal,
  type TLEProgramFormState,
} from "../components/AddTleProgramModal";

interface TLEProgram {
  id: number;
  name: string;
  programCode: string;
  category: string;
  trackType: string;
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

function categoryLabel(cat: string): string {
  return TLE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

const EMPTY_FORM: TLEProgramFormState = {
  name: "",
  programCode: "",
  category: "",
  trackType: "SPECIALIZATION",
  isActive: true,
};

export default function TLEPrograms() {
  const [programs, setPrograms] = useState<TLEProgram[]>([]);
  const [loading, setLoading] = useState(false);

  const specializationPrograms = useMemo(
    () =>
      [...programs]
        .filter((program) => program.trackType === "SPECIALIZATION")
        .sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.name.localeCompare(b.name);
        }),
    [programs],
  );

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
    setForm(EMPTY_FORM);
    setSheetOpen(true);
  };

  const openEdit = (p: TLEProgram) => {
    setEditTarget(p);
    setForm({
      name: p.name,
      programCode: p.programCode,
      category: p.category,
      trackType: p.trackType,
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
            TLE Specializations ({specializationPrograms.length})
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
                    Code
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
                {specializationPrograms.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground text-sm font-bold">
                      {loading
                        ? "Loading..."
                        : "No TLE specializations found."}
                    </td>
                  </tr>
                )}
                {specializationPrograms.map((p, index) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4 font-bold text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-3 pr-4 font-bold">{p.name}</td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant="outline"
                        className="font-mono font-bold text-[10px] uppercase">
                        {p.programCode}
                      </Badge>
                    </td>
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

      <AddTleProgramModal
        open={sheetOpen}
        submitting={submitting}
        editProgramName={editTarget?.name}
        form={form}
        onOpenChange={setSheetOpen}
        onCancel={() => setSheetOpen(false)}
        onSubmit={() => void handleSubmit()}
        onChange={setForm}
      />

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
