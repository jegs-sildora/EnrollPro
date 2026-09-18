import { useState, useEffect, useCallback, useRef } from "react";

export function useResizablePanel(initialPercentage: number = 50, options?: { centered?: boolean }) {
  const [panelPercentage, setPanelPercentage] = useState(initialPercentage);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const percentageRef = useRef(initialPercentage);

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

        const nextPercentage = Math.max(20, Math.min(95, startPercentage + percentageDelta));
        setPanelPercentage(nextPercentage);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };
  }, [options?.centered]);

  const startResizing = createResizeHandler("left");
  const startResizingRight = createResizeHandler("right");

  return {
    panelPercentage,
    isDesktopViewport,
    startResizing,
    startResizingRight,
  };
}
