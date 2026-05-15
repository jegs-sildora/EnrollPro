import { useState } from "react";
import { format } from "date-fns";
import {
  Plus,
  School,
  Calendar,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  FileText,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { cn } from "@/shared/lib/utils";

export interface Sf10Request {
  id: number;
  requestingSchoolName: string;
  requestingSchoolDepedId: string | null;
  requestDate: string;
  status: "PENDING" | "SENT" | "CANCELLED";
  sentDate: string | null;
  notes: string | null;
}

interface Sf10TrackingProps {
  learnerId: number;
  requests: Sf10Request[];
  onRefresh: () => void;
  isAlumni?: boolean;
}

export function Sf10Tracking({
  learnerId,
  requests,
  onRefresh,
}: Sf10TrackingProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    requestingSchoolName: "",
    requestingSchoolDepedId: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/students/${learnerId}/sf10-requests`, formData);
      sileo.success({
        title: "Request Logged",
        description: "The SHS record request has been recorded.",
      });
      setShowAddDialog(false);
      setFormData({
        requestingSchoolName: "",
        requestingSchoolDepedId: "",
        notes: "",
      });
      onRefresh();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    requestId: number,
    status: "SENT" | "CANCELLED",
  ) => {
    try {
      await api.put(`/students/${learnerId}/sf10-requests/${requestId}`, {
        status,
      });
      sileo.success({
        title: "Status Updated",
        description: `Request marked as ${status.toLowerCase()}.`,
      });
      onRefresh();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const handleDelete = async (requestId: number) => {
    if (!window.confirm("Are you sure you want to delete this request record?"))
      return;
    try {
      await api.delete(`/students/${learnerId}/sf10-requests/${requestId}`);
      sileo.success({ title: "Record Deleted" });
      onRefresh();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Permanent Record (SF10) Tracking
          </h3>
          <p className="text-sm text-foreground">
            Manage requests for transcript of records from Senior High Schools.
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="gap-2">
          <Plus className="h-4 w-4" />
          Log New SHS Request
        </Button>
      </div>

      <div className="grid gap-4">
        {requests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <School className="h-8 w-8 text-foreground" />
              </div>
              <h4 className="font-bold">No requests logged yet</h4>
              <p className="text-sm text-foreground max-w-xs mt-1">
                When a Senior High School requests this learner's permanent
                records, log it here to track the release.
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((req) => (
            <Card
              key={req.id}
              className={cn(
                "overflow-hidden transition-all",
                req.status === "SENT"
                  ? "bg-emerald-50/30 border-emerald-100"
                  : "bg-white",
              )}>
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      req.status === "SENT"
                        ? "bg-emerald-100 text-emerald-700"
                        : req.status === "CANCELLED"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-amber-100 text-amber-700",
                    )}>
                    {req.status === "SENT" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : req.status === "CANCELLED" ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg">
                        {req.requestingSchoolName}
                      </h4>
                      <Badge
                        variant={
                          req.status === "SENT"
                            ? "default"
                            : req.status === "CANCELLED"
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          req.status === "SENT" ? "bg-emerald-600" : "",
                          req.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "",
                        )}>
                        {req.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Requested:{" "}
                        {format(new Date(req.requestDate), "MMM d, yyyy")}
                      </span>
                      {req.requestingSchoolDepedId && (
                        <span className="flex items-center gap-1">
                          <School className="h-3.5 w-3.5" />
                          ID: {req.requestingSchoolDepedId}
                        </span>
                      )}
                      {req.sentDate && (
                        <span className="flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Sent: {format(new Date(req.sentDate), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                    {req.notes && (
                      <p className="mt-2 text-sm italic bg-muted/30 p-2 rounded border-l-2 border-primary/20">
                        "{req.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-12 md:ml-0">
                  {req.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleUpdateStatus(req.id, "SENT")}>
                      Mark as Sent
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {req.status === "PENDING" && (
                        <DropdownMenuItem
                          onClick={() =>
                            handleUpdateStatus(req.id, "CANCELLED")
                          }>
                          Cancel Request
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(req.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Record
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New SHS Record Request</DialogTitle>
            <DialogDescription>
              Record the incoming request for this learner's Permanent Record
              (SF10).
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">Requesting School Name</Label>
              <Input
                id="schoolName"
                placeholder="e.g. Negros Occidental High School"
                required
                value={formData.requestingSchoolName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    requestingSchoolName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolId">School DepEd ID (Optional)</Label>
              <Input
                id="schoolId"
                placeholder="e.g. 302633"
                value={formData.requestingSchoolDepedId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    requestingSchoolDepedId: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Special Instructions</Label>
              <Textarea
                id="notes"
                placeholder="e.g. LIS transfer pending, requested via email"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}>
                {submitting ? "Saving..." : "Log Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
