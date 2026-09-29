import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";

export interface PoolStats {
  totalLearners: number;
  scp: {
    ste: number;
    spa: number;
    sps: number;
  };
  topBec: {
    count: number;
    sections: number;
    sectionNames: string[];
  };
  regularBec: {
    count: number;
    sections: number;
    sectionNames: string[];
  };
}

interface Props {
  scene: number;
  poolStats: PoolStats;
}

function Ticker({ value, duration = 0.8, className }: { value: number, duration?: number, className?: string }) {
  const count = useMotionValue(value);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut" });
    return controls.stop;
  }, [value, count, duration]);

  return <motion.span className={className}>{rounded}</motion.span>;
}

export function AutoAssignVisualizer({ scene, poolStats }: Props) {
  const { steEnabled, spaEnabled, spsEnabled } = useSettingsStore();
  const [animationReady, setAnimationReady] = useState(false);
  const [prevScene, setPrevScene] = useState(scene);

  if (scene !== prevScene) {
    setPrevScene(scene);
    setAnimationReady(false);
  }

  useEffect(() => {
    if (!animationReady) {
      const timer = setTimeout(() => setAnimationReady(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [animationReady]);

  const getStatusText = () => {
    switch (scene) {
      case 0:
        return "Phase 1: Fetching verified enrollments and EOSY promotion data...";
      case 1:
        return "Phase 2: Isolating qualified Special Curricular Program learners into specialized sections.";
      case 2:
        return "Phase 3: Sorting and placing top-performing learners into Top BEC sections.";
      case 3:
        return "Phase 4: Executing heterogeneous draft to balance academic performance and gender ratio.";
      default:
        return "";
    }
  };

  // Generate representative nodes dynamically based on poolStats, capped at 40 total to prevent lag
  const nodes = useMemo(() => {
    const exactTotal = poolStats.scp.ste + poolStats.scp.spa + poolStats.scp.sps + poolStats.topBec.count + poolStats.regularBec.count;
    if (exactTotal === 0) return [];

    const useExact = exactTotal <= 30;
    const scale = useExact ? 1 : 30 / exactTotal;

    const steCount = Math.round(poolStats.scp.ste * scale);
    const spaCount = Math.round(poolStats.scp.spa * scale);
    const spsCount = Math.round(poolStats.scp.sps * scale);
    const topCount = Math.round(poolStats.topBec.count * scale);

    // Ensure regular gets the remainder if we capped at 30
    let regularCount = Math.round(poolStats.regularBec.count * scale);
    if (!useExact) {
      regularCount = 30 - steCount - spaCount - spsCount - topCount;
    }

    const generated: { id: number, sex: "M" | "F", ave: number, track: string }[] = [];
    let idCounter = 0;

    const addNodes = (count: number, track: string) => {
      for (let i = 0; i < count; i++) {
        generated.push({
          id: idCounter++,
          sex: i % 2 === 0 ? "M" : "F",
          ave: 98 - Math.floor(i / 2),
          track,
        });
      }
    };

    addNodes(steCount, "STE");
    addNodes(spaCount, "SPA");
    addNodes(spsCount, "SPS");
    addNodes(topCount, "TOP_BEC");
    addNodes(regularCount, "REGULAR_BEC");

    return generated;
  }, [poolStats]);

  // Generate stable random scatter positions for each node (seeded by node id)
  // Scatter zone: the empty area between the title and unassigned pool (where sections appear later)
  const scatterPositions = useMemo(() => {
    return nodes.map((node) => {
      // Simple seeded random using node id for deterministic positions
      const seed = node.id * 2654435761; // Knuth multiplicative hash
      const rx = ((seed >>> 0) % 240) - 120; // x range: -120 to 120
      const ry = ((seed * 31 >>> 0) % 110) + 80; // y range: 80 to 190 (section zone)
      return { x: rx, y: ry };
    });
  }, [nodes]);

  const waitingNodesCount = useMemo(() => {
    return nodes.filter(node => {
      if (scene === 0) return true;
      if (scene === 1 && (node.track === "TOP_BEC" || node.track === "REGULAR_BEC")) return true;
      if (scene === 2 && node.track === "REGULAR_BEC") return true;
      return false;
    }).length;
  }, [nodes, scene]);

  // Delay pool resize to match the 2s animation delay
  const effectivePoolCount = useMemo(() => {
    if (scene === 0 && !animationReady) return 0; // dots are scattered, pool empty
    if (scene === 0 && animationReady) return nodes.length; // all dots gathered into pool

    if (!animationReady) {
      // Pre-animation: ALL visible (non-unmounted) dots are still in pool
      return nodes.filter(node => {
        const isUnmounted =
          (scene >= 2 && (node.track === "STE" || node.track === "SPA" || node.track === "SPS")) ||
          (scene >= 3 && node.track === "TOP_BEC");
        return !isUnmounted;
      }).length;
    }

    // Post-animation: only actual waiting dots remain
    return waitingNodesCount;
  }, [scene, animationReady, nodes, waitingNodesCount]);

  const poolRows = Math.ceil(effectivePoolCount / 10);
  const poolHeight = Math.max(50, 32 + (poolRows * 22) + 12);

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-xl overflow-hidden relative">
      <div className="bg-muted p-3 border-b border-border text-center font-bold text-sm text-primary">
        {getStatusText()}
      </div>

      <div className="flex-1 p-6 relative overflow-hidden flex flex-col items-center">
        {/* Main Ticking Counter — single persistent Ticker to avoid remount re-animations */}
        <div className="h-12 flex items-center justify-center font-extrabold text-2xl  mb-4 z-10">
          <span>
            <Ticker value={(() => {
              const scpTotal = poolStats.scp.ste + poolStats.scp.spa + poolStats.scp.sps;
              switch (scene) {
                case 0: return poolStats.totalLearners;
                case 1: return animationReady ? poolStats.totalLearners - scpTotal : poolStats.totalLearners;
                case 2: return animationReady ? poolStats.regularBec.count : poolStats.totalLearners - scpTotal;
                case 3: return animationReady ? 0 : poolStats.regularBec.count;
                default: return 0;
              }
            })()} />
            {' '}
            {scene === 0 && "Learners Ready for Sectioning"}
            {scene === 1 && "Learners Remaining in Pool"}
            {scene === 2 && "Regular BEC Learners"}
            {scene === 3 && "Unassigned Learners"}
          </span>
        </div>

        {/* Drop Zones / Sections */}
        <AnimatePresence>
          {scene >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              className="absolute top-20 left-4 right-4 flex justify-around gap-2 z-10"
            >
              {scene === 1 && (
                <div className="w-full flex flex-col items-center gap-2 relative">
                  <span className="font-bold uppercase bg-muted text-foreground px-3 py-1 rounded-full z-10">SCP Sections</span>
                  <div className="flex gap-2 w-full justify-center flex-wrap">
                    {steEnabled && (
                      <div className="flex-1 min-w-[100px] max-w-[140px] bg-background border-2 border-dashed border-primary/40 rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm overflow-hidden">
                        <span className="font-bold uppercase truncate w-full text-center text-foreground">STE Section</span>
                        <span className="font-extrabold text-primary mt-1"><Ticker value={animationReady ? poolStats.scp.ste : 0} /> / {poolStats.scp.ste}</span>
                      </div>
                    )}
                    {spaEnabled && (
                      <div className="flex-1 min-w-[100px] max-w-[140px] bg-background border-2 border-dashed border-primary/40 rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm overflow-hidden">
                        <span className="font-bold uppercase truncate w-full text-center text-foreground">SPA Section</span>
                        <span className="font-extrabold text-primary mt-1"><Ticker value={animationReady ? poolStats.scp.spa : 0} /> / {poolStats.scp.spa}</span>
                      </div>
                    )}
                    {spsEnabled && (
                      <div className="flex-1 min-w-[100px] max-w-[140px] bg-background border-2 border-dashed border-primary/40 rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm overflow-hidden">
                        <span className="font-bold uppercase truncate w-full text-center text-foreground">SPS Section</span>
                        <span className="font-extrabold text-primary mt-1"><Ticker value={animationReady ? poolStats.scp.sps : 0} /> / {poolStats.scp.sps}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {scene === 2 && (() => {
                const totalM = Math.ceil(poolStats.topBec.count / 2);
                const totalF = Math.floor(poolStats.topBec.count / 2);

                const names = poolStats.topBec.sectionNames || [];
                if (names.length === 0) {
                  return (
                    <div className="flex-1 bg-background border-2 border-dashed border-border rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm mx-auto">
                      <span className="font-bold uppercase text-foreground">No Top Sections Set</span>
                    </div>
                  );
                }

                // Show up to 4 sections
                const displayNames = names.slice(0, 4);
                const hasMore = names.length > 4;

                const mPerSection = Math.floor(totalM / names.length);
                let remainingM = totalM - (mPerSection * names.length);

                const fPerSection = Math.floor(totalF / names.length);
                let remainingF = totalF - (fPerSection * names.length);

                return (
                  <div className="w-full flex flex-col items-center gap-2 relative">
                    <span className="font-bold uppercase bg-muted text-foreground px-3 py-1 rounded-full z-10">Top BEC Sections</span>
                    <div className="flex gap-2 w-full justify-center flex-wrap">
                      {displayNames.map((name) => {
                        const m = mPerSection + (remainingM > 0 ? 1 : 0);
                        if (remainingM > 0) remainingM--;

                        const f = fPerSection + (remainingF > 0 ? 1 : 0);
                        if (remainingF > 0) remainingF--;

                        return (
                          <div key={name} className="flex-1 min-w-[100px] max-w-[140px] bg-background border-2 border-dashed border-primary/40 rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm overflow-hidden">
                            <span className="font-bold uppercase truncate w-full text-center text-foreground" title={name}>{name}</span>
                            <div className="flex gap-2 mt-1 ">
                              <span className="text-blue-600 font-bold">M: <Ticker value={animationReady ? m : 0} /></span>
                              <span className="text-pink-600 font-bold">F: <Ticker value={animationReady ? f : 0} /></span>
                            </div>
                          </div>
                        );
                      })}
                      {hasMore && (
                        <div className="flex-1 min-w-[80px] max-w-[100px] bg-muted/50 border-2 border-dashed border-border rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm opacity-70">
                          <span className="font-bold uppercase text-foreground">+{names.length - 4} More</span>
                          <span className="text-center mt-1 text-foreground">Balanced evenly</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {scene >= 3 && (() => {
                const totalM = Math.ceil(poolStats.regularBec.count / 2);
                const totalF = Math.floor(poolStats.regularBec.count / 2);

                const names = poolStats.regularBec.sectionNames || [];
                if (names.length === 0) {
                  return (
                    <div className="flex-1 bg-background border-2 border-dashed border-border rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm">
                      <span className="font-bold uppercase text-foreground">No Regular Sections Setup</span>
                    </div>
                  );
                }

                // Show up to 4 sections in the UI to prevent overflow
                const displayNames = names.slice(0, 4);
                const hasMore = names.length > 4;

                const mPerSection = Math.floor(totalM / names.length);
                let remainingM = totalM - (mPerSection * names.length);

                const fPerSection = Math.floor(totalF / names.length);
                let remainingF = totalF - (fPerSection * names.length);

                return (
                  <div className="w-full flex flex-col items-center gap-2 relative">
                    <span className="font-bold uppercase bg-muted text-foreground px-3 py-1 rounded-full z-10">Regular BEC Sections</span>
                    <div className="flex gap-2 w-full justify-center flex-wrap">
                    {displayNames.map((name) => {
                      const m = mPerSection + (remainingM > 0 ? 1 : 0);
                      if (remainingM > 0) remainingM--;

                      const f = fPerSection + (remainingF > 0 ? 1 : 0);
                      if (remainingF > 0) remainingF--;

                      return (
                        <div key={name} className="flex-1 min-w-[100px] max-w-[140px] bg-background border-2 border-dashed border-primary/40 rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm overflow-hidden">
                          <span className="font-bold uppercase truncate w-full text-center text-foreground" title={name}>{name}</span>
                          <div className="flex gap-2 mt-1 ">
                            <span className="text-blue-600 font-bold">M: <Ticker value={animationReady ? m : 0} /></span>
                            <span className="text-pink-600 font-bold">F: <Ticker value={animationReady ? f : 0} /></span>
                          </div>
                        </div>
                      );
                    })}
                    {hasMore && (
                      <div className="flex-1 min-w-[80px] max-w-[100px] bg-muted/50 border-2 border-dashed border-border rounded-lg p-2 flex flex-col items-center justify-center h-20 shadow-sm opacity-70">
                        <span className="font-bold uppercase text-foreground">+{names.length - 4} More</span>
                        <span className="text-center mt-1 text-foreground">Balanced evenly</span>
                      </div>
                    )}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          key="waiting-pool"
          initial={{ opacity: 0, scale: 0.95, height: poolHeight }}
          animate={{ opacity: 1, scale: 1, height: poolHeight }}
          transition={{ type: "spring", stiffness: 60 }}
          className="absolute top-[215px] left-12 right-12 border-2 border-dashed border-primary rounded-xl flex flex-col items-center justify-start p-2 pointer-events-none z-0 overflow-hidden"
        >
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Unassigned Pool</span>
        </motion.div>

        <div className="absolute top-0 left-0 w-full h-full flex justify-center items-start pointer-events-none z-20">
          {(() => {
            let trackCounts: Record<string, number> = {};
            let trackTotals: Record<string, number> = {};
            nodes.forEach(n => { trackTotals[n.track] = (trackTotals[n.track] || 0) + 1; });

            let waitingCount = 0;
            let visibleCount = 0;
            const nodesWithIndices = nodes.map((node) => {
              const trackIdx = trackCounts[node.track] || 0;
              trackCounts[node.track] = trackIdx + 1;

              let isWaiting = false;
              if (scene === 0) isWaiting = true;
              if (scene === 1 && (node.track === "TOP_BEC" || node.track === "REGULAR_BEC")) isWaiting = true;
              if (scene === 2 && node.track === "REGULAR_BEC") isWaiting = true;

              let waitIdx = 0;
              if (isWaiting) {
                waitIdx = waitingCount++;
              }

              // Track visible (non-unmounted) dots for pre-animation pool positions
              const isUnmounted =
                (scene >= 2 && (node.track === "STE" || node.track === "SPA" || node.track === "SPS")) ||
                (scene >= 3 && node.track === "TOP_BEC");
              let preAnimIdx = 0;
              if (!isUnmounted) {
                preAnimIdx = visibleCount++;
              }

              return { ...node, trackIdx, isWaiting, waitIdx, preAnimIdx };
            });

            return nodesWithIndices.map((node, i) => {
              let x = 0;
              let y = 0;
              let opacity = 1;

              const scatter = scatterPositions[i] || { x: 0, y: 0 };

              if (scene === 0 && !animationReady) {
                // Phase 1a: dots stay scattered in the section zone
                x = scatter.x;
                y = scatter.y;
                opacity = 1;
              } else if (scene === 0 && animationReady) {
                // Phase 1b: dots gather into the pool grid
                const allCount = nodes.length;
                const cols = Math.min(10, allCount);
                x = (i % cols) * 22 - ((cols - 1) / 2) * 22;
                y = Math.floor(i / cols) * 22 + 245;
                opacity = 1;
              } else if (scene >= 1 && !animationReady) {
                // Pre-animation hold: ALL visible dots stay in pool for 2s
                const cols = Math.min(10, visibleCount);
                x = (node.preAnimIdx % cols) * 22 - ((cols - 1) / 2) * 22;
                y = Math.floor(node.preAnimIdx / cols) * 22 + 245;
                opacity = 1;
              } else if (node.isWaiting) {
                // Post-animation: waiting nodes stay in pool grid
                const cols = Math.min(10, waitingCount);
                x = (node.waitIdx % cols) * 22 - ((cols - 1) / 2) * 22;
                y = Math.floor(node.waitIdx / cols) * 22 + 245;
                opacity = 1;
              } else if (scene >= 1) {
                // Post-animation: active dots fly to their sections
                if (node.track === "STE" || node.track === "SPA" || node.track === "SPS") {
                  const activeScp = [];
                  if (steEnabled) activeScp.push("STE");
                  if (spaEnabled) activeScp.push("SPA");
                  if (spsEnabled) activeScp.push("SPS");
                  
                  const idx = activeScp.indexOf(node.track);
                  if (idx !== -1) {
                    const numSections = activeScp.length;
                    x = (idx - (numSections - 1) / 2) * 148;
                  } else {
                    x = 0;
                  }
                  y = 156;
                  opacity = 0;
                } else if (node.track === "TOP_BEC" && scene === 2) {
                  const names = poolStats.topBec.sectionNames || [];
                  const numSections = Math.max(1, Math.min(4, names.length));
                  const colIdx = node.trackIdx % numSections;
                  x = (colIdx - (numSections - 1) / 2) * 148;
                  y = 156;
                  opacity = 0;
                } else if (node.track === "TOP_BEC" && scene >= 3) {
                  opacity = 0;
                } else if (node.track === "REGULAR_BEC" && scene === 3) {
                  const names = poolStats.regularBec.sectionNames || [];
                  const numSections = Math.max(1, Math.min(4, names.length));
                  const colIdx = node.trackIdx % numSections;
                  x = (colIdx - (numSections - 1) / 2) * 148;
                  y = 156;
                  opacity = 0;
                }
              }

              // Unmount entirely if it's past its active phase so it doesn't fly back
              if ((scene >= 2 && (node.track === "STE" || node.track === "SPA" || node.track === "SPS")) ||
                (scene >= 3 && node.track === "TOP_BEC")) {
                return null;
              }

              return (
                <motion.div
                  key={node.id}
                  initial={{ x: 0, y: 50, opacity: 0 }}
                  animate={{
                    x,
                    y,
                    opacity,
                    scale: (scene === 2 && node.track === "TOP_BEC") || (scene === 3 && node.track === "REGULAR_BEC") ? [1, 1.2, 1] : 1
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 70,
                    damping: 15,
                    scale: { duration: 0.5, repeat: 0 }
                  }}
                  className={cn(
                    "absolute w-5 h-5 rounded-full shadow-sm border-2",
                    node.sex === 'M' ? "bg-blue-500 border-blue-600" : "bg-pink-500 border-pink-600",
                    node.track !== "REGULAR_BEC" && node.track !== "TOP_BEC" && scene === 0 && "ring-2 ring-yellow-400 ring-offset-1",
                    node.track === "TOP_BEC" && scene <= 1 && "ring-2 ring-emerald-400 ring-offset-1"
                  )}
                />
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
