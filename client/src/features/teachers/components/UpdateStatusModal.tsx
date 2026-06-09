import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCog, Loader2 } from "lucide-react";
import { updateServiceStatusSchema } from "@enrollpro/shared";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import type { UpdateServiceStatusInput } from "@enrollpro/shared";
import type { Teacher } from "../types";
import { formatTeacherName } from "../utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/shared/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

const SERVICE_STATUS_OPTIONS: Array<{
  value: UpdateServiceStatusInput["status"];
  label: string;
}> = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "TRANSFERRED", label: "Transferred" },
  { value: "RETIRED_RESIGNED", label: "Retired / Resigned" },
  { value: "DROPPED_FROM_ROLLS", label: "Dropped from Rolls" },
];

interface UpdateStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: Teacher | null;
  onSave: (input: UpdateServiceStatusInput) => Promise<void>;
  saving: boolean;
}

export function UpdateStatusModal({
  open,
  onOpenChange,
  teacher,
  onSave,
  saving,
}: UpdateStatusModalProps) {
  const form = useForm<UpdateServiceStatusInput>({
    resolver: zodResolver(updateServiceStatusSchema),
    defaultValues: {
      status: teacher?.serviceStatus ?? "ACTIVE",
      effectiveDate: new Date().toISOString().slice(0, 10),
      remarks: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSave(data);
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  if (!teacher) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border-2 p-0 overflow-hidden rounded-2xl bg-background">
        <DialogHeader className="px-6 py-5 bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-foreground/10 rounded-lg">
              <UserCog className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase text-white">
                Update Service Status
              </DialogTitle>
              <DialogDescription className="text-sm text-primary-foreground/80 mt-1 font-bold">
                {formatTeacherName(teacher)} &middot; ID: {teacher.employeeId || "N/A"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-5">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase">
                      Service Status
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}>
                        <SelectTrigger className="h-11 font-bold uppercase text-xs">
                          <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_STATUS_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className="font-bold text-xs uppercase">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase">
                      Effective Date
                    </FormLabel>
                    <FormControl>
                      <HybridDatePicker
                        value={field.value}
                        onChange={field.onChange}
                        className="h-11 font-bold text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase">
                      Remarks / Context
                      <span className="text-foreground/50 font-bold ml-1">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Maternity Leave, Transferred to Manila..."
                        className="min-h-[80px] resize-none font-bold text-xs"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="px-6 py-4 bg-muted/20 border-t flex flex-row items-center justify-between gap-4 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
                className="font-black uppercase text-xs h-11 px-8">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="font-black uppercase text-xs h-11 px-8 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <UserCog className="mr-2 h-4 w-4" />
                    Save Status
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
