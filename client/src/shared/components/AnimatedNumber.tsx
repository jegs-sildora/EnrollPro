import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import { cn } from "@/shared/lib/utils";

// Spring easing — slight natural overshoot that settles cleanly
const SPRING = "linear(0,0.006,0.025 2.8%,0.101 6.1%,0.539 18.9%,0.721 25.3%,0.849 31.5%,0.937 38.1%,0.968 41.8%,1.001 50.1%,1.013 55.7%,1.018 61.8%,1.013 69.3%,1.003 80.1%,1)";

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
};

/**
 * AnimatedNumber — wraps NumberFlow with en-PH locale and standard formatting.
 *
 * Starts at 0 on mount and rolls up to `value` on the next frame so the
 * animation always plays even when the parent conditionally renders this
 * component only after data is available (skeleton → real content pattern).
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix,
  prefix,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    setDisplay(value);
  }, [value]);

  return (
    <NumberFlow
      value={display}
      locales="en-PH"
      format={{
        notation: "standard",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
      }}
      transformTiming={{ duration: 750, easing: SPRING }}
      spinTiming={{ duration: 750, easing: SPRING }}
      opacityTiming={{ duration: 400, easing: "ease-out" }}
      suffix={suffix}
      prefix={prefix}
      className={cn(className)}
    />
  );
}
