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
  | "generic"
  | "enrollmentForm"
  | "learnerProfile";

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

export function LearnerProfileSkeleton({ className }: SkeletonLayoutProps) {
  return (
    <div className={cn("flex flex-col md:flex-row w-full h-full min-h-[calc(100vh-64px)] overflow-hidden bg-background", className)}>
      {/* Left Pane (Sidebar) */}
      <div className="hidden md:flex md:w-[30%] bg-muted/30 md:border-r border-border md:h-full flex-col justify-between py-8 px-6 sm:py-12 shrink-0">
        <div className="flex flex-col items-center w-full">
          <Skeleton className="w-36 h-36 sm:w-40 sm:h-40 rounded-full mb-5 sm:mb-6 shrink-0" />
          <div className="w-full flex flex-col items-center space-y-3">
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          
          <div className="w-full flex flex-col items-center space-y-3 mt-8">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>

        <div className="flex flex-col items-center w-full mt-12 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      </div>

      {/* Right Pane (Main Content) */}
      <div className="flex-1 w-full md:w-[70%] bg-background h-full overflow-hidden flex flex-col p-6 md:p-8 shrink-0">
        <Skeleton className="h-8 w-48 mb-6" />
        
        <div className="flex space-x-2 w-full mb-8 bg-muted/50 p-1 rounded-md">
          <Skeleton className="h-10 flex-1 rounded-sm" />
          <Skeleton className="h-10 flex-1 rounded-sm" />
        </div>
        
        <div className="bg-background border border-border shadow-sm rounded-sm p-6 space-y-6 flex-1">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-3/4 max-w-lg" />
          </div>
          
          <div className="border border-border rounded-sm overflow-hidden">
            <div className="grid grid-cols-4 bg-muted/50 p-3 border-b border-border">
              <Skeleton className="h-5 w-24 mx-auto" />
              <Skeleton className="h-5 w-32 mx-auto" />
              <Skeleton className="h-5 w-24 mx-auto" />
              <Skeleton className="h-5 w-20 mx-auto" />
            </div>
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="grid grid-cols-4 p-4 border-b border-border last:border-0 items-center">
                <Skeleton className="h-4 w-4/5" />
                <div className="flex justify-center gap-4">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-4 w-12 mx-auto" />
                <Skeleton className="h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
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
    case "form":
      return <FormSkeleton />;
    case "enrollmentForm":
      return <EnrollmentFormSkeleton />;
    case "learnerProfile":
      return <LearnerProfileSkeleton />;
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

export function EnrollmentFormSkeleton() {
  return (
    <SkeletonShell className="max-w-6xl mx-auto p-4 md:p-0">
      <div className="mb-6 h-10 w-48 rounded-md bg-muted/50" />
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 lg:p-10 space-y-12">
        
        {/* Header */}
        <div className="space-y-2 border-b border-border pb-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Section I */}
        <div className="space-y-6">
          <Skeleton className="h-6 w-48" />
          
          <div className="p-6 border rounded-2xl space-y-4 bg-muted/20 border-border">
            <div className="space-y-2">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-4 w-72" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="w-32 h-32 rounded-xl" />
            </div>
            <div className="md:col-span-3 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-12 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-full" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-12 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-12 w-full" /></div>
                <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-12 w-full" /></div>
              </div>
            </div>
          </div>
        </div>

        {/* Section II */}
        <div className="space-y-6 pt-6 border-t border-border">
          <Skeleton className="h-6 w-56" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div>
          </div>
        </div>

      </div>
    </SkeletonShell>
  );
}
