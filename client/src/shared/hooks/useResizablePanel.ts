import { useState, useEffect, useCallback, useRef } from "react";

interface ResizablePanelOptions {
  centered?: boolean;
  storageKey?: string;
}

const MIN_PANEL_PERCENTAGE = 20;
const MAX_PANEL_PERCENTAGE = 95;
const STORAGE_PREFIX = "enrollpro:resizable-panel:";

function clampPercentage(value: number): number {
  return Math.max(MIN_PANEL_PERCENTAGE, Math.min(MAX_PANEL_PERCENTAGE, value));
}

function getStoredPercentage(initialPercentage: number, storageKey?: string): number {
  if (!storageKey || typeof window === "undefined") return clampPercentage(initialPercentage);

  try {
    const storedValue = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (storedValue === null) return clampPercentage(initialPercentage);

    const parsedValue = Number(storedValue);
    return Number.isFinite(parsedValue)
      ? clampPercentage(parsedValue)
      : clampPercentage(initialPercentage);
  } catch {
    return clampPercentage(initialPercentage);
  }
}

export function useResizablePanel(
  initialPercentage: number = 50,
  options?: ResizablePanelOptions,
) {
  const storageKey = options?.storageKey;
  const [panelPercentage, setPanelPercentage] = useState(() =>
    getStoredPercentage(initialPercentage, storageKey),
  );
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const percentageRef = useRef(panelPercentage);

  useEffect(() => {
    percentageRef.current = panelPercentage;
  }, [panelPercentage]);

  useEffect(() => {
    const checkViewport = () => {
      setIsDesktopViewport(window.innerWidth >= 640);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  const createResizeHandler = useCallback((side: "left" | "right") => {
    return (mouseDownEvent: React.MouseEvent) => {
      mouseDownEvent.preventDefault();
      const startX = mouseDownEvent.clientX;
      const startPercentage = percentageRef.current;

      const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
        const deltaX = mouseMoveEvent.clientX - startX;
        let percentageDelta = (deltaX / window.innerWidth) * 100;

        if (side === "left") {
          percentageDelta = -percentageDelta;
        }

        if (options?.centered) {
          percentageDelta *= 2;
        }

        const nextPercentage = clampPercentage(startPercentage + percentageDelta);
        percentageRef.current = nextPercentage;
        setPanelPercentage(nextPercentage);
      };

      const handleMouseUp = () => {
        if (storageKey) {
          try {
            window.localStorage.setItem(
              `${STORAGE_PREFIX}${storageKey}`,
              String(percentageRef.current),
            );
          } catch {
            // Storage can be unavailable in restricted browser contexts.
          }
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };
  }, [options?.centered, storageKey]);

  const startResizing = createResizeHandler("left");
  const startResizingRight = createResizeHandler("right");

  return {
    panelPercentage,
    isDesktopViewport,
    startResizing,
    startResizingRight,
  };
}
