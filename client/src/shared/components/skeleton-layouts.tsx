import { motion } from "motion/react";
import React from "react";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useMotionPreferences } from "@/shared/lib/motion";

export type SkeletonPageVariant =
  | "dashboard"
  | "registry"
  | "cardGrid"
  | "twoPanel"
  | "settings"
  | "detail"
  | "modal"
  | "form"
  | "generic";

interface SkeletonLayoutProps {
  className?: string;
}

interface PageLoadingSkeletonProps extends SkeletonLayoutProps {
  withDelay?: boolean;
  variant?: SkeletonPageVariant;
}

function SkeletonShell({ children, className }: { children: React.ReactNode; className?: string }) {
  const motionPreferences = useMotionPreferences();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: motionPreferences.reduceMotion ? 0 : 0.2 }}
      className={cn("flex min-h-0 w-full flex-1 flex-col gap-6", className)}
    >
      <span className="sr-only">Loading content</span>
      {children}
    </motion.div>
  );
}

export function SkeletonPageHeader({ className }: SkeletonLayoutProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-10 w-full max-w-[420px]" />
      <Skeleton className="h-5 w-full max-w-[640px]" />
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
    </div>
  );
}

export function ToolbarSkeleton({ controls = 3 }: { controls?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center">
      <Skeleton className="h-12 min-w-[260px] flex-1" />
      {Array.from({ length: controls }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full lg:w-44" />
      ))}
    </div>
  );
}

export function DataTableSkeleton({
  rows = 50,
  columns = 5,
  dense = false,
  className,
}: {
  rows?: number;
  columns?: number;
  dense?: boolean;
  className?: string;
}) {
  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="grid border-b bg-muted/50" style={gridStyle}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className={cn("px-4", dense ? "py-2" : "py-3")}>
            <Skeleton className={cn("h-4", index === 0 ? "w-32" : "w-24")} />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            "grid border-b last:border-b-0",
            dense ? "min-h-10" : "min-h-16",
          )}
          style={gridStyle}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <div key={columnIndex} className={cn("flex items-center px-4", dense ? "py-2" : "py-4")}>
              <Skeleton
                className={cn(
                  "h-5",
                  columnIndex === 0 ? "w-4/5" : columnIndex === columns - 1 ? "w-20" : "w-24",
                )}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="mt-5 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ sections = 3, className }: { sections?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="rounded-xl border bg-card p-5 shadow-sm">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-4 w-80" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TwoPanelSkeleton({ className }: SkeletonLayoutProps) {
  return (
    <div className={cn("grid min-h-[640px] overflow-hidden rounded-xl border bg-card lg:grid-cols-2", className)}>
      <div className="border-r p-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-5 w-80" />
        <div className="mt-6 flex gap-3">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 w-40" />
        </div>
        <DataTableSkeleton rows={12} columns={3} className="mt-6 rounded-lg" />
      </div>
      <div className="p-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-5 w-56" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-5 h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailPanelSkeleton({ className }: SkeletonLayoutProps) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>
      <FormSkeleton sections={2} />
    </div>
  );
}

export function ModalBodySkeleton({ className }: SkeletonLayoutProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <DataTableSkeleton rows={8} columns={4} className="rounded-lg" />
    </div>
  );
}

function renderVariant(variant: SkeletonPageVariant) {
  switch (variant) {
    case "dashboard":
      return (
        <>
          <SkeletonPageHeader />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <MetricCardSkeleton key={index} />)}
          </div>
          <div className="grid flex-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Skeleton className="min-h-[360px] rounded-xl" />
            <Skeleton className="min-h-[360px] rounded-xl" />
          </div>
        </>
      );
    case "registry":
      return (
        <>
          <SkeletonPageHeader />
          <ToolbarSkeleton controls={3} />
          <DataTableSkeleton />
        </>
      );
    case "cardGrid":
      return (
        <>
          <SkeletonPageHeader />
          <ToolbarSkeleton controls={2} />
          <CardGridSkeleton />
        </>
      );
    case "twoPanel":
      return (
        <>
          <SkeletonPageHeader />
          <TwoPanelSkeleton />
        </>
      );
    case "settings":
    case "form":
      return (
        <>
          <SkeletonPageHeader />
          <FormSkeleton sections={3} />
        </>
      );
    case "detail":
      return <DetailPanelSkeleton />;
    case "modal":
      return <ModalBodySkeleton />;
    case "generic":
    default:
      return (
        <>
          <SkeletonPageHeader />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <MetricCardSkeleton key={index} />)}
          </div>
          <DataTableSkeleton rows={20} />
        </>
      );
  }
}

export function PageLoadingSkeleton({
  withDelay = false,
  variant = "generic",
  className,
}: PageLoadingSkeletonProps) {
  const [show, setShow] = React.useState(!withDelay);

  React.useEffect(() => {
    if (!withDelay) return;
    const timer = window.setTimeout(() => setShow(true), 300);
    return () => window.clearTimeout(timer);
  }, [withDelay]);

  if (!show) return null;

  return (
    <SkeletonShell className={className}>
      {renderVariant(variant)}
    </SkeletonShell>
  );
}
