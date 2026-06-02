import { useState, useEffect, useCallback } from "react";

export function useResizablePanel() {
  const [panelPercentage, setPanelPercentage] = useState(35);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsDesktopViewport(window.innerWidth >= 640);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    
    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      const percentage = ((window.innerWidth - mouseMoveEvent.clientX) / window.innerWidth) * 100;
      // Constraint between 20vw and 80vw
      setPanelPercentage(Math.max(20, Math.min(80, percentage)));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  return {
    panelPercentage,
    isDesktopViewport,
    startResizing,
  };
}
