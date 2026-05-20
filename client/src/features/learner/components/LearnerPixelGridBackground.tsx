import { useId } from "react";
import { useSettingsStore } from "@/store/settings.slice";

export function LearnerPixelGridBackground() {
  const { accentForeground } = useSettingsStore();
  const strokeColor = accentForeground === "0 0% 0%" ? "black" : "white";
  const patternId = `learner-pixel-grid-${useId().replace(/:/g, "")}`;

  return (
    <div
      className="fixed inset-0 -z-10"
      style={{ background: "hsl(var(--accent))" }}>
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.15]"
        xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse">
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              rx="2"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <rect
              x="42"
              y="2"
              width="36"
              height="36"
              rx="2"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <rect
              x="2"
              y="42"
              width="36"
              height="36"
              rx="2"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <rect
              x="42"
              y="42"
              width="36"
              height="36"
              rx="2"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--accent-foreground) / 0.1) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
