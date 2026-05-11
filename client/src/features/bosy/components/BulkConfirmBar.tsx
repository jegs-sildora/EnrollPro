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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background rounded-xl shadow-2xl px-5 py-3 border border-border">
          <span className="text-xs font-black uppercase">
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
            Bulk Confirm Return
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-background hover:text-background/80 hover:bg-foreground/80"
            disabled={loading}
            onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
