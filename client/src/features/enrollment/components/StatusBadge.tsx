import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { STATUS_CONFIG } from "../constants";

export function StatusBadge({
  status,
  className: extraClassName,
}: {
  status: string;
  className?: string;
}) {
  const { label, className } = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-muted text-foreground border-muted-foreground",
  };
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
        "h-auto py-1 px-3 whitespace-normal text-center leading-tight bg-white justify-center",
        className,
        isTemp ? "cursor-help" : "",
        extraClassName,
      )}
      aria-label={`Status: ${label}`}>
      {isTemp ? "🟠 " : ""}
      {label}
    </Badge>
  );
}
