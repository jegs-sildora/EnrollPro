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

export function PageLoadingSkeleton({ className: _c, withDelay: _w = true }: PageLoadingSkeletonProps) {
  return null;
}

export function SkeletonPageHeader({ className: _c }: SkeletonLayoutProps) {
  return null;
}

export function MetricCardSkeleton() {
  return null;
}

export function ToolbarSkeleton({ controls: _ctrls = 3 }: { controls?: number }) {
  return null;
}

export function DataTableSkeleton({
  rows: _r = 50,
  columns: _c = 5,
  dense: _d = false,
  className: _cls,
}: {
  rows?: number;
  columns?: number;
  dense?: boolean;
  className?: string;
}) {
  return null;
}

export function CardGridSkeleton({ count: _c = 6, className: _cls }: { count?: number; className?: string }) {
  return null;
}

export function FormSkeleton({ sections: _s = 3, className: _cls }: { sections?: number; className?: string }) {
  return null;
}

export function TwoPanelSkeleton({ className: _c }: SkeletonLayoutProps) {
  return null;
}

export function DetailPanelSkeleton({ className: _c }: SkeletonLayoutProps) {
  return null;
}

export function ModalBodySkeleton({ className: _c }: SkeletonLayoutProps) {
  return null;
}

export function LearnerProfileSkeleton({ className: _c }: SkeletonLayoutProps) {
  return null;
}

export function EnrollmentFormSkeleton() {
  return null;
}
