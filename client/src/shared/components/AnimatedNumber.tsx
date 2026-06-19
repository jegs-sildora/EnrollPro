import { cn } from "@/shared/lib/utils";

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
};

/**
 * AnimatedNumber — Renders formatted numbers without rolling animation.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
}: AnimatedNumberProps) {
  const formattedValue = new Intl.NumberFormat("en-PH", {
    notation: "standard",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value);

  return (
    <span className={cn(className)}>
      {prefix}{formattedValue}{suffix}
    </span>
  );
}
