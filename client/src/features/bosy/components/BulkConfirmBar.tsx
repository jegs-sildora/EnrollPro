import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  createMotionTransition,
  createScaleFadeVariants,
  getReducedMotionProps,
  useMotionPreferences,
} from "@/shared/lib/motion";

interface BulkConfirmBarProps {
  selectedCount: number;
  loading: boolean;
  onConfirm: () => void;
  onClear: () => void;
}

export function BulkConfirmBar({
  selectedCount,
  loading,
  onConfirm,
  onClear,
}: BulkConfirmBarProps) {
  const motionPreferences = useMotionPreferences();
  const barVariants = createScaleFadeVariants(motionPreferences, 0.98);

  return (
    <AnimatePresence mode="popLayout">
      {selectedCount > 0 && (
        <motion.div
          layout
          variants={barVariants}
          transition={createMotionTransition(motionPreferences, "fast")}
          {...getReducedMotionProps(motionPreferences.reduceMotion)}
          className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-2 border border-border">
          <span className="text-base font-extrabold uppercase text-foreground">
            {selectedCount} selected
          </span>
          <Button
            size="sm"
            variant="default"
            className="rounded-full font-extrabold uppercase bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={loading}
            onClick={onConfirm}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Enroll Selected Learners
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-foreground hover:text-foreground hover:bg-muted/50"
            disabled={loading}
            onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
