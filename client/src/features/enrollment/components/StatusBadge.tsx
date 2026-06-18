import { Badge } from "@/shared/ui/badge";
import { cn, formatApplicationStatus, getApplicationStatusColorClasses } from "@/shared/lib/utils";

export function StatusBadge({
  status,
  className: extraClassName,
}: {
  status: string;
  className?: string;
}) {
  const label = formatApplicationStatus(status);
  const colorClasses = getApplicationStatusColorClasses(status);
  
  const isTemp = status === "TEMPORARILY_ENROLLED";

  return (
    <Badge
      variant="outline"
      title={
        isTemp
          ? "Missing Documents: PSA Birth Certificate or SF9 Permanent Record"
          : undefined
      }
      className={cn(
        "h-auto py-1 px-2.5.5 whitespace-nowrap text-center leading-tight justify-center border-none",
        colorClasses,
        isTemp ? "cursor-help" : "",
        extraClassName,
      )}
      aria-label={`Status: ${label}`}>
      {isTemp ? "🟠 " : ""}
      {label}
    </Badge>
  );
}
