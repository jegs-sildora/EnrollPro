import { Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { motion, AnimatePresence } from "motion/react";

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
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-2 border border-border">
          <span className="text-xs font-black uppercase text-foreground">
            {selectedCount} selected
          </span>
          <Button
            size="sm"
            variant="default"
            className="h-7 px-3 text-[11px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={loading}
            onClick={onConfirm}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            [ Bulk Confirm Selected Learners ]
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            disabled={loading}
            onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
