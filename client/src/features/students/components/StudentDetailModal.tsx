import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import { useUnsavedChangesPrompt } from "@/shared/hooks/useUnsavedChanges";
import { StudentDetailPanel } from "./StudentDetailPanel";

import type { ComponentProps } from "react";

type Props = ComponentProps<typeof StudentDetailPanel>;

export function StudentDetailModal(props: Props) {
  const { panelPercentage, isDesktopViewport, startResizing, startResizingRight } = useResizablePanel(50, {
    centered: true,
    storageKey: "student-detail-modal",
  });
  const { confirmOrRun } = useUnsavedChangesPrompt();

  return (
    <Dialog 
      open={props.id !== null} 
      onOpenChange={(open) => {
        if (!open) confirmOrRun(props.onClose);
      }}
    >
      <DialogContent
        showClose={false}
        aria-describedby={undefined}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          confirmOrRun(props.onClose);
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          confirmOrRun(props.onClose);
        }}
        className="p-0 flex flex-col h-[90vh] md:h-[95vh] border overflow-visible w-full sm:w-auto sm:max-w-none max-w-[95vw]"
        style={isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined}
      >
        {/* Left Resize Handle */}
        <div
          onMouseDown={startResizing}
          className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group rounded-l-md"
        >
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        {/* Right Resize Handle */}
        <div
          onMouseDown={startResizingRight}
          className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group rounded-r-md"
        >
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        {props.id !== null && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-background rounded-md">
            <StudentDetailPanel {...props} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
