import type { ReactNode } from "react";
import { useLocation, Outlet } from "react-router";
import { AnimatePresence } from "motion/react";
import { PageTransition } from "@/shared/components/PageTransition";

export default function PublicLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <PageTransition routeKey={location.pathname}>
        {children ? children : <Outlet />}
      </PageTransition>
    </AnimatePresence>
  );
}
