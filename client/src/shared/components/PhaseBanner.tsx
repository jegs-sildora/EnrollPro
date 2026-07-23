import { useState, useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { useSettingsStore } from "@/store/settings.slice";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { AnimatePresence, motion } from "motion/react";
import {
  createFadeShiftVariants,
  createMotionTransition,
  getReducedMotionProps,
  useMotionPreferences,
} from "@/shared/lib/motion";

export function PhaseBanner() {
  const { systemPhase } = useSettingsStore();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const motionPreferences = useMotionPreferences();
  const bannerVariants = createFadeShiftVariants(
    motionPreferences,
    "y",
    "y",
    "xs",
  );

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
    <AnimatePresence mode="wait">
      <motion.div
        variants={bannerVariants}
        transition={createMotionTransition(motionPreferences, "fast")}
        {...getReducedMotionProps(motionPreferences.reduceMotion)}
        className="mb-2 px-4 sm:px-6 pt-4"
      >
        <Alert className="bg-amber-50 border-amber-200 text-amber-900 relative">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="font-extrabold">Classes Ongoing — Late Enrollment Phase</AlertTitle>
          <AlertDescription className="text-base font-bold mt-1">
            Regular online enrollment is closed. Authorized registrars may still encode late walk-in learners at the campus office. Any new enrollments processed will be automatically flagged as Late Enrollee.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100/50"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4 mr-6" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}
