import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";

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

  const [isResizingState, setIsResizingState] = useState(false);

  function stopResizing() {
    isResizing.current = false;
    setIsResizingState(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
  }

  const startResizing = useCallback(() => {
    if (!isDesktopViewport) return;
    isResizing.current = true;
    setIsResizingState(true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
  }, [handleMouseMove, isDesktopViewport]);

  useLayoutEffect(() => {
    if (isResizingState) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    }
  }, [isResizingState]);

  return {
    panelPercentage,
    isDesktopViewport,
    startResizing,
  };
}
