import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBlocker, useNavigate, type NavigateOptions, type To } from "react-router";
import { sileo } from "sileo";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

export interface UnsavedChangeSource {
  id: string;
  label: string;
  isDirty: boolean;
  isSubmitting?: boolean;
  onDiscard?: () => void | Promise<void>;
  onSave?: () => void | Promise<void>;
  saveLabel?: string;
  showStickyBar?: boolean;
}

interface UnsavedChangesContextValue {
  hasDirtyChanges: boolean;
  dirtySources: UnsavedChangeSource[];
  registerSource: (source: UnsavedChangeSource) => void;
  unregisterSource: (id: string) => void;
  confirmOrRun: (action: () => void | Promise<void>) => void;
  discardAll: () => Promise<void>;
}

interface UnsavedChangesBarProps {
  isSubmitting?: boolean;
  onDiscard: () => void | Promise<void>;
  onSave?: () => void | Promise<void>;
  saveLabel?: string;
  message?: string;
  className?: string;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
);

function sourceKey(source: UnsavedChangeSource): string {
  return `${source.id}:${source.isDirty ? "dirty" : "clean"}:${source.isSubmitting ? "submitting" : "idle"}`;
}

function UnsavedChangesDialog({
  open,
  loading,
  onStay,
  onDiscard,
}: {
  open: boolean;
  loading: boolean;
  onStay: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !loading) {
          onStay();
        }
      }}>
      <DialogContent
        aria-describedby={undefined}
        className="w-full max-w-3xl overflow-hidden rounded-lg bg-card p-0 shadow-2xl">
        <div className="border-b border-border bg-muted/40 px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-2">
                <DialogTitle className="text-2xl font-extrabold">
                  Unsaved Changes
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed text-foreground">
                  You have changes that are not saved yet. If you leave now,
                  those changes will be discarded.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-3 p-4 sm:flex-row sm:items-center sm:justify-end sm:p-6">
          <Button
            type="button"
            variant="outline"
            onClick={onStay}
            disabled={loading}
            className="h-auto flex-1 py-2 text-sm sm:flex-initial sm:text-base">
            Stay on Page
          </Button>
          <Button
            type="button"
            onClick={onDiscard}
            disabled={loading}
            className="h-auto flex-1 py-2 text-sm sm:flex-initial sm:text-base">
            {loading ? "Discarding..." : "Discard Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UnsavedChangesBar({
  isSubmitting = false,
  onDiscard,
  onSave,
  saveLabel = "Save Changes",
  message = "You have unsaved changes.",
  className,
}: UnsavedChangesBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 left-0 sm:left-64 z-50 animate-in slide-in-from-bottom-6 border-t border-border bg-card p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-end gap-3 px-4 sm:px-6 md:px-8",
        className,
      )}>
      <span className="mr-auto hidden text-sm leading-tight text-foreground sm:inline-block sm:text-base">
        {message}
      </span>
      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void onDiscard();
          }}
          disabled={isSubmitting}
          className="h-auto flex-1 py-2 text-sm sm:flex-initial sm:text-base">
          Discard Changes
        </Button>
        {onSave ? (
          <Button
            type="button"
            onClick={() => {
              void onSave();
            }}
            disabled={isSubmitting}
            className="h-auto flex-1 py-2 text-sm sm:flex-initial sm:text-base">
            {isSubmitting ? "Saving..." : saveLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Record<string, UnsavedChangeSource>>(
    {},
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const suppressNextNavigationBlockRef = useRef(false);
  const navigate = useNavigate();

  const dirtySources = useMemo(
    () => Object.values(sources).filter((source) => source.isDirty),
    [sources],
  );
  const hasDirtyChanges = dirtySources.length > 0;

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (suppressNextNavigationBlockRef.current) {
      suppressNextNavigationBlockRef.current = false;
      return false;
    }

    if (!hasDirtyChanges) return false;

    const currentRoute = `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;
    const nextRoute = `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`;
    return currentRoute !== nextRoute;
  });

  const registerSource = useCallback((source: UnsavedChangeSource) => {
    setSources((current) => {
      const existing = current[source.id];
      if (
        existing &&
        sourceKey(existing) === sourceKey(source) &&
        existing.label === source.label &&
        existing.onDiscard === source.onDiscard &&
        existing.onSave === source.onSave &&
        existing.saveLabel === source.saveLabel &&
        existing.showStickyBar === source.showStickyBar
      ) {
        return current;
      }

      return {
        ...current,
        [source.id]: source,
      };
    });
  }, []);

  const unregisterSource = useCallback((id: string) => {
    setSources((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const discardAll = useCallback(async () => {
    const callbacks = dirtySources
      .map((source) => source.onDiscard)
      .filter((callback): callback is () => void | Promise<void> =>
        Boolean(callback),
      );

    for (const callback of callbacks.reverse()) {
      await callback();
    }
  }, [dirtySources]);

  const confirmOrRun = useCallback(
    (action: () => void | Promise<void>) => {
      if (!hasDirtyChanges) {
        void action();
        return;
      }

      pendingActionRef.current = action;
      setDialogOpen(true);
    },
    [hasDirtyChanges],
  );

  useEffect(() => {
    if (!hasDirtyChanges) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.dataset.unsavedGuardIgnore === "true") return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextRoute = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (currentRoute === nextRoute) return;

      event.preventDefault();
      event.stopPropagation();
      confirmOrRun(() => navigate(nextRoute));
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [confirmOrRun, hasDirtyChanges, navigate]);

  const handleStay = useCallback(() => {
    pendingActionRef.current = null;
    setDialogOpen(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }, [blocker]);

  const handleDiscard = useCallback(async () => {
    setDiscarding(true);
    try {
      await discardAll();
      const pendingAction = pendingActionRef.current;
      pendingActionRef.current = null;
      setDialogOpen(false);

      if (pendingAction) {
        suppressNextNavigationBlockRef.current = true;
        await pendingAction();
        return;
      }

      if (blocker.state === "blocked") {
        blocker.proceed();
      }
    } catch (error) {
      sileo.error({
        title: "Could not discard changes",
        description:
          error instanceof Error
            ? error.message
            : "Please try again before leaving this page.",
      });
      if (blocker.state === "blocked") {
        blocker.reset();
      }
    } finally {
      setDiscarding(false);
    }
  }, [blocker, discardAll]);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setDialogOpen(true);
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!hasDirtyChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasDirtyChanges]);

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({
      hasDirtyChanges,
      dirtySources,
      registerSource,
      unregisterSource,
      confirmOrRun,
      discardAll,
    }),
    [
      confirmOrRun,
      dirtySources,
      discardAll,
      hasDirtyChanges,
      registerSource,
      unregisterSource,
    ],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={dialogOpen}
        loading={discarding}
        onStay={handleStay}
        onDiscard={() => {
          void handleDiscard();
        }}
      />
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesContext() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error(
      "useUnsavedChangesContext must be used inside UnsavedChangesProvider",
    );
  }
  return context;
}

export function useUnsavedChanges(source: UnsavedChangeSource) {
  const { registerSource, unregisterSource } = useUnsavedChangesContext();
  const sourceIdRef = useRef(source.id);

  useLayoutEffect(() => {
    if (sourceIdRef.current !== source.id) {
      unregisterSource(sourceIdRef.current);
      sourceIdRef.current = source.id;
    }

    registerSource(source);
  }, [
    registerSource,
    source.id,
    source.label,
    source.isDirty,
    source.isSubmitting,
    source.onDiscard,
    source.onSave,
    source.saveLabel,
    source.showStickyBar,
    unregisterSource,
  ]);

  useEffect(() => {
    return () => {
      unregisterSource(sourceIdRef.current);
    };
  }, [unregisterSource]);
}

export function useUnsavedChangesPrompt() {
  const { confirmOrRun, hasDirtyChanges, dirtySources, discardAll } =
    useUnsavedChangesContext();

  return {
    confirmOrRun,
    hasDirtyChanges,
    dirtySources,
    discardAll,
  };
}

export function useGuardedTabChange<TValue extends string>(
  onChange: (value: TValue) => void,
) {
  const { confirmOrRun } = useUnsavedChangesPrompt();

  return useCallback(
    (value: TValue) => {
      confirmOrRun(() => onChange(value));
    },
    [confirmOrRun, onChange],
  );
}

export function useGuardedNavigate() {
  const navigate = useNavigate();
  const { confirmOrRun } = useUnsavedChangesPrompt();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      confirmOrRun(() => {
        if (typeof to === "number") {
          navigate(to);
          return;
        }

        navigate(to, options);
      });
    },
    [confirmOrRun, navigate],
  );
}

export function useGuardedOpenChange(
  onOpenChange: (open: boolean) => void,
) {
  const { confirmOrRun } = useUnsavedChangesPrompt();

  return useCallback(
    (open: boolean) => {
      if (open) {
        onOpenChange(true);
        return;
      }

      confirmOrRun(() => onOpenChange(false));
    },
    [confirmOrRun, onOpenChange],
  );
}
