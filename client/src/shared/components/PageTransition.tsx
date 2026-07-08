import { motion } from "motion/react";
import type { ReactNode, ComponentProps } from "react";
import {
  createFadeShiftVariants,
  createMotionTransition,
  getReducedMotionProps,
  useMotionPreferences,
} from "@/shared/lib/motion";

interface PageTransitionProps extends ComponentProps<typeof motion.div> {
  children: ReactNode;
  routeKey: string;
}

export function PageTransition({ children, routeKey, ...props }: PageTransitionProps) {
  const motionPreferences = useMotionPreferences();
  const variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  };

  return (
    <motion.div
      key={routeKey}
      variants={variants}
      transition={createMotionTransition(motionPreferences, "normal")}
      {...getReducedMotionProps(motionPreferences.reduceMotion)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
