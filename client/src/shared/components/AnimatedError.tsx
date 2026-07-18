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
          animate={{ opacity: 1, height: "auto", marginTop: 4 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden animated-error transition-[opacity,height,margin] duration-200 ease-in-out"
        >
          <p
            className={cn(
              "text-base text-destructive font-extrabold flex items-center gap-1",
              className
            )}
          >
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{error}</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
