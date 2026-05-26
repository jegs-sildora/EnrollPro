import {
  useState,
  useCallback,
  useEffect,
  startTransition,
  useMemo,
  useRef,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Loader2,
  CheckCircle2,
  Search,
  FileCheck2,
  FileClock,
  X,
  AlertTriangle,
  ShieldX,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/shared/ui/sheet";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { cn } from "@/shared/lib/utils";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { lifecycleFeedback } from "@/shared/lib/lifecycle-feedback";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import {
  getReducedMotionProps,
  panelTransition,
  sectionVariants,
} from "@/shared/lib/motion";
import {
  getPhase2Queue,
  apiConfirmScpSlot,
  apiVerifyBeef,
  apiMarkBeefPending,
  apiResolveBeef,
} from "../api/bosy.api";
import type { Phase2QueueItem } from "../types";

// ── Constants ──────────────────────────────────────────────────────────────

const SCP_CHECKLIST_ITEMS = [
  "PSA Birth Certificate",
  "Form 138 / Report Card",
  "Certificate of Good Moral Character",
  "Medical Certificate",
  "2×2 Photo (2 copies)",
  "Accomplished SCP Application Form",
];

const BEEF_CHECKLIST_ITEMS = [
  "BEEF Form (completed & signed)",
  "PSA Birth Certificate",
  "Form 138 / Report Card",
  "Certificate of Good Moral Character",
  "2×2 Photo (1 copy)",
];

const PHASE2_TABS = [
  {
    key: "scp_priority" as const,
    label: "SCP Priority",
    description: "Passed SCP screening — returning to submit physical BEEF",
    status: ["READY_FOR_ENROLLMENT"],
    admissionChannel: undefined as "ONLINE" | "F2F" | undefined,
  },
  {
    key: "online_beef" as const,
    label: "Online BEEF",
    description: "Digital BEEF submitted via Learner Portal",
    status: ["SUBMITTED_BEEF"],
    admissionChannel: "ONLINE" as "ONLINE" | "F2F" | undefined,
  },
  {
    key: "walkin_beef" as const,
    label: "Walk-In BEEF",
    description: "Paper BEEF encoded on-site (F2F)",
    status: ["SUBMITTED_BEEF"],
    admissionChannel: "F2F" as "ONLINE" | "F2F" | undefined,
  },
  {
    key: "pending_beef" as const,
    label: "Pending / Incomplete",
    description: "BEEF submitted but documents are missing",
    status: ["PENDING_BEEF"],
    admissionChannel: undefined as "ONLINE" | "F2F" | undefined,
  },
];

type Phase2TabKey = (typeof PHASE2_TABS)[number]["key"];

// ── Column builder (per-tab) ────────────────────────────────────────────────

function buildColumns(
  tabKey: Phase2TabKey,
  canMutate: boolean,
  onOpen: (item: Phase2QueueItem) => void,
): ColumnDef<Phase2QueueItem>[] {
  const cols: ColumnDef<Phase2QueueItem>[] = [
    {
      accessorKey: "lrn",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="LRN" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.lrn ?? (
            <em className="opacity-50 not-italic">No LRN</em>
          )}
        </span>
      ),
    },
    {
      id: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Learner" />
      ),
      cell: ({ row }) => {
        const { lastName, firstName, middleName } = row.original;
        const display = [lastName, firstName].filter(Boolean).join(", ");
        return (
          <div>
            <p className="font-bold text-sm">{display}</p>
            {middleName && (
              <p className="text-xs text-muted-foreground">{middleName}</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "gradeLevelName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Grade" />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs font-semibold">
          {row.original.gradeLevelName}
        </Badge>
      ),
    },
  ];

  if (tabKey === "scp_priority") {
    cols.push({
      accessorKey: "applicantType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Program" />
      ),
      cell: ({ row }) => (
        <Badge className="text-xs font-bold">{row.original.applicantType}</Badge>
      ),
    });
  }

  if (tabKey === "online_beef" || tabKey === "walkin_beef") {
    cols.push({
      accessorKey: "learnerType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        const t = row.original.learnerType;
        const label =
          t === "NEW_ENROLLEE"
            ? "New"
            : t === "TRANSFEREE"
              ? "Transfer"
              : t === "RETURNING"
                ? "Returning"
                : t;
        return (
          <Badge variant="outline" className="text-xs">
            {label}
          </Badge>
        );
      },
    });
  }

  if (tabKey === "pending_beef") {
    cols.push({
      id: "status_badge",
      header: "Status",
      cell: () => (
        <Badge variant="destructive" className="text-xs font-bold">
          Incomplete
        </Badge>
      ),
    });
  }

  cols.push({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const missingPhilIri = row.original.readingProfileLevel === null;
      return canMutate ? (
        <div className="flex items-center justify-end gap-1.5 pr-2">
          {missingPhilIri && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
              <ShieldX className="h-3 w-3 shrink-0" />
              Phil-IRI Required
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 px-3 text-xs font-bold",
              missingPhilIri && "opacity-40 cursor-not-allowed",
            )}
            disabled={missingPhilIri}
            onClick={() => onOpen(row.original)}
          >
            Confirm Enrollment
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic text-right block pr-2">
          Read-only
        </span>
      );
    },
  });

  return cols;
}

