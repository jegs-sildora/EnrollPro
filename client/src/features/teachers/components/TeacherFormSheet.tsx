import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, User } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ImageEnlarger } from "@/shared/components/ImageEnlarger";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import type { TeacherFormState } from "../types";

type TeacherFormField = Exclude<keyof TeacherFormState, "photo">;

interface TeacherFormSheetProps {
  mode: "create" | "edit";
  open: boolean;
  title: string;
  description: string;
  formData: TeacherFormState;
  photoPreviewUrl: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (field: TeacherFormField, value: string) => void;
  onPhotoSelect: (file: File | undefined) => void;
  onRemovePhoto: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function TeacherFormSheet({
  mode,
  open,
  title,
  description,
  formData,
  photoPreviewUrl,
  submitting,
  canSubmit,
  onOpenChange,
  onFieldChange,
  onPhotoSelect,
  onRemovePhoto,
  onCancel,
  onSubmit,
}: TeacherFormSheetProps) {
  const [panelPercentage, setPanelPercentage] = useState(45);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true,
  );
  const isResizing = useRef(false);
  const [isPhotoEnlarged, setIsPhotoEnlarged] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 640);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isResizing.current || !isDesktopViewport) {
        return;
      }

      const newWidthPercent =
        ((window.innerWidth - event.clientX) / window.innerWidth) * 100;
      if (newWidthPercent > 20 && newWidthPercent < 95) {
        setPanelPercentage(newWidthPercent);
      }
    },
    [isDesktopViewport],
  );

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    if (!isDesktopViewport) {
      return;
    }

    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing, { once: true });
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, isDesktopViewport, stopResizing]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mouseup", stopResizing);
      stopResizing();
    };
  }, [stopResizing]);

  const submitLabel = mode === "create" ? "Create Teacher" : "Save Changes";
  const submittingLabel = mode === "create" ? "Creating..." : "Saving...";
  const photoHint =
    mode === "create"
      ? "Use the file picker to upload. JPG, PNG, or WEBP up to 5 MB."
      : "Use the file picker to replace the current photo.";
  const canShowPhoto = Boolean(photoPreviewUrl);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setIsPhotoEnlarged(false);
        }
        onOpenChange(nextOpen);
      }}>
      <SheetContent
        side="right"
        className="p-0 flex flex-row border-l overflow-visible w-screen sm:w-auto sm:max-w-none"
        style={
          isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
        }>
        <div
          onMouseDown={startResizing}
          className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group">
          <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <SheetHeader className="space-y-1 border-b bg-primary px-6 py-4 pr-14 shrink-0">
            <SheetTitle className="text-base sm:text-lg text-primary-foreground font-black tracking-tight uppercase">
              {title}
            </SheetTitle>
            <SheetDescription className="text-[11px] sm:text-xs text-primary-foreground/90 font-medium">
              {description}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[hsl(var(--muted))] p-3 sm:p-4 rounded-md border space-y-4">
              <div className="flex flex-col items-center pt-2">
                <div
                  className={`w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-primary border-dashed shadow-md overflow-hidden bg-background flex items-center justify-center mb-4 ${canShowPhoto ? "cursor-zoom-in hover:border-solid transition-all" : ""}`}
                  onClick={() => {
                    if (canShowPhoto) {
                      setIsPhotoEnlarged(true);
                    }
                  }}>
                  {canShowPhoto ? (
                    <img
                      src={photoPreviewUrl || ""}
                      alt="Teacher preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                      <User className="w-10 h-10 mb-1 opacity-20" />
                      <span className="text-[0.5rem] font-black uppercase tracking-tighter opacity-40">
                        Teacher Photo
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center mb-3">
                  {photoHint}
                </p>

                <div className="w-full max-w-md space-y-2">
                  <Label className="text-sm font-medium">Upload Photo</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      onPhotoSelect(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRemovePhoto}
                      disabled={!formData.photo}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4 sm:p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    placeholder="e.g. Santos"
                    value={formData.lastName}
                    onChange={(event) =>
                      onFieldChange("lastName", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    placeholder="e.g. Maria"
                    value={formData.firstName}
                    onChange={(event) =>
                      onFieldChange("firstName", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Middle Name</Label>
                  <Input
                    placeholder="e.g. Cruz"
                    value={formData.middleName}
                    onChange={(event) =>
                      onFieldChange("middleName", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="e.g. maria.santos@example.com"
                    value={formData.email}
                    onChange={(event) =>
                      onFieldChange("email", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input
                    placeholder="e.g. EMP-001"
                    value={formData.employeeId}
                    onChange={(event) =>
                      onFieldChange("employeeId", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input
                    placeholder="e.g. 09171234567"
                    inputMode="numeric"
                    maxLength={11}
                    pattern="\\d{11}"
                    title="Contact number must be 11 digits"
                    value={formData.contactNumber}
                    onChange={(event) =>
                      onFieldChange("contactNumber", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Specialization</Label>
                  <Input
                    placeholder="e.g. Mathematics"
                    value={formData.specialization}
                    onChange={(event) =>
                      onFieldChange("specialization", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subjects (comma separated)</Label>
                  <Input
                    placeholder="e.g. Algebra, Geometry"
                    value={formData.subjectsText}
                    onChange={(event) =>
                      onFieldChange("subjectsText", event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !canSubmit}
              className="w-full sm:w-auto">
              {submitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </div>
      </SheetContent>

      {canShowPhoto && (
        <ImageEnlarger
          src={photoPreviewUrl || ""}
          isOpen={isPhotoEnlarged}
          onClose={() => setIsPhotoEnlarged(false)}
          alt="Teacher photo"
        />
      )}
    </Sheet>
  );
}
