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
      y: motionPreferences.reduceMotion ? 8 : 18,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: motionPreferences.reduceMotion ? -4 : -10,
    },
  };

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: motionPreferences.reduceMotion ? 0.1 : 0.2,
        ease: "easeInOut",
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
