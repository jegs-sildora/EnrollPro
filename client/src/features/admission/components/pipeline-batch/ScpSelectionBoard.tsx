import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Loader2, TrendingUp, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { sileo } from "sileo";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import { TableCell, TableRow } from "@/shared/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import api from "@/shared/api/axiosInstance";
import { formatScpType } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import type { PassedApplicantForBoard, ScpRankingResult } from "./types";

interface ScpSelectionBoardProps {
  scpType: string;
  rankings: ScpRankingResult[];
  passedApplicants?: PassedApplicantForBoard[];
  loading: boolean;
  cutoffSlot?: number;
  onPublishSuccess?: () => Promise<void> | void;
}

interface RankingFormulaComponent {
  key: string;
  label: string;
  weight: number;
}

interface BoardRow extends ScpRankingResult {
  rank: number;
  qualified: boolean;
  statusLabel: string;
  examScore: number | null;
  interviewScore: number | null;
  effectiveCompositeScore: number;
  isManualWinner: boolean;
}

interface BoardCandidate extends ScpRankingResult {
  examScoreOverride: number | null;
  interviewScoreOverride: number | null;
}

function buildLearnerIdentityKey(
  firstName: string,
  lastName: string,
  lrn: string | null | undefined,
): string {
  const normalizedLrn = String(lrn ?? "").trim();
  if (normalizedLrn.length > 0) {
    return `LRN:${normalizedLrn}`;
  }

  return `NAME:${String(lastName).trim().toUpperCase()}|${String(firstName)
    .trim()
    .toUpperCase()}`;
}

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(4);
}

function formatWeight(weight: number, useFractionalWeights: boolean): string {
  const normalized = useFractionalWeights ? weight : weight / 100;
  return normalized.toFixed(2);
}

function formatPercent(weight: number, useFractionalWeights: boolean): string {
  const normalized = useFractionalWeights ? weight : weight / 100;
  return `${Math.round(normalized * 100)}%`;
}

function parseRankingFormulaComponents(value: unknown): RankingFormulaComponent[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const maybeComponents = (value as { components?: Array<Record<string, unknown>> }).components;
  if (!Array.isArray(maybeComponents)) return [];

  return maybeComponents
    .map((component) => {
      const key = String(component.key ?? component.metric ?? "")
        .trim()
        .toUpperCase();
      const label = String(component.label ?? key).trim() || key;
      const weight = Number(component.weight ?? Number.NaN);

      if (!key || !Number.isFinite(weight) || weight <= 0) {
        return null;
      }

      return { key, label, weight };
    })
    .filter((component): component is RankingFormulaComponent => Boolean(component));
}

function normalizeKey(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeScore(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(4));
}

function resolveRawScoreFromBreakdown(
  row: ScpRankingResult,
  component: RankingFormulaComponent,
  useFractionalWeights: boolean,
): number | null {
  const normalizedWeight = useFractionalWeights ? component.weight : component.weight / 100;
  if (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0) {
    return null;
  }

  const directBreakdown = row.breakdown?.[component.key];
  const fallbackBreakdownEntry = Object.entries(row.breakdown ?? {}).find(
    ([key]) => normalizeKey(key) === normalizeKey(component.key),
  )?.[1];
  const weightedValue = directBreakdown ?? fallbackBreakdownEntry;

  if (weightedValue == null || !Number.isFinite(weightedValue)) {
    return null;
  }

  return Number((weightedValue / normalizedWeight).toFixed(4));
}

