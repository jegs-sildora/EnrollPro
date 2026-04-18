import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";

interface SpecialEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialType?: string;
}

export function SpecialEnrollmentDialog({
  open,
  onOpenChange,
  onSuccess,
  initialType = "TRANSFEREE",
}: SpecialEnrollmentDialogProps) {
  const { activeSchoolYearId } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<{ id: number; name: string }[]>([]);

  const [formData, setFormData] = useState({
    lrn: "",
    firstName: "",
    lastName: "",
    middleName: "",
    extensionName: "",
    birthdate: "",
    sex: "",
    learnerType: initialType,
    applicantType: "REGULAR",
    gradeLevelId: "",
    academicStatus: "PROMOTED",
    originSchoolName: "",
    peptCertificateNumber: "",
    peptPassingDate: "",
  });

  useEffect(() => {
    if (open) {
      void fetchGradeLevels();
      setFormData((prev) => ({
        ...prev,
        learnerType: initialType,
      }));
    }
  }, [open, initialType]);

  const fetchGradeLevels = async () => {
    try {
      const res = await api.get("/school-year/grade-levels");
      setGradeLevels(res.data.gradeLevels || res.data || []);
    } catch (err) {
      console.error("Failed to fetch grade levels", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.birthdate || !formData.sex || !formData.gradeLevelId) {
      sileo.error({
        title: "Required Fields",
        description: "Please fill in all required fields.",
      });
      return;
    }

    if (formData.learnerType === "TRANSFEREE" && !formData.originSchoolName) {
      sileo.error({
        title: "Origin School Required",
        description: "Please provide the name of the school student is transferring from.",
      });
      return;
    }

    if (formData.learnerType === "PEPT_PASSER" && (!formData.peptCertificateNumber || !formData.peptPassingDate)) {
      sileo.error({
        title: "PEPT Details Required",
        description: "Please provide the PEPT Certificate Number and Passing Date.",
      });
      return;
    }

    setLoading(true);
    try {
      await api.post("/applications/special-enrollment", formData);
      sileo.success({
        title: "Success",
        description: "Special enrollment created successfully. Student is now in the verification queue.",
      });
      onSuccess();
      onOpenChange(false);
      // Reset form
      setFormData({
        lrn: "",
        firstName: "",
        lastName: "",
        middleName: "",
        extensionName: "",
        birthdate: "",
        sex: "",
        learnerType: "TRANSFEREE",
        applicantType: "REGULAR",
        gradeLevelId: "",
        academicStatus: "PROMOTED",
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Walk-in / Special Enrollment
          </DialogTitle>
          <DialogDescription>
            Directly inject Transferees or PEPT Passers into the official verification queue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lrn" className="text-xs font-bold uppercase">LRN (12 Digits - Optional)</Label>
              <Input
                id="lrn"
                placeholder="Enter LRN"
                value={formData.lrn}
                onChange={(e) => setFormData({ ...formData, lrn: e.target.value })}
                className="h-10 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="learnerType" className="text-xs font-bold uppercase">Enrollment Type</Label>
              <Select
                value={formData.learnerType}
                onValueChange={(val) => setFormData({ ...formData, learnerType: val })}>
                <SelectTrigger className="h-10 font-bold">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSFEREE">Transferee (from other school)</SelectItem>
                  <SelectItem value="PEPT_PASSER">ALS / PEPT Passer</SelectItem>
                  <SelectItem value="NEW_ENROLLEE">New Enrollee (Late Registration)</SelectItem>
                  <SelectItem value="RETURNING">Balik-Aral (Returning)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.learnerType === "TRANSFEREE" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label htmlFor="originSchoolName" className="text-xs font-bold uppercase">Origin School Name *</Label>
              <Input
                id="originSchoolName"
                placeholder="e.g. Manila Science High School"
                required
                value={formData.originSchoolName}
                onChange={(e) => setFormData({ ...formData, originSchoolName: e.target.value.toUpperCase() })}
                className="h-10 font-bold uppercase"
              />
            </div>
          )}

          {formData.learnerType === "PEPT_PASSER" && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <Label htmlFor="peptCertificateNumber" className="text-xs font-bold uppercase">PEPT Cert No. *</Label>
                <Input
                  id="peptCertificateNumber"
                  placeholder="Cert Number"
                  required
                  value={formData.peptCertificateNumber}
                  onChange={(e) => setFormData({ ...formData, peptCertificateNumber: e.target.value })}
                  className="h-10 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peptPassingDate" className="text-xs font-bold uppercase">Passing Date *</Label>
                <Input
                  id="peptPassingDate"
                  type="date"
                  required
                  value={formData.peptPassingDate}
                  onChange={(e) => setFormData({ ...formData, peptPassingDate: e.target.value })}
                  className="h-10 font-bold"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-xs font-bold uppercase">First Name *</Label>
              <Input
                id="firstName"
                placeholder="First Name"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value.toUpperCase() })}
                className="h-10 font-bold uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-xs font-bold uppercase">Last Name *</Label>
              <Input
                id="lastName"
                placeholder="Last Name"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value.toUpperCase() })}
                className="h-10 font-bold uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthdate" className="text-xs font-bold uppercase">Birthdate *</Label>
              <Input
                id="birthdate"
                type="date"
                required
                value={formData.birthdate}
                onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                className="h-10 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex" className="text-xs font-bold uppercase">Sex *</Label>
              <Select
                value={formData.sex}
                onValueChange={(val) => setFormData({ ...formData, sex: val })}>
                <SelectTrigger className="h-10 font-bold">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gradeLevel" className="text-xs font-bold uppercase">Grade to Enroll *</Label>
              <Select
                value={formData.gradeLevelId}
                onValueChange={(val) => setFormData({ ...formData, gradeLevelId: val })}>
                <SelectTrigger className="h-10 font-bold">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels.map((gl) => (
                    <SelectItem key={gl.id} value={String(gl.id)}>
                      Grade {gl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-700 italic">
              Note: This student will be created as a <strong>Regular (BEC)</strong> applicant and will appear immediately in the Pending Verification tab for document checking.
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 font-bold">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 font-bold bg-primary px-8">
              {loading ? "Creating..." : "Create Enrollment Application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
