import { motion } from "motion/react";
import type { ReactNode, ComponentProps } from "react";
import {
  useMotionPreferences,
} from "@/shared/lib/motion";

interface PageTransitionProps extends ComponentProps<typeof motion.div> {
  children: ReactNode;
}

export function PageTransition({ children, ...props }: PageTransitionProps) {
  const motionPreferences = useMotionPreferences();
  const variants = {
    initial: {
      opacity: 0,
      y: motionPreferences.reduceMotion ? 0 : 12,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: motionPreferences.reduceMotion ? 0 : -8,
    },
  };

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: motionPreferences.reduceMotion ? 0.16 : 0.4,
        ease: "easeInOut",
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
