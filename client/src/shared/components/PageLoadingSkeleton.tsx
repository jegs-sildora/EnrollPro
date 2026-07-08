import { motion } from "motion/react";
import { Skeleton } from "@/shared/ui/skeleton";
import { useState, useEffect } from "react";

interface PageLoadingSkeletonProps {
  withDelay?: boolean;
}

export function PageLoadingSkeleton({ withDelay = false }: PageLoadingSkeletonProps) {
  const [show, setShow] = useState(!withDelay);

  useEffect(() => {
    if (!withDelay) return;
    const timer = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(timer);
  }, [withDelay]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col w-full h-full min-h-0 space-y-6"
    >
      <div className="space-y-2">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
      <Skeleton className="flex-1 w-full rounded-xl" />
    </motion.div>
  );
}
