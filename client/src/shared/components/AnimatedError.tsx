import { AnimatePresence, motion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface AnimatedErrorProps {
  error?: string | null;
  className?: string;
}

export function AnimatedError({ error, className }: AnimatedErrorProps) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 6 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden animated-error"
        >
          <p
            className={cn(
              "text-destructive flex items-start gap-1 leading-tight font-bold",
              className
            )}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>{error}</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
