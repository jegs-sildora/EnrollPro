import { motion, type Easing } from "motion/react";
import type { ReactNode, ComponentProps } from "react";

export const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -10,
  },
};

export const pageTransition = {
  duration: 0.2,
  ease: "easeOut" as Easing,
};

interface PageTransitionProps extends ComponentProps<typeof motion.div> {
  children: ReactNode;
  routeKey: string;
}

export function PageTransition({ children, routeKey, ...props }: PageTransitionProps) {
  return (
    <motion.div
      key={routeKey}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      {...props}
    >
      {children}
    </motion.div>
  );
}
