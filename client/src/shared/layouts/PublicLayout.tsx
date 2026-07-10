import type { ReactNode } from "react";
import { useLocation, Outlet } from "react-router";
import { AnimatePresence } from "motion/react";
import { PageTransition } from "@/shared/components/PageTransition";

export default function PublicLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}${location.hash}:${location.key}`;

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={routeKey}>
        {children ? children : <Outlet />}
      </PageTransition>
    </AnimatePresence>
  );
}
