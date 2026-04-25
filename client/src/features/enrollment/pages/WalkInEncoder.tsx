import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  RefreshCw,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  format,
  isValid,
  parse,
  isAfter,
  isBefore,
} from "date-fns";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Calendar } from "@/shared/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";

type LearnerType = "NEW_ENROLLEE" | "TRANSFEREE" | "RETURNING" | "ALS";
type AcademicStatus = "PROMOTED" | "RETAINED";
type Sex = "MALE" | "FEMALE";

interface GradeLevelOption {
  id: number;
  name: string;
}

interface ContactPersonState {
  firstName: string;
  lastName: string;
  middleName: string;
  contactNumber: string;
}

interface WalkInFormState {
  hasNoLrn: boolean;
  lrn: string;
  learnerType: LearnerType;
  gradeLevelId: string;
  academicStatus: AcademicStatus;
  firstName: string;
  lastName: string;
  middleName: string;
  extensionName: string;
  birthdate: string;
  sex: Sex | "";
  placeOfBirth: string;
  currentAddressHouseNoStreet: string;
  currentAddressSitio: string;
  currentAddressBarangay: string;
  currentAddressCityMunicipality: string;
  currentAddressProvince: string;
  mother: ContactPersonState;
  father: ContactPersonState;
  guardian: ContactPersonState;
  guardianRelationship: string;
  contactNumber: string;
  email: string;
  originSchoolName: string;
  lastSchoolId: string;
  schoolYearLastAttended: string;
  lastGradeCompleted: string;
  lastSchoolType: string;
  lastSchoolAddress: string;
  peptCertificateNumber: string;
  peptPassingDate: string;
  finalGeneralAverage: string;
  isSf9Submitted: boolean;
  isPsaBirthCertPresented: boolean;
}

const EMPTY_CONTACT: ContactPersonState = {
  firstName: "",
  lastName: "",
  middleName: "",
  contactNumber: "",
};

const INITIAL_FORM_STATE: WalkInFormState = {
  hasNoLrn: false,
  lrn: "",
  learnerType: "NEW_ENROLLEE",
  gradeLevelId: "",
  academicStatus: "PROMOTED",
  firstName: "",
  lastName: "",
  middleName: "",
  extensionName: "",
  birthdate: "",
  sex: "",
  placeOfBirth: "",
  currentAddressHouseNoStreet: "",
  currentAddressSitio: "",
  currentAddressBarangay: "",
  currentAddressCityMunicipality: "",
  currentAddressProvince: "",
  mother: { ...EMPTY_CONTACT },
  father: { ...EMPTY_CONTACT },
  guardian: { ...EMPTY_CONTACT },
  guardianRelationship: "",
  contactNumber: "",
  email: "",
  originSchoolName: "",
  lastSchoolId: "",
  schoolYearLastAttended: "",
  lastGradeCompleted: "",
  lastSchoolType: "PUBLIC",
  lastSchoolAddress: "",
  peptCertificateNumber: "",
  peptPassingDate: "",
  finalGeneralAverage: "",
  isSf9Submitted: false,
  isPsaBirthCertPresented: false,
};

const LEARNER_TYPE_OPTIONS: Array<{ value: LearnerType; label: string }> = [
  { value: "NEW_ENROLLEE", label: "NEW ENROLLEE" },
  { value: "TRANSFEREE", label: "TRANSFEREE" },
  { value: "RETURNING", label: "BALIK-ARAL" },
  { value: "ALS", label: "ALS / PEPT PASSER" },
];

function normalizeLrn(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 12);
}

function normalizeSchoolId(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 6);
}

function normalizeContactNumber(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 11);
}

