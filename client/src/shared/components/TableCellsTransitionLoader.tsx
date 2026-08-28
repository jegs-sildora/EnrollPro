import { useId } from "react";
import { motion } from "motion/react";
import {
  createMotionTransition,
  getReducedMotionProps,
  useMotionPreferences,
} from "@/shared/lib/motion";

interface TableCellsTransitionLoaderProps {
  currentSection: string | null;
  completedSections: number;
  failedSections: number;
  totalSections: number;
}

export function TableCellsTransitionLoader({
  currentSection,
  completedSections,
  failedSections,
  totalSections,
}: TableCellsTransitionLoaderProps) {
  const motionPreferences = useMotionPreferences();
  const patternId = useId().replace(/:/g, "");
  const processedSections = completedSections + failedSections;
  const progress = Math.min(
    100,
    (processedSections / Math.max(totalSections, 1)) * 100,
  );
  const dotTransition = {
    duration: motionPreferences.durations.slow,
    repeat: motionPreferences.reduceMotion ? 0 : Infinity,
    ease: "easeInOut",
  } as const;

  return (
    <motion.div
      variants={{
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }}
      transition={createMotionTransition(motionPreferences, "normal")}
      {...getReducedMotionProps(motionPreferences.reduceMotion)}
      className="pointer-events-auto absolute inset-0 flex items-center justify-center overflow-hidden bg-background/90 px-6 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label="Synchronizing SMART outcomes"
    >
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <svg
          aria-hidden="true"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id={`table-cell-loader-${patternId}`}
              x="0"
              y="0"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <rect
                x="2"
                y="2"
                width="36"
                height="36"
                rx="4"
                fill="none"
                stroke="hsl(var(--primary) / 0.10)"
                strokeWidth="1"
              />
              <rect
                x="42"
                y="42"
                width="36"
                height="36"
                rx="4"
                fill="none"
                stroke="hsl(var(--primary) / 0.08)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#table-cell-loader-${patternId})`} />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-lg border border-primary/20 bg-card px-8 py-12 text-center shadow-xl">
        <div className="mb-5 flex h-4 items-center justify-center gap-2.5">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-3 w-3 rounded-full bg-primary"
              animate={{ y: motionPreferences.reduceMotion ? 0 : [0, -8, 0] }}
              transition={{ ...dotTransition, delay: index * 0.12 }}
            />
          ))}
        </div>

        <h2 className="text-lg font-bold text-foreground">
          Syncing EOSY Grades
        </h2>
        <p className="mt-1 text-sm font-bold text-foreground">
          {currentSection
            ? `Fetching final grades for ${currentSection}.`
            : "Finishing the school-year grade update."}
        </p>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={createMotionTransition(motionPreferences, "normal")}
          />
        </div>
        <p className="mt-3 text-sm font-bold text-foreground">
          {processedSections} of {totalSections} sections processed
        </p>
        {failedSections > 0 && (
          <p className="mt-2 text-sm  text-destructive">
            {failedSections} section(s) need review.
          </p>
        )}
      </div>
    </motion.div>
  );
}