export function ScpSelectionBoard({
  scpType,
  rankings,
  passedApplicants = [],
  loading,
  cutoffSlot = 70,
  onPublishSuccess,
}: ScpSelectionBoardProps) {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const [selectedRow, setSelectedRow] = useState<BoardRow | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [rankingComponents, setRankingComponents] = useState<RankingFormulaComponent[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [scoreAdjustments, setScoreAdjustments] = useState<Record<number, number>>({});
  const [manualWinnerId, setManualWinnerId] = useState<number | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!ayId) return;

    let isMounted = true;

    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        const res = await api.get(`/curriculum/${ayId}/scp-config`);
        const configs = (res.data?.scpProgramConfigs ?? []) as Array<{
          scpType: string;
          rankingFormula?: unknown;
        }>;
        const config = configs.find((entry) => entry.scpType === scpType);
        if (!isMounted) return;
        setRankingComponents(parseRankingFormulaComponents(config?.rankingFormula));
      } catch {
        if (!isMounted) return;
        setRankingComponents([]);
      } finally {
        if (isMounted) setConfigLoading(false);
      }
    };

    void loadConfig();

    return () => {
      isMounted = false;
    };
  }, [ayId, scpType]);

  const useFractionalWeights = useMemo(() => {
    const totalWeight = rankingComponents.reduce((sum, component) => sum + component.weight, 0);
    return totalWeight <= 1.0001;
  }, [rankingComponents]);

  const getRawScoreFromBreakdown = useCallback(
    (row: ScpRankingResult, keys: string[]): number | null => {
      const matchedComponent = rankingComponents.find((component) =>
        keys.some((key) => normalizeKey(component.key) === normalizeKey(key)),
      );

      if (!matchedComponent) {
        return null;
      }

      return resolveRawScoreFromBreakdown(row, matchedComponent, useFractionalWeights);
    },
    [rankingComponents, useFractionalWeights],
  );

  const mergedCandidates = useMemo<BoardCandidate[]>(() => {
    const candidateByIdentity = new Map<string, BoardCandidate>();

    for (const ranking of rankings) {
      const identityKey = buildLearnerIdentityKey(
        ranking.firstName,
        ranking.lastName,
        ranking.lrn,
      );

      candidateByIdentity.set(identityKey, {
        ...ranking,
        breakdown: ranking.breakdown ?? {},
        examScoreOverride: null,
        interviewScoreOverride: null,
      });
    }

    for (const passed of passedApplicants) {
      const identityKey = buildLearnerIdentityKey(
        passed.firstName,
        passed.lastName,
        passed.lrn,
      );
      const existing = candidateByIdentity.get(identityKey);
      if (!existing) {
        candidateByIdentity.set(identityKey, {
          applicationId: passed.applicationId,
          firstName: passed.firstName,
          lastName: passed.lastName,
          lrn: passed.lrn,
          compositeScore: passed.compositeScore,
          breakdown: {},
          examScoreOverride: passed.examScore,
          interviewScoreOverride: passed.interviewScore,
        });
        continue;
      }

      candidateByIdentity.set(identityKey, {
        ...existing,
        firstName: existing.firstName || passed.firstName,
        lastName: existing.lastName || passed.lastName,
        lrn: existing.lrn ?? passed.lrn,
        examScoreOverride: existing.examScoreOverride ?? passed.examScore,
        interviewScoreOverride:
          existing.interviewScoreOverride ?? passed.interviewScore,
      });
    }

    return Array.from(candidateByIdentity.values());
  }, [rankings, passedApplicants]);

  const rankingRows = useMemo<BoardRow[]>(() => {
    const rows = mergedCandidates.map((row) => {
      const examScore = row.examScoreOverride ?? getRawScoreFromBreakdown(row, [
        "EXAM",
        "QUALIFYING_EXAMINATION",
        "WRITTEN_EXAM",
        "GENERAL_ADMISSION_TEST",
        "TALENT_AUDITION",
        "SPORTS_SKILLS_TRYOUT",
      ]);
      const interviewScore =
        row.interviewScoreOverride ??
        getRawScoreFromBreakdown(row, [
        "INTERVIEW",
        "AUDITION",
      ]);
      const adjustment = scoreAdjustments[row.applicationId] ?? 0;
      const effectiveCompositeScore = Number((row.compositeScore + adjustment).toFixed(4));

      return {
        ...row,
        rank: 0,
        qualified: false,
        statusLabel: "",
        examScore,
        interviewScore,
        effectiveCompositeScore,
        isManualWinner: manualWinnerId === row.applicationId,
      } satisfies BoardRow;
    });

    rows.sort((a, b) => {
      if (b.effectiveCompositeScore !== a.effectiveCompositeScore) {
        return b.effectiveCompositeScore - a.effectiveCompositeScore;
      }

      const examA = a.examScore ?? Number.NEGATIVE_INFINITY;
      const examB = b.examScore ?? Number.NEGATIVE_INFINITY;
      if (examB !== examA) {
        return examB - examA;
      }

      const interviewA = a.interviewScore ?? Number.NEGATIVE_INFINITY;
      const interviewB = b.interviewScore ?? Number.NEGATIVE_INFINITY;
      if (interviewB !== interviewA) {
        return interviewB - interviewA;
      }

      if (manualWinnerId != null) {
        if (a.applicationId === manualWinnerId && b.applicationId !== manualWinnerId) {
          return -1;
        }
        if (b.applicationId === manualWinnerId && a.applicationId !== manualWinnerId) {
          return 1;
        }
      }

      return a.applicationId - b.applicationId;
    });

    return rows.map((row, index) => {
      return {
        ...row,
        rank: index + 1,
        qualified: index < cutoffSlot,
        statusLabel: index < cutoffSlot ? "Qualified" : "Waitlisted / BEC Redirect",
      };
    });
  }, [
    cutoffSlot,
    getRawScoreFromBreakdown,
    manualWinnerId,
    mergedCandidates,
    scoreAdjustments,
  ]);

  const cutoffWinner = rankingRows[cutoffSlot - 1] ?? null;
  const cutoffWaitlist = rankingRows[cutoffSlot] ?? null;
  const hasExactCutoffConflict =
    cutoffWinner != null &&
    cutoffWaitlist != null &&
    normalizeScore(cutoffWinner.effectiveCompositeScore) ===
      normalizeScore(cutoffWaitlist.effectiveCompositeScore);

  const cutoffConflictResolved =
    !hasExactCutoffConflict ||
    (manualWinnerId != null &&
      [cutoffWinner?.applicationId, cutoffWaitlist?.applicationId].includes(manualWinnerId));

  const hasActiveCutoffConflict = hasExactCutoffConflict && !cutoffConflictResolved;
  const hasInsufficientRankedRows = rankingRows.length < cutoffSlot;
  const publishBlocked = hasInsufficientRankedRows || hasActiveCutoffConflict || isPublishing;

  const publishGateMessage = hasInsufficientRankedRows
    ? `At least ${cutoffSlot} ASSESSMENTS PASSED learners are required before publishing. Current ranked learners: ${rankingRows.length}.`
    : hasActiveCutoffConflict
      ? `Tie-breaker required at the Rank ${cutoffSlot} cutoff. Resolve the tie overrides to enable publishing.`
      : null;

  const cutoffConflictIds = useMemo(
    () =>
      new Set(
        [cutoffWinner?.applicationId, cutoffWaitlist?.applicationId].filter(
          (id): id is number => typeof id === "number",
        ),
      ),
    [cutoffWaitlist?.applicationId, cutoffWinner?.applicationId],
  );

  const columns = useMemo<ColumnDef<BoardRow>[]>(
    () => [
      {
        accessorKey: "rank",
        header: "RANK #",
        cell: ({ row }) => (
          <span className="block text-center text-sm font-black">{row.original.rank}</span>
        ),
        size: 90,
      },
      {
        accessorKey: "lrn",
        header: "LRN",
        cell: ({ row }) => (
          <span className="block text-center text-sm font-bold">{row.original.lrn ?? "—"}</span>
        ),
        size: 160,
      },
      {
        id: "name",
        header: "NAME",
        cell: ({ row }) => (
          <div className="space-y-1 text-left">
            <p className="text-sm font-black uppercase leading-tight">
              {row.original.lastName}, {row.original.firstName}
            </p>
            <p className="text-[11px] font-bold text-muted-foreground">
              Application #{row.original.applicationId}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "compositeScore",
        header: "COMPOSITE SCORE",
        cell: ({ row }) => (
          <span className="block text-center text-sm font-black text-foreground">
            {formatScore(row.original.effectiveCompositeScore)}
          </span>
        ),
        size: 180,
      },
      {
        id: "status",
        header: "STATUS",
        cell: ({ row }) => (
          <div className="flex flex-col items-center gap-2">
            <Badge
              className={row.original.qualified
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
              {row.original.statusLabel}
            </Badge>
            {cutoffConflictIds.has(row.original.applicationId) && hasActiveCutoffConflict ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] font-black text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedRow(row.original);
                }}>
                Resolve Tie
              </Button>
            ) : null}
          </div>
        ),
        size: 220,
      },
    ],
    [cutoffConflictIds, hasActiveCutoffConflict],
  );

  const renderBreakdownRows = useCallback(
    (row: BoardRow) => {
      if (rankingComponents.length === 0) {
        return (
          <div className="rounded-xl border border-dashed p-4 text-sm font-bold text-muted-foreground">
            Ranking formula configuration is not available for this program yet.
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {rankingComponents.map((component) => {
            const rawScore = resolveRawScoreFromBreakdown(row, component, useFractionalWeights);
            const weightedContribution =
              row.breakdown?.[component.key] ??
              Object.entries(row.breakdown ?? {}).find(
                ([key]) => normalizeKey(key) === normalizeKey(component.key),
              )?.[1] ??
              null;

            return (
              <div
                key={component.key}
                className="grid grid-cols-1 gap-2 rounded-xl border bg-muted/20 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_auto_auto_auto] sm:items-center">
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase">{component.label}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">
                    {formatPercent(component.weight, useFractionalWeights)} weight
                  </p>
                </div>
                <div className="text-sm font-bold text-muted-foreground">
                  {formatScore(rawScore)} x {formatWeight(component.weight, useFractionalWeights)}
                </div>
                <div className="text-sm font-bold text-muted-foreground">=</div>
                <div className="text-right text-sm font-black text-foreground">
                  {formatScore(weightedContribution)}
                </div>
              </div>
            );
          })}
        </div>
      );
    },
    [rankingComponents, useFractionalWeights],
  );

  const handlePublish = async () => {
    if (!ayId) {
      sileo.error({
        title: "Missing School Year Context",
        description: "Select an active school year before publishing the ranking board.",
      });
      return;
    }

    if (hasActiveCutoffConflict) {
      sileo.error({
        title: "Resolve Cutoff Conflict First",
        description:
          "The tie at the cutoff boundary must be resolved before publishing the roster.",
      });
      return;
    }

    try {
      setIsPublishing(true);

      const rankedApplicationIds = rankingRows.map((row) => row.applicationId);
      const response = await api.patch("/applications/scp-rankings/publish", {
        schoolYearId: ayId,
        scpType,
        cutoffSlot,
        rankedApplicationIds,
      });

      const published = response.data?.published as
        | { priorityCount?: number; redirectedCount?: number }
        | undefined;

      sileo.success({
        title: "Selection Board Published",
        description:
          `${published?.priorityCount ?? 0} learners moved to SCP Priority Lane, ` +
          `${published?.redirectedCount ?? 0} redirected to Regular BEC track.`,
      });

      await Promise.resolve(onPublishSuccess?.());
      setPublishModalOpen(false);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Unable to publish the selection board.";

      sileo.error({
        title: "Publish Failed",
        description: message,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleIncrementTieScore = useCallback((applicationId: number) => {
    setScoreAdjustments((prev) => ({
      ...prev,
      [applicationId]: Number(((prev[applicationId] ?? 0) + 0.01).toFixed(2)),
    }));
    setManualWinnerId(null);
  }, []);

  const handleFlagManualWinner = useCallback((applicationId: number) => {
    setManualWinnerId(applicationId);
  }, []);

  const handleResetTieOverrides = useCallback(() => {
    setScoreAdjustments({});
    setManualWinnerId(null);
  }, []);

  if (loading || configLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border bg-card p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
      <CardHeader className="space-y-3 border-b pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-lg font-black uppercase tracking-tight">
                {formatScpType(scpType)} Selection Board
              </p>
            </div>
            <p className="text-xs font-bold text-muted-foreground">
              Ranked by composite score in descending order with a hard cutoff at slot {cutoffSlot}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="h-7 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              {Math.min(cutoffSlot, rankingRows.length)} Qualified
            </Badge>
            <Badge variant="outline" className="h-7 rounded-full text-xs font-black uppercase">
              {Math.max(0, rankingRows.length - cutoffSlot)} Waitlisted
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground"
              onClick={handleResetTieOverrides}
              disabled={Object.keys(scoreAdjustments).length === 0 && manualWinnerId == null}>
              Reset tie overrides
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p
            className={`text-xs font-black uppercase ${
              hasActiveCutoffConflict ? "text-amber-700" : "text-emerald-700"
            }`}>
            {hasActiveCutoffConflict
              ? `Cutoff Conflict: Identical scores detected at Rank ${cutoffSlot}.`
              : `Top ${cutoffSlot} Cutoff Line`}
          </p>
          <p className={`text-sm font-bold ${hasActiveCutoffConflict ? "text-amber-950" : "text-emerald-950"}`}>
            {hasActiveCutoffConflict
              ? "Resolve the tied learners at the boundary before publishing the STE roster."
              : "Applicants above the line are in the current selection band; students below it are waitlisted."}
          </p>
        </div>

        {publishGateMessage ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-xs font-black uppercase text-amber-700">Publish gate</p>
            <p className="text-sm font-bold text-amber-950">{publishGateMessage}</p>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-0 p-0">
        {rankingRows.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm font-bold text-muted-foreground">
            No rankings available for this program yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-b-xl">
            <DataTable
              columns={columns}
              data={rankingRows}
              loading={false}
              virtualize={false}
              dense
              containerHeight="100%"
              onRowClick={(row) => setSelectedRow(row)}
              noResultsMessage="No ranking records available."
              getRowClassName={(row) =>
                row.qualified
                  ? "bg-emerald-50/60 hover:bg-emerald-100/70"
                  : "bg-amber-50/50 text-muted-foreground hover:bg-amber-100/70"
              }
              renderRowAfter={(_, index) =>
                index === cutoffSlot - 1 ? (
                  <TableRow className={`border-y-2 border-dashed ${
                    hasActiveCutoffConflict
                      ? "border-amber-400 bg-amber-50 hover:bg-amber-50"
                      : "border-destructive/40 bg-destructive/5 hover:bg-destructive/5"
                  }`}>
                    <TableCell
                      colSpan={columns.length}
                      className={`px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] ${
                        hasActiveCutoffConflict ? "text-amber-700" : "text-destructive"
                      }`}>
                      {hasActiveCutoffConflict
                        ? `CUTOFF CONFLICT: Identical scores detected at Rank ${cutoffSlot}.`
                        : `STE CAPACITY LIMIT REACHED (${cutoffSlot}/${cutoffSlot})`}
                    </TableCell>
                  </TableRow>
                ) : null
              }
            />
          </div>
        )}

        <div className="sticky bottom-0 border-t bg-card/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-black uppercase">Final Selection Gate</p>
              <p className="text-xs font-bold text-muted-foreground">
                Finalize the current top {cutoffSlot} ranking and route the remainder to the regular BEC track.
              </p>
            </div>
            <Button
              className="h-11 px-5 text-sm font-black"
              disabled={publishBlocked}
              onClick={() => setPublishModalOpen(true)}>
              Finalize & Publish Top {cutoffSlot}
            </Button>
          </div>
        </div>
      </CardContent>

      <Sheet open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selectedRow && (
            <>
              <SheetHeader className="space-y-3 border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Calculator className="h-4 w-4" />
                  </div>
                  <div>
                    <SheetTitle>
                      {selectedRow.lastName}, {selectedRow.firstName}
                    </SheetTitle>
                    <SheetDescription>
                      Composite score transparency for STE ranking #{selectedRow.rank}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5 pt-5">
                <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-black uppercase text-muted-foreground">LRN</p>
                    <p className="text-sm font-bold">{selectedRow.lrn ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-muted-foreground">Rank</p>
                    <p className="text-sm font-bold">#{selectedRow.rank}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-muted-foreground">Status</p>
                    <Badge className={selectedRow.qualified
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                      {selectedRow.statusLabel}
                    </Badge>
                  </div>
                </div>

                {cutoffConflictIds.has(selectedRow.applicationId) && hasActiveCutoffConflict ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 space-y-3">
                    <div>
                      <p className="text-sm font-black uppercase text-amber-800">Cutoff Tie Resolution</p>
                      <p className="text-xs font-bold text-amber-900">
                        This learner is part of the Rank {cutoffSlot} boundary conflict. Resolve the tie before publishing.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        className="border-amber-300 text-amber-800 hover:bg-amber-100"
                        onClick={() => handleIncrementTieScore(selectedRow.applicationId)}>
                        Add 0.01 to Composite Score
                      </Button>
                      <Button
                        className="bg-amber-700 text-white hover:bg-amber-800"
                        onClick={() => handleFlagManualWinner(selectedRow.applicationId)}>
                        Flag as Winner
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-black uppercase">Composite Formula Breakdown</p>
                    <p className="text-xs font-bold text-muted-foreground">
                      Every weighted component below rolls up to the final composite score shown in the ranking board.
                    </p>
                  </div>
                  {renderBreakdownRows(selectedRow)}
                </div>

                <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 px-5 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                    Total Composite Score
                  </p>
                  <p className="mt-1 text-3xl font-black text-foreground">
                    {formatScore(selectedRow.effectiveCompositeScore)}
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmationModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        title="Finalize STE Top 70"
        description={
          <span>
            This action will lock the STE roster. Ranks 1-70 will be pushed to the BOSY Priority Lane, and ranks 71+ will be routed to the Regular BEC track. After publish, both lanes become READY FOR ENROLLMENT.
          </span>
        }
        confirmText="Finalize & Publish"
        variant="warning"
        loading={isPublishing}
        onConfirm={handlePublish}
      />
    </Card>
  );
}

export default ScpSelectionBoard;