// ── Action Drawer ───────────────────────────────────────────────────────────

interface DrawerProps {
  item: Phase2QueueItem;
  tabKey: Phase2TabKey;
  busy: boolean;
  heightCm: string;
  weightKg: string;
  onHeightChange: (v: string) => void;
  onWeightChange: (v: string) => void;
  onConfirmScp: (pendingDocs: boolean) => void;
  onVerifyBeef: () => void;
  onMarkPending: () => void;
  onConfirmWalkIn: () => void;
  onResolve: () => void;
  onClose: () => void;
}

function IntakeActionDrawer({
  item,
  tabKey,
  busy,
  heightCm,
  weightKg,
  onHeightChange,
  onWeightChange,
  onConfirmScp,
  onVerifyBeef,
  onMarkPending,
  onConfirmWalkIn,
  onResolve,
  onClose,
}: DrawerProps) {
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const fullName = [item.lastName, item.firstName, item.middleName]
    .filter(Boolean)
    .join(", ");

  const toggle = (doc: string) =>
    setChecklist((prev) => ({ ...prev, [doc]: !prev[doc] }));

  const checklistItems =
    tabKey === "scp_priority" ? SCP_CHECKLIST_ITEMS : BEEF_CHECKLIST_ITEMS;

  const missingPhilIri = item.readingProfileLevel === null;
  const isNonReaderScp =
    tabKey === "scp_priority" && item.readingProfileLevel === "NON_READER";
  const blockConfirm = missingPhilIri;

  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Applicant summary */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-1">
          <p className="font-bold text-sm">{fullName}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {item.gradeLevelName}
            </Badge>
            {item.lrn && (
              <span className="font-mono text-xs text-muted-foreground">
                {item.lrn}
              </span>
            )}
            {item.applicantType && (
              <Badge className="text-xs">{item.applicantType}</Badge>
            )}
            {item.readingProfileLevel && (
              <Badge variant="outline" className="text-xs font-semibold">
                {item.readingProfileLevel.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>

        {/* Phil-IRI gate banner */}
        {blockConfirm && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
            <ShieldX className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">
              <p className="font-bold">Phil-IRI Assessment Required</p>
              <p className="mt-0.5 opacity-80">
                A Phil-IRI reading profile must be recorded before this
                application can be confirmed. Please complete the assessment
                first.
              </p>
            </div>
          </div>
        )}

        {/* NON_READER + SCP soft warning */}
        {isNonReaderScp && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700">
              <p className="font-bold">NON_READER Assigned to SCP Track</p>
              <p className="mt-0.5 opacity-80">
                This learner is classified as NON_READER. Confirming will place
                them in the SCP queue. Ensure the program coordinator has
                approved this assignment.
              </p>
            </div>
          </div>
        )}

        {/* SCP Priority: measurements + checklist */}
        {tabKey === "scp_priority" && (
          <>
            <section className="rounded-md border p-4 space-y-3">
              <header className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-bold">Physical Measurements</h4>
              </header>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="height-input"
                    className="text-xs font-semibold uppercase text-muted-foreground"
                  >
                    Height (cm)
                  </label>
                  <Input
                    id="height-input"
                    type="number"
                    placeholder="e.g. 155"
                    value={heightCm}
                    onChange={(e) => onHeightChange(e.target.value)}
                    className="h-9 text-sm font-bold"
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="weight-input"
                    className="text-xs font-semibold uppercase text-muted-foreground"
                  >
                    Weight (kg)
                  </label>
                  <Input
                    id="weight-input"
                    type="number"
                    placeholder="e.g. 52"
                    value={weightKg}
                    onChange={(e) => onWeightChange(e.target.value)}
                    className="h-9 text-sm font-bold"
                    disabled={busy}
                  />
                </div>
              </div>
            </section>
            <section className="rounded-md border p-4 space-y-3">
              <header className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-bold">Document Checklist</h4>
              </header>
              <ul className="space-y-1.5">
                {checklistItems.map((doc) => {
                  const checked = !!checklist[doc];
                  return (
                    <li key={doc}>
                      <label
                        htmlFor={`scp-${doc}`}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors select-none",
                          checked
                            ? "border-primary/30 bg-primary/5"
                            : "border-border hover:bg-muted/30",
                          busy && "opacity-60 cursor-not-allowed",
                        )}
                      >
                        <input
                          type="checkbox"
                          id={`scp-${doc}`}
                          checked={checked}
                          onChange={() => toggle(doc)}
                          className="h-4 w-4 accent-primary shrink-0"
                          disabled={busy}
                        />
                        <span
                          className={cn(
                            "text-sm font-medium flex-1",
                            checked && "text-primary/90",
                          )}
                        >
                          {doc}
                        </span>
                        {checked && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        {/* Online BEEF: verification checklist */}
        {tabKey === "online_beef" && (
          <section className="rounded-md border p-4 space-y-3">
            <header className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold">Document Verification</h4>
            </header>
            <ul className="space-y-1.5">
              {checklistItems.map((doc) => {
                const checked = !!checklist[doc];
                return (
                  <li key={doc}>
                    <label
                      htmlFor={`online-${doc}`}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors select-none",
                        checked
                          ? "border-primary/30 bg-primary/5"
                          : "border-border hover:bg-muted/30",
                        busy && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <input
                        type="checkbox"
                        id={`online-${doc}`}
                        checked={checked}
                        onChange={() => toggle(doc)}
                        className="h-4 w-4 accent-primary shrink-0"
                        disabled={busy}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium flex-1",
                          checked && "text-primary/90",
                        )}
                      >
                        {doc}
                      </span>
                      {checked && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Walk-In BEEF: confirmation note */}
        {tabKey === "walkin_beef" && (
          <div className="rounded-md border p-3 bg-muted/30 space-y-1">
            <p className="text-sm font-semibold">Walk-In Admission</p>
            <p className="text-xs text-muted-foreground">
              Review the paper BEEF form and confirm BEC enrollment.
            </p>
          </div>
        )}

        {/* Pending / Incomplete: document resolution checklist */}
        {tabKey === "pending_beef" && (
          <section className="rounded-md border p-4 space-y-3">
            <header className="flex items-center gap-2">
              <FileClock className="h-4 w-4 text-amber-600" />
              <h4 className="text-sm font-bold">Required Documents</h4>
            </header>
            <p className="text-xs text-muted-foreground">
              Check off each document as the parent / guardian presents it.
            </p>
            <ul className="space-y-1.5">
              {checklistItems.map((doc) => {
                const checked = !!checklist[doc];
                return (
                  <li key={doc}>
                    <label
                      htmlFor={`pending-${doc}`}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors select-none",
                        checked
                          ? "border-primary/30 bg-primary/5"
                          : "border-border hover:bg-muted/30",
                        busy && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <input
                        type="checkbox"
                        id={`pending-${doc}`}
                        checked={checked}
                        onChange={() => toggle(doc)}
                        className="h-4 w-4 accent-primary shrink-0"
                        disabled={busy}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium flex-1",
                          checked && "text-primary/90",
                        )}
                      >
                        {doc}
                      </span>
                      {checked && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Footer action buttons */}
      <SheetFooter className="border-t px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={busy}
          className="sm:mr-auto"
        >
          Cancel
        </Button>

        {tabKey === "scp_priority" && (
          <>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 font-bold"
              onClick={() => onConfirmScp(true)}
              disabled={busy || blockConfirm}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <FileClock className="h-4 w-4 mr-1.5" />
              )}
              Docs Incomplete
            </Button>
            <Button
              onClick={() => onConfirmScp(false)}
              disabled={busy || blockConfirm}
              className="font-bold"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <FileCheck2 className="h-4 w-4 mr-1.5" />
              )}
              Confirm SCP Slot
            </Button>
          </>
        )}

        {tabKey === "online_beef" && (
          <>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 font-bold"
              onClick={onMarkPending}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <FileClock className="h-4 w-4 mr-1.5" />
              )}
              Mark as Pending
            </Button>
            <Button
              onClick={onVerifyBeef}
              disabled={busy || blockConfirm}
              className="font-bold"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <FileCheck2 className="h-4 w-4 mr-1.5" />
              )}
              Verify &amp; Confirm
            </Button>
          </>
        )}

        {tabKey === "walkin_beef" && (
          <Button
            onClick={onConfirmWalkIn}
            disabled={busy || blockConfirm}
            className="font-bold"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <FileCheck2 className="h-4 w-4 mr-1.5" />
            )}
            Confirm BEEF
          </Button>
        )}

        {tabKey === "pending_beef" && (
          <Button
            onClick={onResolve}
            disabled={busy || blockConfirm}
            className="font-bold"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
            )}
            Resolve &amp; Confirm
          </Button>
        )}

      </SheetFooter>
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface Phase2IntakeHubProps {
  syId: number | null;
  canMutate: boolean;
  onDataChange?: () => void;
}

export function Phase2IntakeHub({
  syId,
  canMutate,
  onDataChange,
}: Phase2IntakeHubProps) {
  const [activeTab, setActiveTab] = useState<Phase2TabKey>("scp_priority");
  const [items, setItems] = useState<Phase2QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Phase2QueueItem | null>(
    null,
  );
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const shouldReduceMotion = useReducedMotion() ?? false;
  void getReducedMotionProps(shouldReduceMotion);

  const [panelPercentage, setPanelPercentage] = useState(45);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true,
  );
  const isResizing = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isResizing.current || !isDesktopViewport) return;
      const newWidthPercent =
        ((window.innerWidth - event.clientX) / window.innerWidth) * 100;
      if (newWidthPercent > 20 && newWidthPercent < 95) {
        setPanelPercentage(newWidthPercent);
      }
    },
    [isDesktopViewport],
  );

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    if (!isDesktopViewport) return;
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing, { once: true });
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, isDesktopViewport, stopResizing]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mouseup", stopResizing);
      stopResizing();
    };
  }, [stopResizing]);

  const {
    inputValue: searchInput,
    setInputValue: setSearchInput,
    activeFilter: activeSearch,
  } = useDebouncedSearch();

  const currentTab = PHASE2_TABS.find((t) => t.key === activeTab)!;

  const fetchItems = useCallback(async () => {
    if (!syId) return;
    setLoading(true);
    try {
      const data = await getPhase2Queue({
        schoolYearId: syId,
        status: currentTab.status,
        admissionChannel: currentTab.admissionChannel,
        search: activeSearch || undefined,
        page,
        limit,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setLoading(false);
    }
  }, [syId, currentTab, activeSearch, page, limit]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handleTabChange = (key: string) => {
    startTransition(() => {
      setActiveTab(key as Phase2TabKey);
      setSearchInput("");
      setPage(1);
    });
  };

  const closeDrawer = useCallback(() => {
    setSelectedItem(null);
    setHeightCm("");
    setWeightKg("");
  }, []);

  const withMutation = useCallback(
    async (
      action: () => Promise<unknown>,
      successTitle: string,
      successMsg: string,
    ) => {
      setDrawerBusy(true);
      try {
        await action();
        lifecycleFeedback.success(successTitle, successMsg);
        closeDrawer();
        void fetchItems();
        onDataChange?.();
      } catch (e) {
        toastApiError(e as never);
      } finally {
        setDrawerBusy(false);
      }
    },
    [closeDrawer, fetchItems, onDataChange],
  );

  const handleConfirmScp = (pendingDocs: boolean) => {
    if (!selectedItem) return;
    const name = `${selectedItem.firstName} ${selectedItem.lastName}`;
    void withMutation(
      () => apiConfirmScpSlot(selectedItem.applicationId, pendingDocs),
      "SCP Slot Confirmed",
      pendingDocs
        ? `${name} flagged — awaiting documents.`
        : `${name} is now Ready for Sectioning.`,
    );
  };

  const handleVerifyBeef = () => {
    if (!selectedItem) return;
    const name = `${selectedItem.firstName} ${selectedItem.lastName}`;
    void withMutation(
      () => apiVerifyBeef(selectedItem.applicationId),
      "BEEF Verified",
      `${name} is now Ready for Sectioning.`,
    );
  };

  const handleMarkPending = () => {
    if (!selectedItem) return;
    const name = `${selectedItem.firstName} ${selectedItem.lastName}`;
    void withMutation(
      () => apiMarkBeefPending(selectedItem.applicationId),
      "Marked as Pending",
      `${name} has been moved to the Pending queue.`,
    );
  };

  const handleConfirmWalkIn = () => {
    if (!selectedItem) return;
    const name = `${selectedItem.firstName} ${selectedItem.lastName}`;
    void withMutation(
      () => apiVerifyBeef(selectedItem.applicationId),
      "Walk-In BEEF Confirmed",
      `${name} is now Ready for Sectioning.`,
    );
  };

  const handleResolve = () => {
    if (!selectedItem) return;
    const name = `${selectedItem.firstName} ${selectedItem.lastName}`;
    void withMutation(
      () => apiResolveBeef(selectedItem.applicationId),
      "Resolved & Confirmed",
      `${name} is now Ready for Sectioning.`,
    );
  };

  const columns = useMemo(
    () => buildColumns(activeTab, canMutate, setSelectedItem),
    [activeTab, canMutate],
  );

  const drawerName = selectedItem
    ? `${selectedItem.lastName ?? ""}, ${selectedItem.firstName ?? ""}`.toUpperCase()
    : "";
  const drawerInitials = selectedItem
    ? `${(selectedItem.firstName ?? "").charAt(0)}${(selectedItem.lastName ?? "").charAt(0)}`.toUpperCase()
    : "";
  const drawerTabTitle =
    activeTab === "scp_priority"
      ? "SCP Physical BEEF Review"
      : activeTab === "online_beef"
        ? "Digital BEEF Verification"
        : activeTab === "walkin_beef"
          ? "Walk-In BEEF Processing"
          : "Resolve Missing Documents";

  return (
    <motion.div
      variants={sectionVariants}
      transition={panelTransition}
      className="space-y-3"
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1 bg-white border border-border relative">
          {PHASE2_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="bosy-phase2-active-pill"
                  className="absolute inset-0 bg-primary rounded-md"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className="relative z-20 inline-flex items-center gap-2 text-xs sm:text-sm">
                {tab.label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {PHASE2_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-3">
            {activeTab === tab.key && (
              <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
                <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                      <Input
                        className="pl-10 h-11 text-sm font-bold bg-muted/30 border-2 border-transparent focus:border-primary transition-all"
                        placeholder="Search name or LRN…"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground font-semibold ml-auto">
                      {total} result{total !== 1 ? "s" : ""}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <DataTable
                    columns={columns}
                    data={items}
                    loading={loading}
                    getRowId={(row) => String(row.applicationId)}
                    emptyStateContent={
                      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm font-semibold">Queue is empty.</p>
                        <p className="text-xs mt-1 opacity-70">
                          {tab.description}
                        </p>
                      </div>
                    }
                    dense
                  />
                  {total > limit && (
                    <PaginationBar
                      page={page}
                      limit={limit}
                      total={total}
                      onPageChange={(p) =>
                        startTransition(() => setPage(p))
                      }
                      onLimitChange={() => {}}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Slide-over action drawer */}
      <Sheet
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open && !drawerBusy) closeDrawer();
        }}
      >
        <SheetContent
          side="right"
          className="p-0 flex flex-row border-l overflow-visible w-screen sm:w-auto sm:max-w-none"
          style={isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined}
        >
          <div
            onMouseDown={startResizing}
            className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group"
          >
            <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
          </div>

          <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {selectedItem && (
              <>
                <SheetHeader className="bg-primary px-6 py-6 space-y-1 relative shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="size-16 rounded-2xl bg-white/10 flex items-center justify-center font-black text-white text-2xl uppercase border-2 border-white/20 shadow-xl shrink-0">
                      {drawerInitials}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <SheetTitle className="text-2xl font-black text-white uppercase leading-none truncate">
                        {drawerName}
                      </SheetTitle>
                      <SheetDescription className="text-white/80 font-bold uppercase text-xs">
                        {selectedItem.lrn ?? "No LRN"} · {selectedItem.gradeLevelName}
                      </SheetDescription>
                      <p className="text-white/70 text-xs font-semibold">
                        {drawerTabTitle}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="Close panel"
                  >
                    <X className="size-5" />
                  </button>
                </SheetHeader>
                <IntakeActionDrawer
                  item={selectedItem}
                  tabKey={activeTab}
                  busy={drawerBusy}
                  heightCm={heightCm}
                  weightKg={weightKg}
                  onHeightChange={setHeightCm}
                  onWeightChange={setWeightKg}
                  onConfirmScp={handleConfirmScp}
                  onVerifyBeef={handleVerifyBeef}
                  onMarkPending={handleMarkPending}
                  onConfirmWalkIn={handleConfirmWalkIn}
                  onResolve={handleResolve}
                  onClose={closeDrawer}
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

