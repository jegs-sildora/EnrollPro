import { useState, useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { AnimatePresence, motion } from "motion/react";

export function PhaseBanner() {
  const { systemPhase } = useSettingsStore();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (systemPhase === "CLASSES_ONGOING") {
      setIsVisible(true);
      // Reset dismissal state when phase changes to ongoing
      setIsDismissed(false);
    } else {
      setIsVisible(false);
    }
  }, [systemPhase]);

  if (!isVisible || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="mb-6"
      >
        <Alert className="bg-amber-50 border-amber-200 text-amber-900 relative">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="font-extrabold">Late Enrollment Phase Active</AlertTitle>
          <AlertDescription className="text-base font-semibold mt-1">
            Classes are currently ongoing. Any new enrollments processed will be automatically flagged as Late Enrollee.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100/50"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}