function parseGradeLevelNumber(label: string): number | null {
  const match = label.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toOptionalTrimmed(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function hasContactIdentity(person: ContactPersonState): boolean {
  return Boolean(person.firstName.trim() && person.lastName.trim());
}

export default function WalkInEncoder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialLrn = useMemo(
    () => normalizeLrn(searchParams.get("lrn") ?? ""),
    [searchParams],
  );
  const initialNoLrn = useMemo(
    () => searchParams.get("noLrn") === "true",
    [searchParams],
  );

  const [formData, setFormData] = useState<WalkInFormState>(() => ({
    ...INITIAL_FORM_STATE,
    lrn: initialLrn,
    hasNoLrn: initialNoLrn && initialLrn.length === 0,
  }));
  const [gradeLevels, setGradeLevels] = useState<GradeLevelOption[]>([]);
  const [loadingGradeLevels, setLoadingGradeLevels] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [dateInput, setDateInput] = useState(() => {
    if (!formData.birthdate) return "";
    const d = new Date(formData.birthdate);
    return isValid(d) ? format(d, "MM/dd/yyyy") : "";
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (formData.birthdate) {
      const d = new Date(formData.birthdate);
      if (isValid(d)) return d;
    }
    return new Date();
  });

  const handleDateTyping = (
    value: string,
    onChange: (val: string) => void,
  ) => {
    const isDeleting = value.length < dateInput.length;
    const cleaned = value.replace(/\D/g, "").slice(0, 8);

    let masked = "";
    if (cleaned.length > 0) {
      masked = cleaned.slice(0, 2);
      if (cleaned.length > 2 || (cleaned.length === 2 && !isDeleting)) {
        masked += "/";
      }
      if (cleaned.length > 2) {
        masked += cleaned.slice(2, 4);
        if (cleaned.length > 4 || (cleaned.length === 4 && !isDeleting)) {
          masked += "/";
        }
      }
      if (cleaned.length > 4) {
        masked += cleaned.slice(4, 8);
      }
    }

    setDateInput(masked);

    if (masked.length === 10) {
      const parsedDate = parse(masked, "MM/dd/yyyy", new Date());
      if (
        isValid(parsedDate) &&
        !isAfter(parsedDate, new Date()) &&
        !isBefore(parsedDate, new Date(1900, 0, 1))
      ) {
        onChange(format(parsedDate, "yyyy-MM-dd"));
        setCalendarMonth(parsedDate);
      } else {
        onChange("");
      }
    } else {
      onChange("");
    }
  };

  useEffect(() => {
    void fetchGradeLevels();
  }, []);

  const fetchGradeLevels = async () => {
    setLoadingGradeLevels(true);
    try {
      const response = await api.get("/school-years/grade-levels");
      setGradeLevels(response.data.gradeLevels || response.data || []);
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setLoadingGradeLevels(false);
    }
  };

  const selectedGradeLevel = useMemo(
    () =>
      gradeLevels.find(
        (gradeLevel) => String(gradeLevel.id) === formData.gradeLevelId,
      ) ?? null,
    [formData.gradeLevelId, gradeLevels],
  );

  const isNoLrnAllowed = useMemo(() => {
    if (formData.learnerType === "TRANSFEREE") {
      return true;
    }

    if (formData.learnerType !== "NEW_ENROLLEE") {
      return false;
    }

    if (!selectedGradeLevel) {
      return false;
    }

    return parseGradeLevelNumber(selectedGradeLevel.name) === 7;
  }, [formData.learnerType, selectedGradeLevel]);

  const setField = <T extends keyof WalkInFormState>(
    key: T,
    value: WalkInFormState[T],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const setUpperField = <T extends keyof WalkInFormState>(
    key: T,
    value: string,
  ) => {
    setField(key, value.toUpperCase() as WalkInFormState[T]);
  };

  const setContactField = (
    bucket: "mother" | "father" | "guardian",
    key: keyof ContactPersonState,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [bucket]: {
        ...prev[bucket],
        [key]: key === "contactNumber" ? value : value.toUpperCase(),
      },
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.lastName.trim() || !formData.firstName.trim()) {
      sileo.error({
        title: "Missing Learner Name",
        description: "Last name and first name are required.",
      });
      return false;
    }

    if (!formData.birthdate || !formData.sex || !formData.gradeLevelId) {
      sileo.error({
        title: "Missing Required Learner Details",
        description: "Birthdate, sex, and grade level are required.",
      });
      return false;
    }

    if (
      !formData.currentAddressBarangay.trim() ||
      !formData.currentAddressCityMunicipality.trim() ||
      !formData.currentAddressProvince.trim()
    ) {
      sileo.error({
        title: "Missing Address Fields",
        description: "Barangay, city/municipality, and province are required.",
      });
      return false;
    }

    if (formData.hasNoLrn) {
      if (!isNoLrnAllowed) {
        sileo.error({
          title: "No-LRN Path Not Allowed",
          description:
            "Only incoming Grade 7 or transferee learners can proceed without LRN.",
        });
        return false;
      }
    } else if (!/^\d{12}$/.test(formData.lrn.trim())) {
      sileo.error({
        title: "Invalid LRN",
        description: "LRN must be exactly 12 digits.",
      });
      return false;
    }

    if (
      formData.learnerType === "TRANSFEREE" &&
      !formData.originSchoolName.trim()
    ) {
      sileo.error({
        title: "Origin School Required",
        description: "Provide origin school name for transferees.",
      });
      return false;
    }

    if (
      formData.lastSchoolId.trim() &&
      !/^\d{6}$/.test(formData.lastSchoolId.trim())
    ) {
      sileo.error({
        title: "Invalid School ID",
        description: "DepEd School ID must be exactly 6 digits.",
      });
      return false;
    }

    if (formData.learnerType === "ALS") {
      if (!formData.peptCertificateNumber.trim() || !formData.peptPassingDate) {
        sileo.error({
          title: "PEPT Details Required",
          description:
            "Certificate number and passing date are required for ALS / PEPT passers.",
        });
        return false;
      }
    }

    if (
      !hasContactIdentity(formData.mother) &&
      !hasContactIdentity(formData.father) &&
      !hasContactIdentity(formData.guardian)
    ) {
      sileo.error({
        title: "Parents/Guardian Required",
        description:
          "Provide at least one complete parent or guardian identity (first and last name).",
      });
      return false;
    }

    if (!formData.isSf9Submitted || !formData.isPsaBirthCertPresented) {
      sileo.error({
        title: "Physical Requirements Required",
        description:
          "Confirm both SF9 and PSA Birth Certificate before routing to sectioning.",
      });
      return false;
    }

    const finalAverage = Number.parseFloat(formData.finalGeneralAverage);
    if (Number.isNaN(finalAverage) || finalAverage < 0 || finalAverage > 100) {
      sileo.error({
        title: "Invalid Final General Average",
        description: "Enter a valid SF9 final average between 0 and 100.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const finalGeneralAverage = Number.parseFloat(formData.finalGeneralAverage);

    const payload = {
      lrn: formData.hasNoLrn ? null : formData.lrn.trim(),
      hasNoLrn: formData.hasNoLrn,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      middleName: toOptionalTrimmed(formData.middleName),
      extensionName: toOptionalTrimmed(formData.extensionName),
      birthdate: formData.birthdate,
      sex: formData.sex,
      placeOfBirth: toOptionalTrimmed(formData.placeOfBirth),
      learnerType: formData.learnerType,
      applicantType: "REGULAR",
      gradeLevelId: Number(formData.gradeLevelId),
      academicStatus: formData.academicStatus,
      lastSchoolName: toOptionalTrimmed(formData.originSchoolName),
      lastSchoolId: toOptionalTrimmed(formData.lastSchoolId),
      schoolYearLastAttended: toOptionalTrimmed(formData.schoolYearLastAttended),
      lastGradeCompleted: toOptionalTrimmed(formData.lastGradeCompleted),
      lastSchoolType: formData.lastSchoolType,
      lastSchoolAddress: toOptionalTrimmed(formData.lastSchoolAddress),
      originSchoolName: toOptionalTrimmed(formData.originSchoolName),
      peptCertificateNumber: toOptionalTrimmed(formData.peptCertificateNumber),
      peptPassingDate: formData.peptPassingDate || undefined,
      generalAverage: finalGeneralAverage,
      contactNumber: toOptionalTrimmed(formData.contactNumber),
      email: toOptionalTrimmed(formData.email),
      currentAddress: {
        houseNoStreet: toOptionalTrimmed(formData.currentAddressHouseNoStreet),
        sitio: toOptionalTrimmed(formData.currentAddressSitio),
        barangay: formData.currentAddressBarangay.trim(),
        cityMunicipality: formData.currentAddressCityMunicipality.trim(),
        province: formData.currentAddressProvince.trim(),
      },
      mother: hasContactIdentity(formData.mother)
        ? {
            firstName: formData.mother.firstName.trim(),
            lastName: formData.mother.lastName.trim(),
            middleName: toOptionalTrimmed(formData.mother.middleName),
            contactNumber: toOptionalTrimmed(formData.mother.contactNumber),
          }
        : undefined,
      father: hasContactIdentity(formData.father)
        ? {
            firstName: formData.father.firstName.trim(),
            lastName: formData.father.lastName.trim(),
            middleName: toOptionalTrimmed(formData.father.middleName),
            contactNumber: toOptionalTrimmed(formData.father.contactNumber),
          }
        : undefined,
      guardian: hasContactIdentity(formData.guardian)
        ? {
            firstName: formData.guardian.firstName.trim(),
            lastName: formData.guardian.lastName.trim(),
            middleName: toOptionalTrimmed(formData.guardian.middleName),
            contactNumber: toOptionalTrimmed(formData.guardian.contactNumber),
          }
        : undefined,
      guardianRelationship: toOptionalTrimmed(formData.guardianRelationship),
      checklist: {
        isSf9Submitted: formData.isSf9Submitted,
        isPsaBirthCertPresented: formData.isPsaBirthCertPresented,
        isOriginalPsaBcCollected: formData.isPsaBirthCertPresented,
        academicStatus: formData.academicStatus,
        finalGeneralAverage,
      },
    };

    setSubmitting(true);
    try {
      const response = await api.post(
        "/applications/special-enrollment",
        payload,
      );
      const trackingHint = String(
        response.data?.trackingNumber ||
          `${formData.lastName.trim()} ${formData.firstName.trim()}`,
      ).trim();

      sileo.success({
        title: "Walk-In Saved",
        description: "Learner routed to Section Assignment queue.",
      });

      navigate(
        `/monitoring/enrollment?workflow=SECTION_ASSIGNMENT&search=${encodeURIComponent(trackingHint)}`,
      );
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          className="h-9 text-xs font-bold"
          onClick={() => navigate("/monitoring/enrollment")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Enrollment
        </Button>
        <Badge variant="secondary" className="text-[11px] font-bold">
          Direct Intake: BOSY Walk-In
        </Badge>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl font-bold">
            Direct Intake: Basic Education Enrollment Form
          </CardTitle>
          <p className="text-xs font-semibold text-muted-foreground">
            Encode paper BEEF in one pass. This lane skips pending verification
            and routes directly to sectioning after document confirmation.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <section className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              1. Learner Information
            </p>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  LRN {formData.hasNoLrn ? "(No LRN)" : "*"}
                </Label>
                <Input
                  value={formData.lrn}
                  maxLength={12}
                  disabled={formData.hasNoLrn}
                  placeholder="109988776655"
                  className="h-10 font-bold"
                  onChange={(event) => {
                    setField("lrn", normalizeLrn(event.target.value));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Learner Type *
                </Label>
                <Select
                  value={formData.learnerType}
                  onValueChange={(value) => {
                    setField("learnerType", value as LearnerType);
                  }}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue placeholder="Select learner type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEARNER_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Grade Level *
                </Label>
                <Select
                  value={formData.gradeLevelId}
                  onValueChange={(value) => {
                    setField("gradeLevelId", value);
                  }}
                  disabled={loadingGradeLevels}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue
                      placeholder={
                        loadingGradeLevels
                          ? "Loading grade levels..."
                          : "Select grade"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLevels.map((gradeLevel) => (
                      <SelectItem
                        key={gradeLevel.id}
                        value={String(gradeLevel.id)}>
                        {gradeLevel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Academic Status *
                </Label>
                <Select
                  value={formData.academicStatus}
                  onValueChange={(value) => {
                    setField("academicStatus", value as AcademicStatus);
                  }}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROMOTED">Promoted</SelectItem>
                    <SelectItem value="RETAINED">Retained</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <Checkbox
                id="walkInNoLrn"
                checked={formData.hasNoLrn}
                onCheckedChange={(checked) => {
                  const nextValue = checked === true;
                  setField("hasNoLrn", nextValue);
                  if (nextValue) {
                    setField("lrn", "");
                  }
                }}
              />
              <div className="space-y-1">
                <Label htmlFor="walkInNoLrn" className="text-xs font-bold">
                  Learner has no LRN yet
                </Label>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Allowed only for incoming Grade 7 or transferee learners.
                </p>
              </div>
            </div>

            {formData.hasNoLrn && !isNoLrnAllowed && (
              <p className="text-xs font-bold text-destructive">
                No-LRN path currently not allowed for selected learner type and
                grade level.
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Last Name *
                </Label>
                <Input
                  value={formData.lastName}
                  placeholder="LAST NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("lastName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  First Name *
                </Label>
                <Input
                  value={formData.firstName}
                  placeholder="FIRST NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("firstName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Middle Name
                </Label>
                <Input
                  value={formData.middleName}
                  placeholder="MIDDLE NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("middleName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Extension Name
                </Label>
                <Input
                  value={formData.extensionName}
                  placeholder="JR / SR / III"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("extensionName", event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Birthdate *
                </Label>
                <div className="relative">
                  <Input
                    placeholder="MM/DD/YYYY"
                    maxLength={10}
                    inputMode="numeric"
                    value={dateInput}
                    onChange={(e) =>
                      handleDateTyping(e.target.value, (val) =>
                        setField("birthdate", val),
                      )
                    }
                    className={cn(
                      "h-10 font-bold pr-10",
                      !formData.birthdate && "border-amber-200/60",
                    )}
                  />
                  <Popover
                    open={isCalendarOpen}
                    onOpenChange={(open) => {
                      if (open && formData.birthdate) {
                        const d = new Date(formData.birthdate);
                        if (isValid(d)) setCalendarMonth(d);
                      }
                      setIsCalendarOpen(open);
                    }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full w-9 hover:bg-transparent">
                        <CalendarIcon
                          className={cn(
                            "h-4 w-4 transition-colors",
                            isCalendarOpen
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        selected={
                          formData.birthdate
                            ? new Date(formData.birthdate)
                            : undefined
                        }
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        onSelect={(date) => {
                          if (date) {
                            const formatted = format(date, "yyyy-MM-dd");
                            setField("birthdate", formatted);
                            setDateInput(format(date, "MM/dd/yyyy"));
                            setCalendarMonth(date);
                            setIsCalendarOpen(false);
                          }
                        }}
                        disabled={(date) =>
                          date > new Date() || date < new Date(1950, 0, 1)
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Sex *
                </Label>
                <Select
                  value={formData.sex}
                  onValueChange={(value) => {
                    setField("sex", value as Sex);
                  }}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Place of Birth
                </Label>
                <Input
                  value={formData.placeOfBirth}
                  placeholder="CITY / MUNICIPALITY"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("placeOfBirth", event.target.value);
                  }}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-border p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              2. Previous School Information
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Name of Last School Attended *
                </Label>
                <Input
                  value={formData.originSchoolName}
                  placeholder="SCHOOL NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("originSchoolName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  DepEd School ID
                </Label>
                <Input
                  value={formData.lastSchoolId}
                  placeholder="6-DIGIT ID"
                  maxLength={6}
                  inputMode="numeric"
                  className="h-10 font-bold"
                  onChange={(event) => {
                    setField("lastSchoolId", normalizeSchoolId(event.target.value));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  School Year Last Attended *
                </Label>
                <Select
                  value={formData.schoolYearLastAttended}
                  onValueChange={(value) => {
                    setField("schoolYearLastAttended", value);
                  }}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      const label = `${year - 1}-${year}`;
                      return (
                        <SelectItem key={label} value={label}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Last Grade Level Completed *
                </Label>
                <Select
                  value={formData.lastGradeCompleted}
                  onValueChange={(value) => {
                    setField("lastGradeCompleted", value);
                  }}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue placeholder="SELECT GRADE" />
                  </SelectTrigger>
                  <SelectContent>
                    {["6", "7", "8", "9"].map((g) => (
                      <SelectItem key={g} value={g}>
                        GRADE {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Type of Last School *
                </Label>
                <Select
                  value={formData.lastSchoolType}
                  onValueChange={(value) => {
                    setField("lastSchoolType", value);
                  }}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                    <SelectItem value="PRIVATE">PRIVATE</SelectItem>
                    <SelectItem value="INTERNATIONAL">INTERNATIONAL</SelectItem>
                    <SelectItem value="ALS">ALS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider">
                School Address / Division (Optional)
              </Label>
              <Input
                value={formData.lastSchoolAddress}
                placeholder="SCHOOL ADDRESS / DIVISION"
                className="h-10 font-bold uppercase"
                onChange={(event) => {
                  setUpperField("lastSchoolAddress", event.target.value);
                }}
              />
            </div>

            {formData.learnerType === "ALS" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    PEPT Certificate Number *
                  </Label>
                  <Input
                    value={formData.peptCertificateNumber}
                    placeholder="CERTIFICATE NUMBER"
                    className="h-10 font-bold uppercase"
                    onChange={(event) => {
                      setUpperField(
                        "peptCertificateNumber",
                        event.target.value,
                      );
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    PEPT Passing Date *
                  </Label>
                  <Input
                    type="date"
                    value={formData.peptPassingDate}
                    className="h-10 font-bold"
                    onChange={(event) => {
                      setField("peptPassingDate", event.target.value);
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              3. Address
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  House No. / Street
                </Label>
                <Input
                  value={formData.currentAddressHouseNoStreet}
                  placeholder="HOUSE / STREET"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField(
                      "currentAddressHouseNoStreet",
                      event.target.value,
                    );
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Sitio / Purok
                </Label>
                <Input
                  value={formData.currentAddressSitio}
                  placeholder="SITIO / PUROK"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("currentAddressSitio", event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Barangay *
                </Label>
                <Input
                  value={formData.currentAddressBarangay}
                  placeholder="BARANGAY"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("currentAddressBarangay", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  City / Municipality *
                </Label>
                <Input
                  value={formData.currentAddressCityMunicipality}
                  placeholder="CITY / MUNICIPALITY"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField(
                      "currentAddressCityMunicipality",
                      event.target.value,
                    );
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Province *
                </Label>
                <Input
                  value={formData.currentAddressProvince}
                  placeholder="PROVINCE"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("currentAddressProvince", event.target.value);
                  }}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              4. Parents / Guardian Information
            </p>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Mother - First Name
                </Label>
                <Input
                  value={formData.mother.firstName}
                  placeholder="FIRST NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setContactField("mother", "firstName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Mother - Last Name
                </Label>
                <Input
                  value={formData.mother.lastName}
                  placeholder="LAST NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setContactField("mother", "lastName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Mother - Middle Name
                </Label>
                <Input
                  value={formData.mother.middleName}
                  placeholder="MIDDLE NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setContactField("mother", "middleName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Mother - Contact No.
                </Label>
                <Input
                  value={formData.mother.contactNumber}
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                  inputMode="numeric"
                  className="h-10 font-bold"
                  onChange={(event) => {
                    setContactField(
                      "mother",
                      "contactNumber",
                      normalizeContactNumber(event.target.value),
                    );
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {/* ... Father names ... */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Father - First Name
                </Label>
                <Input
                  value={formData.father.firstName}
                  placeholder="FIRST NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setContactField("father", "firstName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Father - Last Name
                </Label>
                <Input
                  value={formData.father.lastName}
                  placeholder="LAST NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setContactField("father", "lastName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Father - Middle Name
                </Label>
                <Input
                  value={formData.father.middleName}
                  placeholder="MIDDLE NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setContactField("father", "middleName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Father - Contact No.
                </Label>
                <Input
                  value={formData.father.contactNumber}
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                  inputMode="numeric"
                  className="h-10 font-bold"
                  onChange={(event) => {
                    setContactField(
                      "father",
                      "contactNumber",
                      normalizeContactNumber(event.target.value),
                    );
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {/* ... Guardian names ... */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Guardian - First Name
                </Label>
                <Input
                  value={formData.guardian.firstName}
                  placeholder="FIRST NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setContactField(
                      "guardian",
                      "firstName",
                      event.target.value,
                    );
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Guardian - Last Name
                </Label>
                <Input
                  value={formData.guardian.lastName}
                  placeholder="LAST NAME"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setContactField("guardian", "lastName", event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Guardian - Contact No.
                </Label>
                <Input
                  value={formData.guardian.contactNumber}
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                  inputMode="numeric"
                  className="h-10 font-bold"
                  onChange={(event) => {
                    setContactField(
                      "guardian",
                      "contactNumber",
                      normalizeContactNumber(event.target.value),
                    );
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Guardian Relationship
                </Label>
                <Input
                  value={formData.guardianRelationship}
                  placeholder="AUNT / UNCLE / SIBLING"
                  className="h-10 font-bold uppercase"
                  onChange={(event) => {
                    setUpperField("guardianRelationship", event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Primary Contact Number
                </Label>
                <Input
                  value={formData.contactNumber}
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                  inputMode="numeric"
                  className="h-10 font-bold"
                  onChange={(event) => {
                    setField("contactNumber", normalizeContactNumber(event.target.value));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Email Address
                </Label>
                <Input
                  value={formData.email}
                  placeholder="guardian@email.com"
                  className="h-10 font-bold"
                  onChange={(event) => {
                    setField("email", event.target.value);
                  }}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              5. Physical Requirements Submitted
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Final General Average (SF9) *
                </Label>
                <Input
                  value={formData.finalGeneralAverage}
                  placeholder="88.50"
                  className="h-10 font-bold"
                  inputMode="decimal"
                  onChange={(event) => {
                    const val = event.target.value;
                    // Allow only digits and at most one decimal point with 2 places
                    if (val === "" || /^(\d+)?(\.\d{0,2})?$/.test(val)) {
                      const num = val === "" ? null : parseFloat(val);
                      if (num === null || (!isNaN(num) && num <= 100)) {
                        setField("finalGeneralAverage", val);
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <Checkbox
                  id="isSf9Submitted"
                  checked={formData.isSf9Submitted}
                  onCheckedChange={(checked) => {
                    setField("isSf9Submitted", checked === true);
                  }}
                />
                <Label
                  htmlFor="isSf9Submitted"
                  className="text-xs font-bold tracking-wide">
                  Original SF9 (Report Card)
                </Label>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <Checkbox
                  id="isPsaBirthCertPresented"
                  checked={formData.isPsaBirthCertPresented}
                  onCheckedChange={(checked) => {
                    setField("isPsaBirthCertPresented", checked === true);
                  }}
                />
                <Label
                  htmlFor="isPsaBirthCertPresented"
                  className="text-xs font-bold tracking-wide">
                  PSA Birth Certificate
                </Label>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 text-xs font-bold"
              onClick={() => navigate("/monitoring/enrollment")}
              disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 px-6 text-xs font-bold"
              disabled={submitting}
              onClick={() => {
                void handleSubmit();
              }}>
              {submitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Route to Sectioning"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
