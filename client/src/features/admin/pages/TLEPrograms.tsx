import { useState, useEffect, useCallback, useMemo } from "react";
import { sileo } from "sileo";
import { Plus, Edit2, PowerOff, RefreshCw, BookOpen, FlaskConical } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import type { AxiosError } from "axios";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { motion } from "motion/react";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import {
  AddTleProgramModal,
  type TLEProgramFormState,
} from "../components/AddTleProgramModal";

interface TLEProgram {
  id: number;
  name: string;
  category: string;
  trackType: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const ALL_CATEGORIES = [
  { value: "HOME_ECONOMICS", label: "Home Economics (HE)" },
  { value: "INDUSTRIAL_ARTS", label: "Industrial Arts (IA)" },
  { value: "AGRI_FISHERY_ARTS", label: "Agri-Fishery Arts (AFA)" },
  { value: "ICT", label: "Information & Communications Technology (ICT)" },
  { value: "GENERAL", label: "General / Multi-Sector" },
];

function categoryLabel(cat: string): string {
  return ALL_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

const EMPTY_FORM: TLEProgramFormState = {
  name: "",
  category: "",
  trackType: "SPECIALIZATION",
  isActive: true,
};

type ActiveTab = "SPECIALIZATION" | "EXPLORATORY";

const TABS: { id: ActiveTab; label: string; sublabel: string; icon: React.ElementType }[] = [
  {
    id: "EXPLORATORY",
    label: "Exploratory Programs",
    sublabel: "Grades 7 & 8",
    icon: FlaskConical,
  },
  {
    id: "SPECIALIZATION",
    label: "Specializations",
    sublabel: "Grades 9 & 10",
    icon: BookOpen,
  },
];

export default function TLEPrograms() {
  const [programs, setPrograms] = useState<TLEProgram[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("EXPLORATORY");

  const specializationPrograms = useMemo(
    () =>
      [...programs]
        .filter((p) => p.trackType === "SPECIALIZATION")
        .sort((a, b) =>
          a.category !== b.category
            ? a.category.localeCompare(b.category)
            : a.name.localeCompare(b.name),
        ),
    [programs],
  );

  const exploratoryPrograms = useMemo(
    () =>
      [...programs]
        .filter((p) => p.trackType === "EXPLORATORY")
        .sort((a, b) =>
          a.category !== b.category
            ? a.category.localeCompare(b.category)
            : a.name.localeCompare(b.name),
        ),
    [programs],
  );

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TLEProgram | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Deactivate modal state
  const [deactivateTarget, setDeactivateTarget] = useState<TLEProgram | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ programs: TLEProgram[] }>("/admin/tle-programs");
      setPrograms(res.data.programs);
    } catch (e) {
      toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrograms();
  }, [fetchPrograms]);

  const openCreate = () => {
    setEditTarget(null);
    // Pre-fill trackType based on the active tab so the modal opens on the right type
    setForm({ ...EMPTY_FORM, trackType: activeTab });
    setSheetOpen(true);
  };

  const openEdit = (p: TLEProgram) => {
    setEditTarget(p);
    setForm({
      name: p.name,
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
      toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
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
      toastApiError(e as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
    } finally {
      setDeactivating(false);
    }
  };

  const columns: ColumnDef<TLEProgram>[] = [
    {
      id: "index",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="#" className="font-black" />
      ),
      cell: ({ row }) => <span className="font-bold">{row.index + 1}</span>,
      size: 60,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Program Name" />
      ),
      cell: ({ row }) => <span className="font-bold">{row.original.name}</span>,
      size: 360,
    },
    {
      id: "category",
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category / Sector" />
      ),
      cell: ({ row }) => (
        <span className="text-xs font-bold text-muted-foreground">
          {categoryLabel(row.original.category)}
        </span>
      ),
      size: 220,
    },
    {
      id: "status",
      accessorKey: "isActive",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge
          variant={row.original.isActive ? "default" : "secondary"}
          className="font-bold text-xs">
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
      size: 120,
    },
    {
      id: "actions",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actions" className="text-right" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Edit"
            onClick={() => openEdit(row.original)}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          {row.original.isActive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Deactivate"
              onClick={() => setDeactivateTarget(row.original)}>
              <PowerOff className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
      size: 160,
    },
  ];

  return (
    <div className="flex flex-col w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">TLE Programs</h1>
          <p className="text-sm font-bold text-muted-foreground">
            Manage global TLE curriculums including Grade 7-8 Exploratory modules and Grade 9-10 Specializations.
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
          <Button onClick={openCreate} className="gap-2 font-bold">
            <Plus className="h-4 w-4" />
            Add TLE Program
          </Button>
        </div>
      </div>

      {/* ── Curriculum Tab Switcher + Content ── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ActiveTab)}
        className="w-full space-y-4">
        <TabsList className="w-full flex gap-1 h-auto p-1 bg-white border-border relative">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count =
              tab.id === "SPECIALIZATION"
                ? specializationPrograms.length
                : exploratoryPrograms.length;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex flex-1 items-center justify-center gap-2.5 px-4 py-2.5 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {isActive && (
                  <motion.div
                    layoutId="tle-active-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Icon
                  className={cn(
                    "relative z-20 h-4 w-4 shrink-0",
                    isActive ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                />
                <div className="relative z-20 flex flex-col items-start min-w-0">
                  <span className="text-xs font-black uppercase leading-none truncate">
                    {tab.label}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold leading-none mt-0.5",
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}>
                    {tab.sublabel}
                  </span>
                </div>
                <Badge
                  variant={isActive ? "secondary" : "secondary"}
                  className={cn(
                    "relative z-20 ml-auto text-[10px] font-black h-5 px-1.5",
                    isActive && "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20",
                  )}>
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="EXPLORATORY" className="mt-0 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <FlaskConical className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs font-bold text-amber-700">
              <span className="font-black uppercase">Curriculum Segregation Active — </span>
              Exploratory programs are exclusively used for Grade 7 & 8 rotation schedules.
              They are never exposed to Grade 9/10 TLE sectioning, learner track selection, or BOSY workflows.
            </p>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                Exploratory Programs ({exploratoryPrograms.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <DataTable<TLEProgram, unknown>
                  columns={columns}
                  data={exploratoryPrograms}
                  tableClassName="min-w-full"
                  loading={loading}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="SPECIALIZATION" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Specializations ({specializationPrograms.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <DataTable<TLEProgram, unknown>
                  columns={columns}
                  data={specializationPrograms}
                  tableClassName="min-w-full"
                  loading={loading}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
