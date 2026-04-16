import { useState, useEffect, useCallback, useRef } from "react";

const DESKTOP_PANEL_BREAKPOINT = 1024;

export function useResizablePanel() {
  const [panelPercentage, setPanelPercentage] = useState(45); // Default 45vw
  const isResizing = useRef(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth >= DESKTOP_PANEL_BREAKPOINT
      : true,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= DESKTOP_PANEL_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current || !isDesktopViewport) return;
      const newWidthPercent =
        ((window.innerWidth - e.clientX) / window.innerWidth) * 100;

      // Constraints: Between 20% and 95%
      if (newWidthPercent > 20 && newWidthPercent < 95) {
        setPanelPercentage(newWidthPercent);
      }
    },
    [isDesktopViewport],
  );

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    if (!isDesktopViewport) return;
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, isDesktopViewport, stopResizing]);

  return {
    panelPercentage,
    isDesktopViewport,
    startResizing,
  };
}
