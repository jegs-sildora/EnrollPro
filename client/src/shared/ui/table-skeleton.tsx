import { Skeleton } from "@/shared/ui/skeleton";

export const TableSkeleton = () => (
  <div className="rounded-lg border overflow-hidden">
    <div className="bg-muted px-4 py-3 border-b flex items-center justify-between gap-4">
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[100px]" />
      <Skeleton className="h-4 w-[100px]" />
      <Skeleton className="h-4 w-[100px]" />
    </div>
    {[...Array(6)].map((_, i) => (
      <div key={i} className="px-4 py-4 border-b flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-[250px]" />
        <Skeleton className="h-5 w-[80px]" />
        <Skeleton className="h-5 w-[80px]" />
        <Skeleton className="h-5 flex-1" />
      </div>
    ))}
  </div>
);
