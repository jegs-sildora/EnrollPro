import { motion } from "motion/react";
import type { ReactNode, ComponentProps } from "react";
import { pageTransition, pageVariants } from "@/shared/lib/motion";

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